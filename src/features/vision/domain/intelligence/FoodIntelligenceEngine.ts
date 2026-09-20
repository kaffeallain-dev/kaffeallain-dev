import { DetectedFood } from '../detection/DetectedFood';
import { FoodTaxonomy } from './FoodTaxonomy';
import { FoodIntelligenceResult } from './FoodIntelligenceTypes';
import { FoodAliasRegistry } from '../matching/FoodAliasRegistry';

export class FoodIntelligenceEngine {
  public static interpret(detection: DetectedFood): FoodIntelligenceResult {
    const normalizedName = this.normalizeName(detection.foodName);
    const classification = FoodTaxonomy.classifyFoodName(detection.foodName, detection.category);
    
    // Confidence normalization (clamp between 0.0 and 1.0)
    let confidence = detection.confidence;
    if (confidence < 0) confidence = 0;
    if (confidence > 1) confidence = 1;
    
    // Unknown detection handling
    // If the name couldn't be meaningfully normalized or vision model flagged it as unknown
    const isUnknown = detection.isUnknown || normalizedName.length === 0;

    if (isUnknown) {
      classification.category = 'UNKNOWN';
      classification.family = undefined;
    }

    return {
      detectedName: detection.foodName,
      normalizedName,
      rawCategory: detection.category,
      taxonomyCategory: classification.category,
      taxonomyFamily: classification.family,
      isUnknown: isUnknown,
      confidence: confidence
    };
  }
  
  private static normalizeName(name: string): string {
    return FoodAliasRegistry.normalize(name);
  }
}
