import { FoodIndexEntry } from './FoodMatchingTypes';
import { FoodTaxonomy, TaxonomyClassification } from '../intelligence/FoodTaxonomy';
import { FoodAliasRegistry } from './FoodAliasRegistry';

export interface CandidateEvidence {
  visionConfidence: number;
  identityMatch: boolean;
  aliasMatch: boolean;
  keywordMatch: boolean;
  fuzzyScore: number;
  taxonomyCompatibility: string;
  isAmbiguous: boolean;
}

export interface CandidateScore {
  foodKnowledgeId: string;
  name: string;
  evidence: CandidateEvidence;
  totalScore: number;
  isEligibleForValidation: boolean;
  matchType: 'EXACT_NAME' | 'EXACT_ALIAS' | 'EXACT_KEYWORD' | 'FUZZY_NAME' | 'FUZZY_ALIAS' | 'AMBIGUOUS_ALIAS' | 'NONE';
}

export class FoodCandidateScorer {
  public static scoreCandidate(
    query: string,
    detectedName: string,
    visionConfidence: number,
    queryClassification: TaxonomyClassification,
    candidate: FoodIndexEntry
  ): CandidateScore {
    const candidateClassification = FoodTaxonomy.classifyDatabaseFood(candidate);
    const compatibilityLevel = FoodTaxonomy.getCompatibilityLevel(queryClassification, candidateClassification);
    const isCategoryCompatible = FoodTaxonomy.isCompatible(queryClassification, candidateClassification);

    const normalizedFoodName = FoodAliasRegistry.normalize(candidate.name);

    // 1. Identity Match
    const isExactName = normalizedFoodName === query;

    // 2. Phase 4 Registry & Ambiguity Check
    const resolvedIds = FoodAliasRegistry.resolveAlias(detectedName);
    const isAmbiguous = resolvedIds.length > 1;
    const isResolvedAlias = resolvedIds.includes(candidate.id);
    
    // Legacy alias check
    const isExactLegacyAlias = (candidate.aliases || []).some(a => FoodAliasRegistry.normalize(a) === query);
    
    // Only flag as a valid unique alias match if it does not resolve to multiple items
    const isUniqueAliasMatch = (isExactLegacyAlias || isResolvedAlias) && !isAmbiguous;
    const isAmbiguousTarget = isAmbiguous && isResolvedAlias;

    // 3. Keyword Match
    const isKeywordMatch = (candidate.searchKeywords || []).some(k => FoodAliasRegistry.normalize(k) === query);

    // 4. Fuzzy Match
    const nameSim = this.calculateSimilarity(query, normalizedFoodName);
    const maxAliasSim = (candidate.aliases || []).reduce((max, a) => Math.max(max, this.calculateSimilarity(query, FoodAliasRegistry.normalize(a))), 0);
    const maxKeywordSim = (candidate.searchKeywords || []).reduce((max, k) => Math.max(max, this.calculateSimilarity(query, FoodAliasRegistry.normalize(k))), 0);
    const fuzzyScore = Math.max(nameSim, maxAliasSim, maxKeywordSim);

    const evidence: CandidateEvidence = {
      visionConfidence,
      identityMatch: isExactName,
      aliasMatch: isUniqueAliasMatch,
      keywordMatch: isKeywordMatch,
      fuzzyScore,
      taxonomyCompatibility: compatibilityLevel,
      isAmbiguous: isAmbiguousTarget
    };

    let totalScore = 0;
    
    // Taxonomy baseline - capped to 0.2
    if (compatibilityLevel === 'EXACT_COMPATIBLE') totalScore += 0.2;
    else if (compatibilityLevel === 'FAMILY_COMPATIBLE') totalScore += 0.15;
    else if (compatibilityLevel === 'CATEGORY_COMPATIBLE') totalScore += 0.1;
    
    // Vision confidence contributes but cannot independently resolve (max 0.1)
    totalScore += (visionConfidence * 0.1);

    let matchType: CandidateScore['matchType'] = 'NONE';
    if (evidence.isAmbiguous) {
      totalScore += 0.85; // Strong evidence, but ambiguous
      matchType = 'AMBIGUOUS_ALIAS';
    } else if (isExactName) {
      totalScore += 1.0;
      matchType = 'EXACT_NAME';
    } else if (isUniqueAliasMatch) {
      totalScore += 0.9;
      matchType = 'EXACT_ALIAS';
    } else if (isKeywordMatch) {
      totalScore += 0.8;
      matchType = 'EXACT_KEYWORD';
    } else {
      totalScore += fuzzyScore * 0.5; // Fuzzy is severely handicapped
      if (nameSim >= maxAliasSim && nameSim >= maxKeywordSim) {
        matchType = 'FUZZY_NAME';
      } else {
        matchType = 'FUZZY_ALIAS';
      }
    }

    let isEligibleForValidation = false;
    
    if (isCategoryCompatible) {
      if (isExactName || isUniqueAliasMatch || isKeywordMatch) {
        isEligibleForValidation = true;
      }
    }
    
    // SAFETY OVERRIDES
    if (matchType === 'AMBIGUOUS_ALIAS' || evidence.isAmbiguous) {
      isEligibleForValidation = false; // Never eligible if ambiguous
    }
    if (compatibilityLevel === 'UNKNOWN' || compatibilityLevel === 'INCOMPATIBLE') {
      isEligibleForValidation = false; // Unsafe taxonomy
    }

    return {
      foodKnowledgeId: candidate.id,
      name: candidate.name,
      evidence,
      totalScore,
      isEligibleForValidation,
      matchType
    };
  }

  private static calculateDistance(a: string, b: string): number {
    const matrix = [];
    let i, j;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    for (i = 0; i <= b.length; i++) matrix[i] = [i];
    for (j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (i = 1; i <= b.length; i++) {
      for (j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private static calculateSimilarity(a: string, b: string): number {
    const dist = this.calculateDistance(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    return (maxLen - dist) / maxLen;
  }
}
