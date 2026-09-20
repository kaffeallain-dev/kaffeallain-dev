import { RecognizedFoodItem, UserHealthProfile } from '../integration/VisionMealIntegrationTypes';
import { AiCoachingTip } from '../../../../nutrition/knowledge/types/FoodKnowledge';

export class AiCoachEngine {
  /**
   * Selects and prioritizes coaching tips based on the current meal and user profile.
   */
  public static selectCoachingTips(
    items: RecognizedFoodItem[], 
    profile: UserHealthProfile,
    maxTips: number = 3
  ): AiCoachingTip[] {
    let allTips: AiCoachingTip[] = [];

    // Aggregate all tips from all foods in the meal
    for (const item of items) {
      if (item.foodKnowledge.aiCoaching && item.foodKnowledge.aiCoaching.length > 0) {
        allTips = allTips.concat(item.foodKnowledge.aiCoaching);
      }
    }

    if (allTips.length === 0) {
      return [];
    }

    // Prioritize tips based on priority level and user goals
    const priorityMap: Record<string, number> = {
      'High': 3,
      'Medium': 2,
      'Low': 1
    };

    allTips.sort((a, b) => {
      // 1. Sort by Priority
      const pA = priorityMap[a.priority] || 0;
      const pB = priorityMap[b.priority] || 0;
      if (pA !== pB) {
        return pB - pA;
      }
      
      // 2. Sort by Goal Match (if applicable)
      const aMatchesGoal = this.matchesGoal(a.goal, profile.primaryGoal) ? 1 : 0;
      const bMatchesGoal = this.matchesGoal(b.goal, profile.primaryGoal) ? 1 : 0;
      
      return bMatchesGoal - aMatchesGoal;
    });

    // Deduplicate tips by title or message to avoid spamming the user with similar tips
    const uniqueTips: AiCoachingTip[] = [];
    const seenTitles = new Set<string>();

    for (const tip of allTips) {
      if (!seenTitles.has(tip.title)) {
        seenTitles.add(tip.title);
        uniqueTips.push(tip);
      }
      if (uniqueTips.length >= maxTips) {
        break;
      }
    }

    return uniqueTips;
  }

  private static matchesGoal(tipGoal: string, userGoal: string): boolean {
    const normalizedTip = tipGoal.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedUser = userGoal.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedTip.includes(normalizedUser) || normalizedUser.includes(normalizedTip);
  }
}
