const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

code = code.replace(
  '<span className="text-3xl font-bold text-gray-900">{totalCals || 0}</span>',
  '<span className="text-3xl font-bold text-gray-900">~{totalCals || 0}</span>'
);

// We need to implement dynamic meal category selection based on time.
// LogFoodView state: const [mealCategory, setMealCategory] = useState<MealCategory>(initialMeal);
// Let's replace the initialization.

code = code.replace(
  'const [mealCategory, setMealCategory] = useState<MealCategory>(initialMeal);',
  `const [mealCategory, setMealCategory] = useState<MealCategory>(() => {
    if (initialRecord) return initialRecord.mealCategory;
    if (initialMeal && initialMeal !== 'Snacks') return initialMeal;
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Breakfast';
    if (hour >= 11 && hour < 16) return 'Lunch';
    if (hour >= 16 && hour < 22) return 'Dinner';
    return 'Snacks';
  });`
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated total calories and meal category.");
