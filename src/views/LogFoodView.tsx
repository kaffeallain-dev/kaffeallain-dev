import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { MealCategory, FoodItemTemplate, CustomFoodTemplate, ConsumptionRecord } from '../types';
import { commonFoods } from '../data/foodDatabase';
import { getCompositeMeals } from '../data/compositeMeals';
import { Search, ChevronLeft, Check, Plus, Save, Zap, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecommendationEngine } from '../lib/RecommendationEngine';

export default function LogFoodView({ initialMeal, initialFood, initialRecord, onBack }: { initialMeal: MealCategory, initialFood?: FoodItemTemplate | null, initialRecord?: ConsumptionRecord | null, onBack: () => void }) {
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
  
  const [selectedFood, setSelectedFood] = useState<FoodItemTemplate | null>(() => {
    if (initialRecord) {
      return {
        id: initialRecord.id, // we might need to know it's a record id
        name: initialRecord.name,
        calories: initialRecord.calories / initialRecord.servings,
        protein: initialRecord.protein / initialRecord.servings,
        carbs: initialRecord.carbs / initialRecord.servings,
        fat: initialRecord.fat / initialRecord.servings,
        servingSizeText: '1 serving' // fallback
      } as FoodItemTemplate;
    }
    return initialFood || null;
  });
  const [servings, setServings] = useState(initialRecord ? initialRecord.servings.toString() : '1');
  const [portionSize, setPortionSize] = useState<'Small' | 'Medium' | 'Large' | 'Custom'>('Medium');

  // Helper to format serving descriptions intelligently
  const getServingDescription = (size: string, baseText: string = 'serving') => {
    const match = baseText.match(/^([\d.]+)\s*(.*)/);
    if (match) {
      const num = parseFloat(match[1]);
      let unit = match[2] || 'serving';
      const multi = size === 'Small' ? 0.5 : size === 'Large' ? 1.5 : 1;
      const finalNum = num * multi;
      
      const prefix = size !== 'Medium' ? 'About ' : '';
      let formattedNum = finalNum.toString();
      if (finalNum === 0.5) formattedNum = '½';
      else if (finalNum === 1.5) formattedNum = '1½';
      
      if (finalNum <= 1 && unit.endsWith('s') && !unit.endsWith('ss') && unit !== 'grams') unit = unit.slice(0, -1);
      if (finalNum > 1 && !unit.endsWith('s') && unit !== 'g' && unit !== 'ml') unit += 's';
      
      return `${prefix}${formattedNum} ${unit}`.trim();
    }
    
    const b = baseText.toLowerCase();
    if (size === 'Small') return `About ½ ${b}`;
    if (size === 'Medium') return `1 ${b}`;
    if (size === 'Large') return `About 1½ ${b}s`.replace('ss', 's');
    return '';
  };

  // Helper to get multiplier based on portion size
  const getPortionMultiplier = (size: string, customServings: string) => {
    switch(size) {
      case 'Small': return 0.5;
      case 'Medium': return 1.0;
      case 'Large': return 1.5;
      default: return parseFloat(customServings) || 0;
    }
  };

  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [showMoreIntel, setShowMoreIntel] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCals, setCustomCals] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customServingSize, setCustomServingSize] = useState('1 serving');

  const allAvailableFoods = useMemo(() => {
    return [...customFoods, ...commonFoods, ...getCompositeMeals()];
  }, [customFoods]);

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
      const matchExactName = f.name.toLowerCase().includes(query);
      const matchExactAlias = f.aliases?.some(a => a.toLowerCase().includes(query));
      if (matchExactName || matchExactAlias) return true;
      
      if (queryWords.length > 1) {
         const nameAndAliases = [f.name, ...(f.aliases || [])].map(s => s.toLowerCase());
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
    if (!selectedFood) return;
    const numServings = parseFloat(servings);
    if (isNaN(numServings) || numServings <= 0) return;

    if (initialRecord) {
      await updateConsumption({
        ...initialRecord,
        name: selectedFood.name,
        calories: selectedFood.calories * numServings,
        protein: selectedFood.protein ? selectedFood.protein * numServings : 0,
        carbs: selectedFood.carbs ? selectedFood.carbs * numServings : 0,
        fat: selectedFood.fat ? selectedFood.fat * numServings : 0,
        servings: numServings,
        mealCategory,
      });
    } else {
      await addConsumption({
        id: crypto.randomUUID(),
        name: selectedFood.name,
        calories: selectedFood.calories * numServings,
        protein: selectedFood.protein ? selectedFood.protein * numServings : 0,
        carbs: selectedFood.carbs ? selectedFood.carbs * numServings : 0,
        fat: selectedFood.fat ? selectedFood.fat * numServings : 0,
        servings: numServings,
        mealCategory,
        timestamp: Date.now()
      });
    }
    onBack();
  };

  const handleCreateCustom = async () => {
    const cals = parseInt(customCals, 10);
    if (!customName.trim() || isNaN(cals) || cals <= 0) return;

    const newFood: CustomFoodTemplate = {
      id: crypto.randomUUID(),
      name: customName.trim(),
      calories: cals,
      protein: parseFloat(customProtein) || 0,
      carbs: parseFloat(customCarbs) || 0,
      fat: parseFloat(customFat) || 0,
      servingSizeText: customServingSize.trim() || '1 serving',
      category: 'Custom',
      isCustom: true,
      createdAt: Date.now()
    };

    await addCustomFood(newFood);
    setSelectedFood(newFood);
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
          <h1 className="text-xl font-bold text-gray-900">Custom Food</h1>
        </header>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Food Name</label>
            <input
              type="text"
              placeholder="e.g. Mom's Spaghetti"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              
            />
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Calories</label>
            <input
              type="number"
              placeholder="e.g. 350"
              value={customCals}
              onChange={(e) => setCustomCals(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Protein (g)</label>
              <input
                type="number"
                placeholder="e.g. 10"
                value={customProtein}
                onChange={(e) => setCustomProtein(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Carbs (g)</label>
              <input
                type="number"
                placeholder="e.g. 45"
                value={customCarbs}
                onChange={(e) => setCustomCarbs(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-700">Fat (g)</label>
              <input
                type="number"
                placeholder="e.g. 5"
                value={customFat}
                onChange={(e) => setCustomFat(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Serving Size</label>
            <input
              type="text"
              placeholder="e.g. 1 bowl"
              value={customServingSize}
              onChange={(e) => setCustomServingSize(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={handleCreateCustom}
            disabled={!customName.trim() || !parseInt(customCals, 10)}
            className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Save & Select
          </button>
        </div>
      </div>
    );
  }

  if (selectedFood) {
    const srv = getPortionMultiplier(portionSize, servings);
    const totalCals = Math.round(selectedFood.calories * srv);
    const totalProt = Math.round((selectedFood.protein || 0) * srv);
    const totalCarb = Math.round((selectedFood.carbs || 0) * srv);
    const totalFat = Math.round((selectedFood.fat || 0) * srv);
    
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
          <h1 className="text-xl font-bold text-gray-900">{initialRecord ? "Edit Meal" : "Add Food"}</h1>
        </header>

        <div className="p-6 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1 uppercase tracking-tight">{selectedFood.name}</h2>
            {((selectedFood as any).isComposite || selectedFood.foodType === 'Combo') && (selectedFood as any).components && (
              <p className="text-sm text-gray-500 mb-2 font-medium">
                {(selectedFood as any).components.join(' served with ')}
              </p>
            )}
            <p className="text-emerald-700 font-medium text-sm bg-emerald-50 inline-block px-3 py-1 rounded-lg mb-4 mt-1">
              ~{totalCals} kcal &middot; {getServingDescription(portionSize === 'Custom' ? 'Medium' : portionSize, selectedFood.servingSizeText)}
            </p>
            
            {(() => {
              const userGoal = settings.profile?.primaryGoal || 'Eat Healthier';
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
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Protein</p>
              <p className="font-bold text-gray-900">{totalProt}g</p>
            </div>
            <div className="text-center border-l border-r border-gray-200">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Carbs</p>
              <p className="font-bold text-gray-900">{totalCarb}g</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Fat</p>
              <p className="font-bold text-gray-900">{totalFat}g</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700">Portion Size</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Small', 'Medium', 'Large'] as const).map(size => {
                const multi = getPortionMultiplier(size, '1');
                const cals = Math.round(selectedFood.calories * multi);
                const desc = getServingDescription(size, selectedFood.servingSizeText);
                return (
                  <button
                    key={size}
                    onClick={() => setPortionSize(size)}
                    className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center transition-colors ${
                      portionSize === size 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-sm mb-0.5">{size}</span>
                    <span className="text-[10px] font-medium opacity-90 mb-1">{desc}</span>
                    <span className="text-xs opacity-70">~{cals} kcal</span>
                  </button>
                );
              })}
            </div>
            
            <div className="mt-4 flex flex-col gap-2">
              <button 
                onClick={() => setPortionSize('Custom')}
                className={`text-sm font-semibold w-full py-3 rounded-xl border transition-colors flex justify-between items-center px-4 ${
                  portionSize === 'Custom' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>Custom serving</span>
                {portionSize === 'Custom' ? (
                   <span className="text-emerald-700 font-bold">{servings}</span>
                ) : (
                   <span className="text-gray-400 font-normal">Tap to edit</span>
                )}
              </button>
              {portionSize === 'Custom' && (
                <div className="flex items-center gap-3 mt-1">
                   <button onClick={() => setServings((Math.max(0.1, parseFloat(servings || '1') - 0.5)).toString())} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">-</button>
                   <input
                     type="number"
                     min="0.1"
                     step="0.1"
                     value={servings}
                     onChange={(e) => setServings(e.target.value)}
                     placeholder="e.g. 1.5"
                     className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                   />
                   <button onClick={() => setServings((parseFloat(servings || '1') + 0.5).toString())} className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 transition-colors">+</button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">When did you have this?</label>
            <div className="grid grid-cols-2 gap-3">
              {(['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as MealCategory[]).map(meal => (
                <button
                  key={meal}
                  onClick={() => setMealCategory(meal)}
                  className={`py-3 px-4 rounded-xl font-medium text-sm transition-colors border ${
                    mealCategory === meal 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {meal}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6">
            <div className="flex justify-between items-end mb-4">
              <span className="text-gray-500 font-medium">Total Calories</span>
              <span className="text-3xl font-bold text-gray-900">~{totalCals || 0}</span>
            </div>
            <button
              onClick={handleLogFood}
              disabled={!parseFloat(servings)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              {initialRecord ? "Save Changes" : `Add to ${mealCategory}`}
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
          <h1 className="text-xl font-bold text-gray-900">Search Food</h1>
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
            placeholder="Search foods or meals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {!searchQuery && recentFoods.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recently Logged</h3>
              <ul className="space-y-2">
                {recentFoods.map(food => (
                  <li key={`recent-${food.id}`}>
                    <button
                      onClick={() => setSelectedFood(food)}
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">Quick Add</h3>
              <ul className="space-y-2">
                {quickLogFoods.map(food => (
                  <li key={`quick-${food.id}`}>
                    <button
                      onClick={() => setSelectedFood(food)}
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
              <p className="text-gray-500">Search for a food or create a custom one.</p>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="text-center py-10">
              <h3 className="text-lg font-bold text-gray-900 mb-2">No matching food found</h3>
              <p className="text-gray-500 mb-6">Try another name or add it manually.</p>
              <button 
                onClick={() => {
                  setCustomName(searchQuery);
                  setIsCreatingCustom(true);
                }}
                className="text-emerald-600 font-semibold hover:text-emerald-700 flex items-center justify-center gap-1 mx-auto bg-emerald-50 px-4 py-2 rounded-xl"
              >
                <Plus className="w-4 h-4" />
                Create Custom Food
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
                            onClick={() => setSelectedFood(food)}
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
