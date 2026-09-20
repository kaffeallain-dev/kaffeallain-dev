const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

// 1. Add showMoreIntel state
code = code.replace(
  "const [isCreatingCustom, setIsCreatingCustom] = useState(false);",
  "const [isCreatingCustom, setIsCreatingCustom] = useState(false);\n  const [showMoreIntel, setShowMoreIntel] = useState(false);"
);

// 2. Update food identity at the top
const oldIdentity = `<h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            <p className="text-emerald-700 font-medium text-sm bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4">
              ~{totalCals} kcal &middot; {getServingDescription(portionSize === 'Custom' ? 'Medium' : portionSize, selectedFood.servingSizeText)}
            </p>`;

const newIdentity = `<h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            {((selectedFood as any).isComposite || selectedFood.foodType === 'Combo') && (selectedFood as any).components && (
              <p className="text-sm text-gray-500 mb-2 font-medium">
                {(selectedFood as any).components.join(' served with ')}
              </p>
            )}
            <p className="text-emerald-700 font-medium text-sm bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4 mt-1">
              ~{totalCals} kcal &middot; {getServingDescription(portionSize === 'Custom' ? 'Medium' : portionSize, selectedFood.servingSizeText)}
            </p>`;
code = code.replace(oldIdentity, newIdentity);

// 3. Update levelText (goal recommendation)
const oldLevelText = `const levelText = comp.level === 'Excellent' ? 'EXCELLENT FOR' : comp.level === 'Moderate' ? 'GOOD CHOICE FOR' : 'LIMIT FOR';`;
const newLevelText = `const levelText = \`\${comp.level.toUpperCase()} FOR\`;`;
code = code.replace(oldLevelText, newLevelText);

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated identity and levelText.");
