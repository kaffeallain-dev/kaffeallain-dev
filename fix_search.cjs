const fs = require('fs');
let code = fs.readFileSync('src/views/LogFoodView.tsx', 'utf8');

// 1. Import getCompositeMeals
if (!code.includes('getCompositeMeals')) {
  code = code.replace(
    "import { commonFoods } from '../data/foodDatabase';",
    "import { commonFoods } from '../data/foodDatabase';\nimport { getCompositeMeals } from '../data/compositeMeals';"
  );
}

// 2. Add to allAvailableFoods
code = code.replace(
  'return [...customFoods, ...commonFoods];',
  'return [...customFoods, ...commonFoods, ...getCompositeMeals()];'
);

// 3. Update searchResults logic
const oldSearch = `  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allAvailableFoods.filter(f => {
      const matchName = f.name.toLowerCase().includes(query);
      const matchAlias = f.aliases?.some(a => a.toLowerCase().includes(query));
      return matchName || matchAlias;
    }).sort((a, b) => {`;

const newSearch = `  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const queryWords = query.split(/[\\s,&+]+/).filter(w => w !== 'and' && w !== 'with' && w.length > 1);
    
    return allAvailableFoods.filter(f => {
      const matchExactName = f.name.toLowerCase().includes(query);
      const matchExactAlias = f.aliases?.some(a => a.toLowerCase().includes(query));
      if (matchExactName || matchExactAlias) return true;
      
      if (queryWords.length > 1) {
         const nameAndAliases = [f.name, ...(f.aliases || [])].map(s => s.toLowerCase());
         const matchesAnyString = nameAndAliases.some(str => 
             queryWords.every(qw => str.includes(qw))
         );
         if (matchesAnyString) return true;
      }
      return false;
    }).sort((a, b) => {
      if (queryWords.length > 1) {
         const aIsCombo = (a as any).isComposite || a.foodType === 'Combo';
         const bIsCombo = (b as any).isComposite || b.foodType === 'Combo';
         if (aIsCombo && !bIsCombo) return -1;
         if (!aIsCombo && bIsCombo) return 1;
      }`;

code = code.replace(oldSearch, newSearch);

// 4. Update the rendering of the list item to optionally display "COMBINATION MEAL"
// Look for the part that renders the result list item.
// It's inside: {searchResults.map(food => ( ... ))}
// Let's find it.

fs.writeFileSync('src/views/LogFoodView.tsx', code);
console.log("Updated LogFoodView search logic.");
