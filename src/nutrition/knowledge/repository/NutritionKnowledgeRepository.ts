import { FoodKnowledge } from '../types/FoodKnowledge';
import { foods } from '../foods';
import { KnowledgeValidator } from '../validation/KnowledgeValidator';
import { ValidationReport } from '../validation/types';

export class NutritionKnowledgeRepository {
  private static knowledgeBase: Map<string, FoodKnowledge> = new Map();
  private static aliasIndex: Map<string, string> = new Map(); // lowercase alias to food ID
  private static validationReports: Map<string, ValidationReport> = new Map();

  static {
    NutritionKnowledgeRepository.initialize(foods);
  }

  public static normalizeAlias(alias: string | null | undefined): string {
    if (!alias || typeof alias !== 'string') return '';
    return alias.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  }

  public static initialize(foodData: FoodKnowledge[]) {
    this.knowledgeBase.clear();
    this.aliasIndex.clear();
    this.validationReports.clear();

    const existingAliases = new Set<string>();

    for (const food of foodData) {
      if (!food || typeof food !== 'object') continue;
      const { report, updatedFood } = KnowledgeValidator.validate(food, existingAliases);
      this.validationReports.set(updatedFood.id, report);

      if (report.status === 'FAIL') {
        console.error(`[NutritionKnowledgeRepository] Validation FAILED for food ID: ${updatedFood.id}`, report.errors);
        continue;
      }
      if (report.status === 'WARNING') {
        console.warn(`[NutritionKnowledgeRepository] Validation WARNINGS for food ID: ${updatedFood.id}`, report.warnings);
      }
      
      this.knowledgeBase.set(updatedFood.id, updatedFood);
      
      // Index name
      if (updatedFood.name && typeof updatedFood.name === 'string') {
        const normalizedName = this.normalizeAlias(updatedFood.name);
        if (normalizedName) {
          this.aliasIndex.set(normalizedName, updatedFood.id);
          existingAliases.add(normalizedName);
        }
      }
      
      // Index aliases
      if (Array.isArray(updatedFood.aliases)) {
        for (const alias of updatedFood.aliases) {
          if (alias && typeof alias === 'string') {
            const normalizedAlias = this.normalizeAlias(alias);
            if (normalizedAlias) {
              this.aliasIndex.set(normalizedAlias, updatedFood.id);
              existingAliases.add(normalizedAlias);
            }
          }
        }
      }
    }
  }

  public static getValidationReport(id: string | null | undefined): ValidationReport | undefined {
    if (!id || typeof id !== 'string') return undefined;
    return this.validationReports.get(id);
  }

  public static getFood(id: string | null | undefined): FoodKnowledge | undefined {
    if (!id || typeof id !== 'string') return undefined;
    return this.knowledgeBase.get(id);
  }

  public static searchFood(query: string | null | undefined): FoodKnowledge | undefined {
    if (!query || typeof query !== 'string') {
      return undefined;
    }
    const normalizedQuery = this.normalizeAlias(query);
    if (!normalizedQuery) {
      return undefined;
    }
    const id = this.aliasIndex.get(normalizedQuery);
    if (id) {
      return this.getFood(id);
    }
    
    // Fallback: partial match
    for (const [key, foodId] of this.aliasIndex.entries()) {
      if (key && key.includes(normalizedQuery)) {
         return this.getFood(foodId);
      }
    }
    return undefined;
  }

  public static searchAliases(query: string | null | undefined): string[] {
    if (!query || typeof query !== 'string') {
      return [];
    }
    const normalizedQuery = this.normalizeAlias(query);
    if (!normalizedQuery) {
      return [];
    }
    const results = new Set<string>();
    
    for (const [key, foodId] of this.aliasIndex.entries()) {
      if (key && key.includes(normalizedQuery)) {
         const food = this.getFood(foodId);
         if (food && food.name) results.add(food.name);
      }
    }
    return Array.from(results);
  }

  public static getGoalCompatibility(id: string | null | undefined) {
    if (!id || typeof id !== 'string') return undefined;
    return this.getFood(id)?.goalCompatibility;
  }

  public static getPairings(id: string | null | undefined) {
    if (!id || typeof id !== 'string') return [];
    return this.getFood(id)?.foodRelationships?.suggestedPairings || [];
  }

  public static getAlternatives(id: string | null | undefined) {
    if (!id || typeof id !== 'string') return [];
    return this.getFood(id)?.foodRelationships?.betterAlternatives || [];
  }

  public static getPreparationEffects(id: string | null | undefined) {
    if (!id || typeof id !== 'string') return undefined;
    return this.getFood(id)?.preparationIntelligence;
  }

  public static getCoachingTips(id: string | null | undefined) {
    if (!id || typeof id !== 'string') return [];
    return this.getFood(id)?.aiCoaching || [];
  }

  public static getFoodsByCategory(category: string): FoodKnowledge[] {
    if (!category || typeof category !== 'string') return [];
    return Array.from(this.knowledgeBase.values()).filter(f => f.category === category);
  }

  public static getFoodsByMealType(mealType: string): FoodKnowledge[] {
    return Array.from(this.knowledgeBase.values()).filter(f => f.mealType.includes(mealType));
  }

  public static getFoodsByGoal(goal: keyof FoodKnowledge['goalCompatibility'], minLevel: 'Excellent' | 'Good' = 'Good'): FoodKnowledge[] {
    return Array.from(this.knowledgeBase.values()).filter(f => {
      const level = f.goalCompatibility[goal]?.level;
      if (minLevel === 'Excellent') return level === 'Excellent';
      return level === 'Excellent' || level === 'Good';
    });
  }

  public static getFoodsByHealthScore(minScore: number): FoodKnowledge[] {
    return Array.from(this.knowledgeBase.values()).filter(f => f.scores.healthScore >= minScore);
  }

  public static getFoodsBySatiety(minScore: number): FoodKnowledge[] {
    return Array.from(this.knowledgeBase.values()).filter(f => f.scores.satietyScore >= minScore);
  }
}
