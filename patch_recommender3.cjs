const fs = require('fs');
let code = fs.readFileSync('src/lib/RecommendationEngine.ts', 'utf8');

const oldConditions = `      const isVeggie = (food.fiber && food.fiber >= 3) || 
                       (analysis.goodSourceOf && analysis.goodSourceOf.includes('Fiber')) || 
                       (analysis.bestFor && analysis.bestFor.includes('Digestion')) ||
                       food.category === 'Vegetables' || 
                       food.category === 'Soups';
                       
      const isFried = name.includes('fried') || name.includes('puff') || (analysis.potentialConcerns && analysis.potentialConcerns.some(c => c.toLowerCase().includes('fat') || c.toLowerCase().includes('oil')));
      const isHighProtein = (food.protein && food.protein >= 15) || (analysis.goodSourceOf && analysis.goodSourceOf.includes('Protein'));`;

const newConditions = `      const isVeggie = (food.fiber && food.fiber >= 3) || 
                       (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('fiber'))) || 
                       (analysis.bestFor && analysis.bestFor.some(s => s.toLowerCase().includes('digestion'))) ||
                       food.category === 'Vegetables' || 
                       food.category === 'Soups';
                       
      const isFried = name.includes('fried') || name.includes('puff') || (analysis.potentialConcerns && analysis.potentialConcerns.some(c => c.toLowerCase().includes('fat') || c.toLowerCase().includes('oil')));
      const isHighProtein = (food.protein && food.protein >= 15) || (analysis.goodSourceOf && analysis.goodSourceOf.some(s => s.toLowerCase().includes('protein')));`;

if (code.includes(oldConditions)) {
  code = code.replace(oldConditions, newConditions);
  fs.writeFileSync('src/lib/RecommendationEngine.ts', code);
  console.log("Patched RecommendationEngine conditions");
} else {
  console.log("oldConditions not found");
}
