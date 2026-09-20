import { 
  BoundingBox, 
  EstimatedPortionResult, 
  FoodDensityProfile 
} from './PortionEstimationTypes';

export class PortionEstimationEngine {
  // Baseline assumption: Standard dining plate diameter in Cameroon is ~25cm.
  // We assume the plate fills roughly 70% of the image width if framed normally.
  private static readonly REFERENCE_PLATE_CM = 25.0;
  private static readonly PIXELS_TO_CM_RATIO = 0.05; // Heuristic fallback

  // Cameroonian Food Database for Density & Units
  private static readonly FOOD_DATABASE: Record<string, FoodDensityProfile> = {
    'plantain': { density: 1.2, shapeCategory: 'CYLINDRICAL', typicalUnit: 'fingers', unitWeightMap: { '1 finger': 120, '3 fingers': 360 } },
    'rice': { density: 0.8, shapeCategory: 'MOUNDED', typicalUnit: 'plates', unitWeightMap: { 'small plate': 200, 'medium plate': 350, 'large plate': 500 } },
    'beans': { density: 0.85, shapeCategory: 'MOUNDED', typicalUnit: 'cups', unitWeightMap: { '1 cup': 200, '2 cups': 400 } },
    'garri': { density: 0.6, shapeCategory: 'MOUNDED', typicalUnit: 'bowls', unitWeightMap: { 'small bowl': 150, 'medium bowl': 250 } }, // Dry garri or soaked? Assuming soaked
    'eba': { density: 1.1, shapeCategory: 'SPHERICAL', typicalUnit: 'wraps', unitWeightMap: { 'small wrap': 200, 'large wrap': 400 } },
    'fufu': { density: 1.2, shapeCategory: 'SPHERICAL', typicalUnit: 'wraps', unitWeightMap: { 'small wrap': 250, 'large wrap': 500 } },
    'koki': { density: 0.9, shapeCategory: 'IRREGULAR', typicalUnit: 'bundles', unitWeightMap: { '1 bundle': 200 } },
    'ndolé': { density: 1.05, shapeCategory: 'FLAT_LIQUID', typicalUnit: 'tablespoons', unitWeightMap: { '2 tablespoons': 60, '1 plate': 250 } },
    'eru': { density: 0.95, shapeCategory: 'FLAT_LIQUID', typicalUnit: 'plates', unitWeightMap: { 'small plate': 200, 'medium plate': 300 } },
    'corn chaff': { density: 0.9, shapeCategory: 'MOUNDED', typicalUnit: 'plates', unitWeightMap: { 'medium plate': 350 } },
    'spaghetti': { density: 0.7, shapeCategory: 'IRREGULAR', typicalUnit: 'plates', unitWeightMap: { 'medium plate': 250 } },
    'bread': { density: 0.25, shapeCategory: 'IRREGULAR', typicalUnit: 'slices', unitWeightMap: { '1 slice': 35, 'half loaf': 150 } },
    'pap': { density: 1.0, shapeCategory: 'FLAT_LIQUID', typicalUnit: 'bowls', unitWeightMap: { 'small bowl': 250, 'large bowl': 400 } },
    'puff puff': { density: 0.4, shapeCategory: 'SPHERICAL', typicalUnit: 'pieces', unitWeightMap: { '1 piece': 30, '5 pieces': 150 } },
    'akara': { density: 0.5, shapeCategory: 'SPHERICAL', typicalUnit: 'pieces', unitWeightMap: { '1 piece': 25, '4 pieces': 100 } },
    'avocado': { density: 0.9, shapeCategory: 'IRREGULAR', typicalUnit: 'halves', unitWeightMap: { 'half': 100, 'whole': 200 } },
    'yam': { density: 1.1, shapeCategory: 'CYLINDRICAL', typicalUnit: 'slices', unitWeightMap: { '1 thick slice': 150 } },
    'macabo': { density: 1.0, shapeCategory: 'CYLINDRICAL', typicalUnit: 'tubers', unitWeightMap: { '1 medium tuber': 120 } },
    'cassava': { density: 1.1, shapeCategory: 'CYLINDRICAL', typicalUnit: 'pieces', unitWeightMap: { '1 piece': 150 } }
  };

