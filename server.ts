import 'dotenv/config';
import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Verified current Gemini flash model IDs (checked 2026-10-05).
// Primary: gemini-3.5-flash — fast, multimodal, current.
// Fallback: gemini-3-flash-preview — used only if the primary returns 503.
const DETECT_FOOD_MODEL = "gemini-3.5-flash";
const DETECT_FOOD_FALLBACK_MODEL = "gemini-3-flash-preview";

// Max decoded image size accepted by /api/detect-food (~4 MB).
// Keeps Gemini costs predictable and blocks oversized uploads.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Approximate decoded byte size of a base64 string (no full decode needed). */
function estimateBase64Bytes(b64: string): number {
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

const FOOD_DETECTION_PROMPT = `Analyze this image of a meal. Identify the main food components. Return a JSON array of foods.
Each food object MUST have:
- detectedName (string) - Be specific (e.g. "rice", "groundnut soup", "plantain").
- confidence (number) - Confidence score between 0.0 and 1.0.
- estimatedAreaPercentage (number) - Estimated percentage of the plate this food occupies (0.0 to 1.0).
- category (string) - E.g., "starch", "protein", "stew", "vegetable".
`;

function buildGenerateRequest(imageBase64: string) {
  return {
    contents: [
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/jpeg"
        }
      },
      {
        text: FOOD_DETECTION_PROMPT
      }
    ],
    config: {
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
    }
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "5mb" }));

  // Throttle the paid Gemini endpoint: 10 scans/minute per IP.
  const detectFoodLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many scan requests. Please wait a minute and try again." },
  });

  // Shared-secret tripwire against anonymous quota burn. The SPA sends it as
  // the x-internal-secret header (client value: VITE_INTERNAL_API_SECRET).
  // If the server secret is not configured (local dev), the check is skipped
  // with a warning instead of breaking the dev flow.
  const internalApiSecret = process.env.INTERNAL_API_SECRET;
  if (!internalApiSecret) {
    console.warn("[server] INTERNAL_API_SECRET is not set — /api/detect-food auth check is disabled.");
  }

  // API routes FIRST
  app.post("/api/detect-food", detectFoodLimiter, async (req, res) => {
    try {
      if (internalApiSecret) {
        const provided = req.header("x-internal-secret");
        if (!provided || provided !== internalApiSecret) {
          return res.status(401).json({ error: "Unauthorized" });
        }
      }

      const { imageBase64 } = req.body;

      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "Missing imageBase64" });
      }

      if (estimateBase64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: "Image is too large. Please use a smaller photo." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[server] GEMINI_API_KEY is not configured");
        return res.status(500).json({ error: "Food detection is unavailable right now." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let response;
      try {
        response = await ai.models.generateContent({
          model: DETECT_FOOD_MODEL,
          ...buildGenerateRequest(imageBase64)
        });
      } catch (err: any) {
        if (err?.message?.includes("503") || err?.message?.includes("UNAVAILABLE") || err?.status === 503) {
          console.warn(`[server] ${DETECT_FOOD_MODEL} unavailable (503), retrying with ${DETECT_FOOD_FALLBACK_MODEL}...`);
          response = await ai.models.generateContent({
            model: DETECT_FOOD_FALLBACK_MODEL,
            ...buildGenerateRequest(imageBase64)
          });
        } else {
          throw err;
        }
      }

      let json;
      try {
        json = JSON.parse(response.text || "{}");
      } catch (e) {
        console.error("[server] Failed to parse AI response");
        return res.status(500).json({ error: "Food detection failed. Please try again." });
      }

      res.json(json);
    } catch (error: any) {
      // Log the detail server-side; never leak internals to the client.
      console.error("[server] Food detection error:", error?.message || error);
      res.status(500).json({ error: "Food detection failed. Please try again." });
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
