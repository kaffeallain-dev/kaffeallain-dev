const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldTrends = `  const getWeeklyTrends = () => {
    if (daysWithData < 3) {
      return { hasEnoughData: false };
    }
    
    const trends = [];
    
    // Vegetables
    if (currentSummary.weeklyPattern.vegetableTrend === 'Needs Improvement') {
      trends.push({
        id: 'veg-bad',
        title: 'Vegetables',
        status: 'Needs attention',
        observation: 'Vegetables appeared less often than your usual pattern.',
        nextStep: 'Try adding a vegetable-rich side to one more meal this week.',
        priority: 1,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'veg-good',
        title: 'Vegetables',
        status: 'Looking good',
        observation: 'Vegetables have appeared consistently across your logged meals.',
        priority: 3,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Protein
    if (currentSummary.weeklyPattern.proteinTrend === 'Strong') {
      trends.push({
        id: 'protein-good',
        title: 'Protein',
        status: 'Looking good',
        observation: 'Protein has been consistent across your logged meals.',
        nextStep: 'Keep including strong protein sources to support satiety.',
        priority: 1,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    } else {
      trends.push({
        id: 'protein-avg',
        title: 'Protein',
        status: 'Average',
        observation: 'Protein intake has been moderate across your logged meals.',
        priority: 4,
        colorClass: 'text-gray-700 bg-gray-50 border-gray-200'
      });
    }
    
    // Sugary Drinks
    if (currentSummary.weeklyPattern.sugaryDrinkTrend === 'High') {
      trends.push({
        id: 'sugar-high',
        title: 'Sugary Drinks',
        status: 'Needs attention',
        observation: 'Sugary drinks appeared frequently in your recent logs.',
        nextStep: 'Consider substituting water or a sugar-free alternative for one drink tomorrow.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    }
    
    // Fried Foods
    if (currentSummary.weeklyPattern.friedFoodTrend === 'High') {
      trends.push({
        id: 'fried-high',
        title: 'Fried Foods',
        status: 'Needs attention',
        observation: 'Fried foods appeared frequently in your recent logs.',
        nextStep: 'If reducing fried foods is part of your goal, try a grilled or boiled option for one meal.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    }
    
    trends.sort((a, b) => a.priority - b.priority);
    return {
      hasEnoughData: true,
      primary: trends[0],
      secondary: trends.slice(1, 4) // Show up to 3 secondary
    };
  };`;

const newTrends = `  const getWeeklyTrends = () => {
    if (daysWithData < 3) {
      return { hasEnoughData: false };
    }
    
    // Calculate actual occurrences
    let vegMeals = 0;
    let highProteinMeals = 0;
    let sugaryDrinks = 0;
    let friedFoods = 0;
    
    weeklyLogs.forEach(c => {
      const name = c.name.toLowerCase();
      if (name.includes('salad') || name.includes('eru') || name.includes('vegetable')) vegMeals++;
      if ((c.protein || 0) > 20) highProteinMeals++;
      if (name.includes('coke') || name.includes('soda') || name.includes('juice')) sugaryDrinks++;
      if (name.includes('fried') || name.includes('puff')) friedFoods++;
    });

    const totalMeals = weeklyLogs.length;

    const trends = [];
    
    // Vegetables
    if (currentSummary.weeklyPattern.vegetableTrend === 'Needs Improvement') {
      trends.push({
        id: 'veg-bad',
        title: 'Vegetables',
        status: 'Needs attention',
        observation: \`Vegetables appeared in \${vegMeals} of your \${totalMeals} logged meals this week.\`,
        nextStep: 'Try adding a vegetable-rich side to one more meal this week.',
        priority: 1,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'veg-good',
        title: 'Vegetables',
        status: 'Looking good',
        observation: \`Vegetables appeared in \${vegMeals} of your \${totalMeals} logged meals this week.\`,
        priority: 3,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Protein
    if (currentSummary.weeklyPattern.proteinTrend === 'Strong') {
      trends.push({
        id: 'protein-good',
        title: 'Protein',
        status: 'Looking good',
        observation: \`Strong protein sources appeared in \${highProteinMeals} of your \${totalMeals} logged meals.\`,
        nextStep: 'Keep including strong protein sources to support satiety.',
        priority: 1,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    } else {
      trends.push({
        id: 'protein-avg',
        title: 'Protein',
        status: 'Average',
        observation: \`Protein intake has been moderate across your \${totalMeals} logged meals.\`,
        priority: 4,
        colorClass: 'text-gray-700 bg-gray-50 border-gray-200'
      });
    }
    
    // Sugary Drinks
    if (currentSummary.weeklyPattern.sugaryDrinkTrend === 'High') {
      trends.push({
        id: 'sugar-high',
        title: 'Sugary Drinks',
        status: 'Needs attention',
        observation: \`Sugary drinks appeared in \${sugaryDrinks} of your \${totalMeals} recent logs.\`,
        nextStep: 'Consider substituting water or a sugar-free alternative for one drink tomorrow.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'sugar-low',
        title: 'Sugary Drinks',
        status: 'Looking good',
        observation: \`Sugary drinks were minimal across your \${totalMeals} logged meals.\`,
        priority: 5,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Fried Foods
    if (currentSummary.weeklyPattern.friedFoodTrend === 'High') {
      trends.push({
        id: 'fried-high',
        title: 'Fried Foods',
        status: 'Needs attention',
        observation: \`Fried foods appeared in \${friedFoods} of your \${totalMeals} recent logs.\`,
        nextStep: 'If reducing fried foods is part of your goal, try a grilled or boiled option for one meal.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'fried-low',
        title: 'Fried Foods',
        status: 'Looking good',
        observation: \`Fried foods were minimal across your \${totalMeals} logged meals.\`,
        priority: 6,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    trends.sort((a, b) => a.priority - b.priority);
    return {
      hasEnoughData: true,
      primary: trends[0],
      secondary: trends.slice(1, 4) // Show up to 3 secondary
    };
  };`;

if(code.indexOf(oldTrends) !== -1) {
    code = code.replace(oldTrends, newTrends);
    fs.writeFileSync('src/views/AnalyticsView.tsx', code);
    console.log("Patched getWeeklyTrends");
} else {
    console.log("Could not find getWeeklyTrends to patch.");
}
