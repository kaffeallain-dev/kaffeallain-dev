import { ConsumptionRecord, UserProfile, FoodItemTemplate } from '../types';
import { commonFoods } from '../data/foodDatabase';
import { NutritionKnowledgeRepository } from '../nutrition/knowledge';

export interface GoalStatus {
  status: string;
  reason: string;
}

export interface RecommendationInsight {
  title: string;
  description: string;
}

export interface MealAnalysisResult {
  mealName: string;
  goalImpact: string;
  positiveChoice: string;
  improvement: string;
  nextSuggestion: string;
  nutritionScore: number;
}

export interface WeeklyPatternResult {
  habitScore: number;
  proteinTrend: string;
  vegetableTrend: string;
  friedFoodTrend: string;
  sugaryDrinkTrend: string;
  breakfastConsistency: string;
  weeklyFocus: string;
}

export interface RecommendationObject {
  nutritionScore: number;
  confidence: number;
  goalStatus: GoalStatus;
  biggestWin: RecommendationInsight;
  improvement: RecommendationInsight;
  nextAction: RecommendationInsight;
  educationalInsight: RecommendationInsight;
  mealAnalysis: MealAnalysisResult[];
  weeklyPattern: WeeklyPatternResult;
}

export interface FoodAnalysisResult {
  bestFor: string[];
  goodSourceOf: string[];
  potentialConcerns: string[];
  recommendedFrequency: string;
  betterAlternative: string;
  suggestedPairing: string;
  healthScore: number;
  satietyScore: number;
}

export interface DailySummaryResult {
  nutritionScore: number;
  biggestSuccess: string;
  improvement: string;
  dailyFocus: string;
  goalProgress: string;
}

export class RecommendationEngine {
  static generate(
    profile: UserProfile | undefined,
    currentDayLogs: ConsumptionRecord[],
    weeklyLogs: ConsumptionRecord[],
    dailyGoal: number
  ): RecommendationObject {
    const goal = profile?.primaryGoal || 'Eat Healthier';
    const confidence = this.calculateConfidence(profile, currentDayLogs);

    const mealAnalysis = this.analyzeMeals(currentDayLogs, goal);
    const weeklyPattern = this.analyzeWeekly(weeklyLogs, goal);
    
    const nutritionScore = this.calculateOverallScore(currentDayLogs, dailyGoal, goal);
    const goalStatus = this.evaluateGoalStatus(currentDayLogs, dailyGoal, goal);
    
    const { biggestWin, improvement, nextAction, educationalInsight } = this.generateDailyInsights(currentDayLogs, dailyGoal, goal);

    return {
      nutritionScore,
      confidence,
      goalStatus,
      biggestWin,
      improvement,
      nextAction,
      educationalInsight,
      mealAnalysis,
      weeklyPattern
    };
  }

  static analyzeFood(food: FoodItemTemplate | ConsumptionRecord | null | undefined): FoodAnalysisResult {
    if (!food || typeof food !== 'object' || !food.name || typeof food.name !== 'string' || !food.name.trim()) {
      return {
        bestFor: [],
        goodSourceOf: [],
        potentialConcerns: [],
        recommendedFrequency: 'Daily',
        betterAlternative: 'None',
        suggestedPairing: 'Water',
        healthScore: 80,
        satietyScore: 50
      };
    }

    const knowledge = NutritionKnowledgeRepository.searchFood(food.name);
    
    if (knowledge) {
      return {
        bestFor: knowledge.foodIntelligence?.bestFor || [],
        goodSourceOf: knowledge.foodIntelligence?.goodSourceOf || [],
        potentialConcerns: knowledge.foodIntelligence?.concerns || [],
        recommendedFrequency: knowledge.foodIntelligence?.recommendedFrequency || 'Daily',
        betterAlternative: knowledge.foodRelationships?.betterAlternatives?.[0] || 'None',
        suggestedPairing: knowledge.foodRelationships?.suggestedPairings?.[0] || 'Water',
        healthScore: knowledge.scores?.healthScore || 80,
        satietyScore: knowledge.scores?.satietyScore || 50
      };
    }

    // Fallback for foods not in the knowledge base yet
    let richFood: any = food;
    if (!richFood.bestFor) {
       const foodName = (food.name || '').toLowerCase();
       const matched = commonFoods.find(f => f?.name && f.name.toLowerCase() === foodName);
       if (matched && matched.bestFor) {
           richFood = matched;
       }
    }

    return {
      bestFor: richFood.bestFor || [],
      goodSourceOf: richFood.goodSourceOf || [],
      potentialConcerns: richFood.concerns || [],
      recommendedFrequency: richFood.frequency || 'Daily',
      betterAlternative: richFood.alternatives ? richFood.alternatives[0] : 'None',
      suggestedPairing: richFood.pairings ? richFood.pairings[0] : 'Water',
      healthScore: richFood.healthScore || 80,
      satietyScore: richFood.satietyScore || 50
    };
  }

