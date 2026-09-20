export interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface EstimatedPortionResult {
  estimatedWeight: number; // in grams
  confidence: number;      // 0.0 to 1.0
  portionDescription: string; // e.g., "1 medium bowl", "3 fingers", "2 cups"
  errorMargin: number;     // +/- in grams
}

export type FoodShapeCategory = 
  | 'SPHERICAL'    // Puff Puff, Akara
  | 'CYLINDRICAL'  // Plantain, Yam, Macabo, Cassava
  | 'MOUNDED'      // Rice, Beans, Eba, Fufu, Corn Chaff
  | 'FLAT_LIQUID'  // Ndolé, Eru, Pap
  | 'IRREGULAR';   // Spaghetti, Bread, Koki, Avocado

export interface FoodDensityProfile {
  density: number; // g/cm^3 (approximate)
  shapeCategory: FoodShapeCategory;
  typicalUnit: string; // "fingers", "bowls", "cups", "pieces", "plates", "tablespoons"
  unitWeightMap: Record<string, number>; // Mapping of verbal description to typical grams
}
