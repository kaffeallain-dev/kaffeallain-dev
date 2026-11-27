import { RecognizedFoodItem, MealNutritionTotals } from '../../../recommendation/domain/integration/VisionMealIntegrationTypes';
import { calculateGramScaledNutrients } from '../../../../lib/nutritionScaling';

export class NutritionEngine {
  /**
   * Calculates the total nutritional values for a list of confirmed food items
   * using each food's documented serving/100g gram basis consistently.
   * Rejects invalid, zero, negative, non-finite, or missing gram-basis entries
   * instead of inventing a hardcoded 250g denominator or silently clamping quantities.
   */
  public static calculateMealTotals(items: RecognizedFoodItem[]): MealNutritionTotals {
    const totals: MealNutritionTotals = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      micronutrients: {
        potassium: 0,
        calcium: 0,
        iron: 0,
        vitaminC: 0,
        vitaminA: 0
      }
    };

    for (const item of items) {
      if (!item.foodKnowledge || !item.foodKnowledge.nutrition) continue;

      const n = item.foodKnowledge.nutrition;
      const scaled = calculateGramScaledNutrients(
        {
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbohydrates,
          fat: n.fat,
          fiber: n.fiber,
          sugar: n.sugar,
          sodium: n.sodium,
          potassium: n.potassium,
          calcium: n.calcium,
          iron: n.iron,
          vitaminC: n.vitaminC,
          vitaminA: n.vitaminA,
          servingSizeText: item.foodKnowledge.servingSizes?.medium
        },
        item.estimatedWeightGrams,
        item.referenceServingGrams
      );

      if (!scaled.valid) continue;

      totals.calories += scaled.calories;
      totals.protein += scaled.protein;
      totals.carbs += scaled.carbs;
      totals.fat += scaled.fat;
      totals.fiber += scaled.fiber;
      totals.sugar += scaled.sugar;
      totals.sodium += scaled.sodium;

      totals.micronutrients.potassium += scaled.potassium;
      totals.micronutrients.calcium += scaled.calcium;
      totals.micronutrients.iron += scaled.iron;
      totals.micronutrients.vitaminC += scaled.vitaminC;
      totals.micronutrients.vitaminA += scaled.vitaminA;
    }

    totals.calories = Math.round(totals.calories);
    totals.protein = Math.round(totals.protein * 10) / 10;
    totals.carbs = Math.round(totals.carbs * 10) / 10;
    totals.fat = Math.round(totals.fat * 10) / 10;
    totals.fiber = Math.round(totals.fiber * 10) / 10;
    totals.sugar = Math.round(totals.sugar * 10) / 10;
    totals.sodium = Math.round(totals.sodium);

    totals.micronutrients.potassium = Math.round(totals.micronutrients.potassium);
    totals.micronutrients.calcium = Math.round(totals.micronutrients.calcium);
    totals.micronutrients.iron = Math.round(totals.micronutrients.iron * 10) / 10;
    totals.micronutrients.vitaminC = Math.round(totals.micronutrients.vitaminC);
    totals.micronutrients.vitaminA = Math.round(totals.micronutrients.vitaminA);

    return totals;
  }
}
