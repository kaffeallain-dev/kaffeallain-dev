import {   MealAnalysisResult,   UserHealthProfile,
  RecognizedFoodItem 
} from '../../../recommendation/domain/integration/VisionMealIntegrationTypes';
import { FoodIndexEntry, MatchResult } from '../matching/FoodMatchingTypes';
import { ProcessedImageResult } from '../../presentation/acquisition/CameraEngine';
import { EstimatedPortionResult } from '../estimation/PortionEstimationTypes';
import { FoodKnowledge } from '../../../../nutrition/knowledge/types/FoodKnowledge';

export interface FoodRecognitionConfig {
  userProfile: UserHealthProfile;
  foodIndex: FoodIndexEntry[];
  /**
   * Repository lookup function to resolve a full FoodKnowledge 
   * object from an ID returned by the matching engine.
   */
  fetchFoodKnowledgeById: (id: string) => Promise<FoodKnowledge | null>;
}

import { FoodIntelligenceResult } from '../intelligence/FoodIntelligenceTypes';

export interface RecognizedItemDetails {
  detectionId: string;
  detectedLabel: string;
  detectionConfidence?: number;
  intelligence: FoodIntelligenceResult;
  match: MatchResult;
  estimatedPortion: EstimatedPortionResult;
  foodKnowledge?: FoodKnowledge; 
  nutritionStatus: "matched" | "needs_confirmation";
}

export type ImageQualityLevel = "HIGH" | "MEDIUM" | "LOW";

export interface FoodRecognitionResult {
  image: ProcessedImageResult;
  items: RecognizedItemDetails[];
  analysis: MealAnalysisResult | null;
  processingTimeMs: number;
  imageQuality?: ImageQualityLevel;
}
