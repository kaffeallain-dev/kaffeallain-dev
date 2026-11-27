import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  RefreshCcw,
  AlertCircle,
  CheckCircle,
  Plus,
  Check,
  Search,
  Split,
  Scale,
  X
} from 'lucide-react';
import { FoodRecognitionResult, RecognizedItemDetails } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { PortionPresetKey } from '../features/vision/domain/estimation/PortionEstimationTypes';
import { PortionEstimationEngine } from '../features/vision/domain/estimation/PortionEstimationEngine';
import {
  mapCatalogFoodToKnowledge,
  isScanItemReadyForLogging,
  findRelatedCatalogComponents
} from '../features/vision/domain/pipeline/scanPortionHelpers';
import { motion } from 'motion/react';
import { commonFoods as foodDatabase } from '../data/foodDatabase';
import {
  parseServingGrams,
  parsePositiveGramsInput,
  deriveServingPortionOptions,
  calculateGramScaledNutrients
} from '../lib/nutritionScaling';
import { useI18n } from '../lib/i18n';
import { FoodItemTemplate } from '../types';

interface Props {
  result: FoodRecognitionResult;
  onConfirm: (result: FoodRecognitionResult) => void;
  onRetake: () => void;
  onManualAdd?: (food?: FoodItemTemplate | null) => void;
}

interface ItemUiState {
  gramsDraft: string;
  refGramsDraft: string;
  selectedPreset: PortionPresetKey;
  pickerMode: 'none' | 'choose' | 'split';
  pickerQuery: string;
  splitSelectedIds: string[];
  touchedGrams: boolean;
  touchedRefGrams: boolean;
}

function createInitialUiState(item: RecognizedItemDetails): ItemUiState {
  const existingWeight = item.estimatedPortion.estimatedWeight;
  const existingRef = item.estimatedPortion.referenceServingGrams;
  return {
    gramsDraft: existingWeight !== null && existingWeight > 0 ? String(existingWeight) : '',
    refGramsDraft: existingRef !== null && existingRef !== undefined && existingRef > 0 ? String(existingRef) : '',
    selectedPreset: item.estimatedPortion.selectedPreset || 'custom',
    pickerMode: 'none',
    pickerQuery: '',
    splitSelectedIds: [],
    touchedGrams: false,
    touchedRefGrams: false
  };
}

