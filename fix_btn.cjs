const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

code = code.replace(
  'Log to {mealCategory}',
  '{initialRecord ? "Save Changes" : `Log to ${mealCategory}`}'
);
// wait, the JSX is:
// <Check className="w-5 h-5" />
// Log to {mealCategory}

code = code.replace(
  'Log to {mealCategory}',
  '{initialRecord ? "Save Changes" : `Log to ${mealCategory}`}'
);

// We need to also change the title:
// <h1 className="text-xl font-bold text-gray-900">Add Food</h1>
code = code.replace(
  '<h1 className="text-xl font-bold text-gray-900">Add Food</h1>',
  '<h1 className="text-xl font-bold text-gray-900">{initialRecord ? "Edit Meal" : "Add Food"}</h1>'
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
