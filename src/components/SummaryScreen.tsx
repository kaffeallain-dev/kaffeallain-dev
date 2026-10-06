import React, { useMemo } from 'react';
import { ChevronLeft, CheckCircle2, Flame, Droplet, Wheat, Activity, Lightbulb, AlertTriangle, Minus, Plus } from 'lucide-react';
import { FoodRecognitionResult } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { VisionMealIntegrationPipeline } from '../features/recommendation/domain/integration/VisionMealIntegrationPipeline';
import { motion } from 'motion/react';
import { useData } from '../context/DataContext';
import { MealCategory } from '../types';

interface Props {
  result: FoodRecognitionResult;
  onSave: (meal: MealCategory, servings: number) => void;
  onBack: () => void;
  meal: MealCategory;
  servings: number;
  onMealChange: (m: MealCategory) => void;
  onServingsChange: (s: number) => void;
}

const MEAL_OPTIONS: MealCategory[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

function formatServings(s: number): string {
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

export function SummaryScreen({ result, onSave, onBack, meal, servings, onMealChange, onServingsChange }: Props) {
  const { settings, selectedDateConsumptions } = useData();

  // Re-run the analysis if portions were edited on the previous screen
  const analysis = useMemo(() => {
    const validItems = result.items
      .filter(i => i.nutritionStatus === "matched" && i.foodKnowledge)
      .map(i => ({
        foodKnowledge: i.foodKnowledge!,
        estimatedWeightGrams: i.estimatedPortion.estimatedWeight
      }));

    if (validItems.length === 0) {
      return null;
    }

    const currentCalories = selectedDateConsumptions.reduce((sum, item) => sum + item.calories, 0);
    const currentProtein = selectedDateConsumptions.reduce((sum, item) => sum + item.protein, 0);
    const currentCarbs = selectedDateConsumptions.reduce((sum, item) => sum + item.carbs, 0);
    const currentFat = selectedDateConsumptions.reduce((sum, item) => sum + item.fat, 0);

    const targetCalories = settings.dailyGoal;

    let primaryGoal: any = 'healthyEating';
    if (settings.profile?.primaryGoal === 'Lose Weight') primaryGoal = 'weightLoss';
    if (settings.profile?.primaryGoal === 'Gain Weight') primaryGoal = 'weightGain';
    if (settings.profile?.primaryGoal === 'Build Muscle') primaryGoal = 'muscleBuilding';
    if (settings.profile?.primaryGoal === 'Maintain Weight') primaryGoal = 'weightMaintenance';

    const userProfile = {
      primaryGoal,
      conditions: [],
      dailyTargets: {
        calories: targetCalories,
        protein: Math.round(targetCalories * 0.2 / 4),
        carbs: Math.round(targetCalories * 0.5 / 4),
        fat: Math.round(targetCalories * 0.3 / 9)
      },
      currentIntake: {
        calories: currentCalories,
        protein: currentProtein,
        carbs: currentCarbs,
        fat: currentFat
      }
    };

    return VisionMealIntegrationPipeline.analyzeMeal(validItems, userProfile);
  }, [result.items, settings, selectedDateConsumptions]);

  if (!analysis) {
    return (
      <div className="absolute inset-0 bg-gray-50 z-50 flex flex-col h-full overflow-hidden">
        <div className="pt-14 pb-4 px-4 bg-white flex items-center shrink-0 border-b border-gray-100 z-10">
          <button onClick={onBack} className="p-2 text-gray-800">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-xl font-bold flex-1 text-center pr-10">Meal Summary</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle size={48} className="text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Confirmed Foods</h2>
          <p className="text-gray-600 mb-8">Confirm at least one food to continue.</p>
          <button onClick={onBack} className="w-full py-4 rounded-full bg-gray-900 text-white font-bold flex justify-center items-center shadow-xl shadow-gray-900/20">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { totals, healthScore, warnings, coachingTips } = analysis;

  // Totals scaled by the servings the user picked — this is what gets saved.
  const shownCalories = Math.round(totals.calories * servings);
  const shownProtein = Math.round(totals.protein * servings);
  const shownCarbs = Math.round(totals.carbs * servings);
  const shownFat = Math.round(totals.fat * servings);

  return (
    <div className="absolute inset-0 bg-gray-50 z-50 flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="pt-14 pb-4 px-4 bg-white flex items-center shrink-0 border-b border-gray-100 z-10">
        <button onClick={onBack} className="p-2 text-gray-800">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-xl font-bold flex-1 text-center pr-10">Meal Summary</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">

        {/* Top Stats */}
        <div className="bg-white p-6 pt-8 rounded-b-3xl shadow-sm">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-1">Total Calories</p>
              <div className="flex items-baseline">
                <span className="text-5xl font-black text-gray-900">{shownCalories}</span>
                <span className="text-lg text-gray-400 ml-1 font-medium">kcal</span>
              </div>
            </div>

            <div className="text-right">
              <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full ${healthScore >= 7 ? 'bg-emerald-100 text-emerald-700' : healthScore >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                <Activity size={16} />
                <span className="font-bold text-sm">Score {healthScore}/10</span>
              </div>
            </div>
          </div>

          {/* Macros Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100/50">
              <div className="flex items-center space-x-1 text-blue-500 mb-2">
                <Flame size={16} />
                <span className="text-xs font-bold uppercase">Protein</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{shownProtein}g</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100/50">
              <div className="flex items-center space-x-1 text-orange-500 mb-2">
                <Wheat size={16} />
                <span className="text-xs font-bold uppercase">Carbs</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{shownCarbs}g</p>
            </div>
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100/50">
              <div className="flex items-center space-x-1 text-rose-500 mb-2">
                <Droplet size={16} />
                <span className="text-xs font-bold uppercase">Fat</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{shownFat}g</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Log As: meal category + servings */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Log as</h3>
            <div className="flex gap-2 flex-wrap mb-4">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => onMealChange(m)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                    meal === m
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Servings</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onServingsChange(Math.max(0.5, Math.round((servings - 0.5) * 10) / 10))}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                  aria-label="Fewer servings"
                >
                  <Minus size={16} />
                </button>
                <span className="text-lg font-black text-gray-900 w-10 text-center">{formatServings(servings)}</span>
                <button
                  onClick={() => onServingsChange(Math.min(10, Math.round((servings + 0.5) * 10) / 10))}
                  className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"
                  aria-label="More servings"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* AI Coaching Tips */}
          {coachingTips.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <Lightbulb size={20} className="text-amber-500 mr-2" />
                Coach Insights
              </h3>
              <div className="space-y-3">
                {coachingTips.map((tip, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    key={idx}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 border-l-4 border-l-emerald-500"
                  >
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{tip.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{tip.message}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                <AlertTriangle size={20} className="text-red-500 mr-2" />
                Health Warnings
              </h3>
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <ul className="space-y-2">
                  {warnings.map((w, idx) => (
                    <li key={idx} className="flex items-start text-sm text-red-800">
                      <span className="mr-2 mt-0.5">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="absolute bottom-6 left-6 right-6 z-20">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onSave(meal, servings)}
          className="w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg flex justify-center items-center shadow-xl shadow-gray-900/20"
        >
          <CheckCircle2 size={24} className="mr-2 text-emerald-400" />
          Log Meal
        </motion.button>
      </div>

    </div>
  );
}
