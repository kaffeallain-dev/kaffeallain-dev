import { FoodAliasRegistry } from './src/features/vision/domain/matching/FoodAliasRegistry';
import { FoodTaxonomy } from './src/features/vision/domain/intelligence/FoodTaxonomy';
import { FoodIntelligenceEngine } from './src/features/vision/domain/intelligence/FoodIntelligenceEngine';
import { FoodMatchingEngine } from './src/features/vision/domain/matching/FoodMatchingEngine';
import { commonFoods } from './src/data/foodDatabase';

const matcher = new FoodMatchingEngine(commonFoods as any);

function test(query: string) {
  const intel = FoodIntelligenceEngine.interpret({
    detectionId: Math.random().toString(),
    foodName: query,
    confidence: 0.9,
    boundingBox: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
    estimatedWeight: 0,
    portion: 'Medium' as any,
    category: undefined,
    isUnknown: false
  });
  const match = matcher.matchFood(intel);
  return { intel, match };
}

console.log("\n=== KOKI TEST ===");
for (const q of ["koki", "koki beans", "koki corn", "koki (bins)", "koki (kon)"]) {
  const { intel, match } = test(q);
  console.log(`[${q}] -> norm: ${intel.normalizedName} | type: ${match.matchType} | id: ${match.foodKnowledgeId} | name: ${match.matchedName}`);
}

console.log("\n=== ACHU TEST ===");
for (const q of ["achu", "yellow soup", "sauce jaune", "ndza nikki"]) {
  const { intel, match } = test(q);
  console.log(`[${q}] -> norm: ${intel.normalizedName} | type: ${match.matchType} | id: ${match.foodKnowledgeId} | name: ${match.matchedName}`);
}

console.log("\n=== COUSCOUS TEST ===");
for (const q of ["fufu", "water fufu", "fufu corn", "couscous"]) {
  const { intel, match } = test(q);
  console.log(`[${q}] -> norm: ${intel.normalizedName} | type: ${match.matchType} | id: ${match.foodKnowledgeId} | name: ${match.matchedName}`);
}

console.log("\n=== NDOLE TEST ===");
for (const q of ["ndole", "ndolé", "ndolè"]) {
  const { intel, match } = test(q);
  console.log(`[${q}] -> norm: ${intel.normalizedName} | type: ${match.matchType} | id: ${match.foodKnowledgeId} | name: ${match.matchedName}`);
}

console.log("\n=== BOBOLO TEST ===");
for (const q of ["bobolo", "bâton de manioc", "miondo"]) {
  const { intel, match } = test(q);
  console.log(`[${q}] -> norm: ${intel.normalizedName} | type: ${match.matchType} | id: ${match.foodKnowledgeId} | name: ${match.matchedName}`);
}

console.log("\n=== NEGATIVE TESTS ===");
for (const q of ["rice", "energy drink", "butter", "fish", "plantain", "banana"]) {
  const { intel, match } = test(q);
  console.log(`[${q}] -> norm: ${intel.normalizedName} | type: ${match.matchType} | id: ${match.foodKnowledgeId} | name: ${match.matchedName}`);
}

