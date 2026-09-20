import { MatchResult, FoodIndexEntry, FoodCandidate } from './FoodMatchingTypes';
import { FoodIntelligenceResult } from '../intelligence/FoodIntelligenceTypes';
import { FoodTaxonomy, TaxonomyClassification } from '../intelligence/FoodTaxonomy';
import { FoodAliasRegistry } from './FoodAliasRegistry';
import { FoodCandidateScorer, CandidateScore } from './FoodCandidateScorer';

export class FoodMatchingEngine {
  private foodIndex: FoodIndexEntry[] = [];

  constructor(index: FoodIndexEntry[]) {
    this.foodIndex = index;
  }

  public matchFood(intelligence: FoodIntelligenceResult): MatchResult {
    const query = intelligence.normalizedName;
    const detectedName = intelligence.detectedName;
    const visionConfidence = intelligence.confidence;
    
    const queryClassification: TaxonomyClassification = {
      category: intelligence.taxonomyCategory,
      family: intelligence.taxonomyFamily
    };

    // 1. Resolve Phase 4 verified aliases explicitly for AMBIGUITY CHECK
    const resolvedIds = FoodAliasRegistry.resolveAlias(detectedName);
    
    const compatibleResolvedIds = resolvedIds.filter(id => {
      const food = this.foodIndex.find(f => f.id === id);
      if (!food) return false;
      const foodClassification = FoodTaxonomy.classifyDatabaseFood(food);
      return FoodTaxonomy.isCompatible(queryClassification, foodClassification);
    });

    if (compatibleResolvedIds.length > 1) {
      // Ambiguous Alias matching
      const fallbackItems = compatibleResolvedIds
        .map(id => this.foodIndex.find(f => f.id === id))
        .filter(Boolean) as FoodIndexEntry[];
        
      return {
        decision: 'AMBIGUOUS',
        foodKnowledgeId: '',
        matchedName: detectedName,
        matchConfidence: 0.5,
        visionConfidence,
        matchType: 'AMBIGUOUS_ALIAS',
        fallbackSuggestions: fallbackItems.map(f => ({ foodKnowledgeId: f.id, name: f.name })).slice(0, 3),
        reason: 'Multiple valid canonical identities found for the detected name.'
      };
    }

    // Stage 3 Candidate Generation & Scoring
    const scoredCandidates: CandidateScore[] = [];

    for (const food of this.foodIndex) {
      const score = FoodCandidateScorer.scoreCandidate(query, detectedName, visionConfidence, queryClassification, food);
      
      const threshold = score.evidence.taxonomyCompatibility === 'UNKNOWN' ? 0.8 : 0.4;
      
      if (score.isEligibleForValidation || score.evidence.fuzzyScore >= threshold) {
        scoredCandidates.push(score);
      }
    }

    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
    
    const topCandidate = scoredCandidates.length > 0 ? scoredCandidates[0] : null;

    if (topCandidate) {
      const fallbacks = scoredCandidates
        .map(c => ({ foodKnowledgeId: c.foodKnowledgeId, name: c.name }));

      if (topCandidate.isEligibleForValidation) {
        return {
          decision: 'HIGH_CONFIDENCE',
          foodKnowledgeId: topCandidate.foodKnowledgeId,
          matchedName: topCandidate.name,
          matchConfidence: topCandidate.totalScore / 1.3,
          visionConfidence,
          matchType: topCandidate.matchType,
          fallbackSuggestions: fallbacks.slice(1, 4),
          reason: 'Strong identity evidence matched a unique valid canonical food.'
        };
      } else {
        // Evaluate if plausible for NEEDS_CONFIRMATION or entirely UNKNOWN
        const isPlausible = topCandidate.evidence.fuzzyScore >= 0.6 || topCandidate.totalScore >= 0.5;

        if (isPlausible) {
          return {
            decision: 'NEEDS_CONFIRMATION',
            foodKnowledgeId: '',
            matchedName: '',
            matchConfidence: 0,
            visionConfidence,
            matchType: topCandidate.matchType, // retain the type (e.g. FUZZY_ALIAS)
            fallbackSuggestions: fallbacks.slice(0, 3),
            reason: 'Plausible candidates exist but evidence is not strong enough for automatic validation.'
          };
        } else {
          return {
            decision: 'UNKNOWN',
            foodKnowledgeId: '',
            matchedName: '',
            matchConfidence: 0,
            visionConfidence,
            matchType: 'NONE',
            fallbackSuggestions: [],
            reason: 'No sufficiently trustworthy candidate exists.'
          };
        }
      }
    }

    return {
      decision: 'UNKNOWN',
      foodKnowledgeId: '',
      matchedName: '',
      matchConfidence: 0,
      visionConfidence,
      matchType: 'NONE',
      fallbackSuggestions: [],
      reason: 'No matching candidates found in the database.'
    };
  }
}
