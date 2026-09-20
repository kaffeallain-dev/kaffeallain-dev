const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

// 1. Add getServingDescription at the top of the file, outside of LogFoodView or inside it
const servingFn = `  // Helper to format serving descriptions intelligently
  const getServingDescription = (size: string, baseText: string = 'serving') => {
    const match = baseText.match(/^([\\d.]+)\\s*(.*)/);
    if (match) {
      const num = parseFloat(match[1]);
      let unit = match[2] || 'serving';
      const multi = size === 'Small' ? 0.5 : size === 'Large' ? 1.5 : 1;
      const finalNum = num * multi;
      
      const prefix = size !== 'Medium' ? 'About ' : '';
      let formattedNum = finalNum.toString();
      if (finalNum === 0.5) formattedNum = '½';
      else if (finalNum === 1.5) formattedNum = '1½';
      
      if (finalNum <= 1 && unit.endsWith('s') && !unit.endsWith('ss') && unit !== 'grams') unit = unit.slice(0, -1);
      if (finalNum > 1 && !unit.endsWith('s') && unit !== 'g' && unit !== 'ml') unit += 's';
      
      return \`\${prefix}\${formattedNum} \${unit}\`.trim();
    }
    
    const b = baseText.toLowerCase();
    if (size === 'Small') return \`About ½ \${b}\`;
    if (size === 'Medium') return \`1 \${b}\`;
    if (size === 'Large') return \`About 1½ \${b}s\`.replace('ss', 's');
    return '';
  };
`;

code = code.replace('  // Helper to get multiplier based on portion size', servingFn + '\n  // Helper to get multiplier based on portion size');

// 2. Update Food Summary Header
const oldHeader = `<h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            <p className="text-emerald-700 font-medium text-sm bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4">~{selectedFood.calories} kcal &middot; {selectedFood.servingSizeText}</p>`;

const newHeader = `<h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            <p className="text-emerald-700 font-medium text-sm bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4">
              ~{totalCals} kcal &middot; {getServingDescription(portionSize === 'Custom' ? 'Medium' : portionSize, selectedFood.servingSizeText)}
            </p>`;

code = code.replace(oldHeader, newHeader);

// 3. Update Intelligence Section
// It spans from {(() => { to })()}
const intelRegex = /\{\(\(\) => \{[\s\S]*?\}\)\(\)\}/;

const newIntel = `{(() => {
              const userGoal = settings.profile?.primaryGoal || 'Eat Healthier';
              const comp = RecommendationEngine.evaluateGoalCompatibility(selectedFood, userGoal);
              const intel = RecommendationEngine.analyzeFood(selectedFood);
              
              const formatGoal = (g: string) => {
                if (g === 'Lose Weight') return 'WEIGHT LOSS';
                if (g === 'Build Muscle') return 'MUSCLE BUILDING';
                if (g === 'Gain Weight') return 'WEIGHT GAIN';
                return 'GENERAL HEALTH';
              };
              
              const levelText = comp.level === 'Excellent' ? 'EXCELLENT FOR' : comp.level === 'Moderate' ? 'GOOD CHOICE FOR' : 'LIMIT FOR';
              
              const getIntelSections = () => {
                  const sections = [];
                  
                  if (intel.bestFor && intel.bestFor.length > 0) {
                    sections.push({ id: 'bestFor', title: 'Best For', type: 'tags', data: intel.bestFor });
                  }
                  if (intel.goodSourceOf && intel.goodSourceOf.length > 0) {
                    sections.push({ id: 'goodSourceOf', title: 'Good Source Of', type: 'tags', data: intel.goodSourceOf });
                  }
                  
                  const makeItBetter = [];
                  if (intel.betterAlternative && intel.betterAlternative !== 'None') {
                    makeItBetter.push(intel.betterAlternative);
                  }
                  if (selectedFood.preparationNotes) {
                    makeItBetter.push(selectedFood.preparationNotes);
                  }
                  if (makeItBetter.length > 0) {
                    sections.push({ id: 'makeItBetter', title: 'Make It Better', type: 'text', data: makeItBetter.join(' • '), color: 'text-emerald-600' });
                  }
                  
                  if (intel.suggestedPairing && intel.suggestedPairing !== 'None') {
                    sections.push({ id: 'pairing', title: 'Pairing', type: 'text', data: intel.suggestedPairing, color: 'text-blue-600' });
                  }
                  
                  if (intel.potentialConcerns && intel.potentialConcerns.length > 0) {
                    sections.push({ id: 'concerns', title: 'Potential Concerns', type: 'text', data: intel.potentialConcerns.join(', '), color: 'text-amber-600' });
                  }
                  
                  if (userGoal === 'Lose Weight') {
                     const order = ['bestFor', 'makeItBetter', 'concerns', 'pairing', 'goodSourceOf'];
                     sections.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
                  } else if (userGoal === 'Build Muscle') {
                     const order = ['goodSourceOf', 'pairing', 'bestFor', 'makeItBetter', 'concerns'];
                     sections.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
                  } else if (userGoal === 'Gain Weight') {
                     const order = ['pairing', 'goodSourceOf', 'bestFor', 'makeItBetter', 'concerns'];
                     sections.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
                  }
                  
                  return sections;
              };
              
              const sections = getIntelSections();
              const hasIntel = sections.length > 0 || intel.recommendedFrequency;

              return (
                <div className="flex flex-col gap-3 mb-6">
                  <div className={\`p-4 rounded-xl border flex flex-col gap-1 \${
                    comp.level === 'Excellent' ? 'bg-emerald-50/50 border-emerald-100' :
                    comp.level === 'Moderate' ? 'bg-blue-50/50 border-blue-100' :
                    'bg-amber-50/50 border-amber-100'
                  }\`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className={\`w-4 h-4 \${
                        comp.level === 'Excellent' ? 'text-emerald-600' :
                        comp.level === 'Moderate' ? 'text-blue-600' :
                        'text-amber-600'
                      }\`} />
                      <span className={\`text-xs font-bold uppercase tracking-wider \${
                        comp.level === 'Excellent' ? 'text-emerald-700' :
                        comp.level === 'Moderate' ? 'text-blue-700' :
                        'text-amber-700'
                      }\`}>
                        {levelText} {formatGoal(userGoal)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{comp.reason}</p>
                  </div>
                  
                  {hasIntel && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Food Intelligence</h3>
                      
                      <div className="grid grid-cols-1 gap-y-4 text-sm">
                        {sections.map(sec => (
                          <div key={sec.id}>
                            <span className={\`text-xs font-semibold uppercase tracking-wider block mb-1 \${sec.color || 'text-gray-500'}\`}>
                              {sec.title}
                            </span>
                            {sec.type === 'tags' ? (
                              <div className="flex flex-wrap gap-1">
                                {(sec.data as string[]).map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white border rounded-md text-gray-700 text-xs shadow-sm">{item}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-700 text-sm leading-relaxed">{sec.data}</p>
                            )}
                          </div>
                        ))}
                        
                        {intel.recommendedFrequency && (
                          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm mt-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequency</span>
                            <span className={\`text-xs font-bold px-2 py-1 rounded-md \${
                              intel.recommendedFrequency === 'Daily' ? 'bg-emerald-100 text-emerald-700' :
                              intel.recommendedFrequency === 'Occasional' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }\`}>{intel.recommendedFrequency}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}`;

