const fs = require('fs');
let code = fs.readFileSync('src/views/DashboardView.tsx', 'utf-8');

code = code.replace(
  '<span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">{Math.round(cals)} kcal</span>\n                      </div>\n                      <p className="text-xs text-gray-500 truncate">\n                        {items.map(i => i.name).join(\' · \')}\n                      </p>\n                    </li>',
  '<span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">~{Math.round(cals)} kcal · Estimated</span>\n                      </div>\n                      <div className="flex justify-between items-start mt-0.5">\n                        <p className="text-xs text-gray-500 truncate flex-1 pr-2">\n                          {items.map(i => i.name).join(\' · \')}\n                        </p>\n                        <button\n                          onClick={() => onLogFood(meal)}\n                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 shrink-0 flex items-center gap-0.5 transition-colors"\n                        >\n                          Review estimate &rarr;\n                        </button>\n                      </div>\n                    </li>'
);

code = code.replace(
  '<span className="text-xs font-bold text-gray-600">{selectedDateConsumptions.length} item(s) logged today</span>',
  '<span className="text-xs font-bold text-gray-600">\n                  {selectedDateConsumptions.length} {selectedDateConsumptions.length === 1 ? \'meal\' : \'meals\'} logged today\n                </span>'
);

fs.writeFileSync('src/views/DashboardView.tsx', code);
console.log("Done");
