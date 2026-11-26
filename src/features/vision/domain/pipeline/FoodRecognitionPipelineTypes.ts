import type { FoodItemTemplate } from '../../../../types';
import type { ProcessedImageResult } from '../../presentation/acquisition/CameraEngine';
import type { MatchResult } from '../matching/FoodMatchingTypes';
import type { ScanOutcome } from '../../../../../shared/scanResponse';

export interface RecognizedItemDetails {
  detectionId: string;
  detectedLabel: string;
  match: MatchResult;
  food?: FoodItemTemplate;
  grams?: number;
}

export interface FoodRecognitionResult {
  outcome: ScanOutcome;
  image: ProcessedImageResult;
  items: RecognizedItemDetails[];
}
