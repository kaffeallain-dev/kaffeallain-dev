import type { UserProfile } from '../types';

/** Typed subset of the user profile needed for calorie math. */
export interface CalorieProfileInput {
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  heightCm: number;
  weightKg: number;
  activityLevel: 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active';
  primaryGoal?: 'Lose Weight' | 'Maintain Weight' | 'Gain Weight' | 'Build Muscle' | 'Eat Healthier';
}

export interface DailyTargetResult {
  /** false when the profile was incomplete/invalid and a generic fallback was used */
  valid: boolean;
  targetCalories: number;
  bmr: number;
  tdee: number;
  /** true when the computed target was raised to the safe minimum */
  clamped: boolean;
  /** the safe minimum applied for this profile */
  floor: number;
  /** human-readable explanation when the result is a fallback or was clamped */
  note?: string;
}

// Conservative, evidence-based daily minimums (informational coaching only,
// not medical advice). Sources: NIDDK / Harvard T.H. Chan guidance.
export const MIN_DAILY_CALORIES_FEMALE = 1200;
export const MIN_DAILY_CALORIES_MALE = 1500;

// Weight-loss deficit: 15% of TDEE, capped at 750 kcal/day (conservative).
const MAX_DEFICIT_FRACTION = 0.15;
const MAX_DEFICIT_KCAL = 750;

const FALLBACK_TARGET = 2000;

/** Runtime validation: narrows an unknown value to CalorieProfileInput. */
function toCalorieProfileInput(prof: unknown): CalorieProfileInput | null {
  if (!prof || typeof prof !== 'object') return null;
  const p = prof as Record<string, unknown>;

  const age = Number(p.age);
  const heightCm = Number(p.heightCm);
  const weightKg = Number(p.weightKg);
  const sex = p.sex;
  const activityLevel = p.activityLevel;

  if (!Number.isFinite(age) || age < 10 || age > 120) return null;
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) return null;
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 400) return null;
  if (sex !== 'Male' && sex !== 'Female' && sex !== 'Other') return null;
  if (typeof activityLevel !== 'string' || activityLevel.length === 0) return null;

  const knownActivities = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'] as const;
  const safeActivity: CalorieProfileInput['activityLevel'] = (
    knownActivities as readonly string[]
  ).includes(activityLevel)
    ? (activityLevel as CalorieProfileInput['activityLevel'])
    : 'Sedentary';

  return {
    age,
    sex,
    heightCm,
    weightKg,
    activityLevel: safeActivity,
    primaryGoal: p.primaryGoal as CalorieProfileInput['primaryGoal'],
  };
}

function activityMultiplier(level: CalorieProfileInput['activityLevel']): number {
  switch (level) {
    case 'Sedentary': return 1.2;
    case 'Lightly Active': return 1.375;
    case 'Moderately Active': return 1.55;
    case 'Very Active': return 1.725;
  }
}

/**
 * Mifflin-St Jeor BMR + activity multiplier, adjusted for the user's goal.
 * Applies conservative safety floors (1200 kcal women / 1500 kcal men).
 *
 * For sex 'Other' the male and female formulas are averaged — a documented
 * neutral choice, not a medical determination.
 */
export function calculateDailyTargetDetailed(prof: unknown): DailyTargetResult {
  const input = toCalorieProfileInput(prof);

  if (!input) {
    return {
      valid: false,
      targetCalories: FALLBACK_TARGET,
      bmr: 0,
      tdee: 0,
      clamped: false,
      floor: MIN_DAILY_CALORIES_MALE,
      note: 'Profile is incomplete, so this is a generic estimate. Complete your profile for a personal target.',
    };
  }

  const { age, sex, heightCm, weightKg, activityLevel, primaryGoal } = input;

  const maleBmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const femaleBmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const bmr = sex === 'Male' ? maleBmr : sex === 'Female' ? femaleBmr : (maleBmr + femaleBmr) / 2;

  const tdee = bmr * activityMultiplier(activityLevel);

  let target = tdee;
  switch (primaryGoal) {
    case 'Lose Weight': {
      const deficit = Math.min(tdee * MAX_DEFICIT_FRACTION, MAX_DEFICIT_KCAL);
      target = tdee - deficit;
      break;
    }
    case 'Gain Weight':
      target = tdee * 1.15; // 15% surplus
      break;
    case 'Build Muscle':
      target = tdee * 1.10; // 10% surplus
      break;
    case 'Maintain Weight':
    case 'Eat Healthier':
    default:
      target = tdee;
      break;
  }

  // Conservative safety floor: never recommend below the minimum.
  // 'Other' uses the higher (male) floor as the more conservative default.
  const floor = sex === 'Female' ? MIN_DAILY_CALORIES_FEMALE : MIN_DAILY_CALORIES_MALE;
  let clamped = false;
  let note: string | undefined;
  if (target < floor) {
    target = floor;
    clamped = true;
    note = `Raised to a safe minimum of ${floor} kcal/day. Eating below this without medical supervision is not recommended.`;
  }

  return {
    valid: true,
    targetCalories: Math.round(target),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    clamped,
    floor,
    note,
  };
}

/** Backward-compatible wrapper: returns just the calorie number. */
export function calculateDailyTarget(prof: unknown): number {
  return calculateDailyTargetDetailed(prof).targetCalories;
}

export function getProfileCompletion(prof: UserProfile | null | undefined): { percentage: number; missing: string[] } {
  let score = 0;
  const missing: string[] = [];

  if (prof?.primaryGoal) score += 10;
  else missing.push("Primary Goal");

  if (prof?.age) score += 10;
  else missing.push("Age");

  if (prof?.sex) score += 10;
  else missing.push("Gender");

  if (prof?.heightCm) score += 15;
  else missing.push("Height");

  if (prof?.weightKg) score += 15;
  else missing.push("Current Weight");

  if (prof?.activityLevel) score += 15;
  else missing.push("Activity Level");

  if (prof?.targetWeightKg) score += 15;
  else missing.push("Target Weight");

  if (prof?.healthConditions) score += 5;
  else missing.push("Health Conditions");

  if (prof?.preferences) score += 5;
  else missing.push("Preferences");

  return { percentage: score, missing };
}
