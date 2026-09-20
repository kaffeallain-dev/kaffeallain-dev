const fs = require('fs');
const path = './src/features/vision/domain/matching/FoodMatchingEngine.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    `      if (exactAlias) {
        return {
          foodKnowledgeId: food.id,
          matchedName: food.name,
          matchConfidence: 1.0,
          matchType: 'EXACT_ALIAS',
          fallbackSuggestions: []
        };
      }`,
    `      if (exactAlias) {
        return {
          foodKnowledgeId: food.id,
          matchedName: food.name,
          matchConfidence: 1.0,
          matchType: 'EXACT_ALIAS',
          fallbackSuggestions: []
        };
      }

      // SAFETY BOUNDARY: If query is UNKNOWN and we haven't found an exact match,
      // do not proceed to keyword, fuzzy, or fallback matching.
      if (queryClassification.category === 'UNKNOWN') {
        continue;
      }`
);

fs.writeFileSync(path, code);
console.log("Patched!");
