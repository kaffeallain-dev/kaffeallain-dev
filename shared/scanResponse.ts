export type ScanOutcome = 'food' | 'non_food' | 'uncertain';

interface DetectedLabel {
  detectedName: string;
  confidence: number;
  estimatedAreaPercentage: number;
  category: string;
}

export interface ScanResponse {
  outcome: ScanOutcome;
  foods: DetectedLabel[];
}

export function parseScanResponse(input: unknown): ScanResponse | null {
  const response = input as Partial<ScanResponse> | null;
  if (!response || !Array.isArray(response.foods) || response.foods.length > 20) return null;
  const { outcome, foods } = response;
  if (outcome !== 'food' && outcome !== 'non_food' && outcome !== 'uncertain') return null;
  if ((outcome === 'food') !== (foods.length > 0)) return null;

  const parsed: DetectedLabel[] = [];
  for (const food of foods) {
    if (typeof food?.detectedName !== 'string' || !food.detectedName.trim() || food.detectedName.length > 160 ||
        !Number.isFinite(food.confidence) || food.confidence < 0 || food.confidence > 1 ||
        !Number.isFinite(food.estimatedAreaPercentage) || food.estimatedAreaPercentage < 0 || food.estimatedAreaPercentage > 1 ||
        typeof food.category !== 'string' || food.category.length > 80) return null;
    parsed.push({
      detectedName: food.detectedName.trim(),
      confidence: food.confidence,
      estimatedAreaPercentage: food.estimatedAreaPercentage,
      category: food.category,
    });
  }
  return { outcome, foods: parsed };
}
