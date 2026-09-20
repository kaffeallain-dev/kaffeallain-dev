const fs = require('fs');
let code = fs.readFileSync('src/views/AnalyticsView.tsx', 'utf8');

const oldPattern = `<div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your recent pattern</span>
                        {todayLogs.length > 0 ? 
                          (gap.includes('Vegetables') ? 'Your meals today have been light on vegetables.' : 
                           gap.includes('Protein') ? 'Your protein intake is slightly below average today.' : 
                           gap.includes('Water') ? 'You recently had sugary drinks and might need hydration.' : 
                           'Your meals have lacked some healthy fats and minerals.')
                          : 'Based on what you\\'ve logged so far, we don\\'t have a clear pattern for today yet.'
                        }
                      </div>`;

const newPattern = `<div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your recent pattern</span>
                        {(() => {
                           if (todayLogs.length === 0) return "Based on what you've logged so far, we don't have a clear pattern for today yet.";
                           
                           if (gap.includes('Vegetables')) {
                              const vegMeals = todayLogs.filter(m => m.name.toLowerCase().includes('eru') || m.name.toLowerCase().includes('ndolé') || m.name.toLowerCase().includes('salad') || m.name.toLowerCase().includes('veg'));
                              if (vegMeals.length === 0) return "Vegetables haven't appeared in the meals you've logged today.";
                              return \`Vegetables appeared in \${vegMeals.length} of your \${todayLogs.length} logged meals today.\`;
                           }
                           if (gap.includes('Protein')) {
                              const highProtein = todayLogs.filter(m => (m.protein || 0) > 15);
                              if (highProtein.length === 0) return "High-protein sources haven't appeared in the meals you've logged today.";
                              return \`Strong protein sources appeared in \${highProtein.length} of your \${todayLogs.length} logged meals today.\`;
                           }
                           if (gap.includes('Water')) {
                              const sugary = todayLogs.filter(m => m.name.toLowerCase().includes('coke') || m.name.toLowerCase().includes('soda') || m.name.toLowerCase().includes('juice'));
                              if (sugary.length > 0) return \`You've logged \${sugary.length} sugary drink\${sugary.length > 1 ? 's' : ''} today.\`;
                              return "You haven't logged adequate hydration today.";
                           }
                           return \`You've logged \${todayLogs.length} meal\${todayLogs.length > 1 ? 's' : ''} today.\`;
                        })()}
                      </div>`;

code = code.replace(oldPattern, newPattern);
fs.writeFileSync('src/views/AnalyticsView.tsx', code);
console.log("Updated Pattern.");
