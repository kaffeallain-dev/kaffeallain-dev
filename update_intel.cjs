const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

const oldIntel = `              const getIntelSections = () => {
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
              const hasIntel = sections.length > 0 || intel.recommendedFrequency;`;

const newIntel = `              const getIntelSections = () => {
                  const primary: any[] = [];
                  const secondary: any[] = [];
                  
                  if (intel.bestFor && intel.bestFor.length > 0) {
                    primary.push({ id: 'bestFor', title: 'Best For', type: 'tags', data: intel.bestFor });
                  }
                  if (intel.goodSourceOf && intel.goodSourceOf.length > 0) {
                    primary.push({ id: 'goodSourceOf', title: 'Good Source Of', type: 'tags', data: intel.goodSourceOf });
                  }
                  
                  const makeItBetter = [];
                  if (intel.betterAlternative && intel.betterAlternative !== 'None') {
                    makeItBetter.push(intel.betterAlternative);
                  }
                  if (selectedFood.preparationNotes) {
                    makeItBetter.push(selectedFood.preparationNotes);
                  }
                  if (makeItBetter.length > 0) {
                    primary.push({ id: 'makeItBetter', title: 'Make It Better', type: 'text', data: makeItBetter.join(' • '), color: 'text-emerald-600' });
                  }
                  
                  if (intel.suggestedPairing && intel.suggestedPairing !== 'None') {
                    secondary.push({ id: 'pairing', title: 'Pairing', type: 'text', data: intel.suggestedPairing, color: 'text-blue-600' });
                  }
                  
                  if (intel.potentialConcerns && intel.potentialConcerns.length > 0) {
                    secondary.push({ id: 'concerns', title: 'Potential Concerns', type: 'text', data: intel.potentialConcerns.join(', '), color: 'text-amber-600' });
                  }
                  
                  if (userGoal === 'Lose Weight') { 
                     const pOrder = ['bestFor', 'makeItBetter', 'goodSourceOf'];
                     primary.sort((a,b) => pOrder.indexOf(a.id) - pOrder.indexOf(b.id));
                  } else if (userGoal === 'Build Muscle') {
                     const pOrder = ['goodSourceOf', 'bestFor', 'makeItBetter'];
                     primary.sort((a,b) => pOrder.indexOf(a.id) - pOrder.indexOf(b.id));
                  }
                  
                  return { primary, secondary };
              };
              
              const { primary, secondary } = getIntelSections();
              const hasPrimary = primary.length > 0;
              const hasSecondary = secondary.length > 0 || intel.recommendedFrequency;`;

code = code.replace(oldIntel, newIntel);
fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated getIntelSections.");
