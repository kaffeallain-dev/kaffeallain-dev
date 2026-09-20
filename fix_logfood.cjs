const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

if (!code.includes('initialRecord')) {
  // Update imports
  code = code.replace(
    'import { MealCategory, FoodItemTemplate, CustomFoodTemplate } from \'../types\';',
    'import { MealCategory, FoodItemTemplate, CustomFoodTemplate, ConsumptionRecord } from \'../types\';'
  );

  // Update signature
  code = code.replace(
    'export default function LogFoodView({ initialMeal, initialFood, onBack }: { initialMeal: MealCategory, initialFood?: FoodItemTemplate | null, onBack: () => void }) {',
    'export default function LogFoodView({ initialMeal, initialFood, initialRecord, onBack }: { initialMeal: MealCategory, initialFood?: FoodItemTemplate | null, initialRecord?: ConsumptionRecord | null, onBack: () => void }) {'
  );

  // Get data context updates
  code = code.replace(
    'const { settings, addConsumption, customFoods, allConsumptions, addCustomFood } = useData();',
    'const { settings, addConsumption, updateConsumption, customFoods, allConsumptions, addCustomFood } = useData();'
  );

  // Initialize selectedFood from initialRecord if present
  // If initialRecord is present, we create a fake FoodItemTemplate so the UI displays it.
  code = code.replace(
    "const [selectedFood, setSelectedFood] = useState<FoodItemTemplate | null>(initialFood || null);",
    `const [selectedFood, setSelectedFood] = useState<FoodItemTemplate | null>(() => {
    if (initialRecord) {
      return {
        id: initialRecord.id, // we might need to know it's a record id
        name: initialRecord.name,
        calories: initialRecord.calories / initialRecord.servings,
        protein: initialRecord.protein / initialRecord.servings,
        carbs: initialRecord.carbs / initialRecord.servings,
        fat: initialRecord.fat / initialRecord.servings,
        servingSizeText: '1 serving' // fallback
      } as FoodItemTemplate;
    }
    return initialFood || null;
  });`
  );

  // Set initial servings from record
  code = code.replace(
    "const [servings, setServings] = useState('1');",
    "const [servings, setServings] = useState(initialRecord ? initialRecord.servings.toString() : '1');"
  );
  
  // Update the save handler to use updateConsumption if initialRecord is present
  const oldSave = `await addConsumption({
      id: crypto.randomUUID(),
      name: selectedFood.name,
      calories: selectedFood.calories * numServings,
      protein: selectedFood.protein ? selectedFood.protein * numServings : 0,
      carbs: selectedFood.carbs ? selectedFood.carbs * numServings : 0,
      fat: selectedFood.fat ? selectedFood.fat * numServings : 0,
      servings: numServings,
      mealCategory,
      timestamp: Date.now()
    });`;
    
  const newSave = `if (initialRecord) {
      await updateConsumption({
        ...initialRecord,
        name: selectedFood.name,
        calories: selectedFood.calories * numServings,
        protein: selectedFood.protein ? selectedFood.protein * numServings : 0,
        carbs: selectedFood.carbs ? selectedFood.carbs * numServings : 0,
        fat: selectedFood.fat ? selectedFood.fat * numServings : 0,
        servings: numServings,
        mealCategory,
      });
    } else {
      await addConsumption({
        id: crypto.randomUUID(),
        name: selectedFood.name,
        calories: selectedFood.calories * numServings,
        protein: selectedFood.protein ? selectedFood.protein * numServings : 0,
        carbs: selectedFood.carbs ? selectedFood.carbs * numServings : 0,
        fat: selectedFood.fat ? selectedFood.fat * numServings : 0,
        servings: numServings,
        mealCategory,
        timestamp: Date.now()
      });
    }`;
    
  code = code.replace(oldSave, newSave);

  // Handle the back button resetting
  const oldBack = `onClick={() => {
              if (initialFood && selectedFood?.id === initialFood.id) {
                onBack();
              } else {
                setSelectedFood(null);
              }
            }}`;
            
  const newBack = `onClick={() => {
              if ((initialFood && selectedFood?.id === initialFood.id) || initialRecord) {
                onBack();
              } else {
                setSelectedFood(null);
              }
            }}`;
            
  code = code.replace(oldBack, newBack);

  fs.writeFileSync('src/views/LogFoodView.tsx', code);
  console.log("Updated LogFoodView.tsx");
} else {
  console.log("Already updated");
}
