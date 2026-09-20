import { FoodItemTemplate, CompositeMealTemplate } from '../types';
import { commonFoods } from './foodDatabase';

const getFoodByName = (name: string): FoodItemTemplate | undefined => {
  return commonFoods.find(f => f.name.toLowerCase() === name.toLowerCase());
};

const combineNutrition = (components: FoodItemTemplate[]) => {
  return components.reduce((acc, curr) => ({
    calories: acc.calories + curr.calories,
    protein: acc.protein + curr.protein,
    carbs: acc.carbs + curr.carbs,
    fat: acc.fat + curr.fat,
    fiber: (acc.fiber || 0) + (curr.fiber || 0),
    sugar: (acc.sugar || 0) + (curr.sugar || 0),
    sodium: (acc.sodium || 0) + (curr.sodium || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });
};

// Define valid combinations that aren't already explicit single records,
// or that we want to formalize as Composite Meals linking to their components.
export const definedComposites = [
  {
    id: 'comp-gari-eru',
    name: 'Gari & Eru',
    aliases: ['gari and eru', 'garri and eru', 'garr and eru', 'eru and gari', 'gari eru', 'garri eru', 'eru and garri'],
    componentNames: ['Garri', 'Eru'],
    category: 'Campus Meals',
    servingSizeText: '1 plate',
    bestFor: ['Satiety', 'General Health'],
    concerns: ['Portion size', 'Preparation/oil content'],
    preparationNotes: 'Adjust portion or preparation based on your goal.'
  },
  {
    id: 'comp-spaghetti-egg',
    name: 'Spaghetti & Egg',
    aliases: ['spaghetti and egg', 'egg and spaghetti', 'spaghetti egg', 'indomie and egg', 'indomie egg'],
    componentNames: ['Spaghetti (Boiled)', 'Boiled Eggs'], // Assuming "Spaghetti (Boiled)" and "Boiled Eggs" exist. Let's check exact names.
    category: 'Campus Meals',
    servingSizeText: '1 plate',
    bestFor: ['Energy', 'Satiety'],
    concerns: ['High sodium if flavor packets used'],
    preparationNotes: 'Add vegetables for more fiber.'
  }
];

export const getCompositeMeals = (): CompositeMealTemplate[] => {
  const composites: CompositeMealTemplate[] = [];

  for (const def of definedComposites) {
    const components = def.componentNames.map(getFoodByName).filter(Boolean) as FoodItemTemplate[];
    
    // Only build if we found ALL components
    if (components.length === def.componentNames.length) {
      const nutrition = combineNutrition(components);
      
      composites.push({
        id: def.id,
        name: def.name,
        aliases: def.aliases,
        isComposite: true,
        components: def.componentNames,
        foodType: 'Combo',
        category: def.category,
        servingSizeText: def.servingSizeText,
        popularity: 'Common',
        confidenceLevel: 'Medium',
        preparationNotes: def.preparationNotes,
        ...nutrition,
        bestFor: def.bestFor.length > 0 ? def.bestFor : Array.from(new Set(components.flatMap(c => c.bestFor || []))),
        concerns: def.concerns.length > 0 ? def.concerns : Array.from(new Set(components.flatMap(c => c.concerns || []))),
        pairings: Array.from(new Set(components.flatMap(c => c.pairings || []))),
        alternatives: Array.from(new Set(components.flatMap(c => c.alternatives || []))),
      });
    }
  }

  return composites;
};
