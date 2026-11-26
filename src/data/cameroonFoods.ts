import type { FoodItemTemplate } from '../types';

const ponka = 'Ponka et al. (2016), Table 2';
const sharma = 'Sharma et al. (2007)';

type Recipe = [
  id: string, name: string, aliases: string[], category: string,
  calories: number, protein: number, carbs: number, fat: number, source: string,
];

// Values per 100 g edible prepared food. See docs/cameroon-food-catalogue.md.
const recipes: Recipe[] = [
  ['ekomba', 'Ekomba', ['gâteau de maïs aux arachides', 'maize and peanut cake'], 'Traditional Dishes', 180.8, 5, 22.2, 8, ponka],
  ['tenue-militaire', 'Tenue militaire', ['maize and cocoyam leaf pudding', 'maïs aux feuilles de macabo'], 'Traditional Dishes', 113.5, 2.1, 14.4, 5.3, ponka],
  ['keleng-keleng', 'Keleng keleng', ['kéleng kéleng', 'keleng-keleng'], 'Soups', 152, 5.7, 3.2, 13.9, sharma + ', Table I'],
  ['okra-leaf-soup', 'Okra leaf soup', ['soupe de feuilles de gombo', 'okra leaves soup'], 'Soups', 128, 3.8, 2.3, 12.2, sharma + ', Table I'],
  ['fish-stew', 'Fish stew (tomato)', ['sauce tomate au poisson', 'ragoût de poisson'], 'Soups', 188, 2.1, 2.8, 19.4, sharma + ', Table I'],
  ['dried-fish-groundnut', 'Dried fish and groundnut soup', ['sauce arachide au poisson séché', 'dried fish peanut soup'], 'Soups', 108, 6.7, 1.7, 8.7, sharma + ', Table II'],
  ['steamed-snails', 'Steamed snails', ['escargots à la vapeur', 'escargots en feuilles'], 'Protein Sources', 211, 9.7, 6.4, 18.2, sharma + ', Table II'],
  ['snail-stew', 'Snail stew', ['ragoût d’escargots', 'sauce aux escargots'], 'Soups', 143, 11.3, 2.7, 9.8, sharma + ', Table III'],
  ['steamed-fish', 'Steamed fish', ['poisson à la vapeur', 'poisson cuit à la vapeur'], 'Protein Sources', 77, 12.7, 1.5, 2.4, sharma + ', Table III'],
  ['groundnut-pudding', 'Groundnut pudding', ['mets d’arachide', 'gâteau d’arachide', 'peanut pudding'], 'Traditional Dishes', 403, 18.3, 11.5, 35, sharma + ', Table III'],
  ['huckleberry-sauce', 'Huckleberry leaf sauce', ['njama njama', 'njamnjama', 'sauce de morelle noire'], 'Soups', 199, 5.3, 2.9, 19.2, sharma + ', Table III'],
  ['pumpkin-huckleberry', 'Pumpkin and huckleberry leaf sauce', ['sauce de feuilles de courge et de morelle', 'pumpkin leaves and huckleberry'], 'Soups', 115, 6, 4.2, 9.4, sharma + ', Table IV'],
];

export const cameroonFoods: FoodItemTemplate[] = recipes.map(
  ([id, name, aliases, category, calories, protein, carbs, fat, nutritionSource]) => ({
    id: `cm-${id}`,
    name,
    aliases,
    category,
    calories,
    protein,
    carbs,
    fat,
    servingSizeText: '100 g',
    nutritionSource,
    confidenceLevel: 'Medium',
  }),
);
