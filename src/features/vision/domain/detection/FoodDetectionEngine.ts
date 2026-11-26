import type { FoodDetectionRequest, FoodDetectionResponse } from './DetectedFood';
import { accountRequest } from '../../../../lib/apiClient';
import { parseScanResponse } from '../../../../../shared/scanResponse';

export class FoodDetectionEngine {
  public static async detect(request: FoodDetectionRequest): Promise<FoodDetectionResponse> {
    const start = Date.now();
    const payload = await accountRequest('detect-food', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ imageBase64: request.base64Data }),
      signal: request.signal,
    });
    const result = parseScanResponse(payload);
    if (!result) throw new Error('invalid_ai_response');

    return {
      outcome: result.outcome,
      detections: result.foods.map((food, index) => ({
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
