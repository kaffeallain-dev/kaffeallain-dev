const fs = require('fs');
let code = fs.readFileSync('src/views/DashboardView.tsx', 'utf8');

const regex = /\{mealCategories\.map\(meal => \{[\s\S]*?\}\)\}/;

const newCode = `{mealCategories.map(meal => {
                  const items = selectedDateConsumptions.filter(c => c.mealCategory === meal);
                  if (items.length === 0) return null;
                  return (
                    <li key={meal} className="p-3">
                      <h3 className="font-bold text-gray-900 text-sm mb-3">{meal}</h3>
                      <ul className="space-y-4">
                        {items.map(item => (
                          <li key={item.id} className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                ~{Math.round(item.calories)} kcal &middot; Estimated
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">
                                {item.servings} serving{item.servings !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => onLogFood(meal, null, item)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center transition-colors"
                              >
                                Review estimate &rarr;
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/views/DashboardView.tsx', code);
console.log("Replaced");
