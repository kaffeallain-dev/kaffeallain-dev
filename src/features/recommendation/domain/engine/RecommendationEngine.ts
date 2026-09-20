import { 
  RecognizedFoodItem, 
  UserHealthProfile, 
  MealNutritionTotals, 
  DailyIntakeProgress 
} from '../integration/VisionMealIntegrationTypes';

export class RecommendationEngine {
  /**
   * Calculates the overall health score of the meal (0-10).
   * It averages the health scores of individual items, weighted by their estimated portion size.
   */
  public static calculateMealHealthScore(items: RecognizedFoodItem[]): number {
    if (items.length === 0) return 0;
    
    let totalWeight = 0;
    let weightedScoreSum = 0;

    for (const item of items) {
      const weight = item.estimatedWeightGrams || 1;
      const score = item.foodKnowledge.scores?.healthScore || 5; // Default middle score
      
      weightedScoreSum += (score * weight);
      totalWeight += weight;
    }

    const avgScore = totalWeight > 0 ? (weightedScoreSum / totalWeight) : 0;
    return Math.round(avgScore * 10) / 10;
  }

  /**
   * Calculates the overall satiety score of the meal (0-10).
   * Averages individual satiety scores, weighted by portion size.
   */
  public static calculateMealSatietyScore(items: RecognizedFoodItem[]): number {
    if (items.length === 0) return 0;
    
    let totalWeight = 0;
    let weightedScoreSum = 0;

    for (const item of items) {
      const weight = item.estimatedWeightGrams || 1;
      const score = item.foodKnowledge.scores?.satietyScore || 5; 
      
      weightedScoreSum += (score * weight);
      totalWeight += weight;
    }

    const avgScore = totalWeight > 0 ? (weightedScoreSum / totalWeight) : 0;
    return Math.round(avgScore * 10) / 10;
  }

  /**
   * Compiles a list of healthier or better alternatives for the foods in the meal.
   */
  public static compileAlternatives(items: RecognizedFoodItem[]): string[] {
    const alternatives = new Set<string>();

    for (const item of items) {
      const { foodRelationships, name } = item.foodKnowledge;
      if (foodRelationships && foodRelationships.betterAlternatives) {
        foodRelationships.betterAlternatives.forEach(alt => {
          alternatives.add(`Instead of ${name}, consider ${alt}.`);
        });
      }
    }

    return Array.from(alternatives);
  }

  /**
   * Calculates the daily intake progress after consuming this meal.
   */
  public static calculateDailyProgress(
    mealTotals: MealNutritionTotals,
    profile: UserHealthProfile
  ): DailyIntakeProgress {
    
    const consumedCalories = profile.currentIntake.calories + mealTotals.calories;
    const consumedProtein = profile.currentIntake.protein + mealTotals.protein;
    const consumedCarbs = profile.currentIntake.carbs + mealTotals.carbs;
    const consumedFat = profile.currentIntake.fat + mealTotals.fat;

    const remainingCalories = Math.max(0, profile.dailyTargets.calories - consumedCalories);

    return {
      targetCalories: profile.dailyTargets.calories,
      consumedCalories,
      remainingCalories,
      
      targetProtein: profile.dailyTargets.protein,
      consumedProtein,
      
      targetCarbs: profile.dailyTargets.carbs,
      consumedCarbs,
      
      targetFat: profile.dailyTargets.fat,
      consumedFat
    };
  }
}
