import React, { useState } from 'react';
import { ChevronRight, Plus, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { commonFoods } from '../data/foodDatabase';
import type { FoodRecognitionResult } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { getScanPortion, getScanReferenceAmounts } from '../lib/scanPortion';
import { parseServingGrams } from '../lib/nutritionScaling';
import { useI18n } from '../lib/i18n';
import { foodSearchRank } from '../lib/foodSearch';

interface Props {
  result: FoodRecognitionResult;
  onConfirm: (result: FoodRecognitionResult) => void;
  onRetake: () => void;
  onManualAdd: () => void;
}

export function ResultsScreen({ result, onConfirm, onRetake, onManualAdd }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState(result.items);
  const [correction, setCorrection] = useState<{ index: number; query: string } | null>(null);
  const canProceed = items.some(item => getScanPortion(item));
  const hasInvalidAmount = items.some(item => item.grams !== undefined && !getScanPortion(item));

  return (
    <div className="absolute inset-0 z-40 flex h-full min-h-0 flex-col bg-white">
      <div className="relative h-[29%] shrink-0 overflow-hidden rounded-b-3xl bg-gray-900">
        <img src={result.image.image} alt={t('camera_preview')} className="h-full w-full object-contain" />
        <h2 className="absolute inset-x-0 bottom-0 bg-black/65 px-5 py-3 text-lg font-bold text-white">
          {t(result.outcome === 'food' ? 'scan_review_title' : result.outcome === 'non_food' ? 'scan_not_food_title' : 'scan_uncertain_title')}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <p role={items.length ? undefined : 'status'} className="text-sm text-gray-700">
          {t(result.outcome === 'food' ? 'scan_review_amounts' : result.outcome === 'non_food' ? 'scan_not_food' : 'scan_none')}
        </p>
        {result.outcome !== 'non_food' && result.image.quality < 0.7 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('camera_quality_hint')}</p>}
        {items.map((item, index) => {
          const suggestions = [item.match.foodKnowledgeId, ...item.match.fallbackSuggestions.map(match => match.foodKnowledgeId)];
          const exact = commonFoods.filter(food => foodSearchRank(food, item.detectedLabel) >= 3);
          const matches = [...new Set([...exact.map(food => food.id), ...suggestions])]
            .flatMap(id => commonFoods.find(food => food.id === id) ?? []);
          const query = correction?.index === index ? correction.query : '';
          const candidates = query.trim()
            ? commonFoods.map(food => ({ food, rank: foodSearchRank(food, query) }))
              .filter(match => match.rank > 0).sort((a, b) => b.rank - a.rank).slice(0, 6).map(match => match.food)
            : [];
          const selectFood = (food: (typeof commonFoods)[number]) => {
            setItems(previous => previous.map((row, i) => i === index && row.food?.id !== food.id
              ? { ...row, food, grams: undefined } : row));
            setCorrection(null);
          };
          const setGrams = (grams: number | undefined) =>
            setItems(previous => previous.map((row, i) => i === index ? { ...row, grams } : row));
          const amounts = getScanReferenceAmounts(item.food?.servingSizeText);
          return (
            <motion.section key={item.detectionId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index, 3) * 0.035 }}
              className="space-y-3 rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{item.detectedLabel}</h3>
              {item.food && (
                <p className="text-sm text-gray-700">{t('scan_matched', { food: item.food.name })}</p>
              )}
              {matches.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('scan_choose_match')}>
                  {matches.map(food => (
                    <button key={food.id} type="button" aria-pressed={item.food?.id === food.id}
                      onClick={() => selectFood(food)}
                      className="min-h-10 rounded-full bg-gray-100 px-3 text-sm font-medium text-gray-800 aria-pressed:bg-emerald-100 aria-pressed:text-emerald-900">
                      {food.name}
                    </button>
                  ))}
                </div>
              )}
              {correction?.index === index ? (
                <div className="space-y-2">
                  <input type="search" aria-label={t('search_food')} placeholder={t('search_food')} value={query}
                    onChange={event => setCorrection({ index, query: event.currentTarget.value })}
                    className="min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm" />
                  {query.trim() && !candidates.length && <p className="text-sm">{t('manual_no_matching_food')}</p>}
                  {candidates.map(food => (
                    <button key={food.id} type="button" onClick={() => selectFood(food)}
                      className="block min-h-11 w-full rounded-lg bg-gray-100 px-3 text-left text-sm">{food.name}</button>
                  ))}
                </div>
              ) : (
                <button type="button" onClick={() => setCorrection({ index, query: '' })}
                  className="min-h-11 text-sm font-semibold text-emerald-800 underline underline-offset-2">
                  {t('scan_find_different')}
                </button>
              )}
              {item.food && (parseServingGrams(item.food.servingSizeText) ? (
                <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {amounts.map(option => (
                    <button key={option.grams} type="button" aria-pressed={item.grams === option.grams}
                      onClick={() => setGrams(option.grams)}
                      className="min-h-10 rounded-full border border-emerald-800/20 px-3 text-sm text-emerald-900 aria-pressed:bg-emerald-100">
                      {t('scan_reference_serving', option)}
                    </button>
                  ))}
                </div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('scan_amount_grams', { food: item.food.name })}
                  <input type="number" inputMode="numeric" min={1} max={5000} step={1} placeholder="g"
                    value={item.grams ?? ''} aria-invalid={item.grams !== undefined && !getScanPortion(item)}
                    onChange={event => {
                      const grams = event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value);
                      setGrams(grams);
                    }}
                    className="mt-1 block min-h-11 w-28 rounded-xl border border-gray-300 px-3 aria-invalid:border-red-600" />
                </label>
                </div>
              ) : <p className="text-sm text-gray-600">{t('scan_missing_base')}</p>)}
            </motion.section>
          );
        })}
        <button type="button" onClick={onManualAdd} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">
          <Plus size={17} aria-hidden="true" />{t('log_manually')}
        </button>
      </div>

      <div className={`grid shrink-0 gap-3 border-t border-gray-100 p-4 ${items.length ? 'grid-cols-2' : ''}`}>
        <button type="button" onClick={onRetake} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 px-2 font-semibold text-gray-800">
          <RefreshCcw size={17} aria-hidden="true" />{t('retry_photo')}
        </button>
        {items.length > 0 && <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={!canProceed || hasInvalidAmount}
          onClick={() => onConfirm({ ...result, items })}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2 font-semibold text-white disabled:opacity-45">
          {t('scan_review_meal')}<ChevronRight size={17} aria-hidden="true" />
        </motion.button>}
      </div>
    </div>
  );
}
