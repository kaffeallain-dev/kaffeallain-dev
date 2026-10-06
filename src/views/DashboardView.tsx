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
  AlertTriangle,
  Activity,
} from "lucide-react";
import { motion } from "motion/react";
import { format, isToday, isYesterday, addDays, subDays } from "date-fns";
import { getProfileCompletion } from "../lib/personalization";
import { commonFoods } from "../data/foodDatabase";
import { RecommendationEngine } from "../lib/RecommendationEngine";
import {
  computeWeightTrend,
  adaptTargetToTrend,
  buildAdaptiveRecommendations,
  computeDashboardStatus,
  loggingStreak,
  COACHING_DISCLAIMER,
} from "../lib/adaptiveCoaching";

export default function DashboardView({
  onLogFood,
}: {
  onLogFood: (meal: MealCategory, food?: any, record?: any) => void;
  onOpenSettings: () => void;
}) {
  const {
    settings,
    selectedDate,
    setSelectedDate,
    selectedDateConsumptions,
    allConsumptions,
    customFoods,
    weightEntries,
    addWeightEntry,
    dataError,
    clearDataError,
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
    if (isToday(selectedDate)) return "Today";
    if (isYesterday(selectedDate)) return "Yesterday";
    return format(selectedDate, "EEEE, MMM do");
  };

  const dailySummary = useMemo(() => {
    return RecommendationEngine.getDailySummary(
      settings.profile,
      selectedDateConsumptions,
      settings.dailyGoal
    );
  }, [selectedDateConsumptions, settings.dailyGoal, settings.profile]);

  // ---- Adaptive coaching: driven by the user's real logged data ----
  const trend = useMemo(() => computeWeightTrend(weightEntries), [weightEntries]);

  const recentConsumptions = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return allConsumptions.filter((c) => c.timestamp >= cutoff);
  }, [allConsumptions]);

  const recentDaysLogged = useMemo(() => loggingStreak(recentConsumptions), [recentConsumptions]);

  const avgCalories = useMemo(() => {
    if (recentDaysLogged === 0) return 0;
    return recentConsumptions.reduce((s, c) => s + c.calories, 0) / recentDaysLogged;
  }, [recentConsumptions, recentDaysLogged]);

  const adaptiveTarget = useMemo(
    () => adaptTargetToTrend(settings.profile, trend),
    [settings.profile, trend]
  );

  const status = useMemo(
    () =>
      computeDashboardStatus({
        profile: settings.profile,
        trend,
        daysLogged: recentDaysLogged,
        avgCalories,
        targetCalories: adaptiveTarget.targetCalories,
      }),
    [settings.profile, trend, recentDaysLogged, avgCalories, adaptiveTarget]
  );

  const adaptiveRecs = useMemo(
    () =>
      buildAdaptiveRecommendations({
        profile: settings.profile,
        consumptions: recentConsumptions,
        trend,
        entries: weightEntries,
      }),
    [settings.profile, recentConsumptions, trend, weightEntries]
  );

  const statusPill =
    status.status === "on-track"
      ? "bg-emerald-100 text-emerald-700"
      : status.status === "needs-attention"
        ? "bg-amber-100 text-amber-700"
        : status.status === "off-track"
          ? "bg-red-100 text-red-700"
          : "bg-gray-100 text-gray-600";

  const priorityStyles: Record<string, { pill: string; border: string }> = {
    high: { pill: "bg-red-100 text-red-700", border: "border-l-red-500" },
    medium: { pill: "bg-amber-100 text-amber-700", border: "border-l-amber-500" },
    low: { pill: "bg-gray-100 text-gray-600", border: "border-l-gray-300" },
  };

  const [weightInput, setWeightInput] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);

  const handleLogWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(weightInput);
    if (!Number.isFinite(v) || v <= 0 || v > 400) {
      setWeightError("Enter a valid weight in kg.");
      return;
    }
    try {
      await addWeightEntry(v);
      setWeightInput("");
      setWeightError(null);
    } catch (err: any) {
      setWeightError(err?.message || "Could not save your weight.");
    }
  };

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
              {format(selectedDate, "MMMM yyyy")}
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
        {/* DATA ERROR */}
        {dataError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2">
            <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 flex-1">{dataError}</p>
            <button
              onClick={clearDataError}
              className="text-xs font-bold text-red-600 hover:text-red-800 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SNAP A MEAL */}
        {isToday(selectedDate) && (
          <div className="mb-6">
            <button
              onClick={() => onLogFood(getCurrentMealCategory())}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200/50 rounded-2xl p-4 flex items-center justify-center gap-3 transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="font-bold text-lg">Snap a meal</span>
            </button>
          </div>
        )}

        {/* TODAY'S NUTRITION */}
        <section className="mb-6">
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-end mb-2">
              <div>
                <div className="text-2xl font-black text-gray-900 tracking-tight">
                  {Math.round(totalCalories)} <span className="text-sm font-bold text-gray-500">kcal eaten</span>
                </div>
                <div className="text-sm font-bold text-emerald-600 mt-0.5">
                  ~{Math.round(remainingCalories)} remaining
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Daily Target</div>
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

            {adaptiveTarget.adjusted && adaptiveTarget.adjustmentReason && (
              <p className="text-xs text-amber-800 mt-4 font-medium bg-amber-50 p-3 rounded-xl border border-amber-100">
                <span className="font-bold">Adaptive suggestion:</span> {adaptiveTarget.adjustmentReason}
              </p>
            )}

            {isProfileIncomplete && (
              <p className="text-xs text-gray-500 mt-4 font-medium bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="font-bold text-gray-700">Nutrition estimate available.</span> Complete your profile in Settings for a more personalized daily target.
              </p>
            )}
          </div>
        </section>

        {/* YOUR STATUS — driven by real trend + adherence data */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-500" /> Your status
          </h2>
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <div className="mb-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${statusPill}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{status.reason}</p>

            {trend.direction !== "insufficient-data" ? (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-500 font-semibold uppercase">7-day avg</span>
                  <p className="font-black text-gray-900">{trend.avgKg.toFixed(1)} kg</p>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs text-gray-500 font-semibold uppercase">Trend</span>
                  <p className={`font-black ${trend.kgPerWeek < 0 ? "text-emerald-600" : trend.kgPerWeek > 0 ? "text-red-600" : "text-gray-900"}`}>
                    {trend.kgPerWeek > 0 ? "+" : ""}{trend.kgPerWeek.toFixed(2)} kg/wk
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-3">
                Log your weight below to unlock trend tracking — your status gets smarter with real data.
              </p>
            )}

            <form onSubmit={handleLogWeight} className="mt-4 flex gap-2">
              <input
                type="number"
                step="0.1"
                min="25"
                max="400"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="Weight (kg)"
                className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors shrink-0"
              >
                Log weight
              </button>
            </form>
            {weightError && <p className="text-xs text-red-600 mt-1.5">{weightError}</p>}
          </div>
        </section>

        {/* TODAY'S MEALS */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Today's Meals</h2>
          {selectedDateConsumptions.length === 0 ? (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-2">Snap your first meal</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Take a photo and MboaFit will identify the food, estimate portions, and help you understand the nutrition.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm">
              <ul className="divide-y divide-gray-50">
                {mealCategories.map(meal => {
                  const items = selectedDateConsumptions.filter(c => c.mealCategory === meal);
                  if (items.length === 0) return null;
                  return (
                    <li key={meal} className="p-3">
                      <h3 className="font-bold text-gray-900 text-sm mb-3">{meal}</h3>
                      <ul className="space-y-4">
                        {items.map(item => (
                          <li key={item.id} className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                ~{Math.round(item.calories)} kcal &middot; Estimated
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">
                                {item.servings} serving{item.servings !== 1 ? 's' : ''}
                              </span>
                              <button
                                onClick={() => onLogFood(meal, null, item)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center transition-colors"
                              >
                                Review estimate &rarr;
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
                  {selectedDateConsumptions.length} {selectedDateConsumptions.length === 1 ? 'meal' : 'meals'} logged today
                </span>
                <span className="text-xs font-bold text-gray-400">View in Meals</span>
              </div>
            </div>
          )}
        </section>

        {/* QUICK ADD */}
        {isToday(selectedDate) && quickAddItems.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Zap className="w-4 h-4 text-emerald-500" /> Quick Add
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
              <Lightbulb className="w-4 h-4 text-emerald-500" /> One thing to try
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

        {/* COACH INSIGHTS — tiered, personalized, data-driven */}
        {adaptiveRecs.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500" /> Coach insights
            </h2>
            <div className="space-y-3">
              {adaptiveRecs.map((rec, i) => {
                const st = priorityStyles[rec.priority] ?? priorityStyles.low;
                return (
                  <div
                    key={i}
                    className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 border-l-4 ${st.border}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${st.pill}`}>
                        {rec.priority}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm">{rec.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{rec.message}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* DISCLAIMER */}
        <p className="text-[11px] text-gray-400 leading-relaxed text-center px-2 mb-2">
          {COACHING_DISCLAIMER}
        </p>

      </div>
    </div>
  );
}
