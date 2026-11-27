import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Rate limiting map for billable Gemini vision requests
  const scanRateLimiter = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
  const MAX_REQUESTS_PER_WINDOW = 15; // 15 scans per 10 min

  function checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const timestamps = scanRateLimiter.get(clientKey) || [];
    const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    
    if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldest = validTimestamps[0];
      const retryAfterSeconds = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }
    
    validTimestamps.push(now);
    scanRateLimiter.set(clientKey, validTimestamps);
    return { allowed: true };
  }

  // API routes FIRST
  app.post("/api/detect-food", async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const authHeader = req.headers.authorization;
      const rateKey = authHeader ? authHeader.slice(0, 30) : clientIp;

      const limitCheck = checkRateLimit(rateKey);
      if (!limitCheck.allowed) {
        res.setHeader('Retry-After', limitCheck.retryAfterSeconds?.toString() || '60');
        return res.status(429).json({
          error: "Scan rate limit reached (max 15 scans per 10 min). Please wait a moment or log your meal manually.",
          code: "RATE_LIMITED",
          retryable: true
        });
      }

      const { imageBase64, mimeType } = req.body;

      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({
          error: "Missing image data for food analysis.",
          code: "MISSING_IMAGE",
          retryable: false
        });
      }

      const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      const safeMimeType = typeof mimeType === "string" && allowedMimeTypes.has(mimeType)
        ? mimeType
        : "image/jpeg";

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "Food recognition service is not configured on the server. Please log your meal manually.",
          code: "SERVICE_UNCONFIGURED",
          retryable: false
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const promptText = `Analyze this image carefully to identify clearly visible food items on a plate, bowl, or table.
Rules:
- Identify visible everyday and West/Central African or Cameroonian foods accurately (for example: "rice and beans", "rice", "beans", "plantain", "groundnut soup", "ndolé", "eru", "koki beans", "rice and stew", "jollof rice", "fried rice", "puff puff", "grilled fish", "chicken").
- If a plate clearly shows rice served together with beans, you may identify it as "rice and beans" (or list "rice" and "beans" if served as clearly separate portions).
- Do NOT guess or invent foods that are not clearly visible.
- If no food is visible in the image (for example, an object, person, empty surface, or completely unrecognizable blur), return an empty array: { "foods": [] }.

Return JSON matching the schema. Each food object MUST have:
- detectedName (string): specific common food name.
- confidence (number): confidence score between 0.0 and 1.0.
- estimatedAreaPercentage (number): estimated fraction of the plate/image area this food occupies (0.0 to 1.0).
- category (string): e.g., "starch", "protein", "stew", "soup", "legume", "vegetable", "snack", "mixed_meal".`;

      const requestContents = {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: safeMimeType
            }
          },
          {
            text: promptText
          }
        ]
      };

      const requestConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            foods: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  detectedName: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  estimatedAreaPercentage: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                },
                required: ["detectedName", "confidence", "estimatedAreaPercentage", "category"]
              }
            }
          },
          required: ["foods"]
        }
      };

      const isTransientUnavailable = (err: any) => {
        const msg = String(err?.message || "");
        const status = err?.status ?? err?.statusCode;
        return status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded");
      };

      const callModelWithRetry = async (model: string, maxAttempts: number) => {
        let lastErr: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await ai.models.generateContent({
              model,
              contents: requestContents,
              config: requestConfig
            });
          } catch (err: any) {
            lastErr = err;
            if (!isTransientUnavailable(err) || attempt === maxAttempts) {
              throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 400 * attempt));
          }
        }
        throw lastErr;
      };

      let response;
      try {
        response = await callModelWithRetry("gemini-4-hydrogen", 2);
      } catch (err: any) {
        if (isTransientUnavailable(err)) {
          response = await callModelWithRetry("gemini-3.1-flash-lite", 1);
        } else {
          throw err;
        }
      }

      const text = response.text;
      let json: any;
      try {
        json = JSON.parse(text || "");
      } catch {
        return res.status(502).json({
          error: "Food recognition returned an unreadable response. Please retry or log your meal manually.",
          code: "INVALID_AI_RESPONSE",
          retryable: true
        });
      }

      if (!json || !Array.isArray(json.foods)) {
        return res.status(502).json({
          error: "Food recognition returned an unexpected format. Please retry or log your meal manually.",
          code: "INVALID_AI_RESPONSE",
          retryable: true
        });
      }

      return res.json({ foods: json.foods });
    } catch (error: any) {
      console.error("Food detection error:", error);
      const status = error?.status ?? error?.statusCode;
      const msg = String(error?.message || "Food recognition service error.");
      if (status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({
          error: "Food recognition is temporarily busy. Please try again shortly or log your meal manually.",
          code: "QUOTA_EXCEEDED",
          retryable: true
        });
      }
      if (status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE")) {
        return res.status(503).json({
          error: "Food recognition service is temporarily unavailable. Please retry or log your meal manually.",
          code: "SERVICE_UNAVAILABLE",
          retryable: true
        });
      }
      return res.status(500).json({
        error: "Unable to analyze this photo right now. Please retry or log your meal manually.",
        code: "DETECTION_FAILED",
        retryable: true
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
