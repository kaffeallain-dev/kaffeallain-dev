import { DetectedFood, FoodDetectionRequest, FoodDetectionResponse, BoundingBox } from './DetectedFood';

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

      if (needsCloud && request.base64Data) {
        console.log("[FoodDetectionEngine] Low confidence or unknown detected. Falling back to Cloud API.");
        const cloudDetections = await this.runCloudInference(request);
        
        // Merge or replace detections. For simplicity, we replace if cloud finds something.
        if (cloudDetections.length > 0) {
          detections = cloudDetections;
          source = 'CLOUD_VISION';
        }
      }

      // 3. Estimate portion and weight for each detection
      const finalDetections = detections.map(detection => {
        // If portion/weight are already estimated accurately by a 3D/depth model, skip basic estimation
        if (detection.estimatedWeight > 0) {
          return detection;
        }

        const portionStats = this.estimatePortion(detection.boundingBox, request.imageWidth, request.imageHeight);
        return {
          ...detection,
          portion: portionStats.portion,
          estimatedWeight: portionStats.estimatedWeight
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
   * Runs cloud-based vision AI (e.g., Google Cloud Vision, Gemini Vision API, custom endpoint).
   */
  private static async runCloudInference(request: FoodDetectionRequest): Promise<DetectedFood[]> {
     if (!request.base64Data) return [];
     
     try {
       const response = await fetch("/api/detect-food", {
         method: "POST",
         headers: {
           "Content-Type": "application/json"
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
           estimatedWeight: 0, // 0 will let pipeline estimate it using fallback
           isUnknown: food.confidence < this.CONFIDENCE_THRESHOLD,
           category: food.category
         }));
       }
     } catch (e) {
       console.error("[FoodDetectionEngine] Cloud inference fetch error:", e);
     }
     
     return [];
  }

  /**
   * Estimates the serving size and weight based on bounding box relative area.
   */
  private static estimatePortion(
    bbox: BoundingBox, 
    imageWidth: number, 
    imageHeight: number
  ): { portion: 'Small' | 'Medium' | 'Large', estimatedWeight: number } {
    
    const boxWidth = bbox.xMax - bbox.xMin;
    const boxHeight = bbox.yMax - bbox.yMin;
    const boxArea = boxWidth * boxHeight;
    const imageArea = imageWidth * imageHeight;
    
    // Calculate what percentage of the image the food occupies
    const areaPercentage = boxArea / imageArea;
    
    // Very rough heuristic for portion estimation (requires refinement with depth sensor or reference objects)
    let portion: 'Small' | 'Medium' | 'Large' = 'Medium';
    let estimatedWeight = 250; // default grams

    if (areaPercentage < 0.15) {
      portion = 'Small';
      estimatedWeight = 100 + Math.floor(Math.random() * 50); // 100-150g
    } else if (areaPercentage > 0.40) {
      portion = 'Large';
      estimatedWeight = 400 + Math.floor(Math.random() * 150); // 400-550g
    } else {
      portion = 'Medium';
      estimatedWeight = 200 + Math.floor(Math.random() * 100); // 200-300g
    }

    return { portion, estimatedWeight };
  }
}
