const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

// 1. Placeholder update
code = code.replace(
  'placeholder="Search thousands of foods..."',
  'placeholder="Search foods or meals..."'
);

// 2. Quick Log heading update
code = code.replace(
  '<Zap className="w-4 h-4 text-amber-500" /> Quick Log (Student Favorites)',
  'Popular meals'
);
// Make it look correct, remove the Zap if preferred or keep it but the text is "Quick Add"
// Actually, let's just replace the whole h3 content.
code = code.replace(
  /<h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">[\s\S]*?<\/h3>/m,
  '<h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">Quick Add</h3>'
);

// 3. Search Results formatting (Recent Foods)
code = code.replace(
  `<div>
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        <p className="text-sm text-gray-500">{food.servingSizeText}</p>
                      </div>
                      <span className="font-bold text-gray-900">{food.calories} <span className="text-xs text-gray-400 font-normal">kcal</span></span>`,
  `<div className="flex-1 pr-4">
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                      </div>`
);

// Quick Add formatting
code = code.replace(
  `<div>
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        <p className="text-sm text-gray-500">{food.servingSizeText}</p>
                      </div>
                      <span className="font-bold text-gray-900">{food.calories} <span className="text-xs text-gray-400 font-normal">kcal</span></span>`,
  `<div className="flex-1 pr-4">
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                      </div>`
);

// Search Results (actual search) formatting
code = code.replace(
  `<div>
                              <p className="font-semibold text-gray-900 group-hover:text-emerald-900">{food.name}</p>
                              <p className="text-sm text-gray-500 group-hover:text-emerald-600">{food.servingSizeText}</p>
                            </div>
                            <span className="font-bold text-gray-900 group-hover:text-emerald-900">{food.calories} <span className="text-xs text-gray-400 font-normal">kcal</span></span>`,
  `<div className="flex-1 pr-4">
                              <p className="font-semibold text-gray-900 group-hover:text-emerald-900">{food.name}</p>
                              <p className="text-sm text-gray-500 group-hover:text-emerald-600 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                            </div>
                            {food.category === 'Local' && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0">
                                Local
                              </span>
                            )}`
);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated search results & placeholders.");
