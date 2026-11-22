import type { FoodItemTemplate } from '../../../../types';
import type { ProcessedImageResult } from '../../presentation/acquisition/CameraEngine';
import type { MatchResult } from '../matching/FoodMatchingTypes';

export interface RecognizedItemDetails {
  detectionId: string;
  detectedLabel: string;
  match: MatchResult;
  food?: FoodItemTemplate;
  grams?: number;
}

export interface FoodRecognitionResult {
  image: ProcessedImageResult;
  items: RecognizedItemDetails[];
}