  static isKnownVegetableOrPlantFood(foodOrName: FoodItemTemplate | ConsumptionRecord | string): boolean {
    const rawName = typeof foodOrName === 'string' ? foodOrName : (foodOrName?.name || '');
    const name = rawName.toLowerCase().trim();
    if (!name) return false;

    const knowledge = NutritionKnowledgeRepository.searchFood(rawName);
    const category = typeof foodOrName === 'object' && 'category' in foodOrName && foodOrName.category
      ? foodOrName.category
      : (knowledge?.category || '');

    if (category === 'Vegetables' || category === 'Fruits') {
      return true;
    }

    const vegKeywords = [
      'ndolé', 'ndole', 'eru', 'okra', 'okro', 'gombo', 'folere', 'foléré',
      'njama', 'huckleberry', 'zomba', 'bitterleaf', 'waterleaf', 'salad',
      'salade', 'vegetable', 'légume', 'legume', 'veg', 'sanga', 'sangah',
      'koki', 'kondre', 'kondré', 'poulet dg', 'kwem', 'kpwem', 'cassava leaf',
      'feuille', 'mbongo', 'ekwang', 'pistachio', 'egusi', 'beans', 'haricot',
      'avocado', 'avocat', 'safou', 'plum', 'cabbage', 'chou', 'spinach',
      'épinard', 'tomato', 'tomate', 'plantain'
    ];
    return vegKeywords.some(kw => name.includes(kw));
  }

  static matchLogToCatalogue(
    log: ConsumptionRecord,
    availableFoods: FoodItemTemplate[] = commonFoods
  ): FoodItemTemplate | undefined {
    if (!log || typeof log !== 'object') return undefined;
    const catalog = (availableFoods && availableFoods.length > 0) ? availableFoods : commonFoods;

    if (log.foodId && !log.foodId.startsWith('custom-')) {
      const byId = catalog.find(f => f && f.id === log.foodId);
      if (byId) return byId;
    }

    const cleanName = (log.name || '').toLowerCase().trim();
    if (!cleanName) return undefined;

    const exact = catalog.find(f => {
      if (!f || !f.name) return false;
      if (f.name.toLowerCase().trim() === cleanName) return true;
      if (Array.isArray(f.aliases) && f.aliases.some(a => a.toLowerCase().trim() === cleanName)) return true;
      return false;
    });
    if (exact) return exact;

    const knowledge = NutritionKnowledgeRepository.searchFood(log.name);
    if (knowledge) {
      const byKnowledge = catalog.find(
        f => f && (f.id === knowledge.id || f.name.toLowerCase().trim() === knowledge.name.toLowerCase().trim())
      );
      if (byKnowledge) return byKnowledge;
    }

    return undefined;
  }

  static classifyLoggedMeals(
    logs: ConsumptionRecord[],
    availableFoods: FoodItemTemplate[] = commonFoods
  ): {
    totalCount: number;
    matchedCount: number;
    unclassifiedCount: number;
    hasIncompleteIngredientData: boolean;
    knownVegetableMealsCount: number;
    knownFriedMealsCount: number;
    knownSugaryDrinksCount: number;
    vegetablePresenceState: 'PRESENT' | 'INCOMPLETE_DATA' | 'NONE_LOGGED_YET';
    matchedItems: Array<{ log: ConsumptionRecord; template: FoodItemTemplate }>;
    unclassifiedItems: ConsumptionRecord[];
  } {
    const safeLogs = (logs || []).filter(l => l && typeof l === 'object' && typeof l.name === 'string' && l.name.trim().length > 0);
    const catalog = (availableFoods && availableFoods.length > 0) ? availableFoods : commonFoods;

    const matchedItems: Array<{ log: ConsumptionRecord; template: FoodItemTemplate }> = [];
    const unclassifiedItems: ConsumptionRecord[] = [];
    let knownVegetableMealsCount = 0;
    let knownFriedMealsCount = 0;
    let knownSugaryDrinksCount = 0;

    for (const log of safeLogs) {
      const matched = this.matchLogToCatalogue(log, catalog);
      const name = (log.name || '').toLowerCase();

      if (matched) {
        matchedItems.push({ log, template: matched });
        if (this.isKnownVegetableOrPlantFood(matched) || this.isKnownVegetableOrPlantFood(log)) {
          knownVegetableMealsCount++;
        }
        const isFried =
          matched.preparationMethod === 'Fried' ||
          name.includes('fried') ||
          name.includes('puff') ||
          name.includes('beignet') ||
          name.includes('frit');
        if (isFried) knownFriedMealsCount++;
      } else {
        unclassifiedItems.push(log);
        // Even for custom items, if the user explicitly named a known vegetable/plant in the title, count it as present,
        // but NEVER infer absence from custom/unclassified items.
        if (this.isKnownVegetableOrPlantFood(log)) {
          knownVegetableMealsCount++;
        }
      }

      if (name.includes('coke') || name.includes('soda') || name.includes('fanta') || name.includes('sweet drink')) {
        knownSugaryDrinksCount++;
      }
    }

    const totalCount = safeLogs.length;
    const matchedCount = matchedItems.length;
    const unclassifiedCount = unclassifiedItems.length;
    const hasIncompleteIngredientData = unclassifiedCount > 0 || totalCount === 0;

    let vegetablePresenceState: 'PRESENT' | 'INCOMPLETE_DATA' | 'NONE_LOGGED_YET';
    if (knownVegetableMealsCount > 0) {
      vegetablePresenceState = 'PRESENT';
    } else if (unclassifiedCount > 0 || totalCount < 2) {
      // Do not infer absence of vegetables when entries are unclassified/custom or only 1 partial entry is logged
      vegetablePresenceState = 'INCOMPLETE_DATA';
    } else {
      vegetablePresenceState = 'NONE_LOGGED_YET';
    }

    return {
      totalCount,
      matchedCount,
      unclassifiedCount,
      hasIncompleteIngredientData,
      knownVegetableMealsCount,
      knownFriedMealsCount,
      knownSugaryDrinksCount,
      vegetablePresenceState,
      matchedItems,
      unclassifiedItems
    };
  }

