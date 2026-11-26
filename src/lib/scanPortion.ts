import type { RecognizedItemDetails } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { calculateScaledNutrients, parseServingGrams } from './nutritionScaling';

export function getScanReferenceAmounts(servingSizeText?: string) {
  const grams = parseServingGrams(servingSizeText);
  if (!grams) return [];
  return [
    { quantity: '½', grams: Math.round(grams / 2) },
    { quantity: '1', grams }
  ].filter((option, index, options) => option.grams > 0 && option.grams <= 5000 &&
    options.findIndex(other => other.grams === option.grams) === index);
}

export function getScanPortion(item: RecognizedItemDetails) {
  const { food, grams } = item;
  if (!food || grams === undefined || !Number.isInteger(grams) || grams < 1 || grams > 5000) return null;
  const baseGrams = parseServingGrams(food.servingSizeText);
  if (!baseGrams) return null;
  const servings = grams / baseGrams;
  return {
    grams,
    record: {
      ...calculateScaledNutrients(food, servings),
      name: food.name,
      foodId: food.id,
      servingSizeText: food.servingSizeText,
      servings,
    },
  };
}
