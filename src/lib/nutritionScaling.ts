/**
 * Canonical nutrition and portion scaling logic for MboaFit.
 * Provides unified calculations for displayed and saved nutrients,
 * safe gram parsing, and bidirectional serving <-> gram conversions.
 */

export interface BaseNutrientSource {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  servingSizeText?: string;
}

export type PortionPreset = 'Small' | 'Medium' | 'Large' | 'Double' | 'Custom';

/**
 * Parses explicit gram serving labels safely.
 * Returns positive finite gram weight, or null if no reliable gram weight exists.
 * Never invents grams for items without gram indicators.
 */
export function parseServingGrams(servingText?: string | null): number | null {
  if (!servingText || typeof servingText !== 'string') return null;
  const trimmed = servingText.trim();
  if (!trimmed) return null;

  // 1. Look for grams inside parentheses, e.g. "1 bowl (300g)", "1 plate (150g puff puff + 100g beans)"
  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1];
    // Match all instances of <number>g inside parentheses
    const gramMatches = [...inside.matchAll(/(\d+(?:\.\d+)?)\s*g\b/gi)];
    if (gramMatches.length > 0) {
      const sum = gramMatches.reduce((acc, m) => acc + parseFloat(m[1]), 0);
      if (Number.isFinite(sum) && sum > 0) {
        return Math.round(sum);
      }
    }
  }

  // 2. Look for direct gram descriptions, e.g. "100g", "100g cooked", "250 g dried"
  const directMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*g\b/i);
  if (directMatch) {
    const val = parseFloat(directMatch[1]);
    if (Number.isFinite(val) && val > 0) {
      return Math.round(val);
    }
  }

  // No reliable gram specification found (e.g. "1 piece", "1 bottle (330ml)", "1 cup")
  return null;
}

/**
 * Validates whether a serving multiplier is positive and finite.
 */
export function isValidServingMultiplier(val: any): boolean {
  return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

/**
 * Determines the canonical multiplier based on portion preset or custom inputs.
 */
export function getEffectiveMultiplier(
  preset: PortionPreset,
  customInput: string | number,
  baseGrams?: number | null,
  customMode: 'servings' | 'grams' = 'servings'
): number | null {
  if (preset === 'Small') return 0.5;
  if (preset === 'Medium') return 1.0;
  if (preset === 'Large') return 1.5;
  if (preset === 'Double') return 2.0;

  // Custom preset: parse customInput
  if (customMode === 'grams') {
    if (!baseGrams || baseGrams <= 0) return null;
    const grams = typeof customInput === 'number' ? customInput : parseFloat(customInput);
    if (!Number.isFinite(grams) || grams <= 0) return null;
    return grams / baseGrams;
  }

  const srv = typeof customInput === 'number' ? customInput : parseFloat(customInput);
  if (!Number.isFinite(srv) || srv <= 0) return null;
  return srv;
}

/**
 * Formats a scaled serving description matching the multiplier.
 * Scales grams if reliable base grams exist.
 * Never invents grams if baseGrams is null.
 */
export function formatServingDescription(
  baseText: string = '1 serving',
  multiplier: number,
  baseGrams?: number | null
): string {
  if (!isValidServingMultiplier(multiplier)) return baseText;

  const b = baseText.trim();
  const scaledGrams = baseGrams && baseGrams > 0 ? Math.round(baseGrams * multiplier) : null;

  // Format the fractional/decimal prefix
  const formatFraction = (m: number) => {
    if (m === 0.5) return '½';
    if (m === 1.5) return '1½';
    if (m === 2.0) return '2';
    // Format to max 2 decimal places without trailing zeroes
    return parseFloat(m.toFixed(2)).toString();
  };

  // If we have explicit grams inside parentheses
  if (scaledGrams !== null && /\([^)]*g[^)]*\)/i.test(b)) {
    // Replace the parenthesis with the scaled grams
    const withoutParen = b.replace(/\s*\([^)]*g[^)]*\)/i, '').trim();
    // Parse leading count from withoutParen
    const match = withoutParen.match(/^([\d./]+)\s*(.*)/);
    if (match) {
      const baseNum = parseFloat(match[1]) || 1;
      const unit = match[2] || 'serving';
      const finalCount = baseNum * multiplier;
      const formattedCount = formatFraction(finalCount);
      let pluralUnit = unit;
      if (finalCount > 1 && !unit.endsWith('s')) pluralUnit = `${unit}s`;
      if (finalCount <= 1 && unit.endsWith('s') && !unit.endsWith('ss')) pluralUnit = unit.slice(0, -1);
      return `${formattedCount} ${pluralUnit} (${scaledGrams}g)`.trim();
    }
    return `${withoutParen} (${scaledGrams}g)`.trim();
  }

  // If the base text is pure grams, e.g. "100g" or "100g cooked"
  if (scaledGrams !== null && /^\d+(?:\.\d+)?\s*g\b/i.test(b)) {
    const suffix = b.replace(/^\d+(?:\.\d+)?\s*g\b/i, '').trim();
    return suffix ? `${scaledGrams}g ${suffix}` : `${scaledGrams}g`;
  }

  // If no grams exist, format the unit cleanly without inventing grams
  const match = b.match(/^([\d./]+)\s*(.*)/);
  if (match) {
    const baseNum = parseFloat(match[1]) || 1;
    let unit = match[2] || 'serving';
    const finalCount = baseNum * multiplier;
    const formattedCount = formatFraction(finalCount);
    let pluralUnit = unit;
    if (finalCount > 1 && !unit.endsWith('s') && unit !== 'ml' && unit !== 'L') pluralUnit = `${unit}s`;
    if (finalCount <= 1 && unit.endsWith('s') && !unit.endsWith('ss')) pluralUnit = unit.slice(0, -1);
    return `${formattedCount} ${pluralUnit}`.trim();
  }

  return `${formatFraction(multiplier)} ${b}`;
}

/**
 * Calculates scaled nutrition from a base source and a validated multiplier.
 * Displayed and saved values use this identical canonical function.
 */
export function calculateScaledNutrients(
  base: BaseNutrientSource,
  multiplier: number
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  return {
    calories: Math.round(base.calories * multiplier),
    protein: Math.round((base.protein || 0) * multiplier * 10) / 10,
    carbs: Math.round((base.carbs || 0) * multiplier * 10) / 10,
    fat: Math.round((base.fat || 0) * multiplier * 10) / 10
  };
}
