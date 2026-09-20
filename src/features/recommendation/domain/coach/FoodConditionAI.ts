import { RecognizedFoodItem, UserHealthProfile } from '../integration/VisionMealIntegrationTypes';

export class FoodConditionAI {
  /**
   * Generates health warnings based on the user's profile and the foods they are eating.
   */
  public static generateWarnings(items: RecognizedFoodItem[], profile: UserHealthProfile): string[] {
    const warnings = new Set<string>();

    for (const item of items) {
      const { foodKnowledge, estimatedWeightGrams } = item;
      const { foodIntelligence, goalCompatibility } = foodKnowledge;

      // 1. Check direct concerns flagged in the food knowledge base
      if (foodIntelligence.concerns && foodIntelligence.concerns.length > 0) {
        foodIntelligence.concerns.forEach(concern => {
          // Add context to the concern
          warnings.add(`${foodKnowledge.name}: ${concern}`);
        });
      }

      // 2. Check compatibility with specific conditions
      if (profile.conditions.includes('highBloodPressure')) {
        // Assume 'heartHealthy' mapping for blood pressure if specific one is missing, 
        // though our schema might have highBloodPressure. 
        // We cast to any to safely check extended properties or just rely on 'heartHealthy'
        const hpCompat = (goalCompatibility as any).highBloodPressure || goalCompatibility.heartHealthy;
        if (hpCompat && (hpCompat.level === 'Poor' || hpCompat.level === 'Moderate')) {
           warnings.add(`${foodKnowledge.name} may impact blood pressure. ${hpCompat.reason}`);
        }
      }

      if (profile.conditions.includes('diabetes')) {
        const dCompat = goalCompatibility.diabetesFriendly;
        if (dCompat && (dCompat.level === 'Poor' || dCompat.level === 'Moderate')) {
           warnings.add(`${foodKnowledge.name} may spike blood sugar. ${dCompat.reason}`);
        }
      }

      if (profile.conditions.includes('heartDisease')) {
        const hhCompat = goalCompatibility.heartHealthy;
        if (hhCompat && (hhCompat.level === 'Poor' || hhCompat.level === 'Moderate')) {
           warnings.add(`${foodKnowledge.name} is not ideal for heart health. ${hhCompat.reason}`);
        }
      }
      
      // 3. Portion specific warnings based on large estimated weights
      // If estimated weight is > 500g for a single dense item, flag it
      if (estimatedWeightGrams > 500) {
        warnings.add(`The portion size for ${foodKnowledge.name} is very large (${estimatedWeightGrams}g).`);
      }
    }

    return Array.from(warnings);
  }
}
