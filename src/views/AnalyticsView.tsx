import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  ArrowRight,
  Utensils,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calendar,
  Info,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { FoodItemTemplate } from '../types';
import { RecommendationEngine } from '../lib/RecommendationEngine';
import { commonFoods } from '../data/foodDatabase';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  hasMeaningfulPersonalization,
  calculateDailyTarget
} from '../lib/personalization';
import { useI18n } from '../lib/i18n';

function usePrefersReducedMotion(): boolean {
  const motionHookPref = useReducedMotion();
  const [mediaQueryPref, setMediaQueryPref] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMediaQueryPref(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMediaQueryPref(e.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  return Boolean(motionHookPref || mediaQueryPref);
}

export default function AnalyticsView({
  onLogFood
}: {
  onLogFood?: (food?: FoodItemTemplate) => void;
}) {
  const { allConsumptions = [], settings = { dailyGoal: 2000 } } = useData() || {};
  const { t, lang } = useI18n();
  const dateLocale = lang === 'fr' ? fr : enUS;
  const prefersReducedMotion = usePrefersReducedMotion();

  const [showWhy, setShowWhy] = useState(false);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [showFeedbackBanner, setShowFeedbackBanner] = useState(false);
  const [lastLoggedFood, setLastLoggedFood] = useState<string | null>(null);

  const safeConsumptions = useMemo(
    () => (allConsumptions || []).filter(c => c && typeof c === 'object' && typeof c.timestamp === 'number'),
    [allConsumptions]
  );

  // Explicit Time Windows: Today & Last 7 Days
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = useMemo(
    () => safeConsumptions.filter(c => format(new Date(c.timestamp), 'yyyy-MM-dd') === todayStr),
    [safeConsumptions, todayStr]
  );

  const sevenDaysAgo = useMemo(() => {
    const d = subDays(new Date(), 6);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const weeklyLogs = useMemo(
    () => safeConsumptions.filter(c => c.timestamp >= sevenDaysAgo),
    [safeConsumptions, sevenDaysAgo]
  );

  // Check if a meal was logged in the last 10 seconds to show a subtle update banner
  useEffect(() => {
    if (todayLogs.length > 0) {
      const sorted = [...todayLogs].sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      if (Date.now() - latest.timestamp < 10000) {
        setLastLoggedFood(latest.name || (lang === 'fr' ? 'Repas' : 'Meal'));
        setShowFeedbackBanner(true);
        const timer = setTimeout(() => setShowFeedbackBanner(false), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [todayLogs.length, lang]);

  // Reset suggestion offset when logged meals change so primary suggestion adapts immediately
  useEffect(() => {
    setSuggestionOffset(0);
  }, [todayLogs.length]);

  const isPersonalized = hasMeaningfulPersonalization(settings?.profile);
  const dailyGoal =
    settings?.dailyGoal ||
    (isPersonalized && settings?.profile ? calculateDailyTarget(settings.profile) : 2000);
  const primaryGoal = settings?.profile?.primaryGoal || 'Eat Healthier';

  const translateGoal = (goal?: string) => {
    if (!goal) return '';
    if (goal === 'Lose Weight') return t('goal_lose_weight');
    if (goal === 'Gain Weight') return t('goal_gain_weight');
    if (goal === 'Build Muscle') return t('goal_build_muscle');
    if (goal === 'Maintain Weight') return t('goal_maintain_weight');
    if (goal === 'Eat Healthier') return t('goal_eat_healthier');
    return goal;
  };

  // Transparent classification of today's logged meals against the MboaFit catalogue
  const todayClassification = useMemo(
    () => RecommendationEngine.classifyLoggedMeals(todayLogs, commonFoods),
    [todayLogs]
  );

  // Totals for Today
  const totalCalories = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.calories) || 0), 0));
  const totalProtein = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.protein) || 0), 0));
  const totalCarbs = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0));
  const totalFat = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.fat) || 0), 0));
  const remainingCalories = Math.max(0, dailyGoal - totalCalories);
  const calorieProgressPct = Math.min(100, Math.round((totalCalories / Math.max(1, dailyGoal)) * 100));

  // Macro energy shares for clear visual bar
  const totalMacroGrams = Math.max(1, totalProtein + totalCarbs + totalFat);
  const proteinPct = todayLogs.length > 0 ? Math.round((totalProtein / totalMacroGrams) * 100) : 0;
  const carbsPct = todayLogs.length > 0 ? Math.round((totalCarbs / totalMacroGrams) * 100) : 0;
  const fatPct = todayLogs.length > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0;

  // Last 7 days chart data
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return {
        date: d,
        dateStr: format(d, 'yyyy-MM-dd'),
        label: format(d, 'EEE', { locale: dateLocale }),
        isToday: i === 6
      };
    });
  }, [dateLocale]);

  const calorieData = useMemo(() => {
    return last7Days.map(day => {
      const dayItems = safeConsumptions.filter(
        c => format(new Date(c.timestamp), 'yyyy-MM-dd') === day.dateStr
      );
      const cals = Math.round(dayItems.reduce((sum, item) => sum + (Number(item.calories) || 0), 0));
      return {
        name: day.label,
        calories: cals,
        mealCount: dayItems.length,
        target: dailyGoal,
        isToday: day.isToday
      };
    });
  }, [last7Days, safeConsumptions, dailyGoal]);

  const activeDays = useMemo(() => calorieData.filter(d => d.calories > 0), [calorieData]);
  const daysWithData = activeDays.length;
  const avgWeeklyCalories =
    daysWithData > 0
      ? Math.round(activeDays.reduce((sum, d) => sum + d.calories, 0) / daysWithData)
      : 0;

  // Contextual catalogue-backed recommendation (supports cycling through alternatives)
  const contextualRec = useMemo(
    () =>
      RecommendationEngine.getContextualRecommendation(
        settings?.profile,
        todayLogs,
        weeklyLogs,
        commonFoods,
        { optionOffset: suggestionOffset, dailyGoal }
      ),
    [settings?.profile, todayLogs, weeklyLogs, suggestionOffset, dailyGoal]
  );

  // Key Takeaway (Top focal summary grounded strictly in logged data)
  const keyTakeaway = useMemo(() => {
    if (todayLogs.length === 0) {
      return {
        headline: t('empty_insights_title'),
        detail: t('empty_insights_desc')
      };
    }

    const mealNames = todayLogs.map(m => m.name).filter(Boolean);
    const mealListPreview =
      mealNames.length <= 2
        ? mealNames.join(' & ')
        : `${mealNames.slice(0, 2).join(', ')} +${mealNames.length - 2}`;

    if (lang === 'fr') {
      if (todayClassification.unclassifiedCount > 0) {
        return {
          headline: `${totalCalories} kcal enregistrées sur ${todayLogs.length} ${todayLogs.length === 1 ? 'repas' : 'repas'}`,
          detail: `Vos entrées du jour (${mealListPreview}) apportent ${totalProtein}g de protéines, ${totalCarbs}g de glucides et ${totalFat}g de lipides. ${todayClassification.matchedCount}/${todayClassification.totalCount} élément(s) sont associés au catalogue.`
        };
      }
      if (todayClassification.vegetablePresenceState === 'PRESENT') {
        return {
          headline: `Bilan équilibré · ${totalCalories} kcal et ${totalProtein}g de protéines`,
          detail: `Vos repas enregistrés aujourd’hui (${mealListPreview}) incluent des légumes ou plats végétaux du catalogue et couvrent ${calorieProgressPct}% de votre repère quotidien.`
        };
      }
      return {
        headline: `${totalCalories} kcal enregistrées (${totalProtein}g de protéines)`,
        detail: `Basé sur ${todayLogs.length} ${todayLogs.length === 1 ? 'repas enregistré' : 'repas enregistrés'} aujourd’hui (${mealListPreview}), il vous reste environ ${remainingCalories} kcal par rapport à votre repère de ${dailyGoal} kcal.`
      };
    }

    if (todayClassification.unclassifiedCount > 0) {
      return {
        headline: `${totalCalories} kcal logged across ${todayLogs.length} ${todayLogs.length === 1 ? 'entry' : 'entries'}`,
        detail: `Today's logged food (${mealListPreview}) provides ${totalProtein}g protein, ${totalCarbs}g carbs, and ${totalFat}g fat. ${todayClassification.matchedCount} of ${todayClassification.totalCount} item(s) matched the catalogue.`
      };
    }

    if (todayClassification.vegetablePresenceState === 'PRESENT') {
      return {
        headline: `Balanced log · ${totalCalories} kcal & ${totalProtein}g protein`,
        detail: `Your logged meals today (${mealListPreview}) include catalogue-matched vegetables or plant dishes and represent ${calorieProgressPct}% of your ${dailyGoal} kcal reference.`
      };
    }

    return {
      headline: `${totalCalories} kcal logged (${totalProtein}g protein)`,
      detail: `Based on ${todayLogs.length} logged ${todayLogs.length === 1 ? 'meal' : 'meals'} today (${mealListPreview}), you have ${remainingCalories} kcal remaining toward your ${dailyGoal} kcal reference.`
    };
  }, [
    todayLogs,
    todayClassification,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    calorieProgressPct,
    remainingCalories,
    dailyGoal,
    lang,
    t
  ]);

  // Concise, non-judgmental Today's Breakdown observations (strictly evidence-grounded)
  const todayObservation = useMemo(() => {
    const {
      totalCount,
      matchedCount,
      unclassifiedCount,
      knownVegetableMealsCount,
      knownFriedMealsCount,
      vegetablePresenceState
    } = todayClassification;

    if (lang === 'fr') {
      if (unclassifiedCount > 0) {
        return {
          statusLabel: t('status_developing_pattern'),
          statusTone: 'amber' as const,
          observation: `${matchedCount} sur ${totalCount} plat(s) enregistré(s) aujourd’hui figurent dans le catalogue MboaFit. ${unclassifiedCount} entrée(s) sont personnalisées ou non classées.`,
          context: `MboaFit calcule vos calories (${totalCalories} kcal) et macros (${totalProtein}g P · ${totalCarbs}g G · ${totalFat}g L) à partir des valeurs saisies, sans deviner la liste des ingrédients ni supposer l’absence de légumes.`,
          tip: `Associez un plat au catalogue lors de la saisie si vous souhaitez un suivi détaillé par catégorie d’aliments.`
        };
      }
      if (knownVegetableMealsCount > 0) {
        return {
          statusLabel: t('status_looking_good'),
          statusTone: 'emerald' as const,
          observation: `${knownVegetableMealsCount} de vos ${totalCount} repas enregistrés aujourd’hui inclut des légumes, feuilles traditionnelles ou légumineuses reconnus dans le catalogue.`,
          context: `Les plats locaux riches en feuilles (comme le Ndolé, le Gombo ou les haricots) apportent des fibres et accompagnent bien votre apport de ${totalProtein}g de protéines.`,
          tip: `Continuez à enregistrer vos repas à votre rythme pour suivre votre équilibre sur la semaine.`
        };
      }
      if (knownFriedMealsCount > 0) {
        return {
          statusLabel: t('status_average'),
          statusTone: 'amber' as const,
          observation: `Vos entrées du jour incluent ${knownFriedMealsCount} préparation(s) frite(s) identifiée(s) dans le catalogue (${totalFat}g de lipides au total).`,
          context: `Les aliments frits sont plus denses en énergie. Si vous prenez un autre repas aujourd’hui, une cuisson grillée, bouillie ou à l’étouffée peut équilibrer la journée.`,
          tip: `Simple repère informatif basé sur le mode de préparation du catalogue.`
        };
      }
      if (vegetablePresenceState === 'INCOMPLETE_DATA') {
        return {
          statusLabel: t('status_developing_pattern'),
          statusTone: 'emerald' as const,
          observation: `${totalCount} seul repas enregistré jusqu’ici aujourd’hui (${totalCalories} kcal, ${totalProtein}g de protéines).`,
          context: `Un seul repas ne reflète pas toute votre journée. MboaFit n’émet aucune conclusion hâtive sur les légumes ou l’équilibre global à partir d’un journal partiel.`,
          tip: `Ajoutez vos prochains repas quand vous le souhaitez.`
        };
      }
      return {
        statusLabel: t('status_average'),
        statusTone: 'emerald' as const,
        observation: `Sur vos ${totalCount} repas du catalogue enregistrés aujourd’hui (${totalCalories} kcal), aucun plat de légumes ou sauce feuilles n’est encore noté.`,
        context: `Vos repas enregistrés fournissent déjà ${totalProtein}g de protéines et ${totalCarbs}g de glucides.`,
        tip: `Si cela vous tente, un accompagnement de légumes ou une sauce locale peut compléter votre journée.`
      };
    }

    // English
    if (unclassifiedCount > 0) {
      return {
        statusLabel: t('status_developing_pattern'),
        statusTone: 'amber' as const,
        observation: `${matchedCount} of ${totalCount} item(s) logged today matched the MboaFit catalogue, while ${unclassifiedCount} entry is custom or unclassified.`,
        context: `MboaFit summarizes your recorded macros (${totalCalories} kcal · ${totalProtein}g P · ${totalCarbs}g C · ${totalFat}g F) directly and does not infer missing vegetables or ingredients from unmatched entries.`,
        tip: `Match items to a catalogue dish when logging if you want category and preparation breakdowns.`
      };
    }

    if (knownVegetableMealsCount > 0) {
      return {
        statusLabel: t('status_looking_good'),
        statusTone: 'emerald' as const,
        observation: `${knownVegetableMealsCount} of your ${totalCount} logged meal(s) today includes catalogue-recognized vegetables, leafy greens, or legumes.`,
        context: `Traditional leafy dishes, vegetable sauces, and legumes add fiber alongside your ${totalProtein}g of logged protein today.`,
        tip: `Keep logging at your own pace to build your 7-day nutrition picture.`
      };
    }

    if (knownFriedMealsCount > 0) {
      return {
        statusLabel: t('status_average'),
        statusTone: 'amber' as const,
        observation: `Today's catalogue-matched logs include ${knownFriedMealsCount} fried item(s), contributing to ${totalFat}g total fat logged so far.`,
        context: `Fried dishes are naturally more energy-dense. Pairing them with a boiled, steamed, or grilled dish later is an easy way to balance your day.`,
        tip: `Based on documented preparation methods in the MboaFit catalogue.`
      };
    }

    if (vegetablePresenceState === 'INCOMPLETE_DATA') {
      return {
        statusLabel: t('status_developing_pattern'),
        statusTone: 'emerald' as const,
        observation: `${totalCount} meal logged so far today (${totalCalories} kcal, ${totalProtein}g protein).`,
        context: `A single logged meal is only a partial snapshot of your day, so MboaFit does not assume any ingredients or food groups are missing.`,
        tip: `Log additional meals whenever you're ready.`
      };
    }

    return {
      statusLabel: t('status_average'),
      statusTone: 'emerald' as const,
      observation: `Across your ${totalCount} catalogue-matched meals logged today (${totalCalories} kcal), no vegetable or leafy dish has been recorded yet.`,
      context: `Your logged meals already provide ${totalProtein}g protein and ${totalCarbs}g carbs toward your daily reference.`,
      tip: `If you'd like extra variety later, a traditional vegetable sauce or side is one optional addition.`
    };
  }, [todayClassification, totalCalories, totalProtein, totalCarbs, totalFat, lang, t]);

  // 7-Day Rhythm summary
  const weeklySummary = useMemo(() => {
    if (daysWithData < 3) {
      return {
        isPreliminary: true,
        statusLabel: t('status_developing_pattern'),
        headline: t('building_weekly_pattern'),
        detail: t('building_weekly_desc', { days: daysWithData })
      };
    }

    const diffFromGoal = Math.abs(avgWeeklyCalories - dailyGoal);
    if (lang === 'fr') {
      return {
        isPreliminary: false,
        statusLabel: diffFromGoal <= 300 ? t('status_positive_pattern') : t('status_average'),
        headline: `Moyenne de ${avgWeeklyCalories} kcal/jour sur ${daysWithData} jours enregistrés`,
        detail: `Sur les 7 derniers jours, vous avez enregistré ${weeklyLogs.length} repas sur ${daysWithData} jours (repère quotidien : ${dailyGoal} kcal).`
      };
    }

    return {
      isPreliminary: false,
      statusLabel: diffFromGoal <= 300 ? t('status_positive_pattern') : t('status_average'),
      headline: `Averaging ${avgWeeklyCalories} kcal/day across ${daysWithData} logged days`,
      detail: `Over the last 7 days, you recorded ${weeklyLogs.length} meals across ${daysWithData} active days compared with your ${dailyGoal} kcal daily reference.`
    };
  }, [daysWithData, avgWeeklyCalories, dailyGoal, weeklyLogs.length, lang, t]);

  const suggestedFood = contextualRec.food;
  const hasCatalogueNutrition =
    Boolean(suggestedFood) &&
    contextualRec.isCatalogueBacked &&
    Number.isFinite(suggestedFood.calories) &&
    suggestedFood.calories > 0 &&
    Boolean(suggestedFood.servingSizeText);

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.18 }
      };

  return (
    <div
      data-testid="insights-view"
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
      className="min-h-full bg-[#F7F9F5] text-slate-900 px-5 pt-6 pb-44 space-y-6 select-none"
    >
      {/* Top Header & Explicit Time-Window Metadata */}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#064E3B]">
              {t('insights_title')}
            </h1>
            <p className="text-sm text-slate-600 font-medium">
              {t('insights_subtitle')}
            </p>
          </div>
          {onLogFood && (
            <button
              type="button"
              onClick={() => onLogFood()}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-emerald-200/80 text-emerald-800 text-xs font-semibold hover:bg-emerald-50/70 transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0"
            >
              <Utensils className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('log_food_btn')}</span>
            </button>
          )}
        </div>

        {/* Clean Unboxed Time-Window & Coverage Metadata Line */}
        <div
          data-testid="insights-time-window-meta"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 pt-0.5 tabular-nums"
        >
          <span className="font-semibold text-emerald-900">
            {t('insights_time_window_today', {
              count: todayLogs.length,
              unit: todayLogs.length === 1 ? t('unit_meal') : t('unit_meals')
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t('insights_time_window_week', {
              days: daysWithData,
              meals: weeklyLogs.length,
              unit: weeklyLogs.length === 1 ? t('unit_meal') : t('unit_meals')
            })}
          </span>
          {todayLogs.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span data-testid="insights-catalogue-coverage">
                {t('insights_catalogue_coverage', {
                  matched: todayClassification.matchedCount,
                  total: todayClassification.totalCount
                })}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Live Meal Update Feedback Banner */}
      <AnimatePresence>
        {showFeedbackBanner && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-emerald-900 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-800 p-2 rounded-xl shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-200">
                  {t('meal_logged_badge', { name: lastLoggedFood || '' })}
                </p>
                <p className="text-sm font-medium text-white">
                  {t('insight_change_desc', { name: lastLoggedFood || '' })}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {todayLogs.length === 0 ? (
        /* Encouraging Empty State for Today */
        <motion.section
          {...motionProps}
          data-testid="insights-empty-today"
          className="bg-white rounded-3xl p-6 border border-emerald-100/90 shadow-2xs space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Utensils className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">
              {t('empty_insights_title')}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('empty_insights_desc')}
            </p>
          </div>
          {onLogFood && (
            <button
              type="button"
              onClick={() => onLogFood()}
              className="min-h-[44px] px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 shadow-2xs"
            >
              <span>{t('log_food_btn')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </motion.section>
      ) : (
        <>
          {/* SECTION 1: Most Useful Insight First — Key Takeaway & Calorie/Macro Balance Hero */}
          <motion.section
            {...motionProps}
            data-testid="insights-hero-takeaway"
            className="bg-[#064E3B] text-white rounded-3xl p-6 shadow-sm space-y-5 relative overflow-hidden"
          >
            <div className="space-y-2 relative z-10">
              <div className="flex items-center justify-between gap-2 text-xs text-emerald-200/90 font-medium">
                <span>{t('daily_focus')}</span>
                <span className="tabular-nums">
                  {isPersonalized ? t('personalized_target_full') : t('general_ref_target_full')}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white leading-snug">
                {keyTakeaway.headline}
              </h2>
              <p className="text-sm text-emerald-100/90 leading-relaxed">
                {keyTakeaway.detail}
              </p>
            </div>

            {/* Calorie Progress Bar */}
            <div className="bg-emerald-950/55 rounded-2xl p-4 space-y-3 border border-emerald-800/60">
              <div className="flex items-baseline justify-between gap-2 tabular-nums">
                <div>
                  <span className="text-2xl font-bold text-white">{totalCalories}</span>
                  <span className="text-xs text-emerald-200/80 ml-1.5">
                    / {dailyGoal} kcal {isPersonalized ? t('target') : t('general_ref_target')}
                  </span>
                </div>
                <span className="text-xs font-semibold text-emerald-300">
                  {remainingCalories} {t('kcal_remaining')}
                </span>
              </div>
              <div
                className="w-full bg-emerald-900/80 h-2.5 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={totalCalories}
                aria-valuemin={0}
                aria-valuemax={dailyGoal}
                aria-label={
                  isPersonalized
                    ? t('aria_personalized_calorie_goal', { goal: dailyGoal })
                    : t('aria_reference_calorie_goal', { goal: dailyGoal })
                }
              >
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${calorieProgressPct}%` }}
                />
              </div>

              {/* Complementary Macro Breakdown Strip (Amber Protein, Emerald Carbs, Sky Fat) */}
              <div className="grid grid-cols-3 gap-2.5 pt-1 tabular-nums">
                <div className="bg-emerald-900/45 rounded-xl p-2.5 border border-emerald-800/50">
                  <div className="flex items-center justify-between text-[11px] text-emerald-100/80">
                    <span>{t('protein')}</span>
                    <span>{proteinPct}%</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-0.5">{totalProtein}g</p>
                  <div className="w-full bg-emerald-950 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full" style={{ width: `${proteinPct}%` }} />
                  </div>
                </div>

                <div className="bg-emerald-900/45 rounded-xl p-2.5 border border-emerald-800/50">
                  <div className="flex items-center justify-between text-[11px] text-emerald-100/80">
                    <span>{t('carbs')}</span>
                    <span>{carbsPct}%</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-0.5">{totalCarbs}g</p>
                  <div className="w-full bg-emerald-950 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-emerald-300 h-full rounded-full" style={{ width: `${carbsPct}%` }} />
                  </div>
                </div>

                <div className="bg-emerald-900/45 rounded-xl p-2.5 border border-emerald-800/50">
                  <div className="flex items-center justify-between text-[11px] text-emerald-100/80">
                    <span>{t('fat')}</span>
                    <span>{fatPct}%</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-0.5">{totalFat}g</p>
                  <div className="w-full bg-emerald-950 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div className="bg-sky-300 h-full rounded-full" style={{ width: `${fatPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* SECTION 2: Explicit Incomplete Data Disclosure & Today's Logged Breakdown */}
          {(todayClassification.unclassifiedCount > 0 || todayLogs.length < 2) && (
            <motion.section
              {...motionProps}
              data-testid="incomplete-data-banner"
              className="bg-[#FFFBEB] border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="p-2 rounded-xl bg-amber-100/80 text-amber-800 shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs leading-relaxed">
                <h3 className="font-bold text-amber-950">
                  {t('insights_incomplete_data_title')}
                </h3>
                <p className="text-amber-900/90">
                  {todayClassification.unclassifiedCount > 0
                    ? t('insights_incomplete_data_desc', {
                        unclassified: todayClassification.unclassifiedCount
                      })
                    : t('insights_partial_day_desc', { count: todayLogs.length })}
                </p>
              </div>
            </motion.section>
          )}

          <motion.section
            {...motionProps}
            data-testid="insights-food-pattern-card"
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {t('your_food_pattern')}
                </h3>
              </div>
              <span
                className={`text-xs font-semibold ${
                  todayObservation.statusTone === 'emerald'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
                }`}
              >
                {todayObservation.statusLabel}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-800 leading-relaxed">
              {todayObservation.observation}
            </p>

            <div className="bg-[#F7F9F5] rounded-2xl p-3.5 space-y-2 text-xs text-slate-600 leading-relaxed border border-emerald-100/60">
              <p>
                <strong className="text-slate-800">{t('why_it_matters')}</strong>{' '}
                {todayObservation.context}
              </p>
              <p>
                <strong className="text-emerald-800">{t('focus_label')}</strong>{' '}
                {todayObservation.tip}
              </p>
            </div>
          </motion.section>
        </>
      )}

      {/* SECTION 3: Optional, Non-Judgmental, Catalogue-Backed Meal Idea */}
      {suggestedFood && (
        <motion.section
          {...motionProps}
          data-testid="insights-suggestion-card"
          className="bg-white rounded-3xl p-5 border border-emerald-200/70 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {t('your_next_meal')}
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {t('insights_optional_badge')}
            </span>
          </div>

          <div className="bg-[#F4F8F5] rounded-2xl p-4 border border-emerald-100 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h4
                  data-testid="suggested-meal-name"
                  className="text-lg font-bold text-[#064E3B] leading-snug"
                >
                  {suggestedFood.name}
                </h4>
                {hasCatalogueNutrition && (
                  <p
                    data-testid="suggested-meal-serving-basis"
                    className="text-xs text-emerald-800 font-medium"
                  >
                    {t('insights_catalogue_estimate_badge', {
                      serving: contextualRec.servingBasis
                    })}
                  </p>
                )}
              </div>
              {contextualRec.alternatives.length > 0 && (
                <button
                  type="button"
                  data-testid="cycle-suggestion-btn"
                  onClick={() => setSuggestionOffset(prev => prev + 1)}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('see_alternatives')}</span>
                </button>
              )}
            </div>

            {/* Why this suggestion is offered */}
            <p
              data-testid="suggested-meal-reason"
              className="text-sm text-slate-700 leading-relaxed"
            >
              {contextualRec.reason}
            </p>

            {/* Catalogue-Backed Estimated Nutrition Row */}
            {hasCatalogueNutrition && (
              <div
                data-testid="suggested-meal-nutrition"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-slate-700 font-medium tabular-nums border-t border-emerald-200/60"
              >
                <span className="font-bold text-[#064E3B]">
                  ~{suggestedFood.calories} kcal
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('protein')} ~{suggestedFood.protein}g
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('carbs')} ~{suggestedFood.carbs}g
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('fat')} ~{suggestedFood.fat}g
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {onLogFood && (
                <button
                  type="button"
                  onClick={() => onLogFood(suggestedFood)}
                  className="min-h-[44px] px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                >
                  <span>{t('try_this')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowWhy(prev => !prev)}
                className="min-h-[44px] px-3 py-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>{t('why_this_recommendation')}</span>
                {showWhy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showWhy && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-[#F7F9F5] rounded-2xl p-4 border border-slate-200/70 space-y-2.5 text-xs text-slate-600 leading-relaxed">
                  <p>
                    <strong className="text-slate-800">{t('your_goal')}:</strong>{' '}
                    {settings?.profile?.primaryGoal
                      ? t('supports_goal_desc', {
                          goal: translateGoal(primaryGoal).toLowerCase()
                        })
                      : t('no_goal_selected')}
                  </p>
                  <p>
                    <strong className="text-slate-800">{t('confidence')}:</strong>{' '}
                    {todayClassification.totalCount > 0 && todayClassification.unclassifiedCount === 0
                      ? t('confidence_high')
                      : todayClassification.totalCount > 0
                      ? t('confidence_moderate', {
                          matched: todayClassification.matchedCount,
                          total: todayClassification.totalCount
                        })
                      : t('confidence_limited')}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      )}

      {/* SECTION 4: Last 7 Days at a Glance & 7-Day Rhythm */}
      <motion.section
        {...motionProps}
        data-testid="insights-weekly-section"
        className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">
                {t('week_at_glance')}
              </h3>
            </div>
            <p className="text-xs font-semibold text-emerald-900">
              {weeklySummary.headline}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
            {daysWithData}/7
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {weeklySummary.detail}
        </p>

        {/* 7-Day Bar Chart */}
        <div className="h-44 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={calorieData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
                dy={8}
              />
              <Tooltip
                cursor={{ fill: '#F1F5F9', radius: 8 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white text-xs py-2 px-3 rounded-xl shadow-lg tabular-nums">
                        <p className="font-bold mb-0.5">{data.name}</p>
                        {data.calories > 0 ? (
                          <p>
                            {data.calories} kcal{' '}
                            <span className="text-slate-300">
                              ({Math.round((data.calories / Math.max(1, data.target)) * 100)}%)
                            </span>
                          </p>
                        ) : (
                          <p className="text-slate-300">{t('no_data_logged')}</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={dailyGoal} stroke="#CBD5E1" strokeDasharray="3 3" strokeWidth={1.5} />
              <Bar dataKey="calories" radius={[6, 6, 6, 6]} maxBarSize={28} minPointSize={4}>
                {calorieData.map((entry, index) => {
                  let fill = '#10B981';
                  if (entry.calories === 0) {
                    fill = '#E2E8F0';
                  } else if (entry.calories > entry.target * 1.15) {
                    fill = '#F59E0B';
                  } else if (entry.isToday) {
                    fill = '#059669';
                  }
                  return <Cell key={`cell-${index}`} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend with Clean Unboxed Typography */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>{t('chart_logged')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-300 inline-block" />
            <span>
              {t('chart_target')} ({dailyGoal} kcal)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 inline-block" />
            <span>{t('chart_no_data')}</span>
          </div>
        </div>
      </motion.section>

      {/* Bottom Clearance Spacer so Fixed Bottom Nav (80px) & Floating Camera Button never overlap content */}
      <div data-testid="insights-bottom-clearance" className="h-24 w-full shrink-0" aria-hidden="true" />
    </div>
  );
}
