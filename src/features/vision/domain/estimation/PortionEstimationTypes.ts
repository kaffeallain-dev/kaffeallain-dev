export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export type PortionConfidenceLevel = 'unmeasured' | 'serving_estimate' | 'user_entered';
export type PortionPresetKey = 'small' | 'regular' | 'large' | 'custom';

export interface EstimatedPortionResult {
  /**
   * Confirmed or user-selected weight in grams.
   * Always null for raw single-photo scans — never invented from pixel-to-cm assumptions or clamped.
   */
  estimatedWeight: number | null;
  /**
   * Confidence in portion weight (strictly separate from food identity confidence).
   * Single-photo scans have 0 confidence because weight cannot be measured from a single image.
   */
  confidence: number;
  portionConfidenceLevel: PortionConfidenceLevel;
  /** Documented serving weight in grams parsed from the matched catalogue entry, or null if absent. */
  baseServingGrams: number | null;
  /** Optional user-entered reference weight (g) for 1 documented serving when the catalogue entry lacks grams. */
  referenceServingGrams?: number | null;
  /** True only after the user explicitly confirms the portion weight. */
  isConfirmed: boolean;
  /** Which documented serving estimate preset was chosen, or 'custom' for user-entered grams. */
  selectedPreset?: PortionPresetKey;
  /** Human-readable portion status (never presented as a measured fact from pixels). */
  portionDescription: string;
  errorMargin: number | null;
}

export type FoodShapeCategory =
  | 'SPHERICAL'
  | 'CYLINDRICAL'
  | 'MOUNDED'
  | 'FLAT_LIQUID'
  | 'IRREGULAR';

export interface FoodDensityProfile {
  density: number;
  shapeCategory: FoodShapeCategory;
  typicalUnit: string;
  unitWeightMap: Record<string, number>;
}
