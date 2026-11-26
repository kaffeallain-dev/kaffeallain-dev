import type { FoodItemTemplate } from '../types';

export interface CustomFoodDraft {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  servingSizeText: string;
}

/** Validate the entire form before any local or cloud write. */
export function parseCustomFoodDraft(draft: CustomFoodDraft) {
  const name = draft.name.trim();
  const servingSizeText = draft.servingSizeText.trim();
  if (!name || name.length > 200 || !servingSizeText || servingSizeText.length > 100) return null;
  if (!draft.calories.trim()) return null;
  const calories = Number(draft.calories);
  const protein = draft.protein.trim() ? Number(draft.protein) : 0;
  const carbs = draft.carbs.trim() ? Number(draft.carbs) : 0;
  const fat = draft.fat.trim() ? Number(draft.fat) : 0;
  if (!Number.isFinite(calories) || calories <= 0) return null;
  if (![protein, carbs, fat].every(value => Number.isFinite(value) && value >= 0)) return null;
  return { name, calories, protein, carbs, fat, servingSizeText };
}

/** A user-entered name or macros alone are not evidence for a health verdict. */
export function hasCatalogueGuidance(
  food: FoodItemTemplate,
  catalogue: readonly FoodItemTemplate[],
): boolean {
  if ((food as FoodItemTemplate & { isCustom?: boolean }).isCustom) return false;
  return catalogue.some(known => known.id === food.id && known.name === food.name &&
    known.servingSizeText === food.servingSizeText &&
    ['calories', 'protein', 'carbs', 'fat'].every(key =>
      known[key as keyof FoodItemTemplate] === food[key as keyof FoodItemTemplate]));
}
