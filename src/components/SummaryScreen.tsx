import React, { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import type { MealCategory } from '../types';
import type { FoodRecognitionResult } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { getScanPortion } from '../lib/scanPortion';
import { useI18n } from '../lib/i18n';

const meals = [
  ['Breakfast', 'meal_breakfast'], ['Lunch', 'meal_lunch'],
  ['Dinner', 'meal_dinner'], ['Snacks', 'meal_snacks'],
] as const;

interface Props {
  result: FoodRecognitionResult;
  onSave: (meal: MealCategory) => Promise<void>;
  onBack: () => void;
  saving: boolean;
  saveError: boolean;
}

export function SummaryScreen({ result, onSave, onBack, saving, saveError }: Props) {
  const { t } = useI18n();
  const [meal, setMeal] = useState<MealCategory>('Lunch');
  const portions = result.items.flatMap(item => getScanPortion(item) ?? []);
  const totals = portions.reduce((sum, portion) => ({
    calories: sum.calories + portion.record.calories,
    protein: sum.protein + portion.record.protein,
    carbs: sum.carbs + portion.record.carbs,
    fat: sum.fat + portion.record.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <section className="absolute inset-0 flex h-full flex-col bg-gray-50">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <button type="button" disabled={saving || saveError} onClick={onBack} aria-label={t('btn_back')}
          className="grid size-11 place-items-center rounded-xl hover:bg-gray-100 disabled:opacity-40"><ChevronLeft /></button>
        <h2 className="text-xl font-bold">{t('scan_summary_title')}</h2>
      </header>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-emerald-900 p-5 text-white">
          <p className="text-3xl font-bold">{totals.calories} kcal</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {(['protein', 'carbs', 'fat'] as const).map(key => (
              <div key={key}><dt className="text-emerald-100">{t(key)}</dt><dd className="font-semibold">{Number(totals[key].toFixed(1))} g</dd></div>
            ))}
          </dl>
        </div>

        <ul className="divide-y divide-gray-100 rounded-2xl bg-white px-4">
          {portions.map((portion, index) => (
            <li key={index} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="font-medium">{portion.record.name}</span><span className="shrink-0 text-gray-600">{portion.grams} g</span>
            </li>
          ))}
        </ul>

        <label className="block text-sm font-semibold text-gray-800">
          {t('scan_meal_type')}
          <select value={meal} disabled={saving || saveError}
            onChange={event => setMeal(event.currentTarget.value as MealCategory)}
            className="mt-1 block min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3">
            {meals.map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
          </select>
        </label>
        {saveError && <p role="alert" className="text-sm text-red-700">{t('scan_save_failed')}</p>}
      </motion.div>

      <div className="shrink-0 border-t border-gray-100 bg-white p-4">
        <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={saving || portions.length === 0} aria-busy={saving}
          onClick={() => void onSave(meal)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 font-semibold text-white disabled:opacity-50">
          <Check size={19} aria-hidden="true" />{t(saving ? 'scan_saving' : 'scan_save')}
        </motion.button>
      </div>
    </section>
  );
}
