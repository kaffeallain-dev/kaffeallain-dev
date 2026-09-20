const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldWhy = `<div>
                        <span className="font-bold text-gray-900 block mb-0.5">Why this food</span>
                        {nextMealAnalysis.goodSourceOf.length > 0 ? 
                          \`This meal is a great source of \${nextMealAnalysis.goodSourceOf.join(', ').toLowerCase()}.\` : 
                          'This meal balances your current nutritional gap effectively.'
                        }
                      </div>`;

const newWhy = `<div>
                        <span className="font-bold text-gray-900 block mb-0.5">Why this food</span>
                        {nextMealAnalysis.goodSourceOf.length > 0 ? 
                          \`This meal is a good source of \${nextMealAnalysis.goodSourceOf.join(' and ').toLowerCase()}.\` : 
                          (nextMealAnalysis.bestFor && nextMealAnalysis.bestFor.length > 0) ?
                          \`This meal is known to be good for \${nextMealAnalysis.bestFor.join(' and ').toLowerCase()}.\` :
                          'This meal fits your current nutritional pattern.'
                        }
                      </div>`;

code = code.replace(oldWhy, newWhy);
fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Updated Why.");
