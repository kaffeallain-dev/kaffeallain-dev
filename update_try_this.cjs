const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldTryThis = `<button 
                  onClick={onLogFood}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-sm text-center shadow-sm"
                >
                  Try this
                </button>`;

const newTryThis = `<button 
                  onClick={() => onLogFood(nextMeal)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-sm text-center shadow-sm"
                >
                  Try this
                </button>`;

code = code.replace(oldTryThis, newTryThis);
fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Updated Try This.");
