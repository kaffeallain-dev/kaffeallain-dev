const fs = require('fs');
let code = fs.readFileSync('src/lib/RecommendationEngine.ts', 'utf8');

const oldInsights = `  private static generateDailyInsights(logs: ConsumptionRecord[], dailyGoal: number, goal: string) {
    if (logs.length === 0) {
      return {
        biggestWin: { title: "Getting Started", description: "Every journey begins with a single step." },
        improvement: { title: "Log a Meal", description: "You haven't logged any food today." },
        nextAction: { title: "Today's Focus", description: "Log your first meal to get personalized insights." },
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
    let nextAction = { title: "Today's Focus", description: "Add a portion of vegetables to your next meal." };
    let educationalInsight = { title: "Did You Know?", description: "Vegetables add volume to your meals without adding many calories, keeping you full." };

    const sugaryDrink = sortedLogs.find(c => c.name.toLowerCase().includes('coke') || c.name.toLowerCase().includes('soda'));
    const waterAfterSugary = sugaryDrink && sortedLogs.find(c => c.name.toLowerCase().includes('water') && c.timestamp > sugaryDrink.timestamp);
    const friedFood = sortedLogs.find(c => c.name.toLowerCase().includes('fried') || c.name.toLowerCase().includes('puff'));

    if (sugaryDrink && !waterAfterSugary) {
      improvement = { title: "Reduce Sugary Drinks", description: \`\${sugaryDrink.name} contributed unnecessary calories today.\` };
      nextAction = { title: "Today's Focus", description: "Replace a sugary drink with water for your next meal." };
      educationalInsight = { title: "Did You Know?", description: "Sugary drinks cause rapid spikes in blood sugar, often followed by crashes that increase hunger." };
    } else if (sugaryDrink && waterAfterSugary) {
      biggestWin = { title: "Hydration Focus Completed ✓", description: "You replaced a sugary drink habit by logging water." };
      improvement = { title: "Watch the Oil", description: "Try to keep meals light and avoid deep frying." };
      nextAction = { title: "Next Focus", description: "Add beans, eggs, or a high-fiber side to your next meal." };
      educationalInsight = { title: "Did You Know?", description: "Water helps your body process nutrients and keeps you feeling full longer." };
    } else if (friedFood) {
      improvement = { title: "Watch the Oil", description: \`\${friedFood.name} adds a significant amount of fat.\` };
      nextAction = { title: "Today's Focus", description: "Try a boiled or grilled option instead of frying next time." };
      educationalInsight = { title: "Did You Know?", description: "Frying food significantly increases its calorie density without improving how full it makes you feel." };
    } else if (protein < 20 && goal === 'Build Muscle') {
      improvement = { title: "Increase Protein", description: "Your protein intake is quite low so far today." };
      nextAction = { title: "Today's Focus", description: "Add beans, eggs, or fish to your next meal." };
      educationalInsight = { title: "Did You Know?", description: "Protein is the building block of muscle. Without it, workouts won't yield optimal results." };
    }

    return { biggestWin, improvement, nextAction, educationalInsight };
  }`;

const newInsights = `  private static generateDailyInsights(logs: ConsumptionRecord[], dailyGoal: number, goal: string) {
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
      improvement = { title: "Reduce Sugary Drinks", description: \`\${sugaryDrink.name} contributed unnecessary calories today.\` };
      nextAction = { title: "Hydrate for your next choice", description: \`You had \${sugaryDrink.name} earlier. Replacing your next drink with water can help stabilize your energy and reduce hidden calories.\` };
      educationalInsight = { title: "Did You Know?", description: "Sugary drinks cause rapid spikes in blood sugar, often followed by crashes that increase hunger." };
    } else if (sugaryDrink && waterAfterSugary) {
      biggestWin = { title: "Hydration Focus Completed ✓", description: "You replaced a sugary drink habit by logging water." };
      improvement = { title: "Watch the Oil", description: "Try to keep meals light and avoid deep frying." };
      nextAction = { title: "Keep the momentum going", description: "You've already made a great swap with water today. Consider adding a high-fiber side to your next meal to maintain steady energy." };
      educationalInsight = { title: "Did You Know?", description: "Water helps your body process nutrients and keeps you feeling full longer." };
    } else if (friedFood) {
      improvement = { title: "Watch the Oil", description: \`\${friedFood.name} adds a significant amount of fat.\` };
      nextAction = { title: "Opt for a lighter preparation", description: \`Since you had \${friedFood.name} earlier, choosing a boiled or grilled option next can naturally balance your fat intake for the day.\` };
      educationalInsight = { title: "Did You Know?", description: "Frying food significantly increases its calorie density without improving how full it makes you feel." };
    } else if (protein < 20 && goal === 'Build Muscle') {
      improvement = { title: "Increase Protein", description: "Your protein intake is quite low so far today." };
      nextAction = { title: "Prioritize protein in your next meal", description: "Your logged meals are a bit low in protein right now. Adding beans, eggs, or fish will help support your muscle-building goal." };
      educationalInsight = { title: "Did You Know?", description: "Protein is the building block of muscle. Without it, workouts won't yield optimal results." };
    }

    return { biggestWin, improvement, nextAction, educationalInsight };
  }`;

code = code.replace(oldInsights, newInsights);
fs.writeFileSync('src/lib/RecommendationEngine.ts', code);
console.log("Updated generateDailyInsights.");
