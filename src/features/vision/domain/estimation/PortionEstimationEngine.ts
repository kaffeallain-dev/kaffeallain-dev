import {
  BoundingBox,
  EstimatedPortionResult
} from './PortionEstimationTypes';
import {
  deriveServingPortionOptions,
  DerivedPortionOption,
  isValidPositiveGrams
} from '../../../../lib/nutritionScaling';

export class PortionEstimationEngine {
  /**
   * Creates an honest unmeasured portion state for a newly scanned food item.
   * Single photos cannot reliably determine weight in grams without a scale or
   * calibrated depth reference, so no pixel-to-cm heuristic or clamped default (e.g. 1500g)
   * is ever fabricated.
   */
  public static createUnmeasuredPortion(baseServingGrams?: number | null): EstimatedPortionResult {
    const validBase = isValidPositiveGrams(baseServingGrams) ? Math.round(baseServingGrams) : null;
    return {
      estimatedWeight: null,
      confidence: 0,
      portionConfidenceLevel: 'unmeasured',
      baseServingGrams: validBase,
      referenceServingGrams: null,
      isConfirmed: false,
      portionDescription: 'Portion weight not measured from photo',
      errorMargin: null
    };
  }

  /**
   * Retains backwards-compatible signature for callers while refusing to fabricate
   * weights from 2D pixel bounding boxes or arbitrary 1500g clamps.
   */
  public static estimatePortion(
    _foodName: string,
    _bbox?: BoundingBox,
    _imageWidth?: number,
    _imageHeight?: number,
    _hasReferenceObject: boolean = false,
    baseServingGrams?: number | null
  ): EstimatedPortionResult {
    return this.createUnmeasuredPortion(baseServingGrams);
  }

  /**
   * Derives Small (0.5x), Regular (1x), and Large (1.5x) estimate options
   * strictly from a food's documented serving weight in grams.
   * Returns an empty list if no documented gram serving weight exists.
   */
  public static getPortionEstimateOptions(baseServingGrams: number | null | undefined): DerivedPortionOption[] {
    return deriveServingPortionOptions(baseServingGrams);
  }
}
