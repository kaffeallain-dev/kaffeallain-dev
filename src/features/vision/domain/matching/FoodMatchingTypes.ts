export type RecognitionDecision = 'HIGH_CONFIDENCE' | 'AMBIGUOUS' | 'NEEDS_CONFIRMATION' | 'UNKNOWN';

export interface MatchResult {
  decision: RecognitionDecision;
  reason?: string;
  foodKnowledgeId: string;
  matchedName: string;
  matchConfidence: number; // 0.0 to 1.0
  visionConfidence: number;
  matchType: 'EXACT_NAME' | 'EXACT_ALIAS' | 'EXACT_KEYWORD' | 'FUZZY_NAME' | 'FUZZY_ALIAS' | 'AMBIGUOUS_ALIAS' | 'NONE';
  fallbackSuggestions: { foodKnowledgeId: string; name: string }[];
}

export interface FoodIndexEntry {
  id: string;
  name: string;
  aliases: string[];
  searchKeywords: string[];
  category?: string;
}

export interface FoodCandidate {
  foodKnowledgeId: string;
  name: string;
  similarityScore: number;
  compatibility: string;
  matchType: 'EXACT_NAME' | 'EXACT_ALIAS' | 'EXACT_KEYWORD' | 'FUZZY_NAME' | 'FUZZY_ALIAS' | 'AMBIGUOUS_ALIAS' | 'NONE';
}
