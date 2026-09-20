import { TaxonomyCategory, TaxonomyFamily } from './FoodTaxonomy';

export interface FoodIntelligenceResult {
  detectedName: string;
  normalizedName: string;
  rawCategory?: string;
  taxonomyCategory: TaxonomyCategory;
  taxonomyFamily?: TaxonomyFamily;
  isUnknown: boolean;
  confidence: number;
}
