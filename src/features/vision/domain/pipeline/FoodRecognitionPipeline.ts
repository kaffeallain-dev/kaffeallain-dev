import { FoodDetectionEngine } from '../detection/FoodDetectionEngine';
import { PortionEstimationEngine } from '../estimation/PortionEstimationEngine';
import { FoodMatchingEngine } from '../matching/FoodMatchingEngine';
import { ProcessedImageResult } from '../../presentation/acquisition/CameraEngine';
import { ImageQualityValidator } from '../../data/processing/ImageQualityValidator';
import { FoodIntelligenceEngine } from '../intelligence/FoodIntelligenceEngine';
import {
  FoodRecognitionConfig,
  FoodRecognitionResult,
  RecognizedItemDetails,
  ImageQualityLevel
} from './FoodRecognitionPipelineTypes';

function extractImagePayload(dataUrlOrBase64: string): { base64Data: string; mimeType: string } {
  if (!dataUrlOrBase64) {
    return { base64Data: '', mimeType: 'image/jpeg' };
  }
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(dataUrlOrBase64);
  if (match) {
    return { mimeType: match[1], base64Data: match[2] };
  }
  const commaIdx = dataUrlOrBase64.indexOf(',');
  if (commaIdx >= 0) {
    return { mimeType: 'image/jpeg', base64Data: dataUrlOrBase64.slice(commaIdx + 1) };
  }
  return { mimeType: 'image/jpeg', base64Data: dataUrlOrBase64 };
}

export class FoodRecognitionPipeline {

  /**
   * Orchestrates the entire Food Recognition AI flow:
   * 1. Detects food items in the processed image (propagating service/network errors).
   * 2. Interprets detections into structured food intelligence.
   * 3. Matches interpreted intelligence to the MboaFit Knowledge Base as suggestions.
   * 4. Estimates portions based on bounding box constraints.
   * 5. Requires explicit user confirmation on ResultsScreen before analysis or logging.
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

    // 1. Detection Engine (throws FoodDetectionServiceError on HTTP/network/format errors)
    const { base64Data, mimeType } = extractImagePayload(image.image);
    const detectionResponse = await FoodDetectionEngine.detect({
      imageUri: image.image,
      imageWidth: image.width,
      imageHeight: image.height,
      base64Data,
      mimeType
    });

    // 2. Initialize Matcher
    const matcher = new FoodMatchingEngine(config.foodIndex);
    const recognizedItems: RecognizedItemDetails[] = [];

    // Check if both rice and beans were detected as separate items on the same plate
    const hasSeparateRice = detectionResponse.detections.some(d => {
      const n = d.foodName.toLowerCase();
      return (n.includes('rice') || n.includes('riz')) && !n.includes('bean') && !n.includes('haricot');
    });
    const hasSeparateBeans = detectionResponse.detections.some(d => {
      const n = d.foodName.toLowerCase();
      return (n.includes('bean') || n.includes('haricot')) && !n.includes('rice') && !n.includes('riz');
    });
    const riceAndBeansEntry = config.foodIndex.find(f => f.id === 'cp9' || f.name.toLowerCase() === 'rice and beans');

    // 3. Process Each Detection (Intelligence, Matching & Estimation)
    for (const detection of detectionResponse.detections) {
      // A. Food Intelligence Interpretation
      const intelligence = FoodIntelligenceEngine.interpret(detection);

      // B. Match to MboaFit Database
      const match = matcher.matchFood(intelligence);

      // If rice & beans co-occur on the plate, ensure "Rice and Beans" is prominently suggested
      if (hasSeparateRice && hasSeparateBeans && riceAndBeansEntry) {
        const isRiceOrBeanItem =
          intelligence.taxonomyFamily === 'RICE' ||
          intelligence.taxonomyCategory === 'LEGUME' ||
          intelligence.normalizedName.includes('rice') ||
          intelligence.normalizedName.includes('bean') ||
          intelligence.normalizedName.includes('haricot');

        if (isRiceOrBeanItem) {
          const alreadyPrimary = match.foodKnowledgeId === riceAndBeansEntry.id;
          const alreadySuggested = match.fallbackSuggestions.some(s => s.foodKnowledgeId === riceAndBeansEntry.id);
          if (!alreadyPrimary && !alreadySuggested) {
            match.fallbackSuggestions = [
              { foodKnowledgeId: riceAndBeansEntry.id, name: riceAndBeansEntry.name },
              ...match.fallbackSuggestions
            ].slice(0, 4);
            if (match.decision === 'UNKNOWN') {
              match.decision = 'NEEDS_CONFIRMATION';
            }
          }
        }
      }

      // C. Portion weight cannot be measured accurately from a single photo.
      // Keep portion explicitly unmeasured until the user confirms both food and portion.
      const portion = PortionEstimationEngine.createUnmeasuredPortion(null);

      // D. Always require explicit user confirmation of BOTH food identity and portion
      // before treating any suggestion as confirmed or calculating nutrition.
      recognizedItems.push({
        detectionId: detection.detectionId,
        detectedLabel: detection.foodName,
        detectionConfidence: detection.confidence,
        intelligence,
        match,
        estimatedPortion: portion,
        foodKnowledge: undefined,
        nutritionStatus: "needs_confirmation"
      });
    }

    // Analysis is computed in SummaryScreen strictly from user-confirmed items.
    return {
      image,
      items: recognizedItems,
      analysis: null,
      processingTimeMs: Date.now() - startTime,
      imageQuality
    };
  }
}

