const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

// 1. Food Detail Header (Name and Calories)
code = code.replace(
  `<h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedFood.name}</h2>
            <p className="text-gray-500 font-medium mb-3">{selectedFood.calories} kcal per {selectedFood.servingSizeText} (Medium)</p>`,
  `<h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            <p className="text-emerald-700 font-medium text-sm bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4">~{selectedFood.calories} kcal &middot; {selectedFood.servingSizeText}</p>`
);

// 2. Add safe bottom padding to the main detail container
// Find: <div className="max-w-md mx-auto w-full bg-white min-h-screen pb-safe">
code = code.replace(
  '<div className="max-w-md mx-auto w-full bg-white min-h-screen pb-safe">',
  '<div className="max-w-md mx-auto w-full bg-white min-h-screen pb-32">'
);

// 3. Update the portion sizes to use "~X kcal"
code = code.replace(
  '<span className="text-xs opacity-70">{cals} kcal</span>',
  '<span className="text-xs opacity-70">~{cals} kcal</span>'
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated detail header and padding.");