  static getContextualRecommendation(
    profile: UserProfile | undefined,
    currentDayLogs: ConsumptionRecord[],
    weeklyLogs: ConsumptionRecord[],
    availableFoods: FoodItemTemplate[],
    options?: { optionOffset?: number; dailyGoal?: number }
  ): { 
    food: FoodItemTemplate; 
    reason: string;
    confidence: "High" | "Medium" | "Low";
    actionType: "New Meal" | "Add Side" | "Swap Ingredient" | "Modify Preparation";
    alternatives: FoodItemTemplate[];
    isCatalogueBacked: boolean;
    servingBasis: string;
  } {
    const goal = profile?.primaryGoal || 'Eat Healthier';
    const safeDayLogs = (currentDayLogs || []).filter(l => l && typeof l === 'object');
    const safeWeeklyLogs = (weeklyLogs || []).filter(l => l && typeof l === 'object');
    const recentLogs = [...safeDayLogs, ...safeWeeklyLogs];
    const dailyGoal = options?.dailyGoal || 2000;

    const classification = this.classifyLoggedMeals(safeDayLogs, availableFoods);
    const todayCalories = safeDayLogs.reduce((sum, l) => sum + (Number(l.calories) || 0), 0);
    const todayProtein = safeDayLogs.reduce((sum, l) => sum + (Number(l.protein) || 0), 0);
    const remainingCalories = Math.max(0, dailyGoal - todayCalories);

    const needsMoreVegetables = classification.vegetablePresenceState === 'NONE_LOGGED_YET';
    const highFried = classification.knownFriedMealsCount > 0;
    const lowProtein = safeDayLogs.length > 0 && todayProtein < 35;

    const todayLoggedNames = new Set(
      safeDayLogs.map(l => (l.name || '').toLowerCase().trim()).filter(Boolean)
    );
    const todayLoggedIds = new Set(
      classification.matchedItems.map(m => m.template.id)
    );
    const recentFoodNames = recentLogs.slice(0, 10).map(l => (l.name || '').toLowerCase().trim()).filter(Boolean);

    const catalogSource = (availableFoods && availableFoods.length > 0) ? availableFoods : commonFoods;
    const validCatalogFoods = catalogSource.filter(
      f =>
        f &&
        typeof f === 'object' &&
        typeof f.name === 'string' &&
        f.name.trim().length > 0 &&
        Number.isFinite(f.calories) &&
        f.calories > 0 &&
        typeof f.servingSizeText === 'string' &&
        f.servingSizeText.trim().length > 0
    );

    if (validCatalogFoods.length === 0) {
      const fallbackCatalogueItem = commonFoods[0];
      return {
        food: fallbackCatalogueItem,
        reason: 'Suggested from the MboaFit catalogue as a balanced local dish.',
        confidence: 'Low',
        actionType: 'New Meal',
        alternatives: commonFoods.slice(1, 4),
        isCatalogueBacked: true,
        servingBasis: fallbackCatalogueItem.servingSizeText || '1 serving'
      };
    }

    const scoredCandidates: Array<{
      food: FoodItemTemplate;
      score: number;
      reason: string;
      actionType: "New Meal" | "Add Side" | "Swap Ingredient" | "Modify Preparation";
    }> = [];

    for (const food of validCatalogFoods) {
      let score = 50;
      const name = (food.name || '').toLowerCase().trim();
      const knowledge = NutritionKnowledgeRepository.searchFood(food.name);
      const analysis = this.analyzeFood(food);

      const authFiber = knowledge ? knowledge.nutrition.fiber : (food.fiber || 0);
      const authProtein = knowledge ? knowledge.nutrition.protein : (food.protein || 0);
      const authFat = knowledge ? knowledge.nutrition.fat : (food.fat || 0);
      const authCalories = knowledge ? knowledge.nutrition.calories : (food.calories || 0);

      const isVegetableOrLegumeRich = this.isKnownVegetableOrPlantFood(food);
      const isFiberRich =
        authFiber >= 4 ||
        (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('fiber')));
      const isFried =
        food.preparationMethod === 'Fried' ||
        name.includes('fried') ||
        name.includes('puff') ||
        name.includes('beignet');
      const isHighProtein =
        authProtein >= 18 ||
        (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('protein')));
      const isLighterPrep =
        food.preparationMethod === 'Grilled' ||
        food.preparationMethod === 'Boiled' ||
        food.preparationMethod === 'Steamed' ||
        food.preparationMethod === 'Stewed' ||
        name.includes('grilled') ||
        name.includes('boiled') ||
        (!isFried && authCalories <= 550 && authFat <= 22);