export function ResultsScreen({ result, onConfirm, onRetake, onManualAdd }: Props) {
  const { t } = useI18n();

  const [items, setItems] = useState<RecognizedItemDetails[]>(() =>
    result.items.map(item => ({
      ...item,
      match: {
        ...item.match,
        fallbackSuggestions: [...(item.match.fallbackSuggestions || [])]
      },
      estimatedPortion: { ...item.estimatedPortion }
    }))
  );

  const [uiStates, setUiStates] = useState<ItemUiState[]>(() =>
    result.items.map(createInitialUiState)
  );

  const updateUiState = (index: number, patch: Partial<ItemUiState>) => {
    setUiStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleCandidateSelection = (index: number, foodKnowledgeId: string) => {
    const knowledge = foodDatabase.find(f => f.id === foodKnowledgeId);
    if (!knowledge) return;

    const mappedKnowledge = mapCatalogFoodToKnowledge(knowledge);
    const documentedGrams = parseServingGrams(knowledge.servingSizeText);

    setItems(prev => {
      const updated = [...prev];
      const current = updated[index];
      updated[index] = {
        ...current,
        foodKnowledge: mappedKnowledge,
        nutritionStatus: 'matched',
        estimatedPortion: {
          estimatedWeight: null,
          confidence: 0,
          portionConfidenceLevel: 'unmeasured',
          baseServingGrams: documentedGrams,
          referenceServingGrams: null,
          isConfirmed: false,
          selectedPreset: documentedGrams ? 'regular' : 'custom',
          portionDescription: t('scan_portion_unmeasured'),
          errorMargin: null
        },
        match: {
          ...current.match,
          foodKnowledgeId,
          matchedName: knowledge.name
        }
      };
      return updated;
    });

    // For a matched food with documented serving weight, pre-fill editable Regular (1x) estimate
    // (still unconfirmed until user explicitly confirms portion).
    // For missing serving weight, leave grams blank — NEVER invent a default.
    updateUiState(index, {
      gramsDraft: documentedGrams ? String(documentedGrams) : '',
      refGramsDraft: '',
      selectedPreset: documentedGrams ? 'regular' : 'custom',
      pickerMode: 'none',
      pickerQuery: '',
      splitSelectedIds: [],
      touchedGrams: false,
      touchedRefGrams: false
    });
  };

  const handleUnconfirmFood = (index: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        foodKnowledge: undefined,
        nutritionStatus: 'needs_confirmation',
        estimatedPortion: PortionEstimationEngine.createUnmeasuredPortion(null)
      };
      return updated;
    });
    updateUiState(index, {
      gramsDraft: '',
      refGramsDraft: '',
      selectedPreset: 'custom',
      pickerMode: 'none',
      touchedGrams: false,
      touchedRefGrams: false
    });
  };

  const handleSelectPreset = (index: number, preset: 'small' | 'regular' | 'large', grams: number) => {
    updateUiState(index, {
      gramsDraft: String(grams),
      selectedPreset: preset,
      touchedGrams: true
    });
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        estimatedPortion: {
          ...updated[index].estimatedPortion,
          isConfirmed: false,
          selectedPreset: preset
        }
      };
      return updated;
    });
  };

  const handleGramsDraftChange = (index: number, raw: string) => {
    updateUiState(index, {
      gramsDraft: raw,
      selectedPreset: 'custom',
      touchedGrams: true
    });
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        estimatedPortion: {
          ...updated[index].estimatedPortion,
          isConfirmed: false,
          selectedPreset: 'custom'
        }
      };
      return updated;
    });
  };

  const handleRefGramsDraftChange = (index: number, raw: string) => {
    updateUiState(index, {
      refGramsDraft: raw,
      touchedRefGrams: true
    });
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        estimatedPortion: {
          ...updated[index].estimatedPortion,
          isConfirmed: false
        }
      };
      return updated;
    });
  };

  const handleConfirmPortion = (index: number) => {
    const item = items[index];
    const ui = uiStates[index];
    if (!item || !item.foodKnowledge || !ui) return;

    const parsedGrams = parsePositiveGramsInput(ui.gramsDraft);
    const baseGrams = item.estimatedPortion.baseServingGrams;
    const parsedRef = baseGrams ? baseGrams : parsePositiveGramsInput(ui.refGramsDraft);

    if (parsedGrams === null || parsedRef === null) {
      updateUiState(index, { touchedGrams: true, touchedRefGrams: true });
      return;
    }

    const isPresetEstimate = Boolean(baseGrams) && ui.selectedPreset !== 'custom';
    const nextLevel = isPresetEstimate ? 'serving_estimate' : 'user_entered';
    const nextDescription = isPresetEstimate
      ? t('scan_portion_serving_estimate', { g: parsedGrams })
      : t('scan_portion_user_entered', { g: parsedGrams });

    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        estimatedPortion: {
          ...updated[index].estimatedPortion,
          estimatedWeight: parsedGrams,
          referenceServingGrams: baseGrams ? null : parsedRef,
          confidence: isPresetEstimate ? 0.5 : 0.8,
          portionConfidenceLevel: nextLevel,
          selectedPreset: ui.selectedPreset,
          isConfirmed: true,
          portionDescription: nextDescription,
          errorMargin: null
        }
      };
      return updated;
    });
  };

  const handleEditPortion = (index: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        estimatedPortion: {
          ...updated[index].estimatedPortion,
          isConfirmed: false
        }
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    setUiStates(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleSplitCandidate = (index: number, foodId: string) => {
    const ui = uiStates[index];
    if (!ui) return;
    const exists = ui.splitSelectedIds.includes(foodId);
    const nextIds = exists
      ? ui.splitSelectedIds.filter(id => id !== foodId)
      : [...ui.splitSelectedIds, foodId];
    updateUiState(index, { splitSelectedIds: nextIds });
  };

  const handleReplaceWithComponents = (index: number) => {
    const current = items[index];
    const ui = uiStates[index];
    if (!current || !ui || ui.splitSelectedIds.length === 0) return;

    const selectedFoods = ui.splitSelectedIds
      .map(id => foodDatabase.find(f => f.id === id))
      .filter((f): f is FoodItemTemplate => Boolean(f));

    if (selectedFoods.length === 0) return;

    const replacementItems: RecognizedItemDetails[] = selectedFoods.map((food, compIdx) => {
      const documentedGrams = parseServingGrams(food.servingSizeText);
      return {
        detectionId: `${current.detectionId}-comp-${food.id}-${compIdx}`,
        detectedLabel: food.name,
        detectionConfidence: current.detectionConfidence,
        intelligence: {
          ...current.intelligence,
          detectedName: food.name,
          normalizedName: food.name.toLowerCase()
        },
        match: {
          decision: 'HIGH_CONFIDENCE',
          foodKnowledgeId: food.id,
          matchedName: food.name,
          matchConfidence: 1,
          visionConfidence: current.detectionConfidence ?? 0,
          matchType: 'EXACT_NAME',
          fallbackSuggestions: []
        },
        estimatedPortion: {
          estimatedWeight: null,
          confidence: 0,
          portionConfidenceLevel: 'unmeasured',
          baseServingGrams: documentedGrams,
          referenceServingGrams: null,
          isConfirmed: false,
          selectedPreset: documentedGrams ? 'regular' : 'custom',
          portionDescription: t('scan_portion_unmeasured'),
          errorMargin: null
        },
        foodKnowledge: mapCatalogFoodToKnowledge(food),
        nutritionStatus: 'matched'
      };
    });

    const replacementUiStates: ItemUiState[] = selectedFoods.map(food => {
      const documentedGrams = parseServingGrams(food.servingSizeText);
      return {
        gramsDraft: documentedGrams ? String(documentedGrams) : '',
        refGramsDraft: '',
        selectedPreset: documentedGrams ? 'regular' : 'custom',
        pickerMode: 'none',
        pickerQuery: '',
        splitSelectedIds: [],
        touchedGrams: false,
        touchedRefGrams: false
      };
    });

    // Atomically replace the original mixed-dish card with selected separate components (zero double counting)
    setItems(prev => [
      ...prev.slice(0, index),
      ...replacementItems,
      ...prev.slice(index + 1)
    ]);
    setUiStates(prev => [
      ...prev.slice(0, index),
      ...replacementUiStates,
      ...prev.slice(index + 1)
    ]);
  };

  const handleConfirm = () => {
    const confirmedOnly = items.filter(isScanItemReadyForLogging);
    if (confirmedOnly.length === 0) return;
    onConfirm({ ...result, items });
  };

  const hasLowQuality = result.imageQuality === 'LOW';
  const hasNoItems = items.length === 0;
  const readyCount = items.filter(isScanItemReadyForLogging).length;
  const unconfirmedCount = items.length - readyCount;
  const canProceed = readyCount > 0;

  const formatIdentityConfidence = (conf?: number) => {
    if (conf === undefined || !Number.isFinite(conf)) return t('scan_conf_unknown');
    if (conf > 0.8) return t('scan_conf_high');
    if (conf > 0.5) return t('scan_conf_medium');
    return t('scan_conf_low');
  };

  const filterCatalogue = useMemo(() => {
    return (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return foodDatabase.slice(0, 12);
      return foodDatabase
        .filter(f => {
          if (f.name.toLowerCase().includes(q)) return true;
          return (f.aliases || []).some(a => a.toLowerCase().includes(q));
        })
        .slice(0, 15);
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-white z-40 flex flex-col h-full">
      {/* Header Image */}
      <div className="relative h-[32%] rounded-b-[40px] overflow-hidden shadow-sm shrink-0">
        <img src={result.image.image} alt="Captured meal" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-6">
          <h2 className="text-white text-2xl font-bold">{t('scan_detected_foods')}</h2>
          <p className="text-white/85 text-sm">
            {items.length === 0
              ? t('scan_no_foods_short')
              : t('scan_suggestions_summary', {
                  total: items.length,
                  unit: items.length === 1 ? t('scan_item_singular') : t('scan_item_plural'),
                  confirmed: readyCount
                })}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {hasLowQuality && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
            <AlertCircle size={22} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">{t('scan_poor_quality_title')}</h4>
              <p className="text-sm text-amber-700">{t('scan_poor_quality_desc')}</p>
            </div>
          </div>
        )}

        {/* Kitchen Scale / Single-Photo Weight Disclaimer */}
        {!hasNoItems && (
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 flex items-start gap-2.5">
            <Scale size={18} className="text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-900 leading-relaxed">
              {t('scan_kitchen_scale_tip')}
            </p>
          </div>
        )}

        {items.map((item, idx) => {
          const ui = uiStates[idx] || createInitialUiState(item);
          const primarySuggestion =
            item.match.foodKnowledgeId && item.match.matchedName
              ? { foodKnowledgeId: item.match.foodKnowledgeId, name: item.match.matchedName }
              : null;

          const alternativeSuggestions = (item.match.fallbackSuggestions || []).filter(
            s => !primarySuggestion || s.foodKnowledgeId !== primarySuggestion.foodKnowledgeId
          );

          const hasAnySuggestions = Boolean(primarySuggestion) || alternativeSuggestions.length > 0;
          const isFoodMatched = item.nutritionStatus === 'matched' && Boolean(item.foodKnowledge);
          const isPortionConfirmed = item.estimatedPortion.isConfirmed === true;
          const baseServingGrams = item.estimatedPortion.baseServingGrams;
          const portionOptions = deriveServingPortionOptions(baseServingGrams);
          const servingText = item.foodKnowledge?.servingSizes?.medium || t('manual_default_serving');

          const parsedDraftGrams = parsePositiveGramsInput(ui.gramsDraft);
          const parsedRefGrams = baseServingGrams ? baseServingGrams : parsePositiveGramsInput(ui.refGramsDraft);

          const previewNutrition =
            isFoodMatched && item.foodKnowledge && parsedDraftGrams !== null && parsedRefGrams !== null
              ? calculateGramScaledNutrients(
                  {
                    calories: item.foodKnowledge.nutrition.calories,
                    protein: item.foodKnowledge.nutrition.protein,
                    carbs: item.foodKnowledge.nutrition.carbohydrates,
                    fat: item.foodKnowledge.nutrition.fat,
                    servingSizeText: servingText
                  },
                  parsedDraftGrams,
                  baseServingGrams ? undefined : parsedRefGrams
                )
              : null;

          const canConfirmPortion =
            isFoodMatched &&
            parsedDraftGrams !== null &&
            parsedRefGrams !== null &&
            Boolean(previewNutrition && previewNutrition.valid);

          const matchedCatalogItem = item.foodKnowledge
            ? foodDatabase.find(f => f.id === item.foodKnowledge!.id) || null
            : null;

          const relatedComponents = !isFoodMatched
            ? findRelatedCatalogComponents(item.detectedLabel, foodDatabase)
            : { matches: [], unmatchedTerms: [] };

          const pickerResults = ui.pickerMode !== 'none' ? filterCatalogue(ui.pickerQuery) : [];

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.08, 0.3) }}
              key={item.detectionId || idx}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 text-base capitalize leading-snug">
                    {item.detectedLabel}
                  </h3>

                  {/* Separated Food Identity Confidence vs Portion Weight Confidence */}
                  <div className="mt-1.5 space-y-1 text-xs">
                    <p className="text-gray-500">
                      <span className="font-medium text-gray-600">{t('scan_identity_confidence_label')}:</span>{' '}
                      {formatIdentityConfidence(item.detectionConfidence)}
                    </p>
                    <p className="text-gray-500">
                      <span className="font-medium text-gray-600">{t('scan_portion_confidence_label')}:</span>{' '}
                      <span className={isPortionConfirmed ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                        {isPortionConfirmed && item.estimatedPortion.estimatedWeight !== null
                          ? item.estimatedPortion.portionConfidenceLevel === 'serving_estimate'
                            ? t('scan_portion_serving_estimate', { g: item.estimatedPortion.estimatedWeight })
                            : t('scan_portion_user_entered', { g: item.estimatedPortion.estimatedWeight })
                          : t('scan_portion_unmeasured')}
                      </span>
                    </p>
                  </div>

                  {/* Food Match Status Row */}
                  <div className="mt-2 flex items-center flex-wrap gap-1.5">
                    {!isFoodMatched ? (
                      <>
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        <span className="text-xs font-medium text-amber-700">
                          {primarySuggestion
                            ? t('scan_suggested_confirm', { name: primarySuggestion.name })
                            : item.match.decision === 'AMBIGUOUS'
                              ? t('scan_multiple_matches')
                              : item.match.decision === 'UNKNOWN' && !hasAnySuggestions
                                ? t('scan_not_in_catalogue')
                                : t('scan_needs_confirmation')}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-700">
                          {t('scan_food_confirmed', { name: item.foodKnowledge?.name || '' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnconfirmFood(idx)}
                          className="ml-1 text-xs font-semibold text-gray-500 hover:text-gray-700 underline"
                        >
                          {t('scan_change')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {items.length > 0 && (
                  <button
                    type="button"
                    aria-label={t('scan_remove_item')}
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* STEP 1: Confirm Food Identity (when not yet matched) */}
              {!isFoodMatched && (
                <div className="pt-2.5 border-t border-gray-100 space-y-2.5">
                  {hasAnySuggestions ? (
                    <>
                      <p className="text-xs text-amber-700 font-medium">
                        {primarySuggestion
                          ? t('scan_confirm_suggestion_prompt')
                          : item.match.decision === 'AMBIGUOUS'
                            ? t('scan_multiple_matches_prompt')
                            : t('scan_possible_match_prompt')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {primarySuggestion && (
                          <button
                            type="button"
                            onClick={() => handleCandidateSelection(idx, primarySuggestion.foodKnowledgeId)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-full text-xs font-semibold text-white transition-colors inline-flex items-center gap-1"
                          >
                            <Check size={13} />
                            {t('scan_confirm_food_btn', { name: primarySuggestion.name })}
                          </button>
                        )}
                        {alternativeSuggestions.map(suggestion => (
                          <button
                            type="button"
                            key={suggestion.foodKnowledgeId}
                            onClick={() => handleCandidateSelection(idx, suggestion.foodKnowledgeId)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-semibold text-gray-700 transition-colors"
                          >
                            {suggestion.name}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      {t('scan_unknown_mixed_notice')}
                    </p>
                  )}

                  {/* Explicit actions for unknown / mixed dishes: Choose match OR Split into components */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateUiState(idx, {
                          pickerMode: ui.pickerMode === 'choose' ? 'none' : 'choose',
                          pickerQuery: ''
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                        ui.pickerMode === 'choose'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <Search size={13} />
                      {t('scan_choose_catalogue_match')}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateUiState(idx, {
                          pickerMode: ui.pickerMode === 'split' ? 'none' : 'split',
                          pickerQuery: ''
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                        ui.pickerMode === 'split'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Split size={13} />
                      {t('scan_split_components')}
                    </button>
                  </div>

                  {/* Inline Catalogue Picker (Choose Single Match OR Split into Separate Components) */}
                  {ui.pickerMode !== 'none' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                      {ui.pickerMode === 'split' && (
                        <p className="text-xs text-gray-600 leading-snug">
                          {t('scan_split_helper', { name: item.detectedLabel })}
                        </p>
                      )}

                      {relatedComponents.unmatchedTerms.length > 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          {t('scan_unmatched_components_note', {
                            terms: relatedComponents.unmatchedTerms.join(', ')
                          })}
                        </p>
                      )}

                      {relatedComponents.matches.length > 0 && !ui.pickerQuery.trim() && (
                        <div className="flex flex-wrap gap-1.5">
                          {relatedComponents.matches.map(food => {
                            const selected = ui.splitSelectedIds.includes(food.id);
                            return (
                              <button
                                type="button"
                                key={food.id}
                                onClick={() =>
                                  ui.pickerMode === 'choose'
                                    ? handleCandidateSelection(idx, food.id)
                                    : handleToggleSplitCandidate(idx, food.id)
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                  ui.pickerMode === 'split' && selected
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-emerald-50'
                                }`}
                              >
                                {ui.pickerMode === 'split' && selected ? '✓ ' : ''}
                                {food.name}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={ui.pickerQuery}
                          onChange={e => updateUiState(idx, { pickerQuery: e.target.value })}
                          placeholder={t('scan_search_catalogue')}
                          aria-label={t('scan_search_catalogue')}
                          className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {pickerResults.length === 0 ? (
                          <p className="text-xs text-gray-500 py-2 text-center">
                            {t('scan_no_catalogue_results')}
                          </p>
                        ) : (
                          pickerResults.map(food => {
                            const selected = ui.splitSelectedIds.includes(food.id);
                            const foodGrams = parseServingGrams(food.servingSizeText);
                            return (
                              <button
                                type="button"
                                key={food.id}
                                onClick={() =>
                                  ui.pickerMode === 'choose'
                                    ? handleCandidateSelection(idx, food.id)
                                    : handleToggleSplitCandidate(idx, food.id)
                                }
                                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                  ui.pickerMode === 'split' && selected
                                    ? 'bg-emerald-100 text-emerald-900 font-semibold'
                                    : 'bg-white hover:bg-emerald-50 text-gray-800'
                                }`}
                              >
                                <span className="truncate pr-2">
                                  {food.name}
                                  <span className="text-gray-400 font-normal ml-1">
                                    ({food.servingSizeText}{foodGrams ? '' : ''})
                                  </span>
                                </span>
                                <span className="text-emerald-700 font-semibold shrink-0">
                                  {food.calories} kcal
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {ui.pickerMode === 'split' && (
                        <button
                          type="button"
                          disabled={ui.splitSelectedIds.length === 0}
                          onClick={() => handleReplaceWithComponents(idx)}
                          className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-semibold transition-colors"
                        >
                          {t('scan_replace_with_components', { n: ui.splitSelectedIds.length })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Confirm Portion Weight (only after food identity is confirmed) */}
              {isFoodMatched && item.foodKnowledge && (
                <div className="pt-2.5 border-t border-gray-100 space-y-2.5">
                  {isPortionConfirmed && item.estimatedPortion.estimatedWeight !== null ? (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-semibold text-emerald-800">
                          {item.estimatedPortion.portionConfidenceLevel === 'serving_estimate'
                            ? t('scan_portion_serving_estimate', { g: item.estimatedPortion.estimatedWeight })
                            : t('scan_portion_user_entered', { g: item.estimatedPortion.estimatedWeight })}
                        </p>
                        {previewNutrition && previewNutrition.valid && (
                          <p className="text-xs text-emerald-700">
                            {t('scan_estimated_preview', {
                              kcal: previewNutrition.calories,
                              p: previewNutrition.protein,
                              c: previewNutrition.carbs,
                              f: previewNutrition.fat
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditPortion(idx)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline shrink-0"
                      >
                        {t('scan_edit_portion')}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-800">
                          {t('scan_portion_step_title')}
                        </p>
                        {baseServingGrams !== null && (
                          <span className="text-[11px] text-gray-500">
                            {t('scan_documented_serving_label', {
                              serving: servingText,
                              g: baseServingGrams
                            })}
                          </span>
                        )}
                      </div>

                      {/* Case A: Documented serving weight in grams -> Small/Regular/Large estimates (0.5x / 1x / 1.5x) */}
                      {baseServingGrams !== null && portionOptions.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-gray-600">
                            {t('scan_estimates_not_measured')}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {portionOptions.map(opt => {
                              const label =
                                opt.key === 'small'
                                  ? t('scan_preset_small')
                                  : opt.key === 'regular'
                                    ? t('scan_preset_regular')
                                    : t('scan_preset_large');
                              const isSelected =
                                ui.selectedPreset === opt.key &&
                                parsedDraftGrams === opt.grams;
                              return (
                                <button
                                  type="button"
                                  key={opt.key}
                                  onClick={() => handleSelectPreset(idx, opt.key, opt.grams)}
                                  className={`py-2 px-2 rounded-xl border text-center transition-colors ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                                  }`}
                                >
                                  <div className="text-[11px] font-semibold leading-tight">{label}</div>
                                  <div className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-emerald-50' : 'text-emerald-700'}`}>
                                    ~{opt.grams}g
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Case B: Missing serving weight in grams -> require user-entered positive grams + serving reference (never invent default) */
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2">
                          <p className="text-xs text-amber-800 leading-snug">
                            {t('scan_missing_serving_weight_notice', { serving: servingText })}
                          </p>
                          {matchedCatalogItem && onManualAdd && (
                            <button
                              type="button"
                              onClick={() => onManualAdd(matchedCatalogItem)}
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                            >
                              {t('scan_log_by_serving_btn', { serving: servingText })}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Editable Grams Input (No silent upper cap!) */}
                      <div className="space-y-2">
                        <div>
                          <label
                            htmlFor={`scan-grams-${idx}`}
                            className="block text-[11px] font-medium text-gray-600 mb-1"
                          >
                            {t('scan_grams_input_label')}
                          </label>
                          <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-gray-200 focus-within:border-emerald-500">
                            <input
                              id={`scan-grams-${idx}`}
                              type="text"
                              inputMode="decimal"
                              aria-label={`${item.foodKnowledge.name} ${t('scan_grams_input_label')}`}
                              placeholder={t('scan_grams_placeholder')}
                              value={ui.gramsDraft}
                              onChange={e => handleGramsDraftChange(idx, e.target.value)}
                              className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                            />
                            <span className="text-gray-500 font-medium text-sm ml-2">g</span>
                          </div>
                          {ui.touchedGrams && parsedDraftGrams === null && (
                            <p className="text-xs text-red-600 mt-1" role="alert">
                              {t('scan_invalid_grams_error')}
                            </p>
                          )}
                        </div>

                        {/* Reference serving weight input ONLY when catalogue item has no documented gram weight */}
                        {baseServingGrams === null && (
                          <div>
                            <label
                              htmlFor={`scan-ref-grams-${idx}`}
                              className="block text-[11px] font-medium text-gray-600 mb-1"
                            >
                              {t('scan_reference_serving_label', { serving: servingText })}
                            </label>
                            <div className="flex items-center bg-white rounded-xl px-3 py-2 border border-gray-200 focus-within:border-emerald-500">
                              <input
                                id={`scan-ref-grams-${idx}`}
                                type="text"
                                inputMode="decimal"
                                aria-label={t('scan_reference_serving_label', { serving: servingText })}
                                placeholder={t('scan_reference_serving_placeholder')}
                                value={ui.refGramsDraft}
                                onChange={e => handleRefGramsDraftChange(idx, e.target.value)}
                                className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                              />
                              <span className="text-gray-500 font-medium text-sm ml-2">g</span>
                            </div>
                            {ui.touchedRefGrams && parsedRefGrams === null && (
                              <p className="text-xs text-red-600 mt-1" role="alert">
                                {t('scan_invalid_reference_grams_error')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {previewNutrition && previewNutrition.valid && (
                        <p className="text-xs text-emerald-700 font-medium">
                          {t('scan_estimated_preview', {
                            kcal: previewNutrition.calories,
                            p: previewNutrition.protein,
                            c: previewNutrition.carbs,
                            f: previewNutrition.fat
                          })}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={!canConfirmPortion}
                        onClick={() => handleConfirmPortion(idx)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} />
                        {canConfirmPortion && parsedDraftGrams !== null
                          ? t('scan_confirm_portion_btn', { g: parsedDraftGrams })
                          : t('scan_confirm_portion_disabled_btn')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {hasNoItems && !hasLowQuality && (
          <div className="text-center py-10">
            <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-gray-600 font-semibold">{t('scan_no_food_detected_title')}</h3>
            <p className="text-sm text-gray-400 mt-2">{t('scan_no_food_detected_desc')}</p>
          </div>
        )}

        {/* Add Missing Food Button */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => onManualAdd?.(null)}
            className="flex items-center text-emerald-600 font-medium text-sm hover:text-emerald-700 transition-colors bg-emerald-50 px-4 py-2 rounded-full"
          >
            <Plus size={16} className="mr-1" />
            {t('scan_add_missing_food')}
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-5 pb-10 bg-white border-t border-gray-100 flex flex-col space-y-3 shrink-0">
        {!canProceed && !hasNoItems && !hasLowQuality && (
          <p className="text-center text-amber-700 text-xs font-medium">
            {t('scan_confirm_both_prompt')}
          </p>
        )}
        {canProceed && unconfirmedCount > 0 && (
          <p className="text-center text-gray-500 text-xs">
            {t('scan_unconfirmed_excluded_note', { n: unconfirmedCount })}
          </p>
        )}
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 py-3.5 rounded-full border-2 border-gray-200 text-gray-600 font-semibold flex justify-center items-center"
          >
            <RefreshCcw size={18} className="mr-2" />
            {t('scan_retake')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canProceed}
            className="flex-1 py-3.5 rounded-full bg-emerald-600 text-white font-semibold flex justify-center items-center shadow-lg shadow-emerald-600/30 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none transition-colors"
          >
            {t('scan_view_analysis')}
            <ChevronRight size={18} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
