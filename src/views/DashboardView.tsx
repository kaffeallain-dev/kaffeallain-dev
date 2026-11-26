import React, { useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { MealCategory, FoodItemTemplate } from "../types";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Zap,
  Lightbulb,
  Camera,
  Target,
  X
} from "lucide-react";
import { motion } from "motion/react";
import { format, isToday, isYesterday, addDays, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getProfileCompletion, isProfileSufficientForTarget } from "../lib/personalization";
import { commonFoods } from "../data/foodDatabase";
import { RecommendationEngine } from "../lib/RecommendationEngine";
import { useI18n } from "../lib/i18n";

export default function DashboardView({
  onLogFood,
  onOpenSettings,
  onOpenOnboarding,
}: {
  onLogFood: (meal: MealCategory, food?: any, record?: any) => void;
  onOpenSettings: () => void;
  onOpenOnboarding?: () => void;
}) {
  const { t, lang } = useI18n();
  const dateLocale = lang === 'fr' ? fr : undefined;
  const {
    settings,
    selectedDate,
    setSelectedDate,
    selectedDateConsumptions,
    allConsumptions,
    customFoods,
  } = useData();

  const totalCalories = selectedDateConsumptions.reduce(
    (sum, item) => sum + item.calories,
    0,
  );
  const remainingCalories = Math.max(0, settings.dailyGoal - totalCalories);
  const progressPercentage = Math.min(
    100,
    (totalCalories / settings.dailyGoal) * 100,
  );

  const [isPromptDismissed, setIsPromptDismissed] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('mboafit_profile_prompt_dismissed') === 'true';
  });

  const handleDismissPrompt = () => {
    setIsPromptDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mboafit_profile_prompt_dismissed', 'true');
    }
  };

  const mealCategories: MealCategory[] = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snacks",
  ];

  const getProgressBg = () => {
    if (progressPercentage <= 50) return "bg-emerald-500";
    if (progressPercentage <= 85) return "bg-emerald-400";
    if (progressPercentage <= 100) return "bg-amber-400";
    return "bg-red-500";
  };

  const getDisplayDate = () => {
    if (isToday(selectedDate)) return t('today');
    if (isYesterday(selectedDate)) return t('yesterday');
    return format(selectedDate, lang === 'fr' ? "EEEE d MMMM" : "EEEE, MMM do", { locale: dateLocale });
  };

  const dailySummary = useMemo(() => {
    return RecommendationEngine.getDailySummary(
      settings.profile,
      selectedDateConsumptions,
      settings.dailyGoal
    );
  }, [selectedDateConsumptions, settings.dailyGoal, settings.profile]);

  const quickAddItems = useMemo(() => {
    const allAvailableFoods = [...customFoods, ...commonFoods];
    const counts = allConsumptions.reduce((acc, curr) => {
      acc[curr.name] = (acc[curr.name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const recentNames = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const items: FoodItemTemplate[] = [];
    
    for (const name of recentNames) {
      if (items.length >= 3) break;
      const food = allAvailableFoods.find(f => f.name === name);
      if (food && !items.find(i => i.name === food.name)) {
        items.push(food);
      }
    }
    
    if (items.length < 3) {
      const defaults = ["Indomie and Egg", "Beans and Bread (Haricot-Pain)", "Rice and Stew", "Puff Puff and Beans"];
      for (const name of defaults) {
        if (items.length >= 3) break;
        const food = allAvailableFoods.find(f => f.name === name);
        if (food && !items.find(i => i.name === food.name)) {
          items.push(food);
        }
      }
    }
    return items;
  }, [allConsumptions, customFoods]);

  const getCurrentMealCategory = (): MealCategory => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "Breakfast";
    if (hour >= 11 && hour < 15) return "Lunch";
    if (hour >= 15 && hour < 22) return "Dinner";
    return "Snacks";
  };

  const profileCompletion = getProfileCompletion(settings.profile);
  const isProfileIncomplete = profileCompletion.percentage < 100;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-emerald-600 px-4 pt-safe-top pb-6 rounded-b-[2rem] shadow-sm">
        <div className="flex justify-between items-center max-w-lg mx-auto w-full pt-4">
          <button
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-2 text-emerald-100 hover:bg-emerald-700 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-white font-black text-xl tracking-tight">
              {getDisplayDate()}
            </h1>
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider mt-0.5">
              {format(selectedDate, "MMMM yyyy", { locale: dateLocale })}
            </p>
          </div>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            disabled={isToday(selectedDate)}
            className="p-2 text-emerald-100 hover:bg-emerald-700 rounded-full transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4">
        {/* SNAP A MEAL */}
        {isToday(selectedDate) && (
          <div className="mb-6">
            <button 
              onClick={() => onLogFood(getCurrentMealCategory())}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/50 rounded-2xl p-4 flex items-center justify-center gap-3 transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="font-bold text-lg">{t('snap_a_meal')}</span>
            </button>
          </div>
        )}

        {/* TODAY'S NUTRITION */}
        <section className="mb-6">
          {(() => {
            const isProfileSufficient = isProfileSufficientForTarget(settings.profile);
            return (
              <div 
                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"
                aria-label={isProfileSufficient 
                  ? t('aria_personalized_calorie_goal', { goal: settings.dailyGoal }) 
                  : t('aria_reference_calorie_goal', { goal: settings.dailyGoal })}
              >
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-2xl font-black text-gray-900 tracking-tight">
                      {Math.round(totalCalories)} <span className="text-sm font-bold text-gray-500">{t('kcal_eaten')}</span>
                    </div>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">
                      ~{Math.round(remainingCalories)} {t('remaining')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {isProfileSufficient ? t('daily_target') : t('general_ref_target_full')}
                    </div>
                    <div className="text-sm font-bold text-gray-900">~{settings.dailyGoal} kcal</div>
                  </div>
                </div>
                
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mt-4">
                  <motion.div
                    className={`h-full ${getProgressBg()}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium truncate max-w-[170px]">
                    {settings.profile?.primaryGoal 
                      ? (settings.profile.primaryGoal === 'Lose Weight' ? t('goal_lose_weight') :
                         settings.profile.primaryGoal === 'Gain Weight' ? t('goal_gain_weight') :
                         settings.profile.primaryGoal === 'Build Muscle' ? t('goal_build_muscle') :
                         settings.profile.primaryGoal === 'Maintain Weight' ? t('goal_maintain_weight') :
                         t('goal_eat_healthier'))
                      : t('no_goal_set')}
                  </span>
                  {onOpenOnboarding && (
                    <button
                      type="button"
                      onClick={onOpenOnboarding}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Target className="w-3.5 h-3.5 text-emerald-600" />
                      {t('customize_goal_wizard')}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

            {!isPromptDismissed && isProfileIncomplete && (
              <div className="mt-3 p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-xs text-emerald-900 font-medium leading-snug">
                    {t('complete_profile_wizard_prompt')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {Boolean(settings.onboardingCompleted || (settings.profile as any)?.onboardingCompleted || (typeof window !== 'undefined' && localStorage.getItem('mboafit_onboarding_completed') === 'true')) ? (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl shadow-xs transition-colors shrink-0"
                    >
                      {t('edit_profile')}
                    </button>
                  ) : (
                    onOpenOnboarding && (
                      <button
                        type="button"
                        onClick={onOpenOnboarding}
                        className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl shadow-xs transition-colors shrink-0"
                      >
                        {t('relaunch_onboarding')}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={handleDismissPrompt}
                    className="p-1 text-emerald-700/60 hover:text-emerald-900 rounded-lg hover:bg-emerald-100/50 transition-colors"
                    aria-label={t('btn_dismiss')}
                    title={t('btn_dismiss')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
        </section>

        {/* TODAY'S MEALS */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">{t('todays_meals')}</h2>
          {selectedDateConsumptions.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2">{t('snap_first_meal_title')}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('snap_first_meal_desc')}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm">
              <ul className="divide-y divide-gray-50">
                {mealCategories.map(meal => {
                  const items = selectedDateConsumptions.filter(c => c.mealCategory === meal);
                  if (items.length === 0) return null;
                  const mealKey = meal === 'Breakfast' ? 'meal_breakfast' : meal === 'Lunch' ? 'meal_lunch' : meal === 'Dinner' ? 'meal_dinner' : 'meal_snacks';
                  return (
                    <li key={meal} className="p-3">
                      <h3 className="font-bold text-gray-900 text-sm mb-3">{t(mealKey)}</h3>
                      <ul className="space-y-4">
                        {items.map(item => (
                          <li key={item.id} className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                ~{Math.round(item.calories)} kcal
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">
                                {item.servings} {item.servings === 1 ? t('serving_singular') : t('servings')}
                              </span>
                              <button
                                onClick={() => onLogFood(meal, null, item)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center transition-colors"
                              >
                                {t('review_estimate')}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
              <div className="p-3 bg-gray-50 rounded-2xl mt-1 flex justify-between items-center border border-gray-100">
                <span className="text-xs font-bold text-gray-600">
                  {t('meals_logged_today', { n: selectedDateConsumptions.length, unit: selectedDateConsumptions.length === 1 ? t('unit_meal') : t('unit_meals') })}
                </span>
                <span className="text-xs font-bold text-gray-400">{t('view_in_meals')}</span>
              </div>
            </div>
          )}
        </section>

        {/* QUICK ADD */}
        {isToday(selectedDate) && quickAddItems.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Zap className="w-4 h-4 text-emerald-500" /> {t('quick_add')}
            </h2>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <ul className="divide-y divide-gray-50">
                {quickAddItems.map((food) => (
                  <li key={`qa-${food.id}`}>
                    <button
                      onClick={() => onLogFood(getCurrentMealCategory(), food)}
                      className="w-full flex justify-between items-center p-4 hover:bg-gray-50 transition-colors text-left group"
                    >
                      <div className="flex-1 pr-4">
                        <p className="font-semibold text-gray-900 text-sm truncate">{food.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{food.servingSizeText}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-gray-700 text-xs bg-gray-100 px-2 py-1 rounded-md">
                          {Math.round(food.calories)} kcal
                        </span>
                        <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-emerald-50 transition-all bg-white">
                          <Plus className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600" />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ONE THING TO TRY */}
        {selectedDateConsumptions.length >= 2 && dailySummary.dailyFocus && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-emerald-500" /> {t('one_thing_to_try')}
            </h2>
            <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100 flex items-start gap-3 shadow-sm">
              <div>
                <p className="text-emerald-900 text-sm font-semibold leading-relaxed">
                  {dailySummary.dailyFocus}
                </p>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