      // Avoid recommending drinks/snacks as a primary meal idea unless calories remaining are very small
      const isDrinkOrLightSnack =
        food.category === 'Drinks' ||
        (food.category === 'Snacks' && authCalories < 220);
      if (isDrinkOrLightSnack && remainingCalories > 300) {
        score -= 25;
      }

      // Calorie fit based on remaining daily calories (prevents locking onto a heavy 780 kcal meal like Eru & Water Fufu)
      if (safeDayLogs.length > 0) {
        if (remainingCalories > 0) {
          if (authCalories <= remainingCalories && authCalories >= Math.min(250, remainingCalories * 0.35)) {
            score += 18;
          } else if (authCalories > remainingCalories + 150) {
            score -= 25;
          }
        } else {
          // User already reached target; prefer lighter options
          if (authCalories <= 350) score += 15;
          else if (authCalories >= 600) score -= 25;
        }
      } else {
        // When no meals logged yet, prefer moderate everyday staples (350 - 600 kcal) over 780 kcal heavy dishes
        if (authCalories >= 320 && authCalories <= 600) {
          score += 16;
        } else if (authCalories > 700) {
          score -= 12;
        }
      }

      // Goal alignment
      const compatibility = this.evaluateGoalCompatibility(food, goal);
      if (compatibility.level === 'Excellent') score += 12;
      else if (compatibility.level === 'Poor') score -= 20;

      // Contextual fit with today's logged meals
      let reason = `Offers ${authProtein}g protein and ~${authCalories} kcal per ${food.servingSizeText || 'serving'} from the MboaFit catalogue.`;
      let candidateAction: "New Meal" | "Add Side" | "Swap Ingredient" | "Modify Preparation" = "New Meal";

      if (highFried && isLighterPrep && !isFried) {
        score += 22;
        reason = `Since today's log includes a fried item, this ${food.preparationMethod ? food.preparationMethod.toLowerCase() : 'lighter'} dish (~${authCalories} kcal) offers a gentler balance.`;
        candidateAction = "Modify Preparation";
      } else if (lowProtein && isHighProtein) {
        score += 20;
        reason = `Your logged meals today total ${Math.round(todayProtein)}g protein so far; ${food.name} adds ~${authProtein}g protein per ${food.servingSizeText || 'serving'}.`;
        candidateAction = "New Meal";
      } else if (needsMoreVegetables && isVegetableOrLegumeRich) {
        score += 16;
        reason = `Adds leafy greens, vegetables, or legumes (~${authCalories} kcal, ${authProtein}g protein) to complement today's logged meals.`;
        candidateAction = "New Meal";
      } else if (isHighProtein && isFiberRich) {
        score += 14;
        reason = `Combines protein (${authProtein}g) and fiber in a single traditional dish (~${authCalories} kcal per ${food.servingSizeText || 'serving'}).`;
      } else if (compatibility.level === 'Excellent' && compatibility.reason) {
        reason = `${compatibility.reason} (~${authCalories} kcal per ${food.servingSizeText || 'serving'}).`;
      }

      // Strong penalty if already logged today so suggestions adapt immediately when meals change
      if (todayLoggedIds.has(food.id) || todayLoggedNames.has(name)) {
        score -= 60;
      } else if (recentFoodNames.includes(name)) {
        score -= 12;
      }

