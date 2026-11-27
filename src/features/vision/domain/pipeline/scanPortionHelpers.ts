import { FoodItemTemplate } from '../../../../types';
import { FoodKnowledge } from '../../../../nutrition/knowledge/types/FoodKnowledge';
import { RecognizedItemDetails } from './FoodRecognitionPipelineTypes';
import {
  calculateGramScaledNutrients,
  GramScaledNutritionResult,
  parseServingGrams
} from '../../../../lib/nutritionScaling';

/**
 * Converts a MboaFit catalogue FoodItemTemplate into the FoodKnowledge shape
 * used by the vision/recommendation pipeline while preserving its documented serving basis.
 */
export function mapCatalogFoodToKnowledge(knowledge: FoodItemTemplate): FoodKnowledge {
  return {
    id: knowledge.id,
    name: knowledge.name,
    aliases: knowledge.aliases || [],
    searchKeywords: [],
    category: knowledge.category || 'Other',
    mealType: ['Lunch', 'Dinner'],
    country: 'Cameroon',
    regions: [],
    servingSizes: { medium: knowledge.servingSizeText || '1 serving' },
    nutrition: {
      calories: knowledge.calories,
      protein: knowledge.protein,
      carbohydrates: knowledge.carbs,
      fat: knowledge.fat,
      fiber: knowledge.fiber || 0,
      sugar: knowledge.sugar || 0,
      sodium: knowledge.sodium || 0
    },
    foodIntelligence: { concerns: knowledge.concerns || [] },
    goalCompatibility: {},
    scores: { healthScore: 7, satietyScore: 7 },
    foodRelationships: { betterAlternatives: knowledge.alternatives || [] },
    aiCoaching: []
  } as unknown as FoodKnowledge;
}

/**
 * Computes canonical gram-scaled nutrition for a confirmed scan item using its documented
 * serving/100g gram basis (or explicit user-supplied reference serving weight when missing).
 */
export function getScanItemNutrition(item: RecognizedItemDetails): GramScaledNutritionResult {
  if (!item.foodKnowledge || !item.foodKnowledge.nutrition) {
    return { valid: false, error: 'INVALID_NUTRIENTS' };
  }

  const n = item.foodKnowledge.nutrition;
  return calculateGramScaledNutrients(
    {
      calories: n.calories,
      protein: n.protein,
      carbs: n.carbohydrates,
      fat: n.fat,
      fiber: n.fiber,
      sugar: n.sugar,
      sodium: n.sodium,
      potassium: n.potassium,
      calcium: n.calcium,
      iron: n.iron,
      vitaminC: n.vitaminC,
      vitaminA: n.vitaminA,
      servingSizeText: item.foodKnowledge.servingSizes?.medium
    },
    item.estimatedPortion.estimatedWeight,
    item.estimatedPortion.referenceServingGrams
  );
}

/**
 * Returns true ONLY if the user has explicitly confirmed BOTH the food identity
 * AND a valid positive finite portion with a valid nutrient scaling basis.
 */
export function isScanItemReadyForLogging(item: RecognizedItemDetails): boolean {
  if (item.nutritionStatus !== 'matched' || !item.foodKnowledge) {
    return false;
  }
  if (!item.estimatedPortion.isConfirmed) {
    return false;
  }
  return getScanItemNutrition(item).valid;
}

/**
 * Extracts plausible catalogue components from a mixed dish label (e.g. "Rice And Beans With Sausage")
 * purely as user-selectable options in the split/choose panel — never auto-selected or silently substituted.
 */
export function findRelatedCatalogComponents(
  detectedLabel: string,
  catalog: FoodItemTemplate[],
  maxResults: number = 6
): { matches: FoodItemTemplate[]; unmatchedTerms: string[] } {
  const cleaned = (detectedLabel || '').toLowerCase().trim();
  if (!cleaned) return { matches: [], unmatchedTerms: [] };

  const stopWords = new Set(['with', 'and', 'et', 'avec', 'de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'of', 'in', 'on', 'a', 'the', 'plate', 'bowl', 'dish', 'meal', 'served']);

  // Split by common mixed-dish separators ("with", "avec", ",", "+", "&")
  const clauses = cleaned
    .split(/\s*(?:,|\+|&|\bwith\b|\bavec\b)\s*/i)
    .map(c => c.trim())
    .filter(Boolean);

  const subTerms = cleaned
    .split(/\s*(?:,|\+|&|\bwith\b|\bavec\b|\band\b|\bet\b)\s*/i)
    .map(c => c.trim())
    .filter(t => t.length >= 3 && !stopWords.has(t));

  const seenIds = new Set<string>();
  const matches: FoodItemTemplate[] = [];

  const tryAdd = (food: FoodItemTemplate) => {
    if (!seenIds.has(food.id) && matches.length < maxResults) {
      seenIds.add(food.id);
      matches.push(food);
    }
  };

  // First check full clauses (e.g. "rice and beans" in "rice and beans with sausage")
  for (const clause of clauses) {
    for (const food of catalog) {
      const nameLower = food.name.toLowerCase();
      const aliasHit = (food.aliases || []).some(a => a.toLowerCase() === clause);
      if (nameLower === clause || aliasHit) {
        tryAdd(food);
      }
    }
  }

  // Next check individual terms against catalogue names/aliases
  const unmatchedTerms: string[] = [];
  for (const term of subTerms) {
    const termMatches = catalog.filter(food => {
      const nameLower = food.name.toLowerCase();
      if (nameLower === term || nameLower.startsWith(`${term} `) || nameLower.startsWith(`${term} (`)) {
        return true;
      }
      return (food.aliases || []).some(a => a.toLowerCase() === term);
    });

    if (termMatches.length > 0) {
      // Prioritize items with documented gram weights first
      termMatches
        .sort((a, b) => (parseServingGrams(b.servingSizeText) ? 1 : 0) - (parseServingGrams(a.servingSizeText) ? 1 : 0))
        .slice(0, 2)
        .forEach(tryAdd);
    } else {
      // Check if term is already covered by a matched combo (e.g. "beans" covered by "Rice and Beans")
      const coveredByCombo = matches.some(m => m.name.toLowerCase().includes(term));
      if (!coveredByCombo) {
        unmatchedTerms.push(term);
      }
    }
  }

  return { matches, unmatchedTerms };
}
