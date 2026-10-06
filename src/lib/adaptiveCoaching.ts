import type { ConsumptionRecord, UserProfile, WeightEntry } from '../types';
import { calculateDailyTargetDetailed } from './personalization';
import {
  SAFE_WEEKLY_LOSS_KG,
  PROTEIN_G_PER_KG,
  STALL_WEEKS,
  STALL_KG_THRESHOLD,
  ADHERENCE_WINDOW_DAYS,
  ADHERENCE_BAND,
  COACHING_DISCLAIMER,
} from './nutritionGuidelines';

export type TrendDirection = 'losing' | 'gaining' | 'stable' | 'insufficient-data';

export interface WeightTrend {
  direction: TrendDirection;
  /** signed kg per week; negative = losing */
  kgPerWeek: number;
  /** 7-day moving average of the most recent entries */
  avgKg: number;
  entriesUsed: number;
}

/**
 * Weight trend from timestamped weight entries: 7-day moving average plus a
 * least-squares kg/week slope over the recent window.
 */
export function computeWeightTrend(entries: WeightEntry[]): WeightTrend {
  const valid = [...entries]
    .filter((e) => Number.isFinite(e.weightKg) && e.weightKg > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (valid.length < 2) {
    return {
      direction: 'insufficient-data',
      kgPerWeek: 0,
      avgKg: valid[0]?.weightKg ?? 0,
      entriesUsed: valid.length,
    };
  }

  const now = Date.now();
  const lastWeek = valid.filter((e) => now - e.timestamp <= 7 * 24 * 3600 * 1000);
  const recent = lastWeek.length >= 2 ? lastWeek : valid.slice(-7);
  const avgKg = recent.reduce((s, e) => s + e.weightKg, 0) / recent.length;

  // Least-squares slope (kg per week) over the recent window.
  const t0 = recent[0].timestamp;
  const xs = recent.map((e) => (e.timestamp - t0) / (7 * 24 * 3600 * 1000));
  const ys = recent.map((e) => e.weightKg);
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const slope = denom === 0 ? 0 : xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / denom;

  const direction: TrendDirection =
    slope <= -0.05 ? 'losing' : slope >= 0.05 ? 'gaining' : 'stable';

  return { direction, kgPerWeek: slope, avgKg, entriesUsed: recent.length };
}

export interface AdaptiveTarget {
  targetCalories: number;
  adjusted: boolean;
  /** Suggestive explanation shown to the user; never a medical directive. */
  adjustmentReason?: string;
}

/**
 * Adjust the calorie target from the user's REAL weight-trend data.
 * Suggestions only — never overrides the stored profile target silently.
 * - Losing faster than the safe pace  → suggest raising the target.
 * - Gaining while the goal is loss    → flag it, suggest a small step down.
 * - Otherwise                         → keep the computed target.
 */
export function adaptTargetToTrend(
  profile: UserProfile | undefined,
  trend: WeightTrend
): AdaptiveTarget {
  const base = calculateDailyTargetDetailed(profile ?? null);
  const goal = profile?.primaryGoal;

  if (!base.valid || trend.direction === 'insufficient-data') {
    return { targetCalories: base.targetCalories, adjusted: false };
  }

  if (goal === 'Lose Weight' && trend.direction === 'losing' && trend.kgPerWeek < -SAFE_WEEKLY_LOSS_KG.max) {
    const raised = Math.round(base.targetCalories * 1.1);
    return {
      targetCalories: raised,
      adjusted: true,
      adjustmentReason:
        `You're losing weight faster than the safe pace (over ${SAFE_WEEKLY_LOSS_KG.max} kg/week). ` +
        `Consider eating a bit more — around ${raised} kcal/day — to protect muscle and keep your energy up.`,
    };
  }

  if (goal === 'Lose Weight' && trend.direction === 'gaining') {
    const lowered = Math.max(base.floor, Math.round(base.targetCalories * 0.95));
    return {
      targetCalories: lowered,
      adjusted: true,
      adjustmentReason:
        `Your weight has been trending up while your goal is weight loss. ` +
        `A small step down to around ${lowered} kcal/day could help — or check portion sizes and logging consistency first.`,
    };
  }

  return { targetCalories: base.targetCalories, adjusted: false };
}

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface AdaptiveRecommendation {
  priority: RecommendationPriority;
  title: string;
  /** Suggestive coaching language; never a medical directive. */
  message: string;
}

/** Days with at least one logged meal in the last N days. */
export function loggingStreak(consumptions: ConsumptionRecord[], days = ADHERENCE_WINDOW_DAYS): number {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const dayKeys = new Set(
    consumptions
      .filter((c) => c.timestamp >= cutoff)
      .map((c) => new Date(c.timestamp).toDateString())
  );
  return dayKeys.size;
}

/** Stall = 2+ weeks of weight entries with < threshold change in body weight. */
export function isWeightStalled(entries: WeightEntry[]): boolean {
  const valid = entries
    .filter((e) => Number.isFinite(e.weightKg) && e.weightKg > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (valid.length < 3) return false;
  const spanWeeks = (valid[valid.length - 1].timestamp - valid[0].timestamp) / (7 * 24 * 3600 * 1000);
  if (spanWeeks < STALL_WEEKS) return false;
  return Math.abs(valid[valid.length - 1].weightKg - valid[0].weightKg) < STALL_KG_THRESHOLD;
}

export interface AdaptiveInsightsInput {
  profile: UserProfile | undefined;
  /** consumptions in the recent window (e.g. last 7 days) */
  consumptions: ConsumptionRecord[];
  trend: WeightTrend;
  entries: WeightEntry[];
}

/**
 * Tiered, personalized recommendations driven by the user's own data:
 * trend vs goal, protein intake vs evidence-based target, logging
 * consistency, and profile attributes (age, activity level).
 */
export function buildAdaptiveRecommendations({
  profile,
  consumptions,
  trend,
  entries,
}: AdaptiveInsightsInput): AdaptiveRecommendation[] {
  const recs: AdaptiveRecommendation[] = [];
  const goal = profile?.primaryGoal;
  const daysLogged = loggingStreak(consumptions);

  const weightKg = profile?.weightKg && profile.weightKg > 0 ? profile.weightKg : trend.avgKg;
  const proteinTarget = weightKg > 0 ? Math.round(weightKg * PROTEIN_G_PER_KG.target) : 0;
  const proteinFloor = weightKg > 0 ? weightKg * PROTEIN_G_PER_KG.min : 0;
  const avgProtein =
    daysLogged > 0
      ? consumptions.reduce((s, c) => s + (c.protein || 0), 0) / daysLogged
      : 0;

  // ---- High priority: trend vs goal ----
  if (goal === 'Lose Weight' && trend.direction === 'losing' && trend.kgPerWeek < -SAFE_WEEKLY_LOSS_KG.max) {
    recs.push({
      priority: 'high',
      title: 'Pace check: losing fast',
      message:
        `You're averaging ${Math.abs(trend.kgPerWeek).toFixed(1)} kg/week, above the safe pace of ` +
        `${SAFE_WEEKLY_LOSS_KG.max} kg/week. Consider raising your daily target a little to protect muscle and keep your energy up.`,
    });
  }
  if (goal === 'Lose Weight' && isWeightStalled(entries) && daysLogged >= 5) {
    recs.push({
      priority: 'high',
      title: 'Possible plateau',
      message:
        `Your weight hasn't moved much in ${STALL_WEEKS}+ weeks despite consistent logging. ` +
        `Small tweaks — slightly smaller portions, a bit more protein, or more daily movement — often restart progress.`,
    });
  }
  if (goal === 'Lose Weight' && trend.direction === 'gaining') {
    recs.push({
      priority: 'high',
      title: 'Trend vs goal mismatch',
      message:
        "Your weight is trending up while your goal is weight loss. Double-check portion estimates and " +
        'snacks that don\u2019t get logged — those are the usual culprits.',
    });
  }

  // ---- Medium priority: protein & consistency ----
  if (proteinTarget > 0 && avgProtein > 0 && avgProtein < proteinFloor) {
    recs.push({
      priority: 'medium',
      title: 'Protein is low',
      message:
        `You're averaging ~${Math.round(avgProtein)}g protein/day; aiming for ~${proteinTarget}g ` +
        `(${PROTEIN_G_PER_KG.target}g per kg) can help preserve muscle and keep you fuller. ` +
        `Beans, eggs, fish and groundnuts are easy local wins.`,
    });
  }
  if (daysLogged > 0 && daysLogged < 4) {
    recs.push({
      priority: 'medium',
      title: 'Logging gaps',
      message:
        `You've logged ${daysLogged} of the last ${ADHERENCE_WINDOW_DAYS} days. ` +
        `Insights get much smarter with consistent logging — even quick entries count.`,
    });
  }

  // ---- Low priority: profile-based nudges ----
  if (typeof profile?.age === 'number' && profile.age >= 50) {
    recs.push({
      priority: 'low',
      title: 'Protecting muscle with age',
      message:
        'After 50, a little more protein and some resistance movement (bodyweight counts) go a long way ' +
        'for keeping strength while you manage weight.',
    });
  }
  if (profile?.activityLevel === 'Sedentary') {
    recs.push({
      priority: 'low',
      title: 'Easy movement win',
      message: 'A daily 20–30 minute walk can support your goal without changing how you eat.',
    });
  }

  const order: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

export type DashboardStatus = 'on-track' | 'needs-attention' | 'off-track' | 'getting-started';

export interface StatusResult {
  status: DashboardStatus;
  label: string;
  reason: string;
}

export interface DashboardStatusInput {
  profile: UserProfile | undefined;
  trend: WeightTrend;
  daysLogged: number;
  /** average daily calories over the recent window */
  avgCalories: number;
  targetCalories: number;
}

/** Color-coded status driven by the user's real trend + adherence data. */
export function computeDashboardStatus({
  profile,
  trend,
  daysLogged,
  avgCalories,
  targetCalories,
}: DashboardStatusInput): StatusResult {
  const goal = profile?.primaryGoal;

  if (daysLogged < 3 || trend.direction === 'insufficient-data') {
    return {
      status: 'getting-started',
      label: 'Getting started',
      reason: 'Log meals and your weight for a few days and your personal status will appear here.',
    };
  }

  const withinBand =
    targetCalories > 0 &&
    Math.abs(avgCalories - targetCalories) / targetCalories <= ADHERENCE_BAND;

  if (goal === 'Lose Weight') {
    if (trend.direction === 'losing' && trend.kgPerWeek >= -SAFE_WEEKLY_LOSS_KG.max && withinBand) {
      return {
        status: 'on-track',
        label: 'On track',
        reason: `Losing at a steady ${Math.abs(trend.kgPerWeek).toFixed(1)} kg/week and eating close to your target. Keep it up.`,
      };
    }
    if (trend.direction === 'gaining') {
      return {
        status: 'off-track',
        label: 'Off track',
        reason: 'Weight is trending up against your weight-loss goal.',
      };
    }
    if (trend.direction === 'losing' && trend.kgPerWeek < -SAFE_WEEKLY_LOSS_KG.max) {
      return {
        status: 'off-track',
        label: 'Off track',
        reason: 'Weight is dropping faster than the safe pace — consider eating a bit more.',
      };
    }
    return {
      status: 'needs-attention',
      label: 'Needs attention',
      reason: 'Progress is slower than expected. Check the insights below for small adjustments.',
    };
  }

  // Non weight-loss goals: status from calorie adherence.
  if (withinBand) {
    return {
      status: 'on-track',
      label: 'On track',
      reason: 'Your recent intake is close to your daily target.',
    };
  }
  return {
    status: 'needs-attention',
    label: 'Needs attention',
    reason: 'Your recent intake is drifting from your daily target.',
  };
}

export { COACHING_DISCLAIMER };
