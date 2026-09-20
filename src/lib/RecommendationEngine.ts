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

  static analyzeFood(food: FoodItemTemplate | ConsumptionRecord): FoodAnalysisResult {
    const knowledge = NutritionKnowledgeRepository.searchFood(food.name);
    
    if (knowledge) {
      return {
        bestFor: knowledge.foodIntelligence.bestFor || [],
        goodSourceOf: knowledge.foodIntelligence.goodSourceOf || [],
        potentialConcerns: knowledge.foodIntelligence.concerns || [],
        recommendedFrequency: knowledge.foodIntelligence.recommendedFrequency || 'Daily',
        betterAlternative: knowledge.foodRelationships.betterAlternatives?.[0] || 'None',
        suggestedPairing: knowledge.foodRelationships.suggestedPairings?.[0] || 'Water',
        healthScore: knowledge.scores.healthScore || 80,
        satietyScore: knowledge.scores.satietyScore || 50
      };
    }

    // Fallback for foods not in the knowledge base yet
    let richFood: any = food;
    if (!richFood.bestFor) {
       const matched = commonFoods.find(f => f.name.toLowerCase() === food.name.toLowerCase());
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


  static getContextualRecommendation(
    profile: UserProfile | undefined,
    currentDayLogs: ConsumptionRecord[],
    weeklyLogs: ConsumptionRecord[],
    availableFoods: FoodItemTemplate[]
  ): { 
    food: FoodItemTemplate; 
    reason: string;
    confidence: "High" | "Medium" | "Low";
    actionType: "New Meal" | "Add Side" | "Swap Ingredient" | "Modify Preparation";
  } {
    const goal = profile?.primaryGoal || 'Eat Healthier';
    const recentLogs = [...currentDayLogs, ...weeklyLogs];
    
    // 1. Identify Nutritional/Behavioral Opportunity
    let missingVeggies = true;
    let missingFiber = true;
    let highFried = false;
    let highSugar = false;
    let lowProtein = goal === 'Build Muscle'; // default to true if muscle building
    
    const todayProtein = currentDayLogs.reduce((sum, l) => sum + (l.protein || 0), 0);
    if (todayProtein > 40) lowProtein = false;

    currentDayLogs.forEach(log => {
      const name = log.name.toLowerCase();
      const knowledge = NutritionKnowledgeRepository.searchFood(log.name);
      
      const authCategory = knowledge ? knowledge.category : 'Unknown';
      const authFiber = knowledge ? knowledge.nutrition.fiber : 0;
      
      const analysis = this.analyzeFood(log);
      
      const isVeggieLog = authCategory === 'Vegetables' || authCategory === 'Soups' || name.includes('eru') || name.includes('ndolé') || name.includes('salad') || name.includes('veg');
      const isFiberLog = authFiber >= 3 || (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('fiber'))) || (analysis.bestFor && analysis.bestFor.some(s => s.toLowerCase().includes('digestion')));
      
      if (isVeggieLog) missingVeggies = false;
      if (isFiberLog) missingFiber = false;

      if (name.includes('fried') || name.includes('puff')) highFried = true;
      if (name.includes('coke') || name.includes('soda') || name.includes('juice') || name.includes('sweet')) highSugar = true;
    });

    // Extract recent food names to penalize repetition
    const recentFoodNames = recentLogs.slice(0, 10).map(l => l.name.toLowerCase());
    const veryRecentFoodNames = currentDayLogs.map(l => l.name.toLowerCase());
    
    // Extract user preferences (most frequently eaten foods)
    const frequencyMap: Record<string, number> = {};
    recentLogs.forEach(l => {
      frequencyMap[l.name] = (frequencyMap[l.name] || 0) + 1;
    });

    // 2. Evaluate Candidates
    let bestScore = -9999;
    let bestCandidate = availableFoods[0];
    let bestReason = "Recommended because it is a balanced option to keep you on track.";
    let actionType: "New Meal" | "Add Side" | "Swap Ingredient" | "Modify Preparation" = "New Meal";

    for (const food of availableFoods) {
      let score = 50;
      const name = food.name.toLowerCase();
      
      const knowledge = NutritionKnowledgeRepository.searchFood(food.name);
      const analysis = this.analyzeFood(food);
      
      // Authoritative nutrition values (Knowledge base overrides simple database if available)
      const authFiber = knowledge ? knowledge.nutrition.fiber : (food.fiber || 0);
      const authProtein = knowledge ? knowledge.nutrition.protein : (food.protein || 0);
      const authFat = knowledge ? knowledge.nutrition.fat : (food.fat || 0);
      const authCalories = knowledge ? knowledge.nutrition.calories : (food.calories || 0);
      const authCategory = knowledge ? knowledge.category : food.category;
      
      // Separate semantic categories strictly based on nutritional truth
      const isVegetableRich = authCategory === 'Vegetables' || 
                              authCategory === 'Soups' || 
                              name.includes('eru') || 
                              name.includes('ndolé') || 
                              name.includes('salad') || 
                              name.includes('veg');
                              
      const isFiberRich = authFiber >= 3 || 
                          (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('fiber'))) || 
                          (analysis.bestFor && analysis.bestFor.some(s => s.toLowerCase().includes('digestion')));
                          
      const isFried = name.includes('fried') || name.includes('puff') || (analysis.potentialConcerns && analysis.potentialConcerns.some(c => c.toLowerCase().includes('fat') || c.toLowerCase().includes('oil')));
      
      const isHighProtein = authProtein >= 15 || (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('protein')));
      
      const isBoiledOrGrilled = name.includes('boiled') || name.includes('roasted') || name.includes('grilled') || 
                                (!isFried && authCalories < 400 && authFat < 15);
      
      // Goal alignment
      const compatibility = this.evaluateGoalCompatibility(food, goal);
      if (compatibility.level === 'Excellent') score += 15;
      else if (compatibility.level === 'Poor') score -= 20;

      // Opportunity alignment
      if (missingVeggies && isVegetableRich) score += 25;
      if (missingFiber && isFiberRich) score += 15; 
      if (lowProtein && isHighProtein) score += 20;
      if (highFried && isFried) score -= 30;
      if (highFried && isBoiledOrGrilled) score += 20;
      
      // Repetition penalty (Variety)
      if (veryRecentFoodNames.includes(name)) {
        score -= 40; // Don't recommend what they ate today
      } else if (recentFoodNames.includes(name)) {
        score -= 15; // Slightly penalize if eaten recently
      }
      
      // Preference signal (User likes this, but hasn't eaten it today)
      const timesEaten = frequencyMap[food.name] || 0;
      if (timesEaten > 1 && !veryRecentFoodNames.includes(name)) {
        score += 5; // Small bump for proven preference
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = food;
        
        // Generate contextual reason strictly aligned with the evidence that caused the score
        if (missingVeggies && isVegetableRich) {
          if (isFiberRich) {
             bestReason = "Recommended because it can add more vegetables and fiber to your meals today.";
          } else {
             bestReason = "Recommended because it can add more vegetables to your meals today.";
          }
          actionType = "New Meal";
        } else if (missingFiber && isFiberRich) {
          bestReason = "Recommended because it can add more fiber to your meals.";
          actionType = "New Meal";
        } else if (highFried && isBoiledOrGrilled) {
          bestReason = "Recommended because choosing a lighter preparation can help balance your meals today.";
          actionType = "Modify Preparation";
        } else if (lowProtein && isHighProtein) {
          bestReason = "Recommended because it adds a convenient source of protein to your next meal.";
          actionType = "New Meal";
        } else if (compatibility.level === 'Excellent') {
          bestReason = `Recommended because it aligns with your goal: ${compatibility.reason.toLowerCase()}`;
          actionType = "New Meal";
        } else {
          bestReason = "Recommended because it adds good variety to your recent meal pattern.";
          actionType = "New Meal";
        }
      }
    }
    
    let confidence: "High" | "Medium" | "Low" = "Medium";
    if (recentLogs.length > 5) confidence = "High";
    if (recentLogs.length < 2) confidence = "Low";

    return { food: bestCandidate, reason: bestReason, confidence, actionType };
  }

  static evaluateGoalCompatibility(food: FoodItemTemplate | ConsumptionRecord, goal: string) {
    const knowledge = NutritionKnowledgeRepository.searchFood(food.name);
    
    if (knowledge) {
       let goalKey: keyof typeof knowledge.goalCompatibility | undefined;
       if (goal === 'Lose Weight') goalKey = 'weightLoss';
       else if (goal === 'Maintain Weight') goalKey = 'weightMaintenance';
       else if (goal === 'Gain Weight') goalKey = 'weightGain';
       else if (goal === 'Build Muscle') goalKey = 'muscleBuilding';
       else if (goal === 'Eat Healthier') goalKey = 'healthyEating';

       if (goalKey && knowledge.goalCompatibility[goalKey]) {
          return knowledge.goalCompatibility[goalKey];
       }
    }

    let richFood: any = food;
    if (!richFood.goalCompatibility) {
       const matched = commonFoods.find(f => f.name.toLowerCase() === food.name.toLowerCase());
       if (matched && matched.goalCompatibility) {
           richFood = matched;
       }
    }

    if (richFood.goalCompatibility && richFood.goalCompatibility[goal]) {
       return richFood.goalCompatibility[goal];
    }

    const analysis = this.analyzeFood(food);
    let level = 'Moderate';
    let reason = 'Can be enjoyed in moderation.';
    
    if (goal === 'Lose Weight') {
      if (analysis.healthScore >= 80 && analysis.satietyScore >= 60) {
        level = 'Excellent';
        reason = 'Low in calorie density and keeps you full.';
      } else if (analysis.healthScore < 60) {
        level = 'Poor';
        reason = 'High in calories and may slow down weight loss.';
      }
    } else if (goal === 'Build Muscle') {
      if (analysis.goodSourceOf.includes('Protein')) {
        level = 'Excellent';
        reason = 'Provides essential amino acids for muscle repair.';
      } else if (analysis.goodSourceOf.includes('Carbohydrates')) {
        level = 'Moderate';
        reason = 'Provides necessary energy for workouts.';
      }
    } else if (goal === 'Gain Weight') {
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
    const cals = currentDayLogs.reduce((sum, c) => sum + c.calories, 0);
    const protein = currentDayLogs.reduce((sum, c) => sum + (c.protein || 0), 0);
    const nutritionScore = this.calculateOverallScore(currentDayLogs, dailyGoal, goal);
    
    let biggestSuccess = "You successfully logged your meals today.";
    if (protein > 50) biggestSuccess = "Excellent protein intake today, supporting muscle maintenance and satiety.";
    else if (cals <= dailyGoal && goal === 'Lose Weight') biggestSuccess = "You stayed within your calorie target.";
    else if (cals > dailyGoal * 0.8 && goal === 'Gain Weight') biggestSuccess = "Great job reaching a calorie surplus.";
    
    let improvement = "Aim for a more balanced macronutrient profile.";
    let dailyFocus = "Keep aiming for a colorful plate with a good mix of carbohydrates, protein, and fresh foods.";
    let goalProgress = "On Track";
    
    if (currentDayLogs.length === 0) {
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
    if (logs.length > 2) {
      confidence += 0.15;
    }
    return Math.min(1.0, confidence);
  }

  private static calculateOverallScore(logs: ConsumptionRecord[], dailyGoal: number, goal: string): number {
    if (logs.length === 0) return 0;
    const cals = logs.reduce((sum, c) => sum + c.calories, 0);
    const protein = logs.reduce((sum, c) => sum + (c.protein || 0), 0);
    
    let score = 80;
    const hasSugary = logs.some(c => c.name.toLowerCase().includes('coke') || c.name.toLowerCase().includes('soda'));
    const hasFried = logs.some(c => c.name.toLowerCase().includes('fried'));
    const hasVeggie = logs.some(c => c.name.toLowerCase().includes('salad') || c.name.toLowerCase().includes('eru') || c.name.toLowerCase().includes('vegetable'));
    
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
    const cals = logs.reduce((sum, c) => sum + c.calories, 0);
    const protein = logs.reduce((sum, c) => sum + (c.protein || 0), 0);

    if (logs.length === 0) {
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
    if (logs.length === 0) {
      return {
        biggestWin: { title: "Getting Started", description: "Every journey begins with a single step." },
        improvement: { title: "Log a Meal", description: "You haven't logged any food today." },
        nextAction: { title: "Log a meal to get started", description: "Based on what you've logged so far, we don't have enough data yet. Log a few meals to make recommendations more personal." },
        educationalInsight: { title: "Did You Know?", description: "Tracking your food is the most effective way to understand your nutrition habits." }
      };
    }

    const cals = logs.reduce((sum, c) => sum + c.calories, 0);
    const protein = logs.reduce((sum, c) => sum + (c.protein || 0), 0);
    const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);

    let biggestWin = { title: "Consistent Tracking", description: "You successfully logged meals today." };
    if (protein > 30) biggestWin = { title: "Strong Protein Intake", description: "You've included good sources of protein which helps with satiety and recovery." };
    else if (cals <= dailyGoal && goal === 'Lose Weight') biggestWin = { title: "On Track", description: "You are currently on track with your calorie target." };

    let improvement = { title: "Balanced Plate", description: "Try to ensure every meal has a good mix of nutrients." };
    let nextAction = { title: "Give your next meal a little more balance", description: "Your meals today have been light on vegetables. Adding one serving to your next meal could improve variety and fiber." };
    let educationalInsight = { title: "Did You Know?", description: "Vegetables add volume to your meals without adding many calories, keeping you full." };

    const sugaryDrink = sortedLogs.find(c => c.name.toLowerCase().includes('coke') || c.name.toLowerCase().includes('soda') || c.name.toLowerCase().includes('juice'));
    const waterAfterSugary = sugaryDrink && sortedLogs.find(c => c.name.toLowerCase().includes('water') && c.timestamp > sugaryDrink.timestamp);
    const friedFood = sortedLogs.find(c => c.name.toLowerCase().includes('fried') || c.name.toLowerCase().includes('puff'));

    if (sugaryDrink && !waterAfterSugary) {
      improvement = { title: "Reduce Sugary Drinks", description: `${sugaryDrink.name} contributed unnecessary calories today.` };
      nextAction = { title: "Hydrate for your next choice", description: `You had ${sugaryDrink.name} earlier. Replacing your next drink with water can help stabilize your energy and reduce hidden calories.` };
      educationalInsight = { title: "Did You Know?", description: "Sugary drinks cause rapid spikes in blood sugar, often followed by crashes that increase hunger." };
    } else if (sugaryDrink && waterAfterSugary) {
      biggestWin = { title: "Hydration Focus Completed ✓", description: "You replaced a sugary drink habit by logging water." };
      improvement = { title: "Watch the Oil", description: "Try to keep meals light and avoid deep frying." };
      nextAction = { title: "Keep the momentum going", description: "You've already made a great swap with water today. Consider adding a high-fiber side to your next meal to maintain steady energy." };
      educationalInsight = { title: "Did You Know?", description: "Water helps your body process nutrients and keeps you feeling full longer." };
    } else if (friedFood) {
      improvement = { title: "Watch the Oil", description: `${friedFood.name} adds a significant amount of fat.` };
      nextAction = { title: "Opt for a lighter preparation", description: `Since you had ${friedFood.name} earlier, choosing a boiled or grilled option next can naturally balance your fat intake for the day.` };
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

    for (const meal of meals) {
      const mealLogs = logs.filter(c => c.mealCategory === meal);
      if (mealLogs.length === 0) continue;

      const cals = mealLogs.reduce((sum, c) => sum + c.calories, 0);
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
      
      const hasVeggie = mealLogs.some(c => c.name.toLowerCase().includes('salad') || c.name.toLowerCase().includes('eru') || c.name.toLowerCase().includes('fruit'));
      if (hasVeggie) {
         positiveChoice = "Great choice including fiber-rich or fresh foods.";
         nutritionScore += 15;
      }

      const sugaryDrink = mealLogs.find(c => c.name.toLowerCase().includes('coke') || c.name.toLowerCase().includes('soda'));
      const friedFood = mealLogs.find(c => c.name.toLowerCase().includes('fried'));

      if (sugaryDrink) {
        improvement = `This meal included a significant amount of sugar from ${sugaryDrink.name.toLowerCase()}.`;
        nextSuggestion = "Replacing sugary drinks with water would significantly reduce calories.";
        nutritionScore -= 20;
      } else if (friedFood) {
        improvement = `This meal was heavy due to ${friedFood.name.toLowerCase()}.`;
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

    const daysLogged = new Set(weeklyLogs.map(c => new Date(c.timestamp).toDateString()));

    weeklyLogs.forEach(c => {
      if (c.mealCategory === 'Breakfast') breakfastCount++;
      const name = c.name.toLowerCase();
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
