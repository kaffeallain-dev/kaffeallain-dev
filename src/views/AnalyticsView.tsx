import React, { useMemo, useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, Info, Zap, CheckCircle2, Clock, AlertTriangle, Utensils, Star } from 'lucide-react';
import { RecommendationEngine } from '../lib/RecommendationEngine';
import { motion, AnimatePresence } from 'motion/react';
import { commonFoods } from '../data/foodDatabase';
import { useI18n } from '../lib/i18n';
import { isProfileSufficientForTarget } from '../lib/personalization';

function getLocaleDayName(date: Date, lang: string): string {
  try {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const formatted = formatter.format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1).replace('.', '');
  } catch {
    return format(date, 'EEE');
  }
}

function getLocaleDateStr(date: Date, lang: string): string {
  try {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date);
  } catch {
    return format(date, 'MM/dd');
  }
}

function formatUpdateTime(date: Date, lang: string): string {
  try {
    const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return format(date, 'h:mm a');
  }
}

export default function AnalyticsView({ onLogFood }: { onLogFood: (food?: any) => void }) {
  const { allConsumptions, settings } = useData();
  const { t, lang } = useI18n();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showWhyRecommendation, setShowWhyRecommendation] = useState(false);

  const isProfileSufficient = isProfileSufficientForTarget(settings.profile);

  const { 
    todayLogs,
    weeklyLogs,
    weeklyDataArr, 
    currentSummary, 
    previousSummary, 
    recentLog,
    isMeaningfulChange,
    lastLog,
    caloriesConsumed,
    remaining,
    daysWithData
  } = useMemo(() => {
    const now = new Date();
    const tStart = startOfDay(now).getTime();
    const tEnd = endOfDay(now).getTime();
    
    const todayLogs = allConsumptions.filter(c => c && c.timestamp >= tStart && c.timestamp <= tEnd);
    const weeklyLogs = allConsumptions.filter(c => c && c.timestamp >= startOfDay(subDays(now, 6)).getTime() && c.timestamp <= tEnd);
    
    const weeklyDataArr = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      const dayConsumptions = allConsumptions.filter(c => c && c.timestamp >= start && c.timestamp <= end);
      const hasData = dayConsumptions.length > 0;
      const dayCals = Math.round(dayConsumptions.reduce((acc, c) => acc + (c.calories || 0), 0));
      weeklyDataArr.push({
        name: getLocaleDayName(date, lang),
        calories: hasData ? dayCals : null,
        hasData,
        date: getLocaleDateStr(date, lang)
      });
    }

    const sortedLogs = [...todayLogs].sort((a, b) => b.timestamp - a.timestamp);
    const lastLog = sortedLogs[0];
    
    const recentLog = lastLog && (Date.now() - lastLog.timestamp < 30000);
    
    const currentSummary = RecommendationEngine.generate(settings.profile, todayLogs, weeklyLogs, settings.dailyGoal);
    let previousSummary = null;
    let isMeaningfulChange = false;
    
    if (recentLog) {
       const prevLogs = sortedLogs.slice(1);
       previousSummary = RecommendationEngine.generate(settings.profile, prevLogs, weeklyLogs, settings.dailyGoal);
       
       isMeaningfulChange = 
          previousSummary.nextAction.title !== currentSummary.nextAction.title ||
          previousSummary.nextAction.description !== currentSummary.nextAction.description ||
          previousSummary.biggestWin.title !== currentSummary.biggestWin.title ||
          previousSummary.goalStatus.status !== currentSummary.goalStatus.status;
    }
    
    const caloriesConsumed = todayLogs.reduce((acc, c) => acc + (c.calories || 0), 0);
    const remaining = Math.max(0, Math.round(settings.dailyGoal - caloriesConsumed));
    const daysWithData = weeklyDataArr.filter(d => d.hasData).length;

    return { 
      todayLogs, 
      weeklyLogs,
      weeklyDataArr, 
      currentSummary, 
      previousSummary, 
      recentLog,
      isMeaningfulChange, 
      lastLog,
      caloriesConsumed,
      remaining,
      daysWithData
    };
  }, [allConsumptions, settings, lang]);

  useEffect(() => {
    if (recentLog) {
       setIsUpdating(true);
       const timer = setTimeout(() => setIsUpdating(false), 2500);
       return () => clearTimeout(timer);
    }
  }, [recentLog, lastLog?.id]);

  // Determine nutrition gap
  const getNutritionGap = () => {
     if (currentSummary.weeklyPattern.vegetableTrend === 'Needs Improvement') return 'Vegetables (Fiber & Vitamins)';
     if (currentSummary.weeklyPattern.proteinTrend === 'Average' && settings.profile?.primaryGoal === 'Build Muscle') return 'Protein';
     if (currentSummary.weeklyPattern.sugaryDrinkTrend === 'High') return 'Water (Hydration)';
     return 'Healthy Fats & Minerals';
  };
  const gap = getNutritionGap();

  // Determine next best meal
  const recommendation = RecommendationEngine.getContextualRecommendation(
    settings.profile,
    todayLogs,
    weeklyLogs,
    commonFoods
  );
  const nextMeal = recommendation.food;
  const nextMealAnalysis = nextMeal ? RecommendationEngine.analyzeFood(nextMeal) : null;
  const contextualReason = recommendation.reason;

  const formatGoal = (g?: string) => {
    if (!g) return t('no_goal_set');
    if (g === 'Lose Weight') return t('goal_lose_weight');
    if (g === 'Build Muscle') return t('goal_build_muscle');
    if (g === 'Gain Weight') return t('goal_gain_weight');
    if (g === 'Maintain Weight') return t('goal_maintain_weight');
    return t('goal_eat_healthier');
  };

  const getDailyStatus = () => {
    if (todayLogs.length === 0) {
      return {
        title: lang === 'fr' ? "Votre journée prend forme" : "Your day is still taking shape",
        message: lang === 'fr' ? "Aucun repas n'a encore été enregistré aujourd'hui." : "Your food pattern for today hasn't started yet.",
        colorClass: "bg-gray-50 border-gray-100 text-gray-600"
      };
    }
    if (todayLogs.length === 1) {
      return {
        title: lang === 'fr' ? "Votre journée prend forme" : "Your day is still taking shape",
        message: lang === 'fr' ? "Vous avez noté un repas. Le prochain affinera vos analyses." : "You've logged one meal. Another meal will provide a clearer picture.",
        colorClass: "bg-gray-50 border-gray-100 text-gray-600"
      };
    }
    
    const protein = todayLogs.reduce((sum, m) => sum + (m.protein || 0), 0);
    const sugary = todayLogs.filter(m => (m.name || '').toLowerCase().includes('coke') || (m.name || '').toLowerCase().includes('soda') || (m.name || '').toLowerCase().includes('juice'));
    const vegMeals = todayLogs.filter(m => (m.name || '').toLowerCase().includes('eru') || (m.name || '').toLowerCase().includes('ndolé') || (m.name || '').toLowerCase().includes('salad') || (m.name || '').toLowerCase().includes('veg'));
    const goal = settings.profile?.primaryGoal || 'Eat Healthier';
    
    if (sugary.length > 0 || (vegMeals.length === 0 && todayLogs.length > 2)) {
      return {
        title: lang === 'fr' ? "Un point à améliorer aujourd'hui" : "One thing could improve today",
        message: lang === 'fr' ? "Un léger ajustement peut équilibrer votre journée." : "A small adjustment could help balance your nutrition.",
        colorClass: "bg-amber-50 border-amber-100 text-amber-800"
      };
    }
    if (goal === 'Lose Weight' && remaining >= 0) {
      return {
        title: lang === 'fr' ? "Vous êtes sur la bonne voie" : "You're doing well today",
        message: lang === 'fr' ? "Vous respectez votre objectif calorique jusqu'à présent." : "You are within your calorie target so far.",
        colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
      };
    }
    if (goal === 'Build Muscle' && protein > 20) {
      return {
        title: lang === 'fr' ? "Excellent démarrage aujourd'hui" : "You're making a solid start today",
        message: lang === 'fr' ? "Vos repas apportent de bonnes sources de protéines." : "Your logged meals are supporting your protein goals.",
        colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
      };
    }
    return {
      title: lang === 'fr' ? "Votre journée semble équilibrée" : "Your day looks balanced so far",
      message: lang === 'fr' ? "Vos repas enregistrés montrent une belle variété aujourd'hui." : "Your logged meals are reasonably varied today.",
      colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
    };
  };

  const getFoodPattern = () => {
    if (todayLogs.length === 0) return null;

    const sugary = todayLogs.filter(m => (m.name || '').toLowerCase().includes('coke') || (m.name || '').toLowerCase().includes('soda') || (m.name || '').toLowerCase().includes('juice'));
    const vegMeals = todayLogs.filter(m => (m.name || '').toLowerCase().includes('eru') || (m.name || '').toLowerCase().includes('ndolé') || (m.name || '').toLowerCase().includes('salad') || (m.name || '').toLowerCase().includes('veg'));
    const fried = todayLogs.filter(m => (m.name || '').toLowerCase().includes('fried') || (m.name || '').toLowerCase().includes('puff'));
    const highProtein = todayLogs.filter(m => (m.protein || 0) > 15);
    
    if (vegMeals.length === 0 && todayLogs.length >= 1) {
       return {
         status: t('status_needs_attention'),
         observation: lang === 'fr' ? "Les légumes n'apparaissent pas encore dans vos repas du jour." : "Vegetables haven't appeared in the meals you've logged today.",
         whyItMatters: lang === 'fr' ? "Les légumes apportent des fibres et des vitamines indispensables." : "Vegetables can add fiber and important vitamins and minerals to your meals.",
         whatNext: lang === 'fr' ? "Ajouter un accompagnement de légumes au prochain repas améliorera la variété." : "Adding one vegetable-rich side to your next meal could improve variety.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (sugary.length > 0) {
       return {
         status: t('status_needs_attention'),
         observation: lang === 'fr' ? `Vous avez noté ${sugary.length} boisson(s) sucrée(s) aujourd'hui.` : `You've logged ${sugary.length} sugary drink${sugary.length > 1 ? 's' : ''} today.`,
         whyItMatters: lang === 'fr' ? "Les boissons sucrées provoquent des baisses d'énergie sans caler la faim." : "Sugary drinks can cause energy crashes and add hidden calories without making you full.",
         whatNext: lang === 'fr' ? "Privilégiez de l'eau avec votre prochain repas." : "Consider having water with your next meal instead.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (fried.length > 1) {
       return {
         status: t('status_needs_attention'),
         observation: lang === 'fr' ? "Vous avez pris plusieurs aliments frits aujourd'hui." : "You've had multiple fried foods today.",
         whyItMatters: lang === 'fr' ? "Les fritures sont denses en calories et peuvent alourdir la digestion." : "Fried foods are calorie-dense and can make you feel sluggish.",
         whatNext: lang === 'fr' ? "Optez pour une option bouillie ou grillée au prochain repas." : "Opt for a boiled or grilled option for your next meal.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (highProtein.length >= 1) {
       return {
         status: t('status_positive_pattern'),
         observation: lang === 'fr' ? "Vos repas comportent d'excellentes sources de protéines." : "Your logged meals have included strong protein sources.",
         whyItMatters: lang === 'fr' ? "Les protéines prolongent la satiété et favorisent la récupération." : "Protein helps with satiety and supports muscle recovery.",
         whatNext: lang === 'fr' ? "Poursuivez sur cette bonne lancée pour le reste de la journée." : "Keep up the balanced choices for the rest of the day.",
         icon: Star,
         colorClass: "text-emerald-600 bg-emerald-50 border-emerald-100"
       };
    }
    
    return {
       status: t('status_developing_pattern'),
       observation: lang === 'fr' ? "Vos repas montrent un mélange varié d'aliments." : "Your meals show a mix of different foods today.",
       whyItMatters: lang === 'fr' ? "Une alimentation variée garantit un large éventail de nutriments." : "A varied diet is key to getting a wide range of nutrients.",
       whatNext: lang === 'fr' ? "Continuez à noter pour affiner le suivi de votre journée." : "Keep logging to maintain a clear picture of your day.",
       icon: Info,
       colorClass: "text-blue-600 bg-blue-50 border-blue-100"
    };
  };

  const dailyStatus = getDailyStatus();
  const foodPattern = getFoodPattern();

  const getWeeklyTrends = () => {
    if (daysWithData < 3) {
      return { hasEnoughData: false };
    }
    
    let vegMeals = 0;
    let highProteinMeals = 0;
    let sugaryDrinks = 0;
    let friedFoods = 0;
    
    weeklyLogs.forEach(c => {
      const name = (c.name || '').toLowerCase();
      if (name.includes('salad') || name.includes('eru') || name.includes('vegetable')) vegMeals++;
      if ((c.protein || 0) > 20) highProteinMeals++;
      if (name.includes('coke') || name.includes('soda') || name.includes('juice')) sugaryDrinks++;
      if (name.includes('fried') || name.includes('puff')) friedFoods++;
    });

    const totalMeals = weeklyLogs.length;
    const trends = [];
    
    // Vegetables
    if (currentSummary.weeklyPattern.vegetableTrend === 'Needs Improvement') {
      trends.push({
        id: 'veg-bad',
        title: lang === 'fr' ? 'Légumes' : 'Vegetables',
        status: t('status_needs_attention'),
        observation: lang === 'fr' ? `Les légumes étaient présents dans ${vegMeals} de vos ${totalMeals} repas notés cette semaine.` : `Vegetables appeared in ${vegMeals} of your ${totalMeals} logged meals this week.`,
        nextStep: lang === 'fr' ? 'Essayez d’ajouter une portion de légumes à un repas supplémentaire.' : 'Try adding a vegetable-rich side to one more meal this week.',
        priority: 1,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'veg-good',
        title: lang === 'fr' ? 'Légumes' : 'Vegetables',
        status: t('status_looking_good'),
        observation: lang === 'fr' ? `Les légumes étaient présents dans ${vegMeals} de vos ${totalMeals} repas notés cette semaine.` : `Vegetables appeared in ${vegMeals} of your ${totalMeals} logged meals this week.`,
        priority: 3,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Protein
    if (currentSummary.weeklyPattern.proteinTrend === 'Strong') {
      trends.push({
        id: 'protein-good',
        title: lang === 'fr' ? 'Protéines' : 'Protein',
        status: t('status_looking_good'),
        observation: lang === 'fr' ? `De bonnes sources de protéines étaient présentes dans ${highProteinMeals} de vos ${totalMeals} repas.` : `Strong protein sources appeared in ${highProteinMeals} of your ${totalMeals} logged meals.`,
        nextStep: lang === 'fr' ? 'Conservez ce bon apport pour maintenir votre satiété.' : 'Keep including strong protein sources to support satiety.',
        priority: 1,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    } else {
      trends.push({
        id: 'protein-avg',
        title: lang === 'fr' ? 'Protéines' : 'Protein',
        status: t('status_average'),
        observation: lang === 'fr' ? `L’apport en protéines a été modéré sur l’ensemble de vos ${totalMeals} repas notés.` : `Protein intake has been moderate across your ${totalMeals} logged meals.`,
        priority: 4,
        colorClass: 'text-gray-700 bg-gray-50 border-gray-200'
      });
    }
    
    // Sugary Drinks
    if (currentSummary.weeklyPattern.sugaryDrinkTrend === 'High') {
      trends.push({
        id: 'sugar-high',
        title: lang === 'fr' ? 'Boissons sucrées' : 'Sugary Drinks',
        status: t('status_needs_attention'),
        observation: lang === 'fr' ? `Les boissons sucrées sont apparues dans ${sugaryDrinks} de vos ${totalMeals} repas récents.` : `Sugary drinks appeared in ${sugaryDrinks} of your ${totalMeals} recent logs.`,
        nextStep: lang === 'fr' ? 'Remplacez une boisson sucrée par de l’eau demain.' : 'Consider substituting water or a sugar-free alternative for one drink tomorrow.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'sugar-low',
        title: lang === 'fr' ? 'Boissons sucrées' : 'Sugary Drinks',
        status: t('status_looking_good'),
        observation: lang === 'fr' ? `Les boissons sucrées ont été minimes sur vos ${totalMeals} repas notés.` : `Sugary drinks were minimal across your ${totalMeals} logged meals.`,
        priority: 5,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Fried Foods
    if (currentSummary.weeklyPattern.friedFoodTrend === 'High') {
      trends.push({
        id: 'fried-high',
        title: lang === 'fr' ? 'Aliments frits' : 'Fried Foods',
        status: t('status_needs_attention'),
        observation: lang === 'fr' ? `Les aliments frits sont apparus dans ${friedFoods} de vos ${totalMeals} repas récents.` : `Fried foods appeared in ${friedFoods} of your ${totalMeals} recent logs.`,
        nextStep: lang === 'fr' ? 'Optez pour du grillé ou bouilli sur au moins un repas.' : 'If reducing fried foods is part of your goal, try a grilled or boiled option for one meal.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'fried-low',
        title: lang === 'fr' ? 'Aliments frits' : 'Fried Foods',
        status: t('status_looking_good'),
        observation: lang === 'fr' ? `Les aliments frits ont été minimes sur vos ${totalMeals} repas notés.` : `Fried foods were minimal across your ${totalMeals} logged meals.`,
        priority: 6,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    trends.sort((a, b) => a.priority - b.priority);
    return {
      hasEnoughData: true,
      primary: trends[0],
      secondary: trends.slice(1, 4)
    };
  };

  const getChartInterpretation = () => {
    if (daysWithData === 0) {
      return {
        interpretation: lang === 'fr' ? "Notez quelques repas pour voir l'évolution sur 7 jours." : "Log a few meals to see your 7-day calorie pattern.",
        fact: null
      };
    }
    if (daysWithData < 3) {
      return {
        interpretation: lang === 'fr' ? "Peu de jours enregistrés : votre tendance hebdomadaire commence à se dessiner." : "We only have a few logged days, so this week's calorie pattern is still taking shape.",
        fact: null
      };
    }
    
    const validDays = weeklyDataArr.filter(d => d.hasData);
    const dataPoints = validDays.map(d => d.calories || 0);
    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const avg = dataPoints.reduce((a, b) => a + b, 0) / (dataPoints.length || 1);
    
    let interpretation = "";
    const variation = avg > 0 ? (max - min) / avg : 0;
    if (variation > 0.5) {
      interpretation = lang === 'fr' ? "Vos apports caloriques ont pas mal fluctué cette semaine." : "Your logged intake has varied quite a bit this week.";
    } else {
      interpretation = lang === 'fr' ? "Vos apports caloriques sont restés réguliers cette semaine." : "Your logged intake has stayed fairly consistent this week.";
    }
    
    let fact = null;
    const daysNearTarget = validDays.filter(d => Math.abs((d.calories || 0) - settings.dailyGoal) < 300).length;
    
    if (daysNearTarget >= 3) {
      fact = lang === 'fr' 
        ? `${daysNearTarget} sur ${daysWithData} jours notés étaient proches de votre cible.` 
        : `${daysNearTarget} of ${daysWithData} logged days were close to your target.`;
    } else if (validDays.length > 0) {
      const highestDay = validDays.reduce((prev, current) => ((prev.calories || 0) > (current.calories || 0)) ? prev : current);
      fact = lang === 'fr'
        ? `Journée la plus haute : ${highestDay.name} · ${highestDay.calories} kcal`
        : `Highest logged day: ${highestDay.name} · ${highestDay.calories} kcal`;
    }
    
    return { interpretation, fact };
  };

  const weeklyTrends = getWeeklyTrends();
  const chartInterpretation = getChartInterpretation();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (!data.hasData) {
        return (
          <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl border border-gray-800">
            <p className="font-bold text-sm mb-1">{data.name} ({data.date})</p>
            <p className="text-gray-400 text-xs">{t('no_data_logged')}</p>
          </div>
        );
      }
      return (
        <div className="bg-gray-900 text-white p-3 rounded-xl shadow-xl border border-gray-800">
          <p className="font-bold text-sm mb-1">{data.name} ({data.date})</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            <p className="text-gray-200 text-sm">{data.calories} kcal</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const lastUpdate = lastLog ? new Date(lastLog.timestamp) : new Date();

  const chartMax = Math.floor(Math.max(
    settings.dailyGoal,
    ...weeklyDataArr.map(d => d.calories || 0)
  ) * 1.15);

  return (
    <div className="max-w-md mx-auto w-full p-6 pb-40 space-y-6">
      <header className="mb-2 mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('insights_title')}</h1>
          <p className="text-gray-500 font-medium">{t('insights_subtitle')}</p>
        </div>
        
        <AnimatePresence mode="popLayout">
          {isUpdating ? (
            <motion.div 
              key="updating"
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-500 px-3 py-1.5 rounded-full shadow-sm shadow-emerald-200"
            >
              <Zap size={14} className="animate-pulse" />
              <span>{t('analyzing')}</span>
            </motion.div>
          ) : (
            todayLogs.length > 0 && (
              <motion.div 
                key="updated"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"
              >
                <Clock size={14} />
                <span>{t('updated_at', { time: formatUpdateTime(lastUpdate, lang) })}</span>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </header>

      {/* What Changed Banner */}
      <AnimatePresence>
        {recentLog && isMeaningfulChange && previousSummary && lastLog && (
          <motion.div 
            initial={{ opacity: 0, height: 0, scale: 0.95 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.95 }}
            className="bg-blue-900 rounded-3xl p-5 shadow-lg shadow-blue-900/20 text-white mb-6 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-emerald-500 rounded-full p-1"><CheckCircle2 className="w-4 h-4 text-white" /></div>
              <h3 className="font-bold text-sm">{t('insight_updated')}</h3>
            </div>
            <p className="text-blue-200 text-xs mb-4">{t('insight_change_desc', { name: lastLog.name })}</p>
            
            <div className="space-y-3">
              {previousSummary.nextAction.title !== currentSummary.nextAction.title && (
                <div className="bg-blue-800/50 rounded-xl p-3">
                    <span className="text-xs text-blue-300 block mb-1">{t('new_focus')}</span>
                    <span className="font-bold text-sm block">{currentSummary.nextAction.title}</span>
                    <span className="text-xs text-blue-100 block mt-0.5">{currentSummary.nextAction.description}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {recentLog && !isMeaningfulChange && lastLog && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between mb-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-emerald-800">{t('meal_logged_badge', { name: lastLog.name })}</span>
            </div>
            <span className="text-xs text-emerald-600 font-medium">{t('nutrition_updated_badge')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {todayLogs.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center mt-6">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Utensils className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('empty_insights_title')}</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {t('empty_insights_desc')}
          </p>
          <button 
            type="button"
            onClick={() => onLogFood()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            {t('log_food_btn')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
        {/* Today's Focus */}
        <motion.div 
          animate={isUpdating ? { y: [-2, 2, 0] } : {}}
          className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden mb-2"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100/50">
                <Zap className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">{t('daily_focus')}</h3>
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight tracking-tight mb-2">
              {currentSummary.nextAction.title}
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentSummary.nextAction.description}
            </p>
          </div>
        </motion.div>

        {/* Next Best Meal Recommendation */}
        {nextMeal && nextMealAnalysis && (
          <div className="bg-white border border-gray-100 p-6 rounded-3xl mt-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-500" />
                {t('your_next_meal')}
              </h3>
            </div>
            
            <div className="mb-4">
              <h4 className="font-bold text-gray-900 text-2xl tracking-tight mb-1">{nextMeal.name}</h4>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3 font-medium">
                <span>{nextMeal.servingSizeText}</span>
                <span>•</span>
                <span>~{nextMeal.calories} kcal</span>
              </div>
              
              <p className="text-sm text-gray-700 leading-relaxed mb-5">
                {contextualReason}
              </p>
              
              <div className="flex items-center gap-3 mb-2">
                <button 
                  type="button"
                  onClick={() => onLogFood(nextMeal)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-sm text-center shadow-sm"
                >
                  {t('try_this')}
                </button>
                <button 
                  type="button"
                  onClick={() => onLogFood()}
                  className="px-5 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-colors text-sm border border-gray-100"
                >
                  {t('see_alternatives')}
                </button>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-50 mt-5">
              <button 
                type="button"
                onClick={() => setShowWhyRecommendation(!showWhyRecommendation)}
                className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between w-full hover:text-gray-600 transition-colors py-2"
              >
                {t('why_this_recommendation')}
                <svg className={`w-4 h-4 transition-transform ${showWhyRecommendation ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <AnimatePresence>
                {showWhyRecommendation && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4 text-sm text-gray-600">
                      <div className="bg-blue-50/50 -mx-2 px-2 py-2 rounded-lg border border-blue-100/50">
                        <span className="font-bold text-blue-900 block mb-0.5 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" />
                          {t('contextual_fit')}
                        </span>
                        <span className="text-blue-800">{contextualReason}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">{t('your_goal')}</span>
                        {settings.profile?.primaryGoal 
                          ? t('supports_goal_desc', { goal: formatGoal(settings.profile.primaryGoal) })
                          : t('no_goal_set')}
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">{t('your_recent_pattern')}</span>
                        {(() => {
                           if (todayLogs.length === 0) return lang === 'fr' 
                             ? "Selon vos saisies, nous n'avons pas encore de tendance claire pour aujourd'hui."
                             : "Based on what you've logged so far, we don't have a clear pattern for today yet.";
                           
                           if (gap.includes('Vegetables')) {
                              const vegMeals = todayLogs.filter(m => (m.name || '').toLowerCase().includes('eru') || (m.name || '').toLowerCase().includes('ndolé') || (m.name || '').toLowerCase().includes('salad') || (m.name || '').toLowerCase().includes('veg'));
                              if (vegMeals.length === 0) return lang === 'fr'
                                ? "Les légumes n'apparaissent pas encore dans vos repas du jour."
                                : "Vegetables haven't appeared in the meals you've logged today.";
                              return lang === 'fr'
                                ? `Les légumes étaient présents dans ${vegMeals.length} de vos ${todayLogs.length} repas du jour.`
                                : `Vegetables appeared in ${vegMeals.length} of your ${todayLogs.length} logged meals today.`;
                           }
                           if (gap.includes('Protein')) {
                              const highProtein = todayLogs.filter(m => (m.protein || 0) > 15);
                              if (highProtein.length === 0) return lang === 'fr'
                                ? "Les aliments riches en protéines n'apparaissent pas encore dans vos repas du jour."
                                : "High-protein sources haven't appeared in the meals you've logged today.";
                              return lang === 'fr'
                                ? `Des sources de protéines étaient présentes dans ${highProtein.length} de vos ${todayLogs.length} repas.`
                                : `Strong protein sources appeared in ${highProtein.length} of your ${todayLogs.length} logged meals today.`;
                           }
                           if (gap.includes('Water')) {
                              const sugary = todayLogs.filter(m => (m.name || '').toLowerCase().includes('coke') || (m.name || '').toLowerCase().includes('soda') || (m.name || '').toLowerCase().includes('juice'));
                              if (sugary.length > 0) return lang === 'fr'
                                ? `Vous avez noté ${sugary.length} boisson(s) sucrée(s) aujourd'hui.`
                                : `You've logged ${sugary.length} sugary drink${sugary.length > 1 ? 's' : ''} today.`;
                              return lang === 'fr' ? "Hydratation encore insuffisante aujourd'hui." : "You haven't logged adequate hydration today.";
                           }
                           return lang === 'fr'
                             ? `Vous avez noté ${todayLogs.length} repas aujourd'hui.`
                             : `You've logged ${todayLogs.length} meal${todayLogs.length > 1 ? 's' : ''} today.`;
                        })()}
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">{t('why_this_food')}</span>
                        {nextMealAnalysis.goodSourceOf.length > 0 ? 
                          (lang === 'fr' 
                            ? `Ce repas est une bonne source de ${nextMealAnalysis.goodSourceOf.join(' et ').toLowerCase()}.`
                            : `This meal is a good source of ${nextMealAnalysis.goodSourceOf.join(' and ').toLowerCase()}.`) : 
                          (nextMealAnalysis.bestFor && nextMealAnalysis.bestFor.length > 0) ?
                          (lang === 'fr'
                            ? `Ce repas est réputé bénéfique pour : ${nextMealAnalysis.bestFor.join(', ').toLowerCase()}.`
                            : `This meal is known to be good for ${nextMealAnalysis.bestFor.join(' and ').toLowerCase()}.`) :
                          (lang === 'fr'
                            ? "Ce plat s'intègre harmonieusement à vos apports du moment."
                            : 'This meal fits your current nutritional pattern.')
                        }
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">{t('confidence')}</span>
                        {currentSummary.confidence > 70 ? t('confidence_high') :
                         currentSummary.confidence > 30 ? t('confidence_moderate') :
                         t('confidence_limited')}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* TODAY / DAILY PROGRESS */}
        <motion.div 
          animate={isUpdating ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.5 }}
          className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden"
          aria-label={isProfileSufficient 
            ? t('aria_personalized_calorie_goal', { goal: settings.dailyGoal }) 
            : t('aria_reference_calorie_goal', { goal: settings.dailyGoal })}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{t('today')}</h3>
          
          <div className="flex justify-between items-end mb-5">
            <div>
              <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">{remaining > 0 ? remaining : 0}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">{t('kcal_remaining')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">{Math.round(caloriesConsumed)} <span className="text-gray-400 font-medium">{t('consumed')}</span></p>
              <p className="text-sm font-bold text-gray-700">{settings.dailyGoal} <span className="text-gray-400 font-medium">{isProfileSufficient ? t('target') : t('general_ref_target')}</span></p>
            </div>
          </div>
          
          <div className={`p-3.5 rounded-2xl border ${dailyStatus.colorClass}`}>
             <p className="text-sm font-bold mb-0.5">{dailyStatus.title}</p>
             <p className="text-xs opacity-90 font-medium">{dailyStatus.message}</p>
          </div>
        </motion.div>

        {/* YOUR FOOD PATTERN */}
        {foodPattern && (
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('your_food_pattern')}</h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${foodPattern.colorClass}`}>
                {foodPattern.status}
              </span>
            </div>
            
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${foodPattern.colorClass}`}>
                <foodPattern.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg leading-tight mb-2 tracking-tight">
                  {foodPattern.observation}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <span className="font-bold text-gray-700">{t('why_it_matters')}</span> {foodPattern.whyItMatters}
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-sm text-gray-700"><span className="font-bold">{t('focus_label')}</span> {foodPattern.whatNext}</p>
            </div>
          </div>
        )}
        
        {/* YOUR WEEKLY PATTERN */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">{t('your_weekly_pattern')}</h3>
          
          {weeklyTrends.hasEnoughData ? (
            <div className="space-y-4 mb-8">
              {/* Primary Insight */}
              {weeklyTrends.primary && (
                <div className={`p-4 rounded-2xl border ${weeklyTrends.primary.colorClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold flex items-center gap-2">
                      {weeklyTrends.primary.status === t('status_needs_attention') ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {weeklyTrends.primary.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/50 backdrop-blur-sm">
                      {weeklyTrends.primary.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium opacity-90 mb-2">
                    {weeklyTrends.primary.observation}
                  </p>
                  {weeklyTrends.primary.nextStep && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">{t('next_step_label')}</p>
                      <p className="text-sm opacity-90">{weeklyTrends.primary.nextStep}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Secondary Insights (Compact) */}
              {weeklyTrends.secondary && weeklyTrends.secondary.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                  {weeklyTrends.secondary.map((trend: any) => (
                    <div key={trend.id} className={`p-3 rounded-xl border flex items-center justify-between ${trend.colorClass}`}>
                       <span className="text-sm font-bold flex items-center gap-2">
                          {trend.status === t('status_needs_attention') ? <AlertTriangle className="w-3.5 h-3.5 opacity-70" /> : 
                           trend.status === t('status_looking_good') ? <CheckCircle2 className="w-3.5 h-3.5 opacity-70" /> :
                           <Info className="w-3.5 h-3.5 opacity-70" />}
                          {trend.title}
                       </span>
                       <span className="text-xs font-medium opacity-90">{trend.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100 mb-8">
                <Activity className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <h4 className="font-bold text-gray-700 text-sm mb-1">{t('building_weekly_pattern')}</h4>
                <p className="text-xs text-gray-500">{t('building_weekly_desc')}</p>
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{t('week_at_glance')}</h3>
          <div className="mb-4">
            <p className="text-sm font-bold text-gray-800">{chartInterpretation.interpretation}</p>
            {chartInterpretation.fact && (
              <p className="text-sm text-gray-500 mt-1">{chartInterpretation.fact}</p>
            )}
          </div>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyDataArr} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 500 }}
                  domain={[0, chartMax]}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                <ReferenceLine 
                  y={settings.dailyGoal} 
                  stroke="#10b981" 
                  strokeDasharray="4 4" 
                  label={{ 
                    position: 'top', 
                    value: isProfileSufficient ? t('chart_target') : t('general_ref_target'), 
                    fill: '#10b981', 
                    fontSize: 10, 
                    fontWeight: 600 
                  }} 
                />
                <Bar 
                  dataKey="calories" 
                  fill="#34d399" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded bg-emerald-400"></div>
               <span className="text-xs text-gray-500 font-medium">{t('chart_logged')}</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-0 border-t-2 border-dashed border-emerald-500"></div>
               <span className="text-xs text-gray-500 font-medium">{t('chart_target')}</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded bg-transparent border border-gray-200"></div>
               <span className="text-xs text-gray-500 font-medium">{t('chart_no_data')}</span>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
