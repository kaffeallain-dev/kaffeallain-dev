import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCustomFoodDraft, hasCatalogueGuidance } from '../src/lib/manualFood.ts';

const draft = { name: '  QA stew  ', calories: '100.5', protein: '2.5', carbs: '15', fat: '1', servingSizeText: '  1 bowl (100g)  ' };
test('custom draft preserves decimal nutrition and trims text', () => {
  assert.deepEqual(parseCustomFoodDraft(draft), { name: 'QA stew', calories: 100.5, protein: 2.5, carbs: 15, fat: 1, servingSizeText: '1 bowl (100g)' });
});
test('optional blank macros become zero', () => {
  const parsed = parseCustomFoodDraft({ ...draft, protein: '', carbs: ' ', fat: '0' });
  assert.equal(parsed.protein, 0);
  assert.equal(parsed.carbs, 0);
  assert.equal(parsed.fat, 0);
});
for (const calories of ['', ' ', '0', '-1', 'NaN', 'Infinity', '1e309', '100kcal']) {
  test(`reject invalid calories ${JSON.stringify(calories)}`, () => {
    assert.equal(parseCustomFoodDraft({ ...draft, calories }), null);
  });
}
for (const field of ['protein', 'carbs', 'fat']) {
  test(`reject negative and non-finite ${field}`, () => {
    for (const value of ['-0.1', 'Infinity', 'NaN', '5g']) {
      assert.equal(parseCustomFoodDraft({ ...draft, [field]: value }), null);
    }
  });
}
test('reject empty or overlong names and serving descriptions', () => {
  for (const patch of [{ name: ' ' }, { name: 'a'.repeat(201) }, { servingSizeText: '' }, { servingSizeText: 'a'.repeat(101) }]) {
    assert.equal(parseCustomFoodDraft({ ...draft, ...patch }), null);
  }
});
const known = { id: 'catalogue-meal', name: 'Eru', calories: 450, protein: 20, carbs: 15, fat: 35, servingSizeText: '1 bowl (300g)' };
test('retain guidance for unchanged catalogue foods', () => {
  assert.equal(hasCatalogueGuidance({ ...known }, [known]), true);
});
test('custom name or even a copied catalogue identity is not evidence', () => {
  assert.equal(hasCatalogueGuidance({ ...known, id: 'custom-id', isCustom: true }, [known]), false);
  assert.equal(hasCatalogueGuidance({ ...known, isCustom: true }, [known]), false);
  assert.equal(hasCatalogueGuidance({ ...known, id: 'unknown-id' }, [known]), false);
});
test('altered nutrition or portion cannot inherit an existing food verdict', () => {
  for (const patch of [{ calories: 99 }, { protein: 0 }, { carbs: 0 }, { fat: 0 }, { servingSizeText: '1 piece' }, { name: 'Other food' }]) {
    assert.equal(hasCatalogueGuidance({ ...known, ...patch }, [known]), false);
  }
});
