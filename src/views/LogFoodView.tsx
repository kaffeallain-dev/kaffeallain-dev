import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { MealCategory, FoodItemTemplate, CustomFoodTemplate, ConsumptionRecord } from '../types';
import { commonFoods } from '../data/foodDatabase';
import { getCompositeMeals } from '../data/compositeMeals';
import { Search, ChevronLeft, Check, Plus, Save, Zap, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecommendationEngine } from '../lib/RecommendationEngine';
import {
  PortionPreset,
  parseServingGrams,
  getEffectiveMultiplier,
  formatServingDescription,
  calculateScaledNutrients,
  isValidServingMultiplier
} from '../lib/nutritionScaling';
import { useI18n } from '../lib/i18n';
import { parseCustomFoodDraft, hasCatalogueGuidance } from '../lib/manualFood';

export default function LogFoodView({ initialMeal, initialFood, initialRecord, onBack }: { initialMeal: MealCategory, initialFood?: FoodItemTemplate | null, initialRecord?: ConsumptionRecord | null, onBack: () => void }) {
  const { t } = useI18n();
  const { settings, addConsumption, updateConsumption, customFoods, allConsumptions, addCustomFood } = useData();
  const [mealCategory, setMealCategory] = useState<MealCategory>(() => {
    if (initialRecord) return initialRecord.mealCategory;
    if (initialMeal && initialMeal !== 'Snacks') return initialMeal;
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'Breakfast';
    if (hour >= 11 && hour < 16) return 'Lunch';
    if (hour >= 16 && hour < 22) return 'Dinner';
    return 'Snacks';
  });
  const [searchQuery, setSearchQuery] = useState('');

  const allAvailableFoods = useMemo(() => {
    return [...customFoods, ...commonFoods, ...getCompositeMeals()];
  }, [customFoods]);

  const [selectedFood, setSelectedFood] = useState<FoodItemTemplate | null>(() => {
    if (initialRecord && typeof initialRecord === 'object' && typeof initialRecord.name === 'string' && initialRecord.name.trim().length > 0) {
      const match = [...customFoods, ...commonFoods, ...getCompositeMeals()].find(
        f => (f.id && f.id === initialRecord.foodId) || ((f.name || '').toLowerCase() === initialRecord.name.toLowerCase())
      );
      if (match) {
        return match;
      }
      const safeSrv = initialRecord.servings > 0 ? initialRecord.servings : 1;
      return {
        id: initialRecord.foodId || initialRecord.id,
        name: initialRecord.name,
        calories: (initialRecord.calories || 0) / safeSrv,
        protein: (initialRecord.protein || 0) / safeSrv,
        carbs: (initialRecord.carbs || 0) / safeSrv,
        fat: (initialRecord.fat || 0) / safeSrv,
        servingSizeText: initialRecord.servingSizeText || '1 serving',
        category: 'Logged Food'
      } as FoodItemTemplate;
    }
    if (initialFood && typeof initialFood === 'object' && typeof initialFood.name === 'string' && initialFood.name.trim().length > 0) {
      return initialFood;
    }
    return null;
  });

  const [portionSize, setPortionSize] = useState<PortionPreset>(() => {
    if (initialRecord) {
      if (initialRecord.servings === 0.5) return 'Small';
      if (initialRecord.servings === 1.0) return 'Medium';
      if (initialRecord.servings === 1.5) return 'Large';
      if (initialRecord.servings === 2.0) return 'Double';
      return 'Custom';
    }
    return 'Medium';
  });

  const [servings, setServings] = useState<string>(() => {
    if (initialRecord) {
      return initialRecord.servings.toString();
    }
    return '1';
  });

  const baseGrams = useMemo(() => {
    return selectedFood ? parseServingGrams(selectedFood.servingSizeText) : null;
  }, [selectedFood]);

  const [customInputMode, setCustomInputMode] = useState<'servings' | 'grams'>('servings');
  const [customGramsInput, setCustomGramsInput] = useState<string>(() => {
    const srv = initialRecord ? initialRecord.servings : 1;
    if (selectedFood) {
      const bg = parseServingGrams(selectedFood.servingSizeText);
      if (bg) return Math.round(srv * bg).toString();
    }
    return '';
  });

  const handleSelectFood = (food: FoodItemTemplate) => {
    setSelectedFood(food);
    setPortionSize('Medium');
    setServings('1');
    const bg = parseServingGrams(food.servingSizeText);
    if (bg) setCustomGramsInput(bg.toString());
    else setCustomGramsInput('');
    setCustomInputMode('servings');
  };

  const activeCustomInput = customInputMode === 'grams' ? customGramsInput : servings;
  const effectiveMultiplier = useMemo(() => {
    return getEffectiveMultiplier(portionSize, activeCustomInput, baseGrams, customInputMode);
  }, [portionSize, activeCustomInput, baseGrams, customInputMode]);
  const isValidPortion = effectiveMultiplier !== null && isValidServingMultiplier(effectiveMultiplier);

  const handleSwitchToGrams = () => {
    setCustomInputMode('grams');
    if (baseGrams && baseGrams > 0) {
      const s = parseFloat(servings);
      if (Number.isFinite(s) && s > 0) {
        setCustomGramsInput(Math.round(s * baseGrams).toString());
      } else {
        setCustomGramsInput('');
      }
    }
  };

  const handleSwitchToServings = () => {
    setCustomInputMode('servings');
    if (baseGrams && baseGrams > 0) {
      const g = parseFloat(customGramsInput);
      if (Number.isFinite(g) && g > 0) {
        const ratio = g / baseGrams;
        setServings(parseFloat(ratio.toFixed(3)).toString());
      } else {
        setServings('');
      }
    }
  };

  const handleServingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setServings(val);
    const parsed = parseFloat(val);
    if (baseGrams && Number.isFinite(parsed) && parsed > 0) {
      setCustomGramsInput(Math.round(parsed * baseGrams).toString());
    } else if (!val || parsed <= 0) {
      setCustomGramsInput('');
    }
  };

  const handleGramsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomGramsInput(val);
    const g = parseFloat(val);
    if (baseGrams && Number.isFinite(g) && g > 0) {
      const ratio = g / baseGrams;
      setServings(parseFloat(ratio.toFixed(3)).toString());
    } else if (!val || g <= 0) {
      setServings('');
    }
  };

  const handleStepServings = (delta: number) => {
    const cur = parseFloat(servings);
    const baseVal = Number.isFinite(cur) && cur > 0 ? cur : 1;
    const next = Math.max(0.1, parseFloat((baseVal + delta).toFixed(2)));
    setServings(next.toString());
    if (baseGrams) {
      setCustomGramsInput(Math.round(next * baseGrams).toString());
    }
  };

  const handleStepGrams = (delta: number) => {
    if (!baseGrams) return;
    const curG = parseFloat(customGramsInput);
    const baseVal = Number.isFinite(curG) && curG > 0 ? curG : baseGrams;
    const nextG = Math.max(10, Math.round(baseVal + delta));
    setCustomGramsInput(nextG.toString());
    const ratio = nextG / baseGrams;
    setServings(parseFloat(ratio.toFixed(3)).toString());
  };

  const scaledNutrients = useMemo(() => {
    if (!selectedFood || !isValidPortion || effectiveMultiplier === null) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
    return calculateScaledNutrients(selectedFood, effectiveMultiplier);
  }, [selectedFood, effectiveMultiplier, isValidPortion]);

  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [showMoreIntel, setShowMoreIntel] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCals, setCustomCals] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customServingSize, setCustomServingSize] = useState(t('manual_default_serving'));
  const customDraft = parseCustomFoodDraft({ name: customName, calories: customCals, protein: customProtein, carbs: customCarbs, fat: customFat, servingSizeText: customServingSize });

  const recentFoods = useMemo(() => {
    if (searchQuery) return [];
    const counts = allConsumptions.reduce((acc, curr) => {
      acc[curr.name] = (acc[curr.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const sortedNames = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
    return sortedNames.map(name => allAvailableFoods.find(f => f.name === name)).filter(Boolean) as FoodItemTemplate[];
  }, [allConsumptions, allAvailableFoods, searchQuery]);

  const quickLogFoods = useMemo(() => {
    if (searchQuery) return [];
    return allAvailableFoods.filter(f => f.popularity === 'Very Common').slice(0, 25);
  }, [allAvailableFoods, searchQuery]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const queryWords = query.split(/[\s,&+]+/).filter(w => w !== 'and' && w !== 'with' && w.length > 1);
    
    return allAvailableFoods.filter(f => {
      if (!f || typeof f !== 'object' || typeof f.name !== 'string' || !f.name.trim()) return false;
      const matchExactName = f.name.toLowerCase().includes(query);
      const matchExactAlias = Array.isArray(f.aliases) && f.aliases.some(a => a && typeof a === 'string' && a.toLowerCase().includes(query));
      if (matchExactName || matchExactAlias) return true;
      
      if (queryWords.length > 1) {
         const nameAndAliases = [f.name, ...(Array.isArray(f.aliases) ? f.aliases : [])].filter(s => typeof s === 'string').map(s => s.toLowerCase());
         const matchesAnyString = nameAndAliases.some(str => 
             queryWords.every(qw => str.includes(qw))
         );
         if (matchesAnyString) return true;
      }
      return false;
    }).sort((a, b) => {
      if (queryWords.length > 1) {
         const aIsCombo = (a as any).isComposite || a.foodType === 'Combo';
         const bIsCombo = (b as any).isComposite || b.foodType === 'Combo';
         if (aIsCombo && !bIsCombo) return -1;
         if (!aIsCombo && bIsCombo) return 1;
      }
      // Sort by popularity first
      const popOrder: Record<string, number> = { 'Very Common': 0, 'Common': 1, 'Occasional': 2, 'Rare': 3 };
      const popA = popOrder[a.popularity || 'Rare'] ?? 3;
      const popB = popOrder[b.popularity || 'Rare'] ?? 3;
      if (popA !== popB) return popA - popB;

      // Sort Frequently Eaten by Students/Campus Meals higher
      const catOrder = (cat?: string) => {
        if (cat === 'Frequently Eaten by Students') return 0;
        if (cat === 'Campus Meals') return 1;
        if (cat === 'International') return 3;
        return 2;
      };
      const catA = catOrder(a.category);
      const catB = catOrder(b.category);
      if (catA !== catB) return catA - catB;

      return 0;
    }).slice(0, 30);
  }, [searchQuery, allAvailableFoods]);

  const handleLogFood = async () => {
    if (!selectedFood || !isValidPortion || effectiveMultiplier === null) return;

    if (initialRecord) {
      await updateConsumption({
        ...initialRecord,
        name: selectedFood.name,
        calories: scaledNutrients.calories,
        protein: scaledNutrients.protein,
        carbs: scaledNutrients.carbs,
        fat: scaledNutrients.fat,
        servings: effectiveMultiplier,
        mealCategory,
        foodId: selectedFood.id,
        servingSizeText: selectedFood.servingSizeText
      });
    } else {
      await addConsumption({
        id: crypto.randomUUID(),
        name: selectedFood.name,
        calories: scaledNutrients.calories,
        protein: scaledNutrients.protein,
        carbs: scaledNutrients.carbs,
        fat: scaledNutrients.fat,
        servings: effectiveMultiplier,
        mealCategory,
        timestamp: Date.now(),
        foodId: selectedFood.id,
        servingSizeText: selectedFood.servingSizeText
      });
    }
    onBack();
  };

  const handleCreateCustom = async () => {
    if (!customDraft) return;
    const newFood: CustomFoodTemplate = {
      ...customDraft,
      id: crypto.randomUUID(),
      category: 'Custom',
      isCustom: true,
      createdAt: Date.now()
    };

    await addCustomFood(newFood);
    handleSelectFood(newFood);
    setIsCreatingCustom(false);
    setSearchQuery('');
  };

  if (isCreatingCustom) {
    return (
      <div className="max-w-md mx-auto w-full bg-white min-h-screen">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 bg-white z-10">
          <button onClick={() => setIsCreatingCustom(false)} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{t('manual_custom_food')}</h1>
        </header>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">{t('manual_food_name')}</label>
            <input
              type="text"
              aria-label={t('manual_food_name')} maxLength={200} placeholder={t('manual_name_placeholder')}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">{t('calories')}</label>
            <input
              type="number"
              aria-label={t('calories')} step="any" min="0" placeholder="350"
              value={customCals}
              onChange={(e) => setCustomCals(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">{t('manual_protein_g')}</label>
              <input
                type="number"
                aria-label={t('protein')} step="any" min="0" placeholder="10"
                value={customProtein}
                onChange={(e) => setCustomProtein(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">{t('manual_carbs_g')}</label>
              <input
                type="number"
                aria-label={t('carbs')} step="any" min="0" placeholder="45"
                value={customCarbs}
                onChange={(e) => setCustomCarbs(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">{t('manual_fat_g')}</label>
              <input
                type="number"
                aria-label={t('fat')} step="any" min="0" placeholder="5"
                value={customFat}
                onChange={(e) => setCustomFat(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">{t('manual_serving_size')}</label>
            <input
              type="text"
              aria-label={t('manual_serving_size')} maxLength={100} placeholder={t('manual_serving_placeholder')}
              value={customServingSize}
              onChange={(e) => setCustomServingSize(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {customName.trim() && customCals && !customDraft && (
            <p role="alert" className="text-sm text-red-700">{t('manual_invalid_custom')}</p>
          )}
          <button
            onClick={handleCreateCustom}
            disabled={!customDraft}
            className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {t('manual_save_select')}
          </button>
        </div>
      </div>
    );
  }

  if (selectedFood) {
    const totalCals = scaledNutrients.calories;
    const totalProt = Math.round(scaledNutrients.protein);
    const totalCarb = Math.round(scaledNutrients.carbs);
    const totalFat = Math.round(scaledNutrients.fat);
    const scaledServingDesc = effectiveMultiplier !== null
      ? formatServingDescription(selectedFood.servingSizeText, effectiveMultiplier, baseGrams)
      : selectedFood.servingSizeText || '1 serving';

    return (
      <div className="max-w-md mx-auto w-full bg-white min-h-screen pb-32">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
          <button 
            onClick={() => {
              if ((initialFood && selectedFood?.id === initialFood.id) || initialRecord) {
                onBack();
              } else {
                setSelectedFood(null);
              }
            }} 
            className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
             <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{initialRecord ? t('manual_edit_meal') : t('manual_add_food')}</h1>
        </header>

        <div className="p-6 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            {((selectedFood as any).isComposite || selectedFood.foodType === 'Combo') && (selectedFood as any).components && (
              <p className="text-sm text-gray-500 mb-2 font-medium">
                {(selectedFood as any).components.join(' served with ')}
              </p>
            )}
            <p className={`font-medium text-sm inline-block px-3 py-1 rounded-lg mb-4 mt-1 ${
              isValidPortion ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
            }`}>
              {isValidPortion ? `~${totalCals} kcal · ${scaledServingDesc}` : t('manual_valid_portion')}
            </p>
            
            {(() => {
              const userGoal = settings.profile?.primaryGoal;
              const hasGuidance = !customFoods.some(food => food.id === selectedFood.id) &&
                hasCatalogueGuidance(selectedFood, [...commonFoods, ...getCompositeMeals()]);
              if (!hasGuidance || !userGoal) {
                return (
                  <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4" role="note">
                    <p className="text-sm font-semibold text-gray-900">{t('manual_no_assessment')}</p>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">
                      {t(!hasGuidance ? 'manual_custom_guidance_note' : 'manual_no_goal_note')}
                    </p>
                  </div>
                );
              }
              const comp = RecommendationEngine.evaluateGoalCompatibility(selectedFood, userGoal);
              const intel = RecommendationEngine.analyzeFood(selectedFood);
              
              const formatGoal = (g: string) => {
                if (g === 'Lose Weight') return 'WEIGHT LOSS';
                if (g === 'Build Muscle') return 'MUSCLE BUILDING';
                if (g === 'Gain Weight') return 'WEIGHT GAIN';
                return 'GENERAL HEALTH';
              };
              
              const levelText = `${comp.level.toUpperCase()} FOR`;
              
              const getIntelSections = () => {
                  const sections = [];
                  
                  if (intel.bestFor && intel.bestFor.length > 0) {
                    sections.push({ id: 'bestFor', title: 'Best For', type: 'tags', data: intel.bestFor });
                  }
                  if (intel.goodSourceOf && intel.goodSourceOf.length > 0) {
                    sections.push({ id: 'goodSourceOf', title: 'Good Source Of', type: 'tags', data: intel.goodSourceOf });
                  }
                  
                  const makeItBetter = [];
                  if (intel.betterAlternative && intel.betterAlternative !== 'None') {
                    makeItBetter.push(intel.betterAlternative);
                  }
                  if (selectedFood.preparationNotes) {
                    makeItBetter.push(selectedFood.preparationNotes);
                  }
                  if (makeItBetter.length > 0) {
                    sections.push({ id: 'makeItBetter', title: 'Make It Better', type: 'text', data: makeItBetter.join(' • '), color: 'text-emerald-600' });
                  }
                  
                  if (intel.suggestedPairing && intel.suggestedPairing !== 'None') {
                    sections.push({ id: 'pairing', title: 'Pairing', type: 'text', data: intel.suggestedPairing, color: 'text-blue-600' });
                  }
                  
                  if (intel.potentialConcerns && intel.potentialConcerns.length > 0) {
                    sections.push({ id: 'concerns', title: 'Potential Concerns', type: 'text', data: intel.potentialConcerns.join(', '), color: 'text-amber-600' });
                  }
                  
                  if (userGoal === 'Lose Weight') {
                     const order = ['bestFor', 'makeItBetter', 'concerns', 'pairing', 'goodSourceOf'];
                     sections.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
                  } else if (userGoal === 'Build Muscle') {
                     const order = ['goodSourceOf', 'pairing', 'bestFor', 'makeItBetter', 'concerns'];
                     sections.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
                  } else if (userGoal === 'Gain Weight') {
                     const order = ['pairing', 'goodSourceOf', 'bestFor', 'makeItBetter', 'concerns'];
                     sections.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
                  }
                  
                  return sections;
              };
              
              const sections = getIntelSections();
              const hasIntel = sections.length > 0 || intel.recommendedFrequency;

              return (
                <div className="flex flex-col gap-3 mb-6">
                  <div className={`p-4 rounded-xl border flex flex-col gap-1 ${
                    comp.level === 'Excellent' ? 'bg-emerald-50/50 border-emerald-100' :
                    comp.level === 'Moderate' ? 'bg-blue-50/50 border-blue-100' :
                    'bg-amber-50/50 border-amber-100'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className={`w-4 h-4 ${
                        comp.level === 'Excellent' ? 'text-emerald-600' :
                        comp.level === 'Moderate' ? 'text-blue-600' :
                        'text-amber-600'
                      }`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        comp.level === 'Excellent' ? 'text-emerald-700' :
                        comp.level === 'Moderate' ? 'text-blue-700' :
                        'text-amber-700'
                      }`}>
                        {levelText} {formatGoal(userGoal)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{comp.reason}</p>
                  </div>
                  
                  {hasIntel && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Food Intelligence</h3>
                      
                      <div className="grid grid-cols-1 gap-y-4 text-sm">
                        {sections.map(sec => (
                          <div key={sec.id}>
                            <span className={`text-xs font-semibold uppercase tracking-wider block mb-1 ${sec.color || 'text-gray-500'}`}>
                              {sec.title}
                            </span>
                            {sec.type === 'tags' ? (
                              <div className="flex flex-wrap gap-1">
                                {(sec.data as string[]).map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white border rounded-md text-gray-700 text-xs shadow-sm">{item}</span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-700 text-sm leading-relaxed">{sec.data}</p>
                            )}
                          </div>
                        ))}
                        
                        {intel.recommendedFrequency && (
                          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm mt-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Frequency</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                              intel.recommendedFrequency === 'Daily' ? 'bg-emerald-100 text-emerald-700' :
                              intel.recommendedFrequency === 'Occasional' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{intel.recommendedFrequency}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            
          </div>

          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="text-center">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('protein')}</p>
              <p className="font-bold text-gray-900">{totalProt}g</p>
            </div>
            <div className="text-center border-l border-r border-gray-200">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('carbs')}</p>
              <p className="font-bold text-gray-900">{totalCarb}g</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{t('fat')}</p>
              <p className="font-bold text-gray-900">{totalFat}g</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">{t('portion_size')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(['Small', 'Medium', 'Large', 'Double'] as const).map(size => {
                const multi = size === 'Small' ? 0.5 : size === 'Medium' ? 1.0 : size === 'Large' ? 1.5 : 2.0;
                const cals = Math.round(selectedFood.calories * multi);
                const sizeLabel = size === 'Small' ? t('portion_small') : size === 'Medium' ? t('portion_medium') : size === 'Large' ? t('portion_large') : t('portion_double');
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPortionSize(size);
                      setServings(multi.toString());
                      if (baseGrams) {
                        setCustomGramsInput(Math.round(multi * baseGrams).toString());
                      }
                    }}
                    className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-colors ${
                      portionSize === size 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold shadow-xs' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-xs sm:text-sm mb-0.5">{sizeLabel}</span>
                    <span className="text-[11px] font-medium opacity-90 mb-1 text-center truncate max-w-full">
                      {size === 'Small' ? '½' : size === 'Medium' ? '1x' : size === 'Large' ? '1½' : '2x'}
                      {baseGrams ? ` · ${Math.round(baseGrams * multi)}g` : ''}
                    </span>
                    <span className="text-xs opacity-80 font-bold">~{cals} kcal</span>
                  </button>
                );
              })}
            </div>
            
            <div className="mt-3 flex flex-col gap-2">
              <button 
                type="button"
                onClick={() => setPortionSize('Custom')}
                className={`text-sm font-semibold w-full py-3.5 rounded-xl border transition-colors flex justify-between items-center px-4 ${
                  portionSize === 'Custom' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{t('portion_custom')}</span>
                {portionSize === 'Custom' ? (
                  <span className={`font-bold ${isValidPortion ? 'text-emerald-700' : 'text-red-600'}`}>
                    {customInputMode === 'grams' && baseGrams
                      ? (isValidPortion ? `${customGramsInput || 0}g` : t('invalid_grams'))
                      : (isValidPortion ? `${servings} ${parseFloat(servings) === 1 ? t('serving_singular') : t('servings')}` : t('invalid_servings'))}
                  </span>
                ) : (
                  <span className="text-gray-400 font-normal">{t('tap_to_edit')}</span>
                )}
              </button>

              {portionSize === 'Custom' && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3 mt-1">
                  {baseGrams && baseGrams > 0 ? (
                    <div className="flex bg-white p-1 rounded-xl border border-gray-200 max-w-xs mx-auto">
                      <button
                        type="button"
                        onClick={handleSwitchToServings}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          customInputMode === 'servings'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('by_servings')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSwitchToGrams}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          customInputMode === 'grams'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('by_grams', { base: baseGrams })}
                      </button>
                    </div>
                  ) : null}

                  {customInputMode === 'servings' ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button 
                          type="button"
                          onClick={() => handleStepServings(-0.25)} 
                          className="w-12 h-12 shrink-0 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors"
                        >
                          -
                        </button>
                        <div className={`flex-1 flex items-center bg-white border ${!isValidPortion ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-400' : 'border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500'} rounded-xl px-3 py-2.5 transition-all`}>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0.1"
                            value={servings}
                            onChange={handleServingsChange}
                            placeholder="1"
                            className="w-full text-right font-bold text-lg text-gray-900 bg-transparent focus:outline-none min-w-0"
                          />
                          <span className="shrink-0 text-xs text-gray-400 font-medium pl-2 select-none">{t('servings')}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleStepServings(0.25)} 
                          className="w-12 h-12 shrink-0 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors"
                        >
                          +
                        </button>
                      </div>
                      {baseGrams && baseGrams > 0 && isValidPortion && (
                        <p className="text-[11px] text-center text-gray-400 mt-1">
                          {t('equivalent_label', { g: Math.round((effectiveMultiplier || 0) * baseGrams) })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button 
                          type="button"
                          onClick={() => handleStepGrams(-25)} 
                          className="w-14 h-12 shrink-0 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-700 hover:bg-gray-50 shadow-xs transition-colors"
                        >
                          -25g
                        </button>
                        <div className={`flex-1 flex items-center bg-white border ${!isValidPortion ? 'border-red-400 focus-within:ring-2 focus-within:ring-red-400' : 'border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500'} rounded-xl px-3 py-2.5 transition-all`}>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="1"
                            min="1"
                            value={customGramsInput}
                            onChange={handleGramsChange}
                            placeholder={baseGrams ? baseGrams.toString() : "100"}
                            className="w-full text-right font-bold text-lg text-gray-900 bg-transparent focus:outline-none min-w-0"
                          />
                          <span className="shrink-0 text-xs text-gray-400 font-medium pl-2 select-none">{t('grams')}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleStepGrams(25)} 
                          className="w-14 h-12 shrink-0 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-700 hover:bg-gray-50 shadow-xs transition-colors"
                        >
                          +25g
                        </button>
                      </div>
                      {baseGrams && isValidPortion && (
                        <p className="text-[11px] text-center text-gray-400 mt-1">
                          {t('ratio_label', { base: baseGrams, ratio: parseFloat((effectiveMultiplier || 0).toFixed(2)) })}
                        </p>
                      )}
                    </div>
                  )}

                  {!isValidPortion && (
                    <p className="text-xs font-semibold text-red-500 text-center py-1">
                      {t('invalid_portion_greater_zero')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('when_did_you_have_this')}</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as MealCategory[]).map(meal => {
                const mealKey = meal === 'Breakfast' ? 'meal_breakfast' : meal === 'Lunch' ? 'meal_lunch' : meal === 'Dinner' ? 'meal_dinner' : 'meal_snacks';
                return (
                  <button
                    key={meal}
                    type="button"
                    onClick={() => setMealCategory(meal)}
                    className={`py-3 px-4 rounded-xl font-medium text-sm transition-colors border ${
                      mealCategory === meal 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t(mealKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-6">
            <div className="flex justify-between items-end mb-4">
              <span className="text-gray-500 font-medium">{t('calories')}</span>
              <span className="text-3xl font-bold text-gray-900">
                {isValidPortion ? `~${scaledNutrients.calories}` : '—'}
              </span>
            </div>
            <button
              onClick={handleLogFood}
              disabled={!isValidPortion}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              <Check className="w-5 h-5" />
              {initialRecord ? t('save_changes') : t('save_meal')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full bg-white flex flex-col h-full min-h-screen pb-32">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{t('log_meal')}</h1>
        </div>
        <button 
          onClick={() => {
            setCustomName(searchQuery);
            setIsCreatingCustom(true);
          }} 
          className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="p-6 flex-1 flex flex-col">
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={t('search_food')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {!searchQuery && recentFoods.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('recently_logged')}</h3>
              <ul className="space-y-2">
                {recentFoods.map(food => (
                  <li key={`recent-${food.id}`}>
                    <button
                      onClick={() => handleSelectFood(food)}
                      className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors text-left border border-transparent hover:border-emerald-100"
                    >
                      <div className="flex-1 pr-4">
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!searchQuery && quickLogFoods.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">{t('quick_add')}</h3>
              <ul className="space-y-2">
                {quickLogFoods.map(food => (
                  <li key={`quick-${food.id}`}>
                    <button
                      onClick={() => handleSelectFood(food)}
                      className="w-full flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:border-amber-200 hover:bg-amber-50 transition-colors text-left shadow-sm"
                    >
                      <div className="flex-1 pr-4">
                        <p className="font-semibold text-gray-900">{food.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!searchQuery && recentFoods.length === 0 && quickLogFoods.length === 0 && (
            <div className="text-center py-10 opacity-60">
              <p className="text-gray-500">{t('manual_search_hint')}</p>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="text-center py-10">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('manual_no_matching_food')}</h3>
              <p className="text-gray-500 mb-6">{t('manual_try_name')}</p>
              <button 
                onClick={() => {
                  setCustomName(searchQuery);
                  setIsCreatingCustom(true);
                }}
                className="text-emerald-600 font-semibold hover:text-emerald-700 flex items-center justify-center gap-1 mx-auto bg-emerald-50 px-4 py-2 rounded-xl"
              >
                <Plus className="w-4 h-4" />
                {t('manual_create_custom')}
              </button>
            </div>
          )}

          {searchQuery && searchResults.length > 0 && (
            <div className="space-y-6 pb-10">
              {Array.from(new Set(searchResults.map(f => f.category || 'Other'))).map(cat => {
                const group = searchResults.filter(f => (f.category || 'Other') === cat);
                if (group.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {cat}
                    </h3>
                    <ul className="space-y-2">
                      {group.map(food => {
                        const isCombo = (food as any).isComposite || food.foodType === 'Combo';
                        return (
                        <li key={food.id}>
                          <button
                            onClick={() => handleSelectFood(food)}
                            className="w-full flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors text-left group"
                          >
                            <div className="flex-1 pr-4">
                              <p className="font-semibold text-gray-900 group-hover:text-emerald-900 flex items-center gap-2">
                                {food.name}
                                {isCombo && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                    Combo
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500 group-hover:text-emerald-600 mt-0.5">{food.servingSizeText} &middot; ~{food.calories} kcal</p>
                            </div>
                            {food.category === 'Local' && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0">
                                Local
                              </span>
                            )}
                          </button>
                        </li>
                      )})}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
