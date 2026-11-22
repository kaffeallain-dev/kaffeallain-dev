import React, { useState } from 'react';
import { ChevronRight, Plus, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { commonFoods } from '../data/foodDatabase';
import type { FoodRecognitionResult } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { getScanPortion } from '../lib/scanPortion';
import { parseServingGrams } from '../lib/nutritionScaling';
import { useI18n } from '../lib/i18n';

interface Props {
  result: FoodRecognitionResult;
  onConfirm: (result: FoodRecognitionResult) => void;
  onRetake: () => void;
  onManualAdd: () => void;
}

export function ResultsScreen({ result, onConfirm, onRetake, onManualAdd }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState(result.items);
  const canProceed = items.some(item => getScanPortion(item));
  const hasInvalidAmount = items.some(item => item.grams !== undefined && !getScanPortion(item));

  return (
    <div className="absolute inset-0 z-40 flex h-full min-h-0 flex-col bg-white">
      <div className="relative h-[29%] shrink-0 overflow-hidden rounded-b-3xl bg-gray-900">
        <img src={result.image.image} alt={t('camera_preview')} className="h-full w-full object-contain" />
        <h2 className="absolute inset-x-0 bottom-0 bg-black/65 px-5 py-3 text-lg font-bold text-white">
          {t('scan_review_title')}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-sm text-gray-700">{t(items.length ? 'scan_review_amounts' : 'scan_none')}</p>
        {result.image.quality < 0.7 && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('camera_quality_hint')}</p>}
        {items.map((item, index) => {
          const suggestions = [item.match.foodKnowledgeId, ...item.match.fallbackSuggestions.map(match => match.foodKnowledgeId)];
          const matches = [...new Set(suggestions)].flatMap(id => commonFoods.find(food => food.id === id) ?? []);
          return (
            <motion.section key={item.detectionId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(index, 3) * 0.035 }}
              className="space-y-3 rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{item.detectedLabel}</h3>
              {item.food && (
                <p className="text-sm text-gray-700">{t('scan_matched', { food: item.food.name })}</p>
              )}
              {matches.length > 0 ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('scan_choose_match')}>
                  {matches.map(food => (
                    <button key={food.id} type="button" aria-pressed={item.food?.id === food.id}
                      onClick={() => setItems(previous => previous.map((row, i) => i === index ? { ...row, food, grams: undefined } : row))}
                      className="min-h-10 rounded-full bg-gray-100 px-3 text-sm font-medium text-gray-800 aria-pressed:bg-emerald-100 aria-pressed:text-emerald-900">
                      {food.name}
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-600">{t('scan_unknown')}</p>}
              {item.food && (parseServingGrams(item.food.servingSizeText) ? (
                <label className="block text-sm font-medium text-gray-700">
                  {t('scan_amount_grams', { food: item.food.name })}
                  <input type="number" inputMode="numeric" min={1} max={5000} step={1} placeholder="g"
                    value={item.grams ?? ''} aria-invalid={item.grams !== undefined && !getScanPortion(item)}
                    onChange={event => {
                      const grams = event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value);
                      setItems(previous => previous.map((row, i) => i === index ? { ...row, grams } : row));
                    }}
                    className="mt-1 block min-h-11 w-28 rounded-xl border border-gray-300 px-3 aria-invalid:border-red-600" />
                </label>
              ) : <p className="text-sm text-gray-600">{t('scan_missing_base')}</p>)}
            </motion.section>
          );
        })}
        <button type="button" onClick={onManualAdd} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">
          <Plus size={17} aria-hidden="true" />{t('log_manually')}
        </button>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-gray-100 p-4">
        <button type="button" onClick={onRetake} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 px-2 font-semibold text-gray-800">
          <RefreshCcw size={17} aria-hidden="true" />{t('retry_photo')}
        </button>
        <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={!canProceed || hasInvalidAmount}
          onClick={() => onConfirm({ ...result, items })}
          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2 font-semibold text-white disabled:opacity-45">
          {t('scan_review_meal')}<ChevronRight size={17} aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  );
}
