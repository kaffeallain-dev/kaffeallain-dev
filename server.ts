import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes FIRST
  app.post("/api/detect-food", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
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
          model: "gemini-3.6-flash",
          contents: [
            {
              inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg"
              }
            },
            {
              text: `Analyze this image of a meal. Identify the main food components. Return a JSON array of foods. 
              Each food object MUST have:
              - detectedName (string) - Be specific (e.g. "rice", "groundnut soup", "plantain"). 
              - confidence (number) - Confidence score between 0.0 and 1.0.
              - estimatedAreaPercentage (number) - Estimated percentage of the plate this food occupies (0.0 to 1.0).
              - category (string) - E.g., "starch", "protein", "stew", "vegetable".
              `
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
        });
      } catch (err: any) {
        if (err?.message?.includes("503") || err?.message?.includes("UNAVAILABLE") || err?.status === 503) {
          console.warn("Retrying with gemini-flash-latest due to 503 error...");
          response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: "image/jpeg"
                }
              },
              {
                text: `Analyze this image of a meal. Identify the main food components. Return a JSON array of foods. 
                Each food object MUST have:
                - detectedName (string) - Be specific (e.g. "rice", "groundnut soup", "plantain"). 
                - confidence (number) - Confidence score between 0.0 and 1.0.
                - estimatedAreaPercentage (number) - Estimated percentage of the plate this food occupies (0.0 to 1.0).
                - category (string) - E.g., "starch", "protein", "stew", "vegetable".
                `
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
          });
        } else {
          throw err;
        }
      }

      let text = response.text;
      let json;
      try {
        json = JSON.parse(text || "{}");
      } catch (e) {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }
      
      res.json(json);
    } catch (error: any) {
      console.error("Food detection error:", error);
      res.status(500).json({ error: error.message });
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