      scoredCandidates.push({
        food,
        score,
        reason,
        actionType: candidateAction
      });
    }

    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.food.calories - b.food.calories;
    });

    // Top distinct candidates pool so user can cycle or see diverse suggestions
    const topPool = scoredCandidates.slice(0, Math.min(6, scoredCandidates.length));
    const requestedOffset = Math.max(0, options?.optionOffset ?? 0);
    const chosenIndex = topPool.length > 0 ? (requestedOffset % topPool.length) : 0;
    const chosen = topPool[chosenIndex] || scoredCandidates[0];

    const alternatives = topPool
      .filter((_, idx) => idx !== chosenIndex)
      .slice(0, 3)
      .map(c => c.food);

    let confidence: "High" | "Medium" | "Low" = "Medium";
    if (classification.totalCount >= 2 && classification.unclassifiedCount === 0) {
      confidence = "High";
    } else if (classification.totalCount === 0 || classification.matchedCount === 0) {
      confidence = "Low";
    }

    return {
      food: chosen.food,
      reason: chosen.reason,
      confidence,
      actionType: chosen.actionType,
      alternatives,
      isCatalogueBacked: true,
      servingBasis: chosen.food.servingSizeText || '1 serving'
    };
  }

  static evaluateGoalCompatibility(food: FoodItemTemplate | ConsumptionRecord | null | undefined, goal?: string | null) {
    if (!food || typeof food !== 'object' || !food.name || typeof food.name !== 'string' || !food.name.trim()) {
      return {
        level: 'Moderate',
        reason: 'Select a food to evaluate goal compatibility.'
      };
    }

    const currentGoal = goal || 'Eat Healthier';
    const knowledge = NutritionKnowledgeRepository.searchFood(food.name);
    
    if (knowledge && knowledge.goalCompatibility) {
       let goalKey: keyof typeof knowledge.goalCompatibility | undefined;
       if (currentGoal === 'Lose Weight') goalKey = 'weightLoss';
       else if (currentGoal === 'Maintain Weight') goalKey = 'weightMaintenance';
       else if (currentGoal === 'Gain Weight') goalKey = 'weightGain';
       else if (currentGoal === 'Build Muscle') goalKey = 'muscleBuilding';
       else if (currentGoal === 'Eat Healthier') goalKey = 'healthyEating';

       if (goalKey && knowledge.goalCompatibility[goalKey]) {
          return knowledge.goalCompatibility[goalKey];
       }
    }

    let richFood: any = food;
    if (!richFood.goalCompatibility) {
       const foodName = food.name.toLowerCase();
       const matched = commonFoods.find(f => f?.name && f.name.toLowerCase() === foodName);
       if (matched && matched.goalCompatibility) {
           richFood = matched;
       }
    }

    if (richFood.goalCompatibility && richFood.goalCompatibility[currentGoal]) {
       return richFood.goalCompatibility[currentGoal];
    }

    const analysis = this.analyzeFood(food);
    let level = 'Moderate';
    let reason = 'Can be enjoyed in moderation.';
    
    if (currentGoal === 'Lose Weight') {
      if (analysis.healthScore >= 80 && analysis.satietyScore >= 60) {
        level = 'Excellent';
        reason = 'Low in calorie density and keeps you full.';
      } else if (analysis.healthScore < 60) {
        level = 'Poor';
        reason = 'High in calories and may slow down weight loss.';
      }
    } else if (currentGoal === 'Build Muscle') {
      if (analysis.goodSourceOf.includes('Protein')) {
        level = 'Excellent';
        reason = 'Provides essential amino acids for muscle repair.';
      } else if (analysis.goodSourceOf.includes('Carbohydrates')) {
        level = 'Moderate';
        reason = 'Provides necessary energy for workouts.';
      }
    } else if (currentGoal === 'Gain Weight') {
      if (analysis.bestFor.includes('Weight Gain')) {
        level = 'Excellent';
        reason = 'Helps you easily reach your calorie surplus.';
      } else {
        level = 'Moderate';
        reason = 'Good for nutrients, but low in total energy.';
      }
    } else {
      if (analysis.healthScore >= 80) {
         level = 'Excellent';
         reason = 'Rich in nutrients and supports overall health.';
      } else if (analysis.healthScore < 60) {
         level = 'Moderate';
         reason = 'Enjoy occasionally, but focus on whole foods.';
      } else {
         level = 'Excellent';
         reason = 'Provides good energy for daily activities.';
      }
    }
    
    return { level, reason };
  }

  static getDailySummary(
    profile: UserProfile | undefined,
    currentDayLogs: ConsumptionRecord[],
    dailyGoal: number
  ): DailySummaryResult {
    const goal = profile?.primaryGoal || 'Eat Healthier';
    const safeLogs = (currentDayLogs || []).filter(c => c && typeof c === 'object');
    const cals = safeLogs.reduce((sum, c) => sum + (c.calories || 0), 0);
    const protein = safeLogs.reduce((sum, c) => sum + (c.protein || 0), 0);
    const nutritionScore = this.calculateOverallScore(safeLogs, dailyGoal, goal);
    
    let biggestSuccess = "You successfully logged your meals today.";
    if (protein > 50) biggestSuccess = "Excellent protein intake today, supporting muscle maintenance and satiety.";
    else if (cals <= dailyGoal && goal === 'Lose Weight') biggestSuccess = "You stayed within your calorie target.";
    else if (cals > dailyGoal * 0.8 && goal === 'Gain Weight') biggestSuccess = "Great job reaching a calorie surplus.";
    
    let improvement = "Aim for a more balanced macronutrient profile.";
    let dailyFocus = "Keep aiming for a colorful plate with a good mix of carbohydrates, protein, and fresh foods.";
    let goalProgress = "On Track";
    
    if (safeLogs.length === 0) {
      biggestSuccess = "Taking the first step by opening the app.";
      improvement = "You haven't logged any meals today.";
      dailyFocus = "Start logging your meals to receive personalized coaching. Even small snacks matter!";
      goalProgress = "Waiting for data";
    } else {
      if (goal === 'Lose Weight' && cals > dailyGoal) {
        improvement = "Calorie target exceeded.";
        dailyFocus = "You've exceeded your daily energy goal. Tomorrow is a new day—small improvements lead to sustainable weight loss.";
        goalProgress = "Slightly Over Target";
      } else if (goal === 'Lose Weight') {
        improvement = "Include more fiber in your diet.";
        dailyFocus = "Add one serving of vegetables or a piece of fruit today to boost your fiber intake.";
        goalProgress = "Supports Weight Loss";
      } else if (goal === 'Build Muscle') {
        if (protein < 50) {
           improvement = "Protein intake is too low for optimal muscle synthesis.";
           dailyFocus = "Today's meals were a little low in protein. Adding beans, eggs, fish, or chicken tomorrow would create a better balance.";
           goalProgress = "Needs More Protein";
        } else {
           improvement = "Ensure you are getting enough rest to complement your diet.";
           dailyFocus = "Great consistency so far. Make sure you're pairing your workouts with enough protein and carbs for recovery.";
           goalProgress = "Supports Muscle Building";
        }
      } else if (goal === 'Gain Weight') {
        if (cals < dailyGoal * 0.8) {
           improvement = "Calorie intake is too low for weight gain.";
           dailyFocus = "Add some healthy fats like groundnuts or avocado to easily increase your energy intake.";
           goalProgress = "Needs More Calories";
        } else {
           improvement = "Focus on nutrient-dense foods, not just empty calories.";
           dailyFocus = "You're building healthy weight. Keep fueling your body with whole foods.";
           goalProgress = "Supports Weight Gain";
        }
      }
    }
    
    return {
      nutritionScore,
      biggestSuccess,
      improvement,
      dailyFocus,
      goalProgress
    };
  }

  // --- Internal Helpers ---
  private static calculateConfidence(profile: UserProfile | undefined, logs: ConsumptionRecord[]): number {
    let confidence = 0.5;
    if (profile?.age && profile?.weightKg && profile?.heightCm && profile?.activityLevel && profile?.primaryGoal) {
      confidence += 0.3;
    }
    const safeLogs = (logs || []).filter(c => c && typeof c === 'object');
    if (safeLogs.length > 2) {
      confidence += 0.15;
    }
    return Math.min(1.0, confidence);
  }

  private static calculateOverallScore(logs: ConsumptionRecord[], dailyGoal: number, goal: string): number {
    const safeLogs = (logs || []).filter(c => c && typeof c === 'object');
    if (safeLogs.length === 0) return 0;
    const cals = safeLogs.reduce((sum, c) => sum + (c.calories || 0), 0);
    const protein = safeLogs.reduce((sum, c) => sum + (c.protein || 0), 0);
    
    let score = 80;
    const hasSugary = safeLogs.some(c => (c.name || '').toLowerCase().includes('coke') || (c.name || '').toLowerCase().includes('soda'));
    const hasFried = safeLogs.some(c => (c.name || '').toLowerCase().includes('fried'));
    const hasVeggie = safeLogs.some(c => (c.name || '').toLowerCase().includes('salad') || (c.name || '').toLowerCase().includes('eru') || (c.name || '').toLowerCase().includes('vegetable'));
    
    if (hasSugary) score -= 15;
    if (hasFried) score -= 10;
    if (hasVeggie) score += 10;
    if (protein > 50) score += 10;
    
    if (goal === 'Lose Weight') {
      if (cals > dailyGoal) score -= 20;
      else score += 10;
    }
    return Math.max(0, Math.min(100, score));
  }

  private static evaluateGoalStatus(logs: ConsumptionRecord[], dailyGoal: number, goal: string): GoalStatus {
    const safeLogs = (logs || []).filter(c => c && typeof c === 'object');
    const cals = safeLogs.reduce((sum, c) => sum + (c.calories || 0), 0);
    const protein = safeLogs.reduce((sum, c) => sum + (c.protein || 0), 0);

    if (safeLogs.length === 0) {
      return { status: "No Data", reason: "Start logging your meals to see how they impact your goals." };
    }

    if (goal === 'Lose Weight') {
      if (cals > dailyGoal) return { status: "Slows Progress", reason: "Today's calorie intake exceeded your target." };
      return { status: "Supports Weight Loss", reason: "Today's meals remained within your calorie target." };
    }
    if (goal === 'Build Muscle') {
      if (protein > 50) return { status: "Supports Muscle Building", reason: "You consumed adequate protein to support muscle synthesis." };
      return { status: "Needs Improvement", reason: "Protein intake was a bit low for optimal muscle growth." };
    }
    if (goal === 'Gain Weight') {
      if (cals > dailyGoal * 0.9) return { status: "Supports Weight Gain", reason: "You are hitting your calorie surplus." };
      return { status: "Slows Progress", reason: "Calorie intake was too low to effectively gain weight." };
    }
    
    return { status: "Supports Health", reason: "You are maintaining healthy tracking habits." };
  }

  private static generateDailyInsights(logs: ConsumptionRecord[], dailyGoal: number, goal: string) {
    const safeLogs = (logs || []).filter(c => c && typeof c === 'object');
    if (safeLogs.length === 0) {
      return {
        biggestWin: { title: "Getting Started", description: "Every journey begins with a single step." },
        improvement: { title: "Log a Meal", description: "You haven't logged any food today." },
        nextAction: { title: "Log a meal to get started", description: "Based on what you've logged so far, we don't have enough data yet. Log a few meals to make recommendations more personal." },
        educationalInsight: { title: "Did You Know?", description: "Tracking your food is the most effective way to understand your nutrition habits." }
      };
    }

    const cals = safeLogs.reduce((sum, c) => sum + (c.calories || 0), 0);
    const protein = safeLogs.reduce((sum, c) => sum + (c.protein || 0), 0);
    const sortedLogs = [...safeLogs].sort((a, b) => b.timestamp - a.timestamp);
    const classification = this.classifyLoggedMeals(safeLogs);

    let biggestWin = { title: "Consistent Tracking", description: "You successfully logged meals today." };
    if (protein > 30) biggestWin = { title: "Strong Protein Intake", description: "You've included good sources of protein which helps with satiety and recovery." };
    else if (cals <= dailyGoal && goal === 'Lose Weight') biggestWin = { title: "On Track", description: "You are currently on track with your calorie target." };

    let improvement = { title: "Balanced Plate", description: "Try to ensure every meal has a good mix of nutrients." };
    let nextAction =
      classification.vegetablePresenceState === 'PRESENT'
        ? {
            title: "Steady meal balance",
            description: `Your ${safeLogs.length} logged item(s) today already include vegetables or plant-rich foods (${Math.round(cals)} kcal, ${Math.round(protein)}g protein total).`
          }
        : classification.vegetablePresenceState === 'INCOMPLETE_DATA'
        ? {
            title: "Summary of recorded macros",
            description:
              classification.unclassifiedCount > 0
                ? `You have logged ${safeLogs.length} item(s) (${Math.round(cals)} kcal, ${Math.round(protein)}g protein). Ingredient details aren't available for custom or unmatched entries, so MboaFit only summarizes your recorded macros.`
                : `You have logged 1 meal so far today (${Math.round(cals)} kcal, ${Math.round(protein)}g protein). Log additional meals when ready to see a fuller daily breakdown.`
          }
        : {
            title: "Optional variety idea",
            description: `Across your ${safeLogs.length} catalogue-matched meals today (${Math.round(cals)} kcal), no vegetable or leafy dish is recorded yet. If you like, a vegetable sauce or side can add fiber.`
          };
    let educationalInsight = { title: "Did You Know?", description: "Combining protein, complex carbs, and traditional leafy sauces supports steady energy across the day." };

    const sugaryDrink = sortedLogs.find(c => (c.name || '').toLowerCase().includes('coke') || (c.name || '').toLowerCase().includes('soda') || (c.name || '').toLowerCase().includes('juice'));
    const waterAfterSugary = sugaryDrink && sortedLogs.find(c => (c.name || '').toLowerCase().includes('water') && c.timestamp > sugaryDrink.timestamp);
    const friedFood = sortedLogs.find(c => (c.name || '').toLowerCase().includes('fried') || (c.name || '').toLowerCase().includes('puff'));

    if (sugaryDrink && !waterAfterSugary) {
      improvement = { title: "Reduce Sugary Drinks", description: `${sugaryDrink.name || 'Sugary drink'} contributed unnecessary calories today.` };
      nextAction = { title: "Hydrate for your next choice", description: `You had ${sugaryDrink.name || 'a sugary drink'} earlier. Replacing your next drink with water can help stabilize your energy and reduce hidden calories.` };
      educationalInsight = { title: "Did You Know?", description: "Sugary drinks cause rapid spikes in blood sugar, often followed by crashes that increase hunger." };
    } else if (sugaryDrink && waterAfterSugary) {
      biggestWin = { title: "Hydration Focus Completed ✓", description: "You replaced a sugary drink habit by logging water." };
      improvement = { title: "Watch the Oil", description: "Try to keep meals light and avoid deep frying." };
      nextAction = { title: "Keep the momentum going", description: "You've already made a great swap with water today. Consider adding a high-fiber side to your next meal to maintain steady energy." };
      educationalInsight = { title: "Did You Know?", description: "Water helps your body process nutrients and keeps you feeling full longer." };
    } else if (friedFood) {
      improvement = { title: "Watch the Oil", description: `${friedFood.name || 'Fried food'} adds a significant amount of fat.` };
      nextAction = { title: "Opt for a lighter preparation", description: `Since you had ${friedFood.name || 'fried food'} earlier, choosing a boiled or grilled option next can naturally balance your fat intake for the day.` };
      educationalInsight = { title: "Did You Know?", description: "Frying food significantly increases its calorie density without improving how full it makes you feel." };
    } else if (protein < 20 && goal === 'Build Muscle') {
      improvement = { title: "Increase Protein", description: "Your protein intake is quite low so far today." };
      nextAction = { title: "Prioritize protein in your next meal", description: "Your logged meals are a bit low in protein right now. Adding beans, eggs, or fish will help support your muscle-building goal." };
      educationalInsight = { title: "Did You Know?", description: "Protein is the building block of muscle. Without it, workouts won't yield optimal results." };
    }

    return { biggestWin, improvement, nextAction, educationalInsight };
  }

  private static analyzeMeals(logs: ConsumptionRecord[], goal: string): MealAnalysisResult[] {
    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    const results: MealAnalysisResult[] = [];
    const safeLogs = (logs || []).filter(c => c && typeof c === 'object');

    for (const meal of meals) {
      const mealLogs = safeLogs.filter(c => c.mealCategory === meal);
      if (mealLogs.length === 0) continue;

      const cals = mealLogs.reduce((sum, c) => sum + (c.calories || 0), 0);
      const protein = mealLogs.reduce((sum, c) => sum + (c.protein || 0), 0);
      
      let nutritionScore = 80;
      let positiveChoice = "Good source of energy.";
      let improvement = "Consider a more balanced mix of nutrients.";
      let nextSuggestion = "Try adding a side of vegetables or fruit.";
      let goalImpact = "Neutral";

      if (protein > 15) {
        positiveChoice = "Excellent choice adding a solid source of protein.";
        nutritionScore += 10;
      }
      
      const hasVeggie = mealLogs.some(c => (c.name || '').toLowerCase().includes('salad') || (c.name || '').toLowerCase().includes('eru') || (c.name || '').toLowerCase().includes('fruit'));
      if (hasVeggie) {
         positiveChoice = "Great choice including fiber-rich or fresh foods.";
         nutritionScore += 15;
      }

      const sugaryDrink = mealLogs.find(c => (c.name || '').toLowerCase().includes('coke') || (c.name || '').toLowerCase().includes('soda'));
      const friedFood = mealLogs.find(c => (c.name || '').toLowerCase().includes('fried'));

      if (sugaryDrink) {
        improvement = `This meal included a significant amount of sugar from ${(sugaryDrink.name || '').toLowerCase()}.`;
        nextSuggestion = "Replacing sugary drinks with water would significantly reduce calories.";
        nutritionScore -= 20;
      } else if (friedFood) {
        improvement = `This meal was heavy due to ${(friedFood.name || '').toLowerCase()}.`;
        nextSuggestion = "Choosing a grilled or boiled option next time would reduce unnecessary calories.";
        nutritionScore -= 15;
      }

      if (goal === 'Lose Weight') {
        if (cals > 800) goalImpact = "Slows Progress (High Calories)";
        else goalImpact = "Supports Weight Loss";
      } else if (goal === 'Build Muscle') {
        if (protein > 20) goalImpact = "Supports Muscle Building";
        else goalImpact = "Needs More Protein";
      }

      nutritionScore = Math.max(0, Math.min(100, nutritionScore));

      results.push({
        mealName: meal,
        goalImpact,
        positiveChoice,
        improvement,
        nextSuggestion,
        nutritionScore
      });
    }

    return results;
  }

  private static analyzeWeekly(weeklyLogs: ConsumptionRecord[], goal: string): WeeklyPatternResult {
    let habitScore = 80;
    
    let breakfastCount = 0;
    let sugaryDrinks = 0;
    let friedFoods = 0;
    let veggieCount = 0;
    let highProteinCount = 0;

    const safeLogs = (weeklyLogs || []).filter(c => c && typeof c === 'object');
    const daysLogged = new Set(safeLogs.map(c => new Date(c.timestamp).toDateString()));

    safeLogs.forEach(c => {
      if (c.mealCategory === 'Breakfast') breakfastCount++;
      const name = (c.name || '').toLowerCase();
      if (name.includes('coke') || name.includes('soda') || name.includes('juice')) sugaryDrinks++;
      if (name.includes('fried') || name.includes('puff')) friedFoods++;
      if (name.includes('salad') || name.includes('eru') || name.includes('vegetable')) veggieCount++;
      if ((c.protein || 0) > 20) highProteinCount++;
    });

    let breakfastConsistency = breakfastCount >= daysLogged.size * 0.7 ? "Consistent" : "Inconsistent";
    let sugaryDrinkTrend = sugaryDrinks > 3 ? "High" : "Low";
    let friedFoodTrend = friedFoods > 3 ? "High" : "Moderate";
    let vegetableTrend = veggieCount >= 3 ? "Good" : "Needs Improvement";
    let proteinTrend = highProteinCount >= 4 ? "Strong" : "Average";

    if (daysLogged.size < 3) {
      habitScore -= 20;
    }
    if (sugaryDrinks > 3) habitScore -= 15;
    if (friedFoods > 3) habitScore -= 10;
    if (veggieCount >= 3) habitScore += 15;

    let weeklyFocus = "Keep up your current habits! You are maintaining a great balance.";
    if (sugaryDrinks > 3) {
      weeklyFocus = "Replace one sugary drink with water each day to significantly reduce calorie intake.";
    } else if (friedFoods > 3) {
      weeklyFocus = "Try to choose grilled or boiled options instead of fried foods a few times this week.";
    } else if (breakfastCount < daysLogged.size * 0.5) {
      weeklyFocus = "Try adding a small, quick breakfast like boiled eggs to start your day with energy.";
    }

    return {
      habitScore: Math.max(0, Math.min(100, habitScore)),
      proteinTrend,
      vegetableTrend,
      friedFoodTrend,
      sugaryDrinkTrend,
      breakfastConsistency,
      weeklyFocus
    };
  }
}
