import type { FoodItemTemplate } from '../types';

function normalizeFoodName(name: string) {
  return name.normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function foodSearchRank(food: FoodItemTemplate, query: string): number {
  const normalizedQuery = normalizeFoodName(query);
  if (!normalizedQuery || typeof food?.name !== 'string' || !food.name.trim()) return 0;
  const name = normalizeFoodName(food.name);
  const names = [name, ...(Array.isArray(food.aliases) ? food.aliases : [])
    .filter(alias => typeof alias === 'string').map(normalizeFoodName)];
  if (name === normalizedQuery) return 4;
  if (names.includes(normalizedQuery)) return 3;
  if (names.some(value => value.includes(normalizedQuery))) return 2;
  const words = normalizedQuery.split(' ').filter(word =>
    word.length > 1 && !['and', 'with', 'avec', 'et', 'de', 'du', 'des', 'au', 'aux'].includes(word)
  );
  return words.length > 1 && names.some(value => words.every(word => value.includes(word))) ? 1 : 0;
}
