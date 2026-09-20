const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldApp = `<AnalyticsView 
                      onLogFood={() => { setLogMealContext({meal: 'Snacks', food: null}); setCurrentTab('Meals'); }} 
                    />`;

const newApp = `<AnalyticsView 
                      onLogFood={(food) => { setLogMealContext({meal: 'Snacks', food: food || null}); setCurrentTab('Meals'); }} 
                    />`;

code = code.replace(oldApp, newApp);
fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx.");
