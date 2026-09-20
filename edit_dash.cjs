const fs = require('fs');
let code = fs.readFileSync('src/views/DashboardView.tsx', 'utf8');

code = code.replace(
  'onLogFood: (meal: MealCategory, food?: any) => void;',
  'onLogFood: (meal: MealCategory, food?: any, record?: any) => void;'
);

code = code.replace(
  'onClick={() => onLogFood(meal)}\n                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 shrink-0 flex items-center gap-0.5 transition-colors"\n                        >\n                          Review estimate &rarr;',
  'onClick={() => onLogFood(meal, null, item)}\n                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 shrink-0 flex items-center gap-0.5 transition-colors"\n                        >\n                          Review estimate &rarr;'
);

fs.writeFileSync('src/views/DashboardView.tsx', code);
console.log("Updated DashboardView.tsx");
