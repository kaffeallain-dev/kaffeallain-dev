const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

const oldUI = `                      {group.map(food => (
                        <li key={food.id}>
                          <button
                            onClick={() => setSelectedFood(food)}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
                          >
                            <div>
                              <p className="font-semibold text-gray-900 group-hover:text-emerald-900">{food.name}</p>
                              <p className="text-sm text-gray-500 group-hover:text-emerald-600">{food.servingSizeText}</p>
                            </div>
                            <span className="font-bold text-gray-900 group-hover:text-emerald-900">{food.calories} <span className="text-xs text-gray-400 font-normal group-hover:text-emerald-600">kcal</span></span>
                          </button>
                        </li>
                      ))}`;

const newUI = `                      {group.map(food => {
                        const isCombo = (food as any).isComposite || food.foodType === 'Combo';
                        return (
                        <li key={food.id}>
                          <button
                            onClick={() => setSelectedFood(food)}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
                          >
                            <div className="flex-1 pr-4">
                              <p className="font-semibold text-gray-900 group-hover:text-emerald-900 flex items-center gap-2">
                                {food.name}
                                {isCombo && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                    Combo
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500 group-hover:text-emerald-600 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                            </div>
                            {food.category === 'Local' && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0">
                                Local
                              </span>
                            )}
                          </button>
                        </li>
                      )})}`;

code = code.replace(oldUI, newUI);
fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated UI");