  /**
   * Estimates the portion size of a detected food item using 2D bounding boxes
   * and shape/density heuristics.
   */
  public static estimatePortion(
    foodName: string,
    bbox: BoundingBox,
    imageWidth: number,
    imageHeight: number,
    hasReferenceObject: boolean = false
  ): EstimatedPortionResult {
    
    const normalizedName = foodName.toLowerCase();
    const profile = this.FOOD_DATABASE[normalizedName] || {
      density: 1.0,
      shapeCategory: 'IRREGULAR',
      typicalUnit: 'portions',
      unitWeightMap: { 'small portion': 150, 'medium portion': 250, 'large portion': 400 }
    };

    // Calculate Bounding Box Area
    const boxWidthPixels = bbox.xMax - bbox.xMin;
    const boxHeightPixels = bbox.yMax - bbox.yMin;
    
    // Heuristic: Estimate physical area in cm^2
    // Without depth sensing, we assume a standard distance from the plate.
    const estimatedCmPerPixel = this.PIXELS_TO_CM_RATIO;
    const physicalWidthCm = boxWidthPixels * estimatedCmPerPixel;
    const physicalHeightCm = boxHeightPixels * estimatedCmPerPixel;
    const physicalAreaCm2 = physicalWidthCm * physicalHeightCm;

    // Estimate Volume based on Shape Category
    let estimatedVolumeCm3 = 0;
    
    switch (profile.shapeCategory) {
      case 'SPHERICAL':
        // Assume sphere: V = 4/3 * pi * r^3
        const radius = (physicalWidthCm + physicalHeightCm) / 4;
        estimatedVolumeCm3 = (4/3) * Math.PI * Math.pow(radius, 3);
        break;
      case 'CYLINDRICAL':
        // Assume cylinder viewed from side: V = pi * r^2 * h
        const r = physicalWidthCm / 2;
        estimatedVolumeCm3 = Math.PI * Math.pow(r, 2) * physicalHeightCm;
        break;
      case 'MOUNDED':
        // Assume half-ellipsoid (dome)
        estimatedVolumeCm3 = (2/3) * Math.PI * (physicalWidthCm / 2) * (physicalHeightCm / 2) * (physicalWidthCm / 2);
        break;
      case 'FLAT_LIQUID':
        // Assume uniform shallow depth of ~2.5cm
        estimatedVolumeCm3 = physicalAreaCm2 * 2.5;
        break;
      case 'IRREGULAR':
      default:
        // Assume bounding box volume with 3cm depth
        estimatedVolumeCm3 = physicalAreaCm2 * 3.0;
        break;
    }

    // Apply Density to get Weight
    // W = V * D
    let calculatedWeight = Math.round(estimatedVolumeCm3 * profile.density);

    // Sanity Constraints (prevent extreme outliers)
    calculatedWeight = Math.max(10, Math.min(calculatedWeight, 1500));

    // Confidence Calculation
    // Confidence is lower if no reference object exists, or if bounding box is extremely large/small
    let confidence = hasReferenceObject ? 0.85 : 0.60;
    const imageArea = imageWidth * imageHeight;
    const boxArea = boxWidthPixels * boxHeightPixels;
    if (boxArea / imageArea > 0.8 || boxArea / imageArea < 0.05) {
      confidence -= 0.2; // Box too big (close up) or too small (far away) breaks focal assumptions
    }

    // Determine verbal portion description
    const portionDescription = this.matchToVerbalUnit(calculatedWeight, profile);

    // Error Margin
    const errorMargin = Math.round(calculatedWeight * (1 - confidence));

    return {
      estimatedWeight: calculatedWeight,
      confidence: parseFloat(confidence.toFixed(2)),
      portionDescription,
      errorMargin
    };
  }

  /**
   * Matches the calculated weight to the closest typical Cameroonian verbal unit.
   */
  private static matchToVerbalUnit(weight: number, profile: FoodDensityProfile): string {
    const units = Object.entries(profile.unitWeightMap);
    if (units.length === 0) {
      return `${weight}g portion`;
    }

    // Find closest match
    let closestUnit = units[0][0];
    let smallestDifference = Math.abs(weight - units[0][1]);

    for (let i = 1; i < units.length; i++) {
      const diff = Math.abs(weight - units[i][1]);
      if (diff < smallestDifference) {
        smallestDifference = diff;
        closestUnit = units[i][0];
      }
    }

    // If the difference is too large, it might be multiple units (e.g., 6 pieces of puff puff)
    if (profile.shapeCategory === 'SPHERICAL' && profile.typicalUnit === 'pieces') {
      const singlePieceWeight = profile.unitWeightMap['1 piece'] || 30;
      const count = Math.round(weight / singlePieceWeight);
      if (count > 0) return `${count} ${count === 1 ? 'piece' : 'pieces'}`;
    }

    if (profile.shapeCategory === 'CYLINDRICAL' && profile.typicalUnit === 'fingers') {
      const singleFingerWeight = profile.unitWeightMap['1 finger'] || 120;
      const count = Math.round(weight / singleFingerWeight);
      if (count > 0) return `${count} ${count === 1 ? 'finger' : 'fingers'}`;
    }

    return closestUnit;
  }
}
