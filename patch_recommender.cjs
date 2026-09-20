const fs = require('fs');
let code = fs.readFileSync('src/lib/RecommendationEngine.ts', 'utf8');

const oldLoop = `    for (const food of availableFoods) {
      let score = 50;
      const name = food.name.toLowerCase();
      
      const isVeggie = name.includes('eru') || name.includes('ndolé') || name.includes('salad') || name.includes('veg');
      const isFried = name.includes('fried') || name.includes('puff');
      const isHighProtein = (food.protein || 0) > 15;
      const isBoiledOrGrilled = name.includes('boiled') || name.includes('roasted') || name.includes('grilled');`;

const newLoop = `    for (const food of availableFoods) {
      let score = 50;
      const name = food.name.toLowerCase();
      
      const analysis = this.analyzeFood(food);
      const isVeggie = (food.fiber && food.fiber >= 3) || 
                       (analysis.goodSourceOf && analysis.goodSourceOf.includes('Fiber')) || 
                       (analysis.bestFor && analysis.bestFor.includes('Digestion')) ||
                       food.category === 'Vegetables' || 
                       food.category === 'Soups';
                       
      const isFried = name.includes('fried') || name.includes('puff') || (analysis.potentialConcerns && analysis.potentialConcerns.some(c => c.toLowerCase().includes('fat') || c.toLowerCase().includes('oil')));
      const isHighProtein = (food.protein && food.protein >= 15) || (analysis.goodSourceOf && analysis.goodSourceOf.includes('Protein'));
      const isBoiledOrGrilled = name.includes('boiled') || name.includes('roasted') || name.includes('grilled') || 
                                (!isFried && food.calories < 400 && food.fat && food.fat < 15);`;

if (code.includes(oldLoop)) {
  code = code.replace(oldLoop, newLoop);
  fs.writeFileSync('src/lib/RecommendationEngine.ts', code);
  console.log("Patched RecommendationEngine loop");
} else {
  console.log("oldLoop not found");
}
