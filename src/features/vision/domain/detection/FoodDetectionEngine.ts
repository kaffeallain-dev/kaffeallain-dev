import type { FoodDetectionRequest, FoodDetectionResponse } from './DetectedFood';
import { accountRequest } from '../../../../lib/apiClient';

interface FoodDetection {
  detectedName: string;
  confidence: number;
  category: string;
}

export class FoodDetectionEngine {
  public static async detect(request: FoodDetectionRequest): Promise<FoodDetectionResponse> {
    const start = Date.now();
    const result = await accountRequest('detect-food', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ imageBase64: request.base64Data }),
      signal: request.signal,
    });
    if (!Array.isArray(result.foods)) throw new Error('invalid_ai_response');

    return {
      detections: result.foods.map((food: FoodDetection, index: number) => ({
        detectionId: `cloud-${index}`,
        foodName: food.detectedName,
        confidence: food.confidence,
        portion: 'Medium',
        estimatedWeight: 0,
        isUnknown: food.confidence < 0.6,
        category: food.category,
      })),
      processingTimeMs: Date.now() - start,
      source: 'CLOUD_VISION',
    };
  }
}
