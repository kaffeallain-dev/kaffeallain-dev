import { FoodDetectionEngine } from '../detection/FoodDetectionEngine';
import { FoodMatchingEngine } from '../matching/FoodMatchingEngine';
import { FoodIntelligenceEngine } from '../intelligence/FoodIntelligenceEngine';
import type { FoodItemTemplate } from '../../../../types';
import type { ProcessedImageResult } from '../../presentation/acquisition/CameraEngine';
import type { FoodRecognitionResult } from './FoodRecognitionPipelineTypes';

export class FoodRecognitionPipeline {
  public static async process(
    image: ProcessedImageResult,
    foods: FoodItemTemplate[],
    signal?: AbortSignal,
  ): Promise<FoodRecognitionResult> {
    const { detections, outcome } = await FoodDetectionEngine.detect({
      imageUri: image.image,
      imageWidth: image.width,
      imageHeight: image.height,
      base64Data: image.image.split(',')[1],
      signal,
    });

    const matcher = new FoodMatchingEngine(foods.map(food => ({
      id: food.id,
      name: food.name,
      aliases: food.aliases ?? [],
      searchKeywords: [...(food.aliases ?? []), food.name.toLowerCase()],
      category: food.category,
    })));
    return {
      outcome,
      image,
      items: detections.map(detection => {
        const match = matcher.matchFood(FoodIntelligenceEngine.interpret(detection));
        return { detectionId: detection.detectionId, detectedLabel: detection.foodName, match };
      }),
    };
  }
}

