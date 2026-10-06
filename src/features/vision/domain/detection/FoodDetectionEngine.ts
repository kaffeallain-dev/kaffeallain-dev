import { DetectedFood, FoodDetectionRequest, FoodDetectionResponse } from './DetectedFood';
import { PortionEstimationEngine } from '../estimation/PortionEstimationEngine';

export class FoodDetectionEngine {
  private static readonly CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Initializes the local ML models (e.g., TFLite).
   * Call this during app startup.
   */
  public static async initializeModel(): Promise<void> {
    // Load local TFLite model for Cameroonian foods, fruits, vegetables, drinks, mixed plates
    console.log("[FoodDetectionEngine] Loading local TFLite model...");
    // Mock initialization delay
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("[FoodDetectionEngine] Local model loaded.");
  }

  /**
   * Detects foods in the provided image using a cascading approach:
   * 1. Try local TFLite model.
   * 2. If confidence is too low or items are unknown, fallback to Cloud Vision API.
   *
   * Portion estimation always goes through PortionEstimationEngine
   * (density-table based, deterministic) — the single portion estimator used
   * everywhere in the pipeline.
   */
  public static async detect(request: FoodDetectionRequest): Promise<FoodDetectionResponse> {
    const startTime = Date.now();

    try {
      // 1. Run local inference (currently a stub returning [] until a TFLite
      //    model is bundled — see TODO in runLocalInference).
      let detections = await this.runLocalInference(request);
      let source: 'LOCAL_TFLITE' | 'CLOUD_VISION' = 'LOCAL_TFLITE';

      // 2. Check if we need cloud fallback
      const needsCloud = detections.length === 0 ||
                         detections.some(d => d.confidence < this.CONFIDENCE_THRESHOLD || d.isUnknown);

      if (needsCloud && request.base64Data) {
        console.log("[FoodDetectionEngine] Low confidence or unknown detected. Falling back to Cloud API.");
        const cloudDetections = await this.runCloudInference(request);

        // Merge or replace detections. For simplicity, we replace if cloud finds something.
        if (cloudDetections.length > 0) {
          detections = cloudDetections;
          source = 'CLOUD_VISION';
        }
      }

      // 3. Estimate portion and weight for each detection with the single
      //    deterministic estimator (no random values).
      const finalDetections = detections.map(detection => {
        // If portion/weight are already estimated accurately by a 3D/depth model, skip basic estimation
        if (detection.estimatedWeight > 0) {
          return detection;
        }

        const portion = PortionEstimationEngine.estimatePortion(
          detection.foodName,
          detection.boundingBox,
          request.imageWidth,
          request.imageHeight,
          false // no reference object available at the detection stage
        );

        const portionLabel: DetectedFood['portion'] =
          portion.estimatedWeight < 200 ? 'Small'
          : portion.estimatedWeight > 400 ? 'Large'
          : 'Medium';

        return {
          ...detection,
          portion: portionLabel,
          estimatedWeight: portion.estimatedWeight
        };
      });

      const processingTimeMs = Date.now() - startTime;

      return {
        detections: finalDetections,
        processingTimeMs,
        source
      };

    } catch (error) {
      console.error("[FoodDetectionEngine] Detection failed:", error);
      throw new Error("Failed to process image for food detection.");
    }
  }

  /**
   * Runs the on-device TFLite model for object detection.
   */
  private static async runLocalInference(request: FoodDetectionRequest): Promise<DetectedFood[]> {
    // TODO: Implement actual TFLite inference here using 'react-native-fast-tflite' or similar
    // Native bindings would process the tensor data and return boxes + classes

    // Mock implementation for architecture demonstration
    return [
       // {
       //   detectionId: 'local-123',
       //   foodName: 'ndole',
       //   confidence: 0.85,
       //   boundingBox: { xMin: 10, yMin: 10, xMax: 200, yMax: 200 },
       //   portion: 'Medium',
       //   estimatedWeight: 0,
       //   isUnknown: false
       // }
    ];
  }

  /**
   * Runs cloud-based vision AI (MboaFit server -> Gemini).
   * Sends the shared-secret header when the client build provides one
   * (VITE_INTERNAL_API_SECRET); the server skips the check when it has no
   * secret configured (local dev).
   */
  private static async runCloudInference(request: FoodDetectionRequest): Promise<DetectedFood[]> {
     if (!request.base64Data) return [];

     try {
       const internalSecret = (import.meta as any).env?.VITE_INTERNAL_API_SECRET as string | undefined;

       const response = await fetch("/api/detect-food", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           ...(internalSecret ? { "x-internal-secret": internalSecret } : {})
         },
         body: JSON.stringify({ imageBase64: request.base64Data })
       });

       if (!response.ok) {
         console.error("[FoodDetectionEngine] Cloud inference failed:", await response.text());
         return [];
       }

       const result = await response.json();
       if (result.foods && Array.isArray(result.foods)) {
         return result.foods.map((food: any, idx: number) => ({
           detectionId: `cloud-${idx}`,
           foodName: food.detectedName,
           confidence: food.confidence,
           boundingBox: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 }, // Mock bounding box since AI doesn't provide it easily
           portion: "Medium",
           estimatedWeight: 0, // 0 will let the estimator above fill it in deterministically
           isUnknown: food.confidence < this.CONFIDENCE_THRESHOLD,
           category: food.category
         }));
       }
     } catch (e) {
       console.error("[FoodDetectionEngine] Cloud inference fetch error:", e);
     }

     return [];
  }
}
