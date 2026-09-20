import { RecognizedFoodItem, MealNutritionTotals } from '../../../recommendation/domain/integration/VisionMealIntegrationTypes';

export class NutritionEngine {
  /**
   * Calculates the total nutritional values for a list of recognized food items.
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

      // Base weight assumption for standard serving is 250g if not specified
      // We scale the nutrition values based on estimated weight
      const scale = item.estimatedWeightGrams / 250;
      const n = item.foodKnowledge.nutrition;

      totals.calories += (n.calories || 0) * scale;
      totals.protein += (n.protein || 0) * scale;
      totals.carbs += (n.carbohydrates || 0) * scale;
      totals.fat += (n.fat || 0) * scale;
      totals.fiber += (n.fiber || 0) * scale;
      totals.sugar += (n.sugar || 0) * scale;
      totals.sodium += (n.sodium || 0) * scale;

      totals.micronutrients.potassium += (n.potassium || 0) * scale;
      totals.micronutrients.calcium += (n.calcium || 0) * scale;
      totals.micronutrients.iron += (n.iron || 0) * scale;
      totals.micronutrients.vitaminC += (n.vitaminC || 0) * scale;
      totals.micronutrients.vitaminA += (n.vitaminA || 0) * scale;
    }

    // Round everything nicely
    totals.calories = Math.round(totals.calories);
    totals.protein = Math.round(totals.protein);
    totals.carbs = Math.round(totals.carbs);
    totals.fat = Math.round(totals.fat);
    totals.fiber = Math.round(totals.fiber);
    totals.sugar = Math.round(totals.sugar);
    totals.sodium = Math.round(totals.sodium);
    
    totals.micronutrients.potassium = Math.round(totals.micronutrients.potassium);
    totals.micronutrients.calcium = Math.round(totals.micronutrients.calcium);
    totals.micronutrients.iron = Math.round(totals.micronutrients.iron * 10) / 10;
    totals.micronutrients.vitaminC = Math.round(totals.micronutrients.vitaminC);
    totals.micronutrients.vitaminA = Math.round(totals.micronutrients.vitaminA);

    return totals;
  }
}
