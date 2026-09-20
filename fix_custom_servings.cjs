const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

const oldCustomBtn = `<div className="flex items-center justify-between mt-4">
              <button 
                onClick={() => setPortionSize('Custom')}
                className={\`text-sm font-medium \${portionSize === 'Custom' ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}\`}
              >
                Custom Servings
              </button>
            </div>
            
            {portionSize === 'Custom' && (
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                
                placeholder="Number of servings"
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all mt-2"
              />
            )}`;

const newCustomBtn = `<div className="mt-4 flex flex-col gap-2">
              <button 
                onClick={() => setPortionSize('Custom')}
                className={\`text-sm font-semibold w-full py-3 rounded-xl border transition-colors flex justify-between items-center px-4 \${
                  portionSize === 'Custom' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }\`}
              >
                <span>Custom serving</span>
                {portionSize === 'Custom' ? (
                   <span className="text-emerald-700 font-bold">{servings}</span>
                ) : (
                   <span className="text-gray-400 font-normal">Tap to edit</span>
                )}
              </button>
              {portionSize === 'Custom' && (
                <div className="flex items-center gap-3 mt-1">
                   <button onClick={() => setServings((Math.max(0.1, parseFloat(servings || '1') - 0.5)).toString())} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">-</button>
                   <input
                     type="number"
                     min="0.1"
                     step="0.1"
                     value={servings}
                     onChange={(e) => setServings(e.target.value)}
                     placeholder="e.g. 1.5"
                     className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                   />
                   <button onClick={() => setServings((parseFloat(servings || '1') + 0.5).toString())} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">+</button>
                </div>
              )}
            </div>`;
            
code = code.replace(oldCustomBtn, newCustomBtn);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated custom servings.");
