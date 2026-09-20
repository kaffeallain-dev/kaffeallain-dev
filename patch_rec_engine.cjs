const fs = require('fs');

let code = fs.readFileSync('src/lib/RecommendationEngine.ts', 'utf8');

const oldMethodRegex = /static getContextualRecommendation\([^]*?\)\s*\{[^]*?return \{ food: bestCandidate, reason: bestReason, confidence, actionType \};\n  \}/;

const newMethod = `static getContextualRecommendation(
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
          bestReason = \`Recommended because it aligns with your goal: \${compatibility.reason.toLowerCase()}\`;
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
  }`;

if (oldMethodRegex.test(code)) {
  code = code.replace(oldMethodRegex, newMethod);
  fs.writeFileSync('src/lib/RecommendationEngine.ts', code);
  console.log("Patched RecommendationEngine logic successfully");
} else {
  console.log("Could not find the method with regex");
}
