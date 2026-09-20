import React, { useMemo, useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity, Info, TrendingUp, Target, Star, ArrowRight, Zap, CheckCircle2, Clock, AlertTriangle, Utensils } from 'lucide-react';
import { RecommendationEngine } from '../lib/RecommendationEngine';
import { motion, AnimatePresence } from 'motion/react';
import { commonFoods } from '../data/foodDatabase';

export default function AnalyticsView({ onLogFood }: { onLogFood: (food?: any) => void }) {
  const { allConsumptions, settings } = useData();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showWhyRecommendation, setShowWhyRecommendation] = useState(false);

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
    
    const todayLogs = allConsumptions.filter(c => c.timestamp >= tStart && c.timestamp <= tEnd);
    const weeklyLogs = allConsumptions.filter(c => c.timestamp >= startOfDay(subDays(now, 6)).getTime() && c.timestamp <= tEnd);
    
    const weeklyDataArr = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i);
      const start = startOfDay(date).getTime();
      const end = endOfDay(date).getTime();
      const dayConsumptions = allConsumptions.filter(c => c.timestamp >= start && c.timestamp <= end);
      const hasData = dayConsumptions.length > 0;
      const dayCals = Math.round(dayConsumptions.reduce((acc, c) => acc + c.calories, 0));
      weeklyDataArr.push({
        name: format(date, 'EEE'),
        calories: hasData ? dayCals : null, // Important: null for missing days
        hasData,
        date: format(date, 'MM/dd')
      });
    }

    const sortedLogs = [...todayLogs].sort((a, b) => b.timestamp - a.timestamp);
    const lastLog = sortedLogs[0];
    
    // Determine if we should show the "changed recently" banner (within 30 seconds of log)
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
          
       // If no insight changed, but calories changed meaningfully, we could consider it meaningful.
       // However, the prompt specifically says "Only #3 should trigger the large 'Insight Updated' banner."
       // "#3 INSIGHT CHANGE The Recommendation Engine produced a materially different Daily Focus, Goal Status, Nutrition Gap, or Next Action."
    }
    
    const caloriesConsumed = todayLogs.reduce((acc, c) => acc + c.calories, 0);
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
  }, [allConsumptions, settings]);

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

  const getDailyStatus = () => {
    if (todayLogs.length === 0) {
      return {
        title: "Your day is still taking shape",
        message: "Your food pattern for today hasn't started yet.",
        colorClass: "bg-gray-50 border-gray-100 text-gray-600"
      };
    }
    if (todayLogs.length === 1) {
      return {
        title: "Your day is still taking shape",
        message: "You've logged one meal. Another meal will provide a clearer picture.",
        colorClass: "bg-gray-50 border-gray-100 text-gray-600"
      };
    }
    
    const protein = todayLogs.reduce((sum, m) => sum + (m.protein || 0), 0);
    const sugary = todayLogs.filter(m => m.name.toLowerCase().includes('coke') || m.name.toLowerCase().includes('soda') || m.name.toLowerCase().includes('juice'));
    const vegMeals = todayLogs.filter(m => m.name.toLowerCase().includes('eru') || m.name.toLowerCase().includes('ndolé') || m.name.toLowerCase().includes('salad') || m.name.toLowerCase().includes('veg'));
    const goal = settings.profile?.primaryGoal || 'Eat Healthier';
    
    if (sugary.length > 0 || (vegMeals.length === 0 && todayLogs.length > 2)) {
      return {
        title: "One thing could improve today",
        message: "A small adjustment could help balance your nutrition.",
        colorClass: "bg-amber-50 border-amber-100 text-amber-800"
      };
    }
    if (goal === 'Lose Weight' && remaining >= 0) {
      return {
        title: "You're doing well today",
        message: "You are within your calorie target so far.",
        colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
      };
    }
    if (goal === 'Build Muscle' && protein > 20) {
      return {
        title: "You're making a solid start today",
        message: "Your logged meals are supporting your protein goals.",
        colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
      };
    }
    return {
      title: "Your day looks balanced so far",
      message: "Your logged meals are reasonably varied today.",
      colorClass: "bg-emerald-50 border-emerald-100 text-emerald-800"
    };
  };

  const getFoodPattern = () => {
    if (todayLogs.length === 0) return null;

    const sugary = todayLogs.filter(m => m.name.toLowerCase().includes('coke') || m.name.toLowerCase().includes('soda') || m.name.toLowerCase().includes('juice'));
    const vegMeals = todayLogs.filter(m => m.name.toLowerCase().includes('eru') || m.name.toLowerCase().includes('ndolé') || m.name.toLowerCase().includes('salad') || m.name.toLowerCase().includes('veg'));
    const fried = todayLogs.filter(m => m.name.toLowerCase().includes('fried') || m.name.toLowerCase().includes('puff'));
    const highProtein = todayLogs.filter(m => (m.protein || 0) > 15);
    
    if (vegMeals.length === 0 && todayLogs.length >= 1) {
       return {
         status: "Needs attention",
         observation: "Vegetables haven't appeared in the meals you've logged today.",
         whyItMatters: "Vegetables can add fiber and important vitamins and minerals to your meals.",
         whatNext: "Adding one vegetable-rich side to your next meal could improve variety.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (sugary.length > 0) {
       return {
         status: "Needs attention",
         observation: `You've logged ${sugary.length} sugary drink${sugary.length > 1 ? 's' : ''} today.`,
         whyItMatters: "Sugary drinks can cause energy crashes and add hidden calories without making you full.",
         whatNext: "Consider having water with your next meal instead.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (fried.length > 1) {
       return {
         status: "Needs attention",
         observation: "You've had multiple fried foods today.",
         whyItMatters: "Fried foods are calorie-dense and can make you feel sluggish.",
         whatNext: "Opt for a boiled or grilled option for your next meal.",
         icon: AlertTriangle,
         colorClass: "text-amber-600 bg-amber-50 border-amber-100"
       };
    }
    
    if (highProtein.length >= 1) {
       return {
         status: "Positive pattern",
         observation: "Your logged meals have included strong protein sources.",
         whyItMatters: "Protein helps with satiety and supports muscle recovery.",
         whatNext: "Keep up the balanced choices for the rest of the day.",
         icon: Star,
         colorClass: "text-emerald-600 bg-emerald-50 border-emerald-100"
       };
    }
    
    return {
       status: "Developing pattern",
       observation: "Your meals show a mix of different foods today.",
       whyItMatters: "A varied diet is key to getting a wide range of nutrients.",
       whatNext: "Keep logging to maintain a clear picture of your day.",
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
    
    // Calculate actual occurrences
    let vegMeals = 0;
    let highProteinMeals = 0;
    let sugaryDrinks = 0;
    let friedFoods = 0;
    
    weeklyLogs.forEach(c => {
      const name = c.name.toLowerCase();
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
        title: 'Vegetables',
        status: 'Needs attention',
        observation: `Vegetables appeared in ${vegMeals} of your ${totalMeals} logged meals this week.`,
        nextStep: 'Try adding a vegetable-rich side to one more meal this week.',
        priority: 1,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'veg-good',
        title: 'Vegetables',
        status: 'Looking good',
        observation: `Vegetables appeared in ${vegMeals} of your ${totalMeals} logged meals this week.`,
        priority: 3,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Protein
    if (currentSummary.weeklyPattern.proteinTrend === 'Strong') {
      trends.push({
        id: 'protein-good',
        title: 'Protein',
        status: 'Looking good',
        observation: `Strong protein sources appeared in ${highProteinMeals} of your ${totalMeals} logged meals.`,
        nextStep: 'Keep including strong protein sources to support satiety.',
        priority: 1,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    } else {
      trends.push({
        id: 'protein-avg',
        title: 'Protein',
        status: 'Average',
        observation: `Protein intake has been moderate across your ${totalMeals} logged meals.`,
        priority: 4,
        colorClass: 'text-gray-700 bg-gray-50 border-gray-200'
      });
    }
    
    // Sugary Drinks
    if (currentSummary.weeklyPattern.sugaryDrinkTrend === 'High') {
      trends.push({
        id: 'sugar-high',
        title: 'Sugary Drinks',
        status: 'Needs attention',
        observation: `Sugary drinks appeared in ${sugaryDrinks} of your ${totalMeals} recent logs.`,
        nextStep: 'Consider substituting water or a sugar-free alternative for one drink tomorrow.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'sugar-low',
        title: 'Sugary Drinks',
        status: 'Looking good',
        observation: `Sugary drinks were minimal across your ${totalMeals} logged meals.`,
        priority: 5,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    // Fried Foods
    if (currentSummary.weeklyPattern.friedFoodTrend === 'High') {
      trends.push({
        id: 'fried-high',
        title: 'Fried Foods',
        status: 'Needs attention',
        observation: `Fried foods appeared in ${friedFoods} of your ${totalMeals} recent logs.`,
        nextStep: 'If reducing fried foods is part of your goal, try a grilled or boiled option for one meal.',
        priority: 2,
        colorClass: 'text-amber-700 bg-amber-50 border-amber-200'
      });
    } else {
      trends.push({
        id: 'fried-low',
        title: 'Fried Foods',
        status: 'Looking good',
        observation: `Fried foods were minimal across your ${totalMeals} logged meals.`,
        priority: 6,
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      });
    }
    
    trends.sort((a, b) => a.priority - b.priority);
    return {
      hasEnoughData: true,
      primary: trends[0],
      secondary: trends.slice(1, 4) // Show up to 3 secondary
    };
  };

  const getChartInterpretation = () => {
    if (daysWithData === 0) {
      return {
        interpretation: "Log a few meals to see your 7-day calorie pattern.",
        fact: null
      };
    }
    if (daysWithData < 3) {
      return {
        interpretation: "We only have a few logged days, so this week's calorie pattern is still taking shape.",
        fact: null
      };
    }
    
    const validDays = weeklyDataArr.filter(d => d.hasData);
    const dataPoints = validDays.map(d => d.calories);
    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const avg = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
    
    let interpretation = "";
    const variation = (max - min) / avg;
    if (variation > 0.5) {
      interpretation = "Your logged intake has varied quite a bit this week.";
    } else {
      interpretation = "Your logged intake has stayed fairly consistent this week.";
    }
    
    // Calculate a specific fact
    let fact = null;
    const daysNearTarget = validDays.filter(d => Math.abs(d.calories - settings.dailyGoal) < 300).length;
    
    if (daysNearTarget >= 3) {
      fact = `${daysNearTarget} of ${daysWithData} logged days were close to your target.`;
    } else {
      // Find highest day
      const highestDay = validDays.reduce((prev, current) => (prev.calories > current.calories) ? prev : current);
      fact = `Highest logged day: ${highestDay.name} · ${highestDay.calories} kcal`;
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
            <p className="text-gray-400 text-xs">No data logged</p>
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

  // Calculate dynamic chart maximum to ensure target line is always visible
  const chartMax = Math.floor(Math.max(
    settings.dailyGoal,
    ...weeklyDataArr.map(d => d.calories || 0)
  ) * 1.15);

  return (
    <div className="max-w-md mx-auto w-full p-6 pb-40 space-y-6">
      <header className="mb-2 mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Insights</h1>
          <p className="text-gray-500 font-medium">Your personalized coaching</p>
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
              <span>Analyzing...</span>
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
                <span>Updated {format(lastUpdate, 'h:mm a')}</span>
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
              <h3 className="font-bold text-sm">Insight Updated!</h3>
            </div>
            <p className="text-blue-200 text-xs mb-4">Adding {lastLog.name} changed your daily coaching focus.</p>
            
            <div className="space-y-3">
              {previousSummary.nextAction.title !== currentSummary.nextAction.title && (
                <div className="bg-blue-800/50 rounded-xl p-3">
                    <span className="text-xs text-blue-300 block mb-1">New Focus</span>
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
              <span className="text-sm font-bold text-emerald-800">{lastLog.name} logged</span>
            </div>
            <span className="text-xs text-emerald-600 font-medium">Nutrition updated</span>
          </motion.div>
        )}
      </AnimatePresence>

      {todayLogs.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center mt-6">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Utensils className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your day hasn't started yet</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Log your first meal to see personalized insights, nutrition balance, and a daily coaching focus.
          </p>
          <button 
            onClick={onLogFood}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            Log Food
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Daily Focus</h3>
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
                Your Next Meal
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
                  onClick={() => onLogFood(nextMeal)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors text-sm text-center shadow-sm"
                >
                  Try this
                </button>
                <button 
                  className="px-5 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-colors text-sm border border-gray-100"
                >
                  See alternatives
                </button>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-50 mt-5">
              <button 
                onClick={() => setShowWhyRecommendation(!showWhyRecommendation)}
                className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between w-full hover:text-gray-600 transition-colors py-2"
              >
                Why this recommendation?
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
                          Contextual Fit
                        </span>
                        <span className="text-blue-800">{contextualReason}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your goal</span>
                        Supports your current goal to {settings.profile?.primaryGoal || 'Eat Healthier'}.
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Your recent pattern</span>
                        {(() => {
                           if (todayLogs.length === 0) return "Based on what you've logged so far, we don't have a clear pattern for today yet.";
                           
                           if (gap.includes('Vegetables')) {
                              const vegMeals = todayLogs.filter(m => m.name.toLowerCase().includes('eru') || m.name.toLowerCase().includes('ndolé') || m.name.toLowerCase().includes('salad') || m.name.toLowerCase().includes('veg'));
                              if (vegMeals.length === 0) return "Vegetables haven't appeared in the meals you've logged today.";
                              return `Vegetables appeared in ${vegMeals.length} of your ${todayLogs.length} logged meals today.`;
                           }
                           if (gap.includes('Protein')) {
                              const highProtein = todayLogs.filter(m => (m.protein || 0) > 15);
                              if (highProtein.length === 0) return "High-protein sources haven't appeared in the meals you've logged today.";
                              return `Strong protein sources appeared in ${highProtein.length} of your ${todayLogs.length} logged meals today.`;
                           }
                           if (gap.includes('Water')) {
                              const sugary = todayLogs.filter(m => m.name.toLowerCase().includes('coke') || m.name.toLowerCase().includes('soda') || m.name.toLowerCase().includes('juice'));
                              if (sugary.length > 0) return `You've logged ${sugary.length} sugary drink${sugary.length > 1 ? 's' : ''} today.`;
                              return "You haven't logged adequate hydration today.";
                           }
                           return `You've logged ${todayLogs.length} meal${todayLogs.length > 1 ? 's' : ''} today.`;
                        })()}
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Why this food</span>
                        {nextMealAnalysis.goodSourceOf.length > 0 ? 
                          `This meal is a good source of ${nextMealAnalysis.goodSourceOf.join(' and ').toLowerCase()}.` : 
                          (nextMealAnalysis.bestFor && nextMealAnalysis.bestFor.length > 0) ?
                          `This meal is known to be good for ${nextMealAnalysis.bestFor.join(' and ').toLowerCase()}.` :
                          'This meal fits your current nutritional pattern.'
                        }
                      </div>
                      
                      <div>
                        <span className="font-bold text-gray-900 block mb-0.5">Confidence</span>
                        {currentSummary.confidence > 70 ? 'High confidence · Based on your recent logs and nutritional profile.' :
                         currentSummary.confidence > 30 ? 'Moderate confidence · We are still learning your eating patterns.' :
                         'Limited confidence · We don\'t have enough recent meal data yet.'}
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
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Today</h3>
          
          <div className="flex justify-between items-end mb-5">
            <div>
              <p className="text-3xl font-black text-gray-900 leading-none tracking-tight">{remaining > 0 ? remaining : 0}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">kcal remaining</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">{Math.round(caloriesConsumed)} <span className="text-gray-400 font-medium">consumed</span></p>
              <p className="text-sm font-bold text-gray-700">{settings.dailyGoal} <span className="text-gray-400 font-medium">target</span></p>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Your Food Pattern</h3>
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
                  <span className="font-bold text-gray-700">Why it matters:</span> {foodPattern.whyItMatters}
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-sm text-gray-700"><span className="font-bold">Focus:</span> {foodPattern.whatNext}</p>
            </div>
          </div>
        )}
        
        {/* YOUR WEEKLY PATTERN */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Your Weekly Pattern</h3>
          
          {weeklyTrends.hasEnoughData ? (
            <div className="space-y-4 mb-8">
              {/* Primary Insight */}
              {weeklyTrends.primary && (
                <div className={`p-4 rounded-2xl border ${weeklyTrends.primary.colorClass}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold flex items-center gap-2">
                      {weeklyTrends.primary.status === 'Needs attention' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
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
                      <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Next Step</p>
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
                          {trend.status === 'Needs attention' ? <AlertTriangle className="w-3.5 h-3.5 opacity-70" /> : 
                           trend.status === 'Looking good' ? <CheckCircle2 className="w-3.5 h-3.5 opacity-70" /> :
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
                <h4 className="font-bold text-gray-700 text-sm mb-1">Building your weekly pattern</h4>
                <p className="text-xs text-gray-500">Log a few more meals to make your weekly nutrition pattern clearer.</p>
            </div>
          )}

          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Your Week At A Glance</h3>
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
                <ReferenceLine y={settings.dailyGoal} stroke="#10b981" strokeDasharray="4 4" label={{ position: 'top', value: 'Target', fill: '#10b981', fontSize: 10, fontWeight: 600 }} />
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
               <span className="text-xs text-gray-500 font-medium">Logged</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-0 border-t-2 border-dashed border-emerald-500"></div>
               <span className="text-xs text-gray-500 font-medium">Target</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-3 h-3 rounded bg-transparent border border-gray-200"></div>
               <span className="text-xs text-gray-500 font-medium">No data</span>
            </div>
          </div>
        </div>        </div>
      )}
    </div>
  );
}

