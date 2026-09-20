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

  private static normalizeAlias(alias: string): string {
    return alias.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  }

  public static initialize(foodData: FoodKnowledge[]) {
    this.knowledgeBase.clear();
    this.aliasIndex.clear();
    this.validationReports.clear();

    const existingAliases = new Set<string>();

    for (const food of foodData) {
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
      const normalizedName = this.normalizeAlias(updatedFood.name);
      this.aliasIndex.set(normalizedName, updatedFood.id);
      existingAliases.add(normalizedName);
      
      // Index aliases
      if (updatedFood.aliases) {
        for (const alias of updatedFood.aliases) {
          const normalizedAlias = this.normalizeAlias(alias);
          this.aliasIndex.set(normalizedAlias, updatedFood.id);
          existingAliases.add(normalizedAlias);
        }
      }
    }
  }

  public static getValidationReport(id: string): ValidationReport | undefined {
    return this.validationReports.get(id);
  }

  public static getFood(id: string): FoodKnowledge | undefined {
    return this.knowledgeBase.get(id);
  }

  public static searchFood(query: string): FoodKnowledge | undefined {
    const normalizedQuery = this.normalizeAlias(query);
    const id = this.aliasIndex.get(normalizedQuery);
    if (id) {
      return this.getFood(id);
    }
    
    // Fallback: partial match
    for (const [key, foodId] of this.aliasIndex.entries()) {
      if (key.includes(normalizedQuery)) {
         return this.getFood(foodId);
      }
    }
    return undefined;
  }

  public static searchAliases(query: string): string[] {
    const normalizedQuery = this.normalizeAlias(query);
    const results = new Set<string>();
    
    for (const [key, foodId] of this.aliasIndex.entries()) {
      if (key.includes(normalizedQuery)) {
         const food = this.getFood(foodId);
         if (food) results.add(food.name);
      }
    }
    return Array.from(results);
  }

  public static getGoalCompatibility(id: string) {
    return this.getFood(id)?.goalCompatibility;
  }

  public static getPairings(id: string) {
    return this.getFood(id)?.foodRelationships.suggestedPairings || [];
  }

  public static getAlternatives(id: string) {
    return this.getFood(id)?.foodRelationships.betterAlternatives || [];
  }

  public static getPreparationEffects(id: string) {
    return this.getFood(id)?.preparationIntelligence;
  }

  public static getCoachingTips(id: string) {
    return this.getFood(id)?.aiCoaching || [];
  }

  public static getFoodsByCategory(category: string): FoodKnowledge[] {
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
