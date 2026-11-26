import assert from 'node:assert/strict';
import { commonFoods } from '../src/data/foodDatabase';
import { cameroonFoods } from '../src/data/cameroonFoods';
import { foodSearchRank } from '../src/lib/foodSearch';
import { calculateScaledNutrients, getEffectiveMultiplier, parseServingGrams } from '../src/lib/nutritionScaling';

assert.equal(cameroonFoods.length, 12);
for (const food of cameroonFoods) {
  assert.equal(commonFoods.filter(item => item.id === food.id).length, 1);
  assert.ok(food.nutritionSource);
  const grams = parseServingGrams(food.servingSizeText);
  assert.equal(grams, 100);
  const multiplier = getEffectiveMultiplier('Custom', '200', grams, 'grams');
  assert.equal(multiplier, 2);
  assert.equal(calculateScaledNutrients(food, multiplier!).calories, Math.round(food.calories * 2));
  for (const alias of food.aliases ?? []) {
    assert.ok(foodSearchRank(food, alias) >= 3, alias);
  }
}
const byId = (id: string) => commonFoods.find(food => food.id === id)!;
assert.equal(foodSearchRank(byId('cm-keleng-keleng'), '  KÉLENG-kéleng '), 4);
assert.equal(foodSearchRank(byId('cm-snail-stew'), "ragout d'escargots"), 3);
assert.equal(foodSearchRank(byId('sp1'), 'ndole'), 4);
assert.equal(foodSearchRank(byId('sp1'), '...'), 0);
console.log('Cameroon catalogue, French search, and portion checks passed (12 foods).');
