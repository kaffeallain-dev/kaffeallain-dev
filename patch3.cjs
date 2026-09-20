const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

// 1. Update 0-meal and 1-meal states
code = code.replace(
  'message: "Log a meal to help MboaFit understand your eating pattern."',
  'message: "Your food pattern for today hasn\'t started yet."'
);
code = code.replace(
  'message: "You\'ve made a start. Log your next meal to see your daily pattern."',
  'message: "You\'ve logged one meal. Another meal will provide a clearer picture."'
);

// 2. Update Food Pattern vegetable educational copy
code = code.replace(
  'whyItMatters: "Vegetables provide essential fiber to keep you full and micronutrients for energy."',
  'whyItMatters: "Vegetables can add fiber and important vitamins and minerals to your meals."'
);

// 3. Move "Your Next Meal"
// We need to capture from {/* Next Best Meal Recommendation */} to just before {/* Nutrition Gaps & Trends */}
// And insert it right after the </motion.div> of {/* Today's Focus */}

// Find Today's Focus
const todaysFocusRegex = /\{\/\* Today's Focus \*\/\}[\s\S]*?<\/motion\.div>/;
const todaysFocusMatch = code.match(todaysFocusRegex);

// Find Next Best Meal Recommendation
const nextMealRegex = /\{\/\* Next Best Meal Recommendation \*\/\}[\s\S]*?(?=\{\/\* Nutrition Gaps & Trends \*\/)/;
const nextMealMatch = code.match(nextMealRegex);

if (todaysFocusMatch && nextMealMatch) {
  // Remove nextMeal from its original position
  code = code.replace(nextMealMatch[0], '');
  
  // Insert it after Today's Focus
  code = code.replace(
    todaysFocusMatch[0],
    todaysFocusMatch[0] + '\n\n        ' + nextMealMatch[0].trim()
  );
} else {
  console.log("Could not find regex matches!");
}

fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("AnalyticsView patched for final polish.");
