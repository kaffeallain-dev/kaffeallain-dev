const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add ConsumptionRecord to imports if missing
if (!code.includes('ConsumptionRecord')) {
  code = code.replace(
    'import { MealCategory, FoodItemTemplate } from \'./types\';',
    'import { MealCategory, FoodItemTemplate, ConsumptionRecord } from \'./types\';'
  );
}

// Update logMealContext type
code = code.replace(
  'useState<{meal: MealCategory, food?: FoodItemTemplate | null}>({ meal: \'Snacks\' });',
  'useState<{meal: MealCategory, food?: FoodItemTemplate | null, record?: ConsumptionRecord | null}>({ meal: \'Snacks\' });'
);

// Update DashboardView onLogFood
code = code.replace(
  'onLogFood={(meal, food) => { setLogMealContext({meal, food}); setCurrentTab(\'Meals\'); }}',
  'onLogFood={(meal, food, record) => { setLogMealContext({meal, food, record}); setCurrentTab(\'Meals\'); }}'
);

// Update LogFoodView initialRecord
code = code.replace(
  '<LogFoodView \n                      initialMeal={logMealContext.meal} \n                      initialFood={logMealContext.food} \n                      onBack={() => setCurrentTab(\'Home\')} \n                    />',
  '<LogFoodView \n                      initialMeal={logMealContext.meal} \n                      initialFood={logMealContext.food} \n                      initialRecord={logMealContext.record} \n                      onBack={() => setCurrentTab(\'Home\')} \n                    />'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx");