code = code.replace(intelRegex, newIntel);

// 4. Remove the old preparationNotes block, as it is now part of "Make It Better"
const oldNotesBlock = /{selectedFood\.preparationNotes && \([\s\S]*?Confidence[\s\S]*?<\/div>\s*\)\s*\}/;
code = code.replace(oldNotesBlock, '');

// 5. Update portion buttons
const oldPortions = `{(['Small', 'Medium', 'Large'] as const).map(size => {
                const multi = getPortionMultiplier(size, '1');
                const cals = Math.round(selectedFood.calories * multi);
                return (
                  <button
                    key={size}
                    onClick={() => setPortionSize(size)}
                    className={\`py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-colors \${
                      portionSize === size 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }\`}
                  >
                    <span className="font-bold text-sm mb-1">{size}</span>
                    <span className="text-xs opacity-70">~{cals} kcal</span>
                  </button>
                );
              })}`;

const newPortions = `{(['Small', 'Medium', 'Large'] as const).map(size => {
                const multi = getPortionMultiplier(size, '1');
                const cals = Math.round(selectedFood.calories * multi);
                const desc = getServingDescription(size, selectedFood.servingSizeText);
                return (
                  <button
                    key={size}
                    onClick={() => setPortionSize(size)}
                    className={\`py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-colors \${
                      portionSize === size 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }\`}
                  >
                    <span className="font-bold text-sm mb-0.5">{size}</span>
                    <span className="text-[10px] font-medium opacity-90 mb-1">{desc}</span>
                    <span className="text-xs opacity-70">~{cals} kcal</span>
                  </button>
                );
              })}`;
code = code.replace(oldPortions, newPortions);

// 6. Update Custom Serving Button to clearly say "Custom serving [ - ] 1.5 [ + ]" instead of just a button
// We can actually just show a button that says "Enter Custom Serving" and opens the input.
const oldCustomBtn = `<div className="flex items-center justify-between mt-4">
              <button 
                onClick={() => setPortionSize('Custom')}
                className={\`text-sm font-semibold flex items-center gap-1 \${portionSize === 'Custom' ? 'text-emerald-600' : 'text-gray-500 hover:text-emerald-600'}\`}
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

// 7. Update Meal Selector to have "WHEN DID YOU HAVE THIS?"
const oldMeal = `<label className="block text-sm font-semibold text-gray-700">Meal</label>`;
const newMeal = `<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">When did you have this?</label>`;
code = code.replace(oldMeal, newMeal);


fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated LogFoodView components.");
