/**
 * Conservative, evidence-based reference values used by MboaFit's coaching
 * features. Grounded in NIH, NIDDK and Harvard T.H. Chan guidance
 * (safe pace 0.5–1 kg/week; deficit 500–750 kcal/day; protein 1.2–2 g/kg/day;
 * minimum intakes 1200/1500 kcal/day for women/men).
 *
 * These are informational coaching inputs, NOT medical advice. The app must
 * always show COACHING_DISCLAIMER alongside insights derived from them.
 */

/** Safe pace of weight loss in kg per week. */
export const SAFE_WEEKLY_LOSS_KG = { min: 0.25, max: 1.0 } as const;

/** Conservative daily calorie deficit range (kcal) for weight loss. */
export const SAFE_DEFICIT_KCAL_PER_DAY = { min: 250, max: 750 } as const;

/**
 * Protein to protect muscle during weight loss (g per kg body weight / day).
 * Evidence supports 1.2–2.0; we target the middle (1.6) as a conservative default.
 */
export const PROTEIN_G_PER_KG = { min: 1.2, target: 1.6, max: 2.0 } as const;

/** Minimum daily calories — informational floor, not a prescription. */
export const MIN_DAILY_CALORIES = { female: 1200, male: 1500, other: 1500 } as const;

/** A "stall" = this many weeks of weight entries with < STALL_KG_THRESHOLD change. */
export const STALL_WEEKS = 2;
export const STALL_KG_THRESHOLD = 0.25;

/** Logging consistency window: days with at least one logged meal in the last N days. */
export const ADHERENCE_WINDOW_DAYS = 7;

/** Calorie adherence band: within ±10% of target counts as "on target". */
export const ADHERENCE_BAND = 0.10;

export const COACHING_DISCLAIMER =
  'MboaFit insights are informational coaching based on your logged data, not medical advice. ' +
  'Talk to a doctor or registered dietitian before making big changes to how you eat.';
