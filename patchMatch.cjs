const fs = require('fs');
const path = './src/features/vision/domain/matching/FoodMatchingEngine.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `    if (bestMatch && isDirectMatch) {
      if (bestMatchType === 'FUZZY_NAME' || bestMatchType === 'FUZZY_ALIAS') {
          return {
            foodKnowledgeId: '',
            matchedName: '',
            matchConfidence: 0,
            matchType: 'NONE',
            fallbackSuggestions: topFallbacks.slice(0, 3)
          };
      }`;

const replacement = `    if (bestMatch && isDirectMatch) {
      if (bestMatchType === 'FUZZY_NAME' || bestMatchType === 'FUZZY_ALIAS') {
          return {
            foodKnowledgeId: '',
            matchedName: bestMatch.name,
            matchConfidence: highestSimilarity,
            matchType: 'NONE', // Downgraded to prevent automatic resolution
            fallbackSuggestions: topFallbacks.slice(0, 3)
          };
      }`;

code = code.replace(target, replacement);
fs.writeFileSync(path, code);
console.log("Patched Match Confidence!");
