import { FoodKnowledge, AiCoachingTip, GoalCompatibilityRating } from '../../../../nutrition/knowledge/types/FoodKnowledge';

export interface RecognizedFoodItem {
  foodKnowledge: FoodKnowledge;
  estimatedWeightGrams: number;
}

export interface MealNutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  micronutrients: {
    potassium: number;
    calcium: number;
    iron: number;
    vitaminC: number;
    vitaminA: number;
  };
}

export interface DailyIntakeProgress {
  targetCalories: number;
  consumedCalories: number;
  remainingCalories: number;
  targetProtein: number;
  consumedProtein: number;
  targetCarbs: number;
  consumedCarbs: number;
  targetFat: number;
  consumedFat: number;
}

export interface UserHealthProfile {
  primaryGoal: 'weightLoss' | 'weightGain' | 'muscleBuilding' | 'weightMaintenance' | 'healthyEating';
  conditions: Array<'diabetes' | 'highBloodPressure' | 'heartDisease'>;
  dailyTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  currentIntake: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MealAnalysisResult {
  totals: MealNutritionTotals;
  healthScore: number; // 0-10
  satietyScore: number; // 0-10
  goalCompatibility: Record<string, GoalCompatibilityRating>;
  alternatives: string[];
  warnings: string[];
  dailyIntakeProgress: DailyIntakeProgress;
  coachingTips: AiCoachingTip[];
}
