import { FoodDetectionEngine } from '../detection/FoodDetectionEngine';
import { PortionEstimationEngine } from '../estimation/PortionEstimationEngine';
import { FoodMatchingEngine } from '../matching/FoodMatchingEngine';
import { VisionMealIntegrationPipeline } from '../../../recommendation/domain/integration/VisionMealIntegrationPipeline';
import { ProcessedImageResult } from '../../presentation/acquisition/CameraEngine';
import { RecognizedFoodItem } from '../../../recommendation/domain/integration/VisionMealIntegrationTypes';
import { ImageQualityValidator } from '../../data/processing/ImageQualityValidator';
import { FoodIntelligenceEngine } from '../intelligence/FoodIntelligenceEngine';
import { 
  FoodRecognitionConfig, 
  FoodRecognitionResult, 
  RecognizedItemDetails,
  ImageQualityLevel
} from './FoodRecognitionPipelineTypes';

export class FoodRecognitionPipeline {
  
  /**
   * Orchestrates the entire Food Recognition AI flow:
   * 1. Detects food items in the processed image.
   * 2. Interprets detections into structured food intelligence.
   * 3. Matches interpreted intelligence to the MboaFit Knowledge Base.
   * 4. Estimates portions based on bounding box constraints.
   * 5. Fetches full nutritional profiles.
   * 6. Runs the meal through the Recommendation Engine for AI coaching.
   */
  public static async process(
    image: ProcessedImageResult,
    config: FoodRecognitionConfig
  ): Promise<FoodRecognitionResult> {
    const startTime = Date.now();

    // 0. Image Quality Assessment
    const qualityResult = await ImageQualityValidator.analyzeImage(image.image);
    let imageQuality: ImageQualityLevel = "HIGH";
    if (qualityResult.quality < 0.4) {
      imageQuality = "LOW";
    } else if (qualityResult.quality < 0.7) {
      imageQuality = "MEDIUM";
    }

    // 1. Detection Engine
    const detectionResponse = await FoodDetectionEngine.detect({
      imageUri: image.image,
      imageWidth: image.width,
      imageHeight: image.height,
      base64Data: image.image.split(",")[1]
    });

    // 2. Initialize Matcher
    const matcher = new FoodMatchingEngine(config.foodIndex);
    const recognizedItems: RecognizedItemDetails[] = [];
    const validMealItems: RecognizedFoodItem[] = [];

    // 3. Process Each Detection (Intelligence, Matching & Estimation)
    for (const detection of detectionResponse.detections) {
      
      // A. Food Intelligence Interpretation
      const intelligence = FoodIntelligenceEngine.interpret(detection);
      
      // B. Match to MboaFit Database
      const match = matcher.matchFood(intelligence);

      // C. Estimate Portion (Volumetric/Area Heuristics)
      const portion = PortionEstimationEngine.estimatePortion(
        match.matchedName || detection.foodName,
        detection.boundingBox,
        image.width,
        image.height,
        true // Assuming reasonable framing
      );

      // D. Lookup Full Knowledge
      let knowledge: any = undefined;
      if (match.foodKnowledgeId && match.decision === 'HIGH_CONFIDENCE') {
        const fetched = await config.fetchFoodKnowledgeById(match.foodKnowledgeId);
        if (fetched) {
          knowledge = fetched;
        }
      }

      const nutritionStatus = knowledge ? "matched" : "needs_confirmation";

      recognizedItems.push({
        detectionId: detection.detectionId,
        detectedLabel: detection.foodName,
        detectionConfidence: detection.confidence,
        intelligence,
        match,
        estimatedPortion: portion,
        foodKnowledge: knowledge,
        nutritionStatus
      });

      // E. Build Valid Meal Array for Nutrition Analysis
      if (knowledge) {
        validMealItems.push({
          foodKnowledge: knowledge,
          estimatedWeightGrams: portion.estimatedWeight
        });
      }
    }

    // 4. Recommendation & Coaching Integration
    let analysis = null;
    if (validMealItems.length > 0) {
      analysis = VisionMealIntegrationPipeline.analyzeMeal(validMealItems, config.userProfile);
    }

    return {
      image,
      items: recognizedItems,
      analysis,
      processingTimeMs: Date.now() - startTime,
      imageQuality
    };
  }
}

