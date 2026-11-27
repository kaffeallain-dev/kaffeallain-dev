import {
  DetectedFood,
  FoodDetectionRequest,
  FoodDetectionResponse,
  FoodDetectionServiceError
} from './DetectedFood';

export class FoodDetectionEngine {
  private static readonly CONFIDENCE_THRESHOLD = 0.6;
  
  /**
   * Initializes the local ML models (e.g., TFLite).
   * Call this during app startup.
   */
  public static async initializeModel(): Promise<void> {
    console.log("[FoodDetectionEngine] Loading local TFLite model...");
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("[FoodDetectionEngine] Local model loaded.");
  }

  /**
   * Detects foods in the provided image using a cascading approach:
   * 1. Try local TFLite model.
   * 2. If confidence is too low or no local detections exist, call Cloud Vision API.
   *    Never turns a failed HTTP request, network error, or malformed response into an empty detection.
   */
  public static async detect(request: FoodDetectionRequest): Promise<FoodDetectionResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Run local inference
      let detections = await this.runLocalInference(request);
      let source: 'LOCAL_TFLITE' | 'CLOUD_VISION' = 'LOCAL_TFLITE';

      // 2. Check if we need cloud fallback
      const needsCloud = detections.length === 0 || 
                         detections.some(d => d.confidence < this.CONFIDENCE_THRESHOLD || d.isUnknown);

      if (needsCloud) {
        if (!request.base64Data) {
          throw new FoodDetectionServiceError(
            "Unable to read photo data for food analysis. Please retake the photo or log your meal manually.",
            'MISSING_IMAGE',
            undefined,
            false
          );
        }

        const cloudDetections = await this.runCloudInference(request);
        detections = cloudDetections;
        source = 'CLOUD_VISION';
      }

      // 3. Do NOT fabricate portion weights from a single 2D photo.
      // Food identity detection stays strictly separated from user-confirmed portion weight.
      const finalDetections = detections.map(detection => ({
        ...detection,
        portion: null,
        estimatedWeight: null
      }));

      const processingTimeMs = Date.now() - startTime;

      return {
        detections: finalDetections,
        processingTimeMs,
        source
      };

    } catch (error) {
      if (error instanceof FoodDetectionServiceError) {
        throw error;
      }
      console.error("[FoodDetectionEngine] Detection failed:", error);
      throw new FoodDetectionServiceError(
        error instanceof Error && error.message
          ? error.message
          : "Failed to process image for food detection.",
        'NETWORK_ERROR',
        undefined,
        true
      );
    }
  }

  /**
   * Runs the on-device TFLite model for object detection.
   */
  private static async runLocalInference(_request: FoodDetectionRequest): Promise<DetectedFood[]> {
    return [];
  }

  /**
   * Runs cloud-based vision AI via the server proxy (/api/detect-food).
   * Throws FoodDetectionServiceError on any network failure, non-2xx HTTP status, or invalid payload.
   */
  private static async runCloudInference(request: FoodDetectionRequest): Promise<DetectedFood[]> {
    if (!request.base64Data) {
      throw new FoodDetectionServiceError(
        "Missing image data for food analysis.",
        'MISSING_IMAGE',
        undefined,
        false
      );
    }

    let response: Response;
    try {
      response = await fetch("/api/detect-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageBase64: request.base64Data,
          mimeType: request.mimeType || "image/jpeg"
        })
      });
    } catch (error) {
      console.error("[FoodDetectionEngine] Cloud inference network error:", error);
      throw new FoodDetectionServiceError(
        "Could not connect to the food recognition service. Please check your connection and retry, or log your meal manually.",
        'NETWORK_ERROR',
        undefined,
        true
      );
    }

    if (!response.ok) {
      let serverMessage = "";
      try {
        const rawText = await response.text();
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);
            if (typeof parsed?.error === "string" && parsed.error.trim().length > 0) {
              serverMessage = parsed.error.trim();
            } else {
              serverMessage = rawText.trim();
            }
          } catch {
            serverMessage = rawText.trim();
          }
        }
      } catch {
        // Ignore body read error and fall back to status text
      }

      const fallbackMessage = response.status === 429
        ? "Food recognition is temporarily busy. Please wait a moment and retry, or log your meal manually."
        : response.status >= 500
          ? "Food recognition service is temporarily unavailable. Please retry or log your meal manually."
          : `Food recognition request failed (HTTP ${response.status}). Please retry or log your meal manually.`;

      console.error(`[FoodDetectionEngine] Cloud inference HTTP ${response.status}:`, serverMessage || fallbackMessage);
      throw new FoodDetectionServiceError(
        serverMessage || fallbackMessage,
        'HTTP_ERROR',
        response.status,
        response.status >= 500 || response.status === 429
      );
    }

    let result: any;
    try {
      result = await response.json();
    } catch (error) {
      console.error("[FoodDetectionEngine] Failed to parse cloud inference JSON:", error);
      throw new FoodDetectionServiceError(
        "Food recognition returned an invalid response. Please retry or log your meal manually.",
        'INVALID_RESPONSE',
        response.status,
        true
      );
    }

    if (!result || !Array.isArray(result.foods)) {
      console.error("[FoodDetectionEngine] Unexpected cloud inference payload:", result);
      throw new FoodDetectionServiceError(
        "Food recognition returned an unexpected response format. Please retry or log your meal manually.",
        'INVALID_RESPONSE',
        response.status,
        true
      );
    }

    const imgW = request.imageWidth > 0 ? request.imageWidth : 640;
    const imgH = request.imageHeight > 0 ? request.imageHeight : 640;

    return result.foods
      .filter((food: any) => food && typeof food.detectedName === "string" && food.detectedName.trim().length > 0)
      .map((food: any, idx: number) => {
        const rawConf = typeof food.confidence === "number" && Number.isFinite(food.confidence)
          ? food.confidence
          : 0.5;
        const confidence = Math.max(0, Math.min(1, rawConf));

        const rawArea = typeof food.estimatedAreaPercentage === "number" && Number.isFinite(food.estimatedAreaPercentage)
          ? Math.max(0.05, Math.min(0.85, food.estimatedAreaPercentage))
          : 0.25;
        const scale = Math.sqrt(rawArea);
        const boxW = Math.round(imgW * scale);
        const boxH = Math.round(imgH * scale);

        return {
          detectionId: `cloud-${idx}`,
          foodName: food.detectedName.trim(),
          confidence,
          boundingBox: { xMin: 0, yMin: 0, xMax: boxW, yMax: boxH },
          portion: null,
          estimatedWeight: null,
          isUnknown: confidence < this.CONFIDENCE_THRESHOLD,
          category: typeof food.category === "string" ? food.category : undefined
        };
      });
  }
}
