import { 
  RecognizedFoodItem, 
  UserHealthProfile, 
  MealAnalysisResult 
} from './VisionMealIntegrationTypes';

import { NutritionEngine } from '../../../nutrition/domain/engine/NutritionEngine';
import { RecommendationEngine } from '../engine/RecommendationEngine';
import { FoodConditionAI } from '../coach/FoodConditionAI';
import { AiCoachEngine } from '../coach/AiCoachEngine';
import { GoalCompatibilityRating } from '../../../../nutrition/knowledge/types/FoodKnowledge';

export class VisionMealIntegrationPipeline {
  /**
   * Main entry point to process a detected meal and generate a comprehensive analysis.
   */
  public static analyzeMeal(
    items: RecognizedFoodItem[],
    userProfile: UserHealthProfile
  ): MealAnalysisResult {
    
    // 1. Calculate Nutrition Totals
    const totals = NutritionEngine.calculateMealTotals(items);

    // 2. Calculate Scores
    const healthScore = RecommendationEngine.calculateMealHealthScore(items);
    const satietyScore = RecommendationEngine.calculateMealSatietyScore(items);

    // 3. Compile Goal Compatibility
    const goalCompatibility = this.compileGoalCompatibility(items, userProfile.primaryGoal);

    // 4. Generate Alternatives and Warnings
    const alternatives = RecommendationEngine.compileAlternatives(items);
    const warnings = FoodConditionAI.generateWarnings(items, userProfile);

    // 5. Calculate Daily Progress
    const dailyIntakeProgress = RecommendationEngine.calculateDailyProgress(totals, userProfile);

    // 6. Generate AI Coaching Tips
    const coachingTips = AiCoachEngine.selectCoachingTips(items, userProfile, 3);

    return {
      totals,
      healthScore,
      satietyScore,
      goalCompatibility,
      alternatives,
      warnings,
      dailyIntakeProgress,
      coachingTips
    };
  }

  /**
   * Aggregates the goal compatibility ratings across all items in the meal for the user's primary goal.
   * If items have conflicting ratings (e.g. one is 'Excellent', one is 'Poor'), we take a conservative approach.
   */
  private static compileGoalCompatibility(
    items: RecognizedFoodItem[], 
    primaryGoal: string
  ): Record<string, GoalCompatibilityRating> {
    
    // Default fallback if we can't determine compatibility
    const aggregated: Record<string, GoalCompatibilityRating> = {
      [primaryGoal]: { level: 'Moderate', reason: 'Mixed meal compatibility.' }
    };

    if (items.length === 0) return aggregated;

    let lowestLevelScore = 4; // 4 = Excellent, 1 = Poor
    const reasons: string[] = [];

    const levelMap: Record<string, number> = {
      'Excellent': 4,
      'Good': 3,
      'Moderate': 2,
      'Poor': 1
    };

    const reverseLevelMap: Record<number, 'Excellent' | 'Good' | 'Moderate' | 'Poor'> = {
      4: 'Excellent',
      3: 'Good',
      2: 'Moderate',
      1: 'Poor'
    };

    for (const item of items) {
      const compatObj = (item.foodKnowledge.goalCompatibility as any)[primaryGoal];
      if (compatObj) {
        const score = levelMap[compatObj.level] || 2;
        if (score < lowestLevelScore) {
          lowestLevelScore = score;
        }
        reasons.push(`${item.foodKnowledge.name}: ${compatObj.reason}`);
      }
    }

    // We take the lowest level as the limiting factor for the meal's compatibility
    aggregated[primaryGoal] = {
      level: reverseLevelMap[lowestLevelScore] || 'Moderate',
      reason: reasons.join(' ')
    };

    return aggregated;
  }
}
