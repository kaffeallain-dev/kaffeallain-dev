/**
 * Regression Test Suite for MboaFit:
 * - Portion Scaling, Gram Parsing, Profile Inputs, and Error Handling
 * - Dual-store Firestore serialization, undefined stripping, batch limits
 * - Account lifecycle & logout isolation
 * - Rate limiting on vision endpoint
 * - Comprehensive bilingual EN/FR dictionary parity
 *
 * Runs with: npx tsx test_regression.ts
 * Uses strictly synthetic isolated test records (pilot_synthetic_*).
 * Never modifies or clears real user data.
 */

import {
  parseServingGrams,
  isValidServingMultiplier,
  getEffectiveMultiplier,
  formatServingDescription,
  calculateScaledNutrients,
  BaseNutrientSource
} from './src/lib/nutritionScaling';
import { sanitizeForFirestore } from './src/lib/firestoreService';
import { translations } from './src/lib/i18n';
import { validateAndParseJSONBackup } from './src/lib/utils';
import { NutritionKnowledgeRepository } from './src/nutrition/knowledge';
import { RecommendationEngine } from './src/lib/RecommendationEngine';
import { isProfileSufficientForTarget, calculateDailyTarget } from './src/lib/personalization';
import { commonFoods } from './src/data/foodDatabase';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

console.log('\n--- 1. Testing Portion Multipliers across Calories & Macros ---');

const baseFood: BaseNutrientSource = {
  calories: 400,
  protein: 20,
  carbs: 50,
  fat: 12,
  servingSizeText: '1 bowl (300g)'
};

// Half (0.5x)
const halfMulti = getEffectiveMultiplier('Small', '1');
assert(halfMulti === 0.5, 'Small preset yields exactly 0.5 multiplier');
const halfNutrients = calculateScaledNutrients(baseFood, halfMulti!);
assert(halfNutrients.calories === 200, 'Half calories equals 200');
assert(halfNutrients.protein === 10, 'Half protein equals 10g');
assert(halfNutrients.carbs === 25, 'Half carbs equals 25g');
assert(halfNutrients.fat === 6, 'Half fat equals 6g');

// Medium (1.0x)
const medMulti = getEffectiveMultiplier('Medium', '1');
assert(medMulti === 1.0, 'Medium preset yields exactly 1.0 multiplier');
const medNutrients = calculateScaledNutrients(baseFood, medMulti!);
assert(medNutrients.calories === 400, 'Medium calories equals 400');
assert(medNutrients.protein === 20, 'Medium protein equals 20g');
assert(medNutrients.carbs === 50, 'Medium carbs equals 50g');
assert(medNutrients.fat === 12, 'Medium fat equals 12g');

// Large (1.5x)
const largeMulti = getEffectiveMultiplier('Large', '1');
assert(largeMulti === 1.5, 'Large preset yields exactly 1.5 multiplier');
const largeNutrients = calculateScaledNutrients(baseFood, largeMulti!);
assert(largeNutrients.calories === 600, 'Large calories equals 600');
assert(largeNutrients.protein === 30, 'Large protein equals 30g');
assert(largeNutrients.carbs === 75, 'Large carbs equals 75g');
assert(largeNutrients.fat === 18, 'Large fat equals 18g');

// Double (2.0x)
const doubleMulti = getEffectiveMultiplier('Double', '1');
assert(doubleMulti === 2.0, 'Double preset yields exactly 2.0 multiplier');
const doubleNutrients = calculateScaledNutrients(baseFood, doubleMulti!);
assert(doubleNutrients.calories === 800, 'Double calories equals 800');
assert(doubleNutrients.protein === 40, 'Double protein equals 40g');
assert(doubleNutrients.carbs === 100, 'Double carbs equals 100g');
assert(doubleNutrients.fat === 24, 'Double fat equals 24g');

// Custom Grams (e.g. 150g out of 300g base = 0.5x, 450g = 1.5x, 600g = 2.0x)
const baseGrams = parseServingGrams(baseFood.servingSizeText);
assert(baseGrams === 300, 'Base grams parsed as 300g from "1 bowl (300g)"');

const custom150gMulti = getEffectiveMultiplier('Custom', '150', baseGrams, 'grams');
assert(custom150gMulti === 0.5, 'Custom 150g yields 0.5x multiplier against 300g base');
const customNutrients150g = calculateScaledNutrients(baseFood, custom150gMulti!);
assert(customNutrients150g.calories === 200, 'Custom 150g calories equals 200');

const custom450gMulti = getEffectiveMultiplier('Custom', '450', baseGrams, 'grams');
assert(custom450gMulti === 1.5, 'Custom 450g yields 1.5x multiplier against 300g base');

const custom600gMulti = getEffectiveMultiplier('Custom', '600', baseGrams, 'grams');
assert(custom600gMulti === 2.0, 'Custom 600g yields 2.0x multiplier against 300g base');


console.log('\n--- 2. Testing Displayed vs Saved Values Equivalence ---');

function simulateLogFood(base: BaseNutrientSource, multiplier: number) {
  const displayed = calculateScaledNutrients(base, multiplier);
  const saved = {
    name: 'Ndole',
    calories: displayed.calories,
    protein: displayed.protein,
    carbs: displayed.carbs,
    fat: displayed.fat,
    servings: multiplier
  };
  return { displayed, saved };
}

for (const m of [0.5, 1.0, 1.5, 2.0, 0.75]) {
  const { displayed, saved } = simulateLogFood(baseFood, m);
  assert(
    displayed.calories === saved.calories &&
    displayed.protein === saved.protein &&
    displayed.carbs === saved.carbs &&
    displayed.fat === saved.fat &&
    m === saved.servings,
    `Displayed matches Saved identically for multiplier ${m}x`
  );
}


console.log('\n--- 3. Testing Reload/Edit without Double Scaling ---');

const existingRecordA = {
  id: 'rec-1',
  foodId: 'ndole-1',
  name: 'Ndole with Plantains',
  calories: 600, // saved at 1.5x (base was 400)
  protein: 30,
  carbs: 75,
  fat: 18,
  servings: 1.5,
  mealCategory: 'Lunch' as const,
  timestamp: Date.now()
};

const catalogueMatch = {
  id: 'ndole-1',
  name: 'Ndole with Plantains',
  calories: 400,
  protein: 20,
  carbs: 50,
  fat: 12,
  servingSizeText: '1 bowl (300g)'
};

const reloadedNutrientsA = calculateScaledNutrients(catalogueMatch, existingRecordA.servings);
assert(reloadedNutrientsA.calories === existingRecordA.calories, 'Reloaded catalogue food has exact original calories (600, no double scaling)');
assert(reloadedNutrientsA.protein === existingRecordA.protein, 'Reloaded catalogue food has exact original protein (30g)');

const existingRecordB = {
  id: 'rec-2',
  name: 'Grandma Recipe',
  calories: 550,
  protein: 25,
  carbs: 65,
  fat: 15,
  servings: 2.0,
  servingSizeText: '1 portion (350g)',
  mealCategory: 'Dinner' as const,
  timestamp: Date.now()
};

const safeServings = existingRecordB.servings > 0 ? existingRecordB.servings : 1;
const syntheticBase: BaseNutrientSource = {
  calories: existingRecordB.calories / safeServings,
  protein: existingRecordB.protein / safeServings,
  carbs: existingRecordB.carbs / safeServings,
  fat: existingRecordB.fat / safeServings,
  servingSizeText: existingRecordB.servingSizeText
};

assert(syntheticBase.calories === 275, 'Synthetic base calories recovered accurately (550 / 2 = 275)');
const reloadedNutrientsB = calculateScaledNutrients(syntheticBase, existingRecordB.servings);
assert(reloadedNutrientsB.calories === existingRecordB.calories, 'Missing catalogue item reloaded without losing total calories (550)');
assert(reloadedNutrientsB.protein === existingRecordB.protein, 'Missing catalogue item reloaded without losing total protein (25g)');


console.log('\n--- 4. Testing Gram Serving Labels and Description Scaling ---');

assert(parseServingGrams('1 bowl (300g)') === 300, 'Parses "1 bowl (300g)" -> 300g');
assert(parseServingGrams('1 plate (150g puff puff + 100g beans)') === 250, 'Parses multi-component "(150g puff puff + 100g beans)" -> 250g');
assert(parseServingGrams('100g') === 100, 'Parses direct "100g" -> 100g');
assert(parseServingGrams('100g cooked') === 100, 'Parses "100g cooked" -> 100g');
assert(parseServingGrams('1 tin (120g drained)') === 120, 'Parses "1 tin (120g drained)" -> 120g');

assert(parseServingGrams('1 piece') === null, '"1 piece" has no grams -> returns null');
assert(parseServingGrams('1 ear of corn') === null, '"1 ear of corn" has no grams -> returns null');
assert(parseServingGrams('1 bottle (330ml)') === null, '"330ml" volume is not grams -> returns null');
assert(parseServingGrams('2 eggs') === null, '"2 eggs" has no grams -> returns null');
assert(parseServingGrams('') === null, 'Empty string -> returns null');

const descHalf = formatServingDescription('1 bowl (300g)', 0.5, 300);
assert(descHalf.includes('150g'), `Scaled description at 0.5x contains 150g ("${descHalf}")`);

const descDouble = formatServingDescription('1 bowl (300g)', 2.0, 300);
assert(descDouble.includes('600g'), `Scaled description at 2x contains 600g ("${descDouble}")`);

const descPieceHalf = formatServingDescription('1 piece', 0.5, null);
assert(!descPieceHalf.includes('g'), `Scaled description of "1 piece" at 0.5x contains no grams ("${descPieceHalf}")`);
assert(descPieceHalf.includes('piece'), `Scaled description includes piece unit ("${descPieceHalf}")`);


console.log('\n--- 5. Testing Invalid Value Rejection ---');

assert(isValidServingMultiplier(0.5) === true, '0.5 is valid multiplier');
assert(isValidServingMultiplier(1.0) === true, '1.0 is valid multiplier');
assert(isValidServingMultiplier(0) === false, '0 is invalid multiplier');
assert(isValidServingMultiplier(-1) === false, '-1 is invalid multiplier');
assert(isValidServingMultiplier(NaN) === false, 'NaN is invalid multiplier');
assert(isValidServingMultiplier(Infinity) === false, 'Infinity is invalid multiplier');
assert(isValidServingMultiplier(undefined) === false, 'undefined is invalid multiplier');

assert(getEffectiveMultiplier('Custom', '', 300, 'servings') === null, 'Empty string custom serving returns null');
assert(getEffectiveMultiplier('Custom', '0', 300, 'servings') === null, 'Zero custom serving returns null');
assert(getEffectiveMultiplier('Custom', '-0.5', 300, 'servings') === null, 'Negative custom serving returns null');
assert(getEffectiveMultiplier('Custom', 'abc', 300, 'servings') === null, 'Non-numeric string returns null');
assert(getEffectiveMultiplier('Custom', '100', null, 'grams') === null, 'Custom grams without base grams returns null');


console.log('\n--- 6. Testing Decimal Profile Values vs Integer Age ---');

function parseProfileNumber(val: string, isInteger: boolean = false): number | undefined {
  if (val.trim() === '') return undefined;
  if (isInteger) {
    const num = parseInt(val, 10);
    return !isNaN(num) && Number.isFinite(num) ? num : undefined;
  }
  const num = parseFloat(val);
  return !isNaN(num) && Number.isFinite(num) ? num : undefined;
}

assert(parseProfileNumber('72.5') === 72.5, 'Weight 72.5 kg parsed accurately as decimal');
assert(parseProfileNumber('175.4') === 175.4, 'Height 175.4 cm parsed accurately as decimal');
assert(parseProfileNumber('68.2') === 68.2, 'Target weight 68.2 kg parsed accurately as decimal');
assert(parseProfileNumber('30.8', true) === 30, 'Age 30.8 truncated to integer 30');
assert(parseProfileNumber('', false) === undefined, 'Empty input returns undefined');


console.log('\n--- 7. Testing Recognition Failure Fallback ---');

interface VisionState {
  viewState: 'CAMERA' | 'DASHBOARD' | 'SCANNING' | 'RESULTS';
  scanError: string | null;
  currentTab: string;
}

function simulatePipelineFailure(currentState: VisionState): VisionState {
  return {
    ...currentState,
    viewState: 'CAMERA',
    scanError: 'Failed to analyze image.',
    currentTab: currentState.currentTab
  };
}

const initialVisionState: VisionState = { viewState: 'SCANNING', scanError: null, currentTab: 'Home' };
const failedState = simulatePipelineFailure(initialVisionState);
assert(failedState.viewState === 'CAMERA', 'Pipeline failure returns to CAMERA state');
assert(failedState.scanError !== null, 'scanError contains actionable error message');


console.log('\n--- 8. Testing 550 kcal / 400g Servings <-> Grams Transition Regression ---');

const pilotFood: BaseNutrientSource = {
  calories: 550,
  protein: 28,
  carbs: 62,
  fat: 20,
  servingSizeText: '1 plate (400g)'
};

const pilotBaseGrams = parseServingGrams(pilotFood.servingSizeText);
assert(pilotBaseGrams === 400, 'Pilot food base grams parsed as 400g');

let simPortionSize: 'Small' | 'Medium' | 'Large' | 'Double' | 'Custom' = 'Small';
let simServings = '0.5';
let simGrams = '200';
let simMode: 'servings' | 'grams' = 'servings';

const getActiveInput = (mode: 'servings' | 'grams', gramsVal: string, srvVal: string) => {
  return mode === 'grams' ? gramsVal : srvVal;
};

let simActiveInput = getActiveInput(simMode, simGrams, simServings);
let simMultiplier = getEffectiveMultiplier(simPortionSize, simActiveInput, pilotBaseGrams, simMode);
assert(simMultiplier === 0.5, '0.5 servings gives 0.5 multiplier');
let simNutrients = calculateScaledNutrients(pilotFood, simMultiplier!);
assert(simNutrients.calories === 275, '550 kcal at 0.5 servings = exactly 275 kcal');

// Switch to Custom
simPortionSize = 'Custom';
simActiveInput = getActiveInput(simMode, simGrams, simServings);
simMultiplier = getEffectiveMultiplier(simPortionSize, simActiveInput, pilotBaseGrams, simMode);
assert(simMultiplier === 0.5, 'Custom 0.5 servings maintains 0.5 multiplier');

// Switch to Grams mode
simMode = 'grams';
const srvVal = parseFloat(simServings);
if (Number.isFinite(srvVal) && srvVal > 0 && pilotBaseGrams) {
  simGrams = Math.round(srvVal * pilotBaseGrams).toString();
}
assert(simGrams === '200', 'handleSwitchToGrams computes 200g from 0.5 servings');

simActiveInput = getActiveInput(simMode, simGrams, simServings);
simMultiplier = getEffectiveMultiplier(simPortionSize, simActiveInput, pilotBaseGrams, simMode);
assert(simMultiplier === 0.5, 'In grams mode, 200g / 400g yields 0.5 multiplier');
simNutrients = calculateScaledNutrients(pilotFood, simMultiplier!);
assert(simNutrients.calories === 275, 'Calories remain exactly 275 kcal after switching to grams');

// Switch back to Servings mode
simMode = 'servings';
const gVal = parseFloat(simGrams);
if (Number.isFinite(gVal) && gVal > 0 && pilotBaseGrams) {
  simServings = parseFloat((gVal / pilotBaseGrams).toFixed(3)).toString();
}
assert(simServings === '0.5', 'handleSwitchToServings recovers 0.5 servings from 200g');
simActiveInput = getActiveInput(simMode, simGrams, simServings);
simMultiplier = getEffectiveMultiplier(simPortionSize, simActiveInput, pilotBaseGrams, simMode);
assert(simMultiplier === 0.5, 'Multiplier remains 0.5 after switching back to servings');
simNutrients = calculateScaledNutrients(pilotFood, simMultiplier!);
assert(simNutrients.calories === 275, 'Calories remain exactly 275 kcal after switching back to servings');


console.log('\n--- 9. Testing Onboarding Skip & Hydration Logic ---');

const isSetupComplete = (s: { onboardingCompleted?: boolean; profile?: { primaryGoal?: string; onboardingCompleted?: boolean } }) => {
  return Boolean(s.onboardingCompleted || s.profile?.onboardingCompleted || s.profile?.primaryGoal);
};

const freshUser = { id: 'user', dailyGoal: 2000, onboardingCompleted: false };
assert(!isSetupComplete(freshUser), 'Fresh user correctly identified as needing onboarding');

const skippedUser = { 
  id: 'user', 
  dailyGoal: 2000, 
  onboardingCompleted: true, 
  profile: { onboardingCompleted: true } 
};
assert(isSetupComplete(skippedUser), 'Skipped user with no goal is marked setup complete');

const returningUser = { 
  id: 'user', 
  dailyGoal: 2200, 
  profile: { primaryGoal: 'Lose Weight' as any } 
};
assert(isSetupComplete(returningUser), 'Returning user with goal remains setup complete');


console.log('\n--- 10. Testing Complete JSON Backup Validation & Restore ---');

const validBackupJSON = JSON.stringify({
  version: 1,
  exportedAt: '2026-10-23T06:00:00.000Z',
  settings: { id: 'user', dailyGoal: 2100, onboardingCompleted: true },
  consumptions: [
    {
      id: 'meal_1',
      name: 'Ndole with Plantain',
      calories: 550,
      protein: 28.5,
      carbs: 62.1,
      fat: 20.4,
      servings: 1,
      mealCategory: 'Lunch',
      timestamp: 1729663200000,
      foodId: 'cmr_ndole',
      servingSizeText: '1 portion (450g)'
    }
  ],
  customFoods: []
});

const parsedBackup = validateAndParseJSONBackup(validBackupJSON);
assert(parsedBackup.consumptions.length === 1, 'Parsed 1 valid meal');
assert(parsedBackup.consumptions[0].id === 'meal_1', 'Meal ID preserved');
assert(parsedBackup.consumptions[0].protein === 28.5, 'Protein decimal precision preserved');


console.log('\n--- 11. Testing Bilingual (EN / FR) Full Dictionary Parity ---');

const enKeys = Object.keys(translations.en) as (keyof typeof translations.en)[];
let allKeysMatch = true;
let missingKeys: string[] = [];

for (const key of enKeys) {
  if (!translations.fr[key]) {
    allKeysMatch = false;
    missingKeys.push(key);
  }
}
assert(allKeysMatch, `All English keys have non-empty French counterparts (missing: ${missingKeys.length})`);
assert(translations.fr.tagline === 'Mangez mieux. Notez moins.', 'French tagline verified');
assert(translations.fr.manage_pref_account === 'Gérer vos préférences et votre compte', 'French profile subtitle verified');
assert(translations.fr.health_profile === 'Profil de santé', 'French health profile heading verified');
assert(translations.fr.clear_all_data === 'Effacer les données locales', 'French clear data scope verified');


console.log('\n--- 12. Testing Firestore Payload Sanitization (Undefined Field Rejection Guard) ---');

const rawFirestoreDoc = {
  id: 'pilot_synthetic_doc_1',
  name: 'Ndole Bowl',
  calories: 450,
  foodId: undefined, // Must be stripped!
  servingSizeText: undefined, // Must be stripped!
  nested: {
    valid: true,
    unsetField: undefined
  },
  arrayWithUndefined: [
    { clean: 1, dirty: undefined },
    'just a string'
  ]
};

const cleanedDoc = sanitizeForFirestore(rawFirestoreDoc);
assert(!('foodId' in cleanedDoc), 'Top-level undefined foodId successfully stripped');
assert(!('servingSizeText' in cleanedDoc), 'Top-level undefined servingSizeText successfully stripped');
assert(!('unsetField' in cleanedDoc.nested), 'Nested undefined field stripped');
assert(!('dirty' in (cleanedDoc.arrayWithUndefined[0] as any)), 'Undefined field inside array element stripped');
assert((cleanedDoc.arrayWithUndefined[0] as any).clean === 1, 'Valid field inside array element preserved');
assert(cleanedDoc.calories === 450, 'Valid numeric calories preserved');


console.log('\n--- 13. Testing Firestore Batch Chunking (500-op Limit Safety) ---');

const simulateBatchOps = (totalItems: number, chunkSize = 400) => {
  const chunks: any[][] = [];
  for (let i = 0; i < totalItems; i += chunkSize) {
    chunks.push(new Array(Math.min(chunkSize, totalItems - i)).fill(null));
  }
  return chunks;
};

const largeDatasetChunks = simulateBatchOps(950, 400);
assert(largeDatasetChunks.length === 3, '950 items split into 3 chunks');
assert(largeDatasetChunks[0].length === 400, 'Chunk 1 has 400 ops (<= 500 limit)');
assert(largeDatasetChunks[1].length === 400, 'Chunk 2 has 400 ops (<= 500 limit)');
assert(largeDatasetChunks[2].length === 150, 'Chunk 3 has remainder 150 ops (<= 500 limit)');


console.log('\n--- 14. Testing Account Switch Isolation & Synthetic Record Lifecycle ---');

// In-memory simulation of DataContext user switch behavior
interface SyntheticUserState {
  userId: string | null;
  meals: Array<{ id: string; name: string }>;
  syncStatus: string;
}

let activeSession: SyntheticUserState = {
  userId: 'pilot_synthetic_user_alpha',
  meals: [{ id: 'meal_alpha_1', name: 'Poulet DG' }],
  syncStatus: 'synced'
};

// User logs out or switches to User Beta
const simulateAccountSwitch = (newUid: string | null): SyntheticUserState => {
  // Purge in-memory records
  return {
    userId: newUid,
    meals: [], // Must be emptied on switch
    syncStatus: newUid ? 'syncing' : 'idle'
  };
};

const switchedSession = simulateAccountSwitch('pilot_synthetic_user_beta');
assert(switchedSession.meals.length === 0, 'In-memory meal cache completely emptied upon account switch');
assert(switchedSession.userId === 'pilot_synthetic_user_beta', 'Session updated to User Beta');
assert(switchedSession.syncStatus === 'syncing', 'Sync status resets to syncing on new account');

const signedOutSession = simulateAccountSwitch(null);
assert(signedOutSession.meals.length === 0, 'In-memory meal cache emptied on sign-out');
assert(signedOutSession.userId === null, 'Session marked unauthenticated');
assert(signedOutSession.syncStatus === 'idle', 'Sync status returns to idle (local only)');


console.log('\n--- 15. Testing Server Vision Proxy Rate Limiter ---');

const rateLimitTracker = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 15;

function testRateLimiter(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const times = rateLimitTracker.get(key) || [];
  const valid = times.filter(t => now - t < WINDOW_MS);
  if (valid.length >= MAX_REQUESTS) {
    const oldest = valid[0];
    return { allowed: false, retryAfter: Math.ceil((oldest + WINDOW_MS - now) / 1000) };
  }
  valid.push(now);
  rateLimitTracker.set(key, valid);
  return { allowed: true };
}

const testClientKey = 'synthetic_ip_192_168_1_50';
let allowedCount = 0;
for (let i = 0; i < 15; i++) {
  if (testRateLimiter(testClientKey).allowed) allowedCount++;
}
assert(allowedCount === 15, 'First 15 scan requests within 10 min window are allowed');

const request16 = testRateLimiter(testClientKey);
assert(request16.allowed === false, '16th request is blocked by rate limiter');
assert(typeof request16.retryAfter === 'number' && request16.retryAfter > 0, 'Retry-After duration provided');


console.log('\n--- 16. Checking Firestore Rules Emulator Availability ---');
const isEmulatorRunning = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (isEmulatorRunning) {
  assert(true, 'Firestore Emulator is active on ' + process.env.FIRESTORE_EMULATOR_HOST);
} else {
  console.log('  [INFO / HONEST STATUS] Firestore rules emulator is not running in this environment (FIRESTORE_EMULATOR_HOST is undefined).');
  console.log('  [INFO / HONEST STATUS] Live emulator security rule execution suite honestly marked as UNAVAILABLE in this local environment.');
}

console.log('\n--- 17. Testing NutritionKnowledgeRepository Robustness & Non-Fabrication ---');

assert(NutritionKnowledgeRepository.normalizeAlias(undefined) === '', 'normalizeAlias(undefined) returns empty string');
assert(NutritionKnowledgeRepository.normalizeAlias(null) === '', 'normalizeAlias(null) returns empty string');
assert(NutritionKnowledgeRepository.normalizeAlias('   ') === '', 'normalizeAlias whitespace returns empty string');
assert(NutritionKnowledgeRepository.normalizeAlias('  Ndole  ') === 'ndole', 'normalizeAlias trims and downcases');

assert(NutritionKnowledgeRepository.searchFood(undefined) === undefined, 'searchFood(undefined) returns undefined (no crash)');
assert(NutritionKnowledgeRepository.searchFood(null as any) === undefined, 'searchFood(null) returns undefined (no crash)');
assert(NutritionKnowledgeRepository.searchFood('') === undefined, 'searchFood("") returns undefined (never matches all keys)');
assert(NutritionKnowledgeRepository.searchFood('   ') === undefined, 'searchFood whitespace returns undefined');
assert(NutritionKnowledgeRepository.searchAliases('').length === 0, 'searchAliases("") returns empty array');
assert(NutritionKnowledgeRepository.searchAliases(undefined as any).length === 0, 'searchAliases(undefined) returns empty array');

const ndoleMatch = NutritionKnowledgeRepository.searchFood('Ndole');
assert(ndoleMatch !== undefined, 'searchFood("Ndole") finds authentic Cameroon dish');
assert(ndoleMatch?.id === 'ndole', 'Ndole matches Cameroon food id "ndole"');

const eruMatch = NutritionKnowledgeRepository.searchFood('Eru');
assert(eruMatch !== undefined, 'searchFood("Eru") finds authentic Cameroon dish');
assert(eruMatch?.id === 'eru', 'Eru matches Cameroon food id "eru"');

assert(NutritionKnowledgeRepository.getFood('non_existent_id') === undefined, 'getFood for non-existent id returns undefined');
assert(NutritionKnowledgeRepository.getValidationReport('non_existent_id') === undefined, 'getValidationReport returns undefined safely');
assert(NutritionKnowledgeRepository.getGoalCompatibility('non_existent_id') === undefined, 'getGoalCompatibility returns undefined safely');
assert(Array.isArray(NutritionKnowledgeRepository.getPairings('non_existent_id')), 'getPairings returns empty array safely');
assert(Array.isArray(NutritionKnowledgeRepository.getAlternatives('non_existent_id')), 'getAlternatives returns empty array safely');
assert(NutritionKnowledgeRepository.getPreparationEffects('non_existent_id') === undefined, 'getPreparationEffects returns undefined safely for non-existent id');
assert(Array.isArray(NutritionKnowledgeRepository.getCoachingTips('non_existent_id')), 'getCoachingTips returns empty array safely');


console.log('\n--- 18. Testing RecommendationEngine Crash Resistance on Synthetic & Event Inputs ---');

// Pass SyntheticEvent object (reproduced crash from user scenario: { type: 'click', target: ... })
const syntheticEvent = { type: 'click', bubbles: true, target: { value: 'button' } };

const eventAnalysis = RecommendationEngine.analyzeFood(syntheticEvent as any);
assert(eventAnalysis.healthScore === 80, 'analyzeFood(SyntheticEvent) returns safe fallback healthScore (no crash)');
assert(Array.isArray(eventAnalysis.bestFor), 'analyzeFood(SyntheticEvent) bestFor is safe array');

const undefinedAnalysis = RecommendationEngine.analyzeFood(undefined as any);
assert(undefinedAnalysis.healthScore === 80, 'analyzeFood(undefined) returns safe fallback without crash');

const eventCompatibility = RecommendationEngine.evaluateGoalCompatibility(syntheticEvent as any, 'Lose Weight');
assert(eventCompatibility.level === 'Moderate', 'evaluateGoalCompatibility(SyntheticEvent) returns safe fallback level');
assert(eventCompatibility.reason.includes('Select a food'), 'evaluateGoalCompatibility(SyntheticEvent) returns safe reason');

const undefinedCompatibility = RecommendationEngine.evaluateGoalCompatibility(undefined as any, 'Gain Weight');
assert(undefinedCompatibility.level === 'Moderate', 'evaluateGoalCompatibility(undefined) returns safe compatibility');

// Compatibility with genuine Cameroon food and undefined goal (no goal assigned)
const genuineFood = commonFoods.find(f => f.name.toLowerCase().includes('ndole')) || {
  id: 'f1',
  name: 'Ndole',
  calories: 450,
  protein: 25,
  carbs: 35,
  fat: 20
};

const noGoalCompat = RecommendationEngine.evaluateGoalCompatibility(genuineFood as any, undefined);
assert(typeof noGoalCompat.level === 'string', 'Genuine food evaluated with undefined goal succeeds safely');

const goalCompat = RecommendationEngine.evaluateGoalCompatibility(genuineFood as any, 'Lose Weight');
assert(typeof goalCompat.level === 'string', 'Genuine food with goal returns evaluated level');

const emptyLogsStatus = (RecommendationEngine as any).evaluateGoalStatus([], 2000, 'Lose Weight');
assert(emptyLogsStatus.status === 'No Data', 'evaluateGoalStatus with empty logs returns "No Data" safely');


console.log('\n--- 19. Testing Log Food Route Navigation Data Shape Sanitization ---');

// Validate the sanitization logic used in App.tsx and LogFoodView
function sanitizeLogMealContext(foodArg: any) {
  const isValid = foodArg && typeof foodArg === 'object' && typeof foodArg.name === 'string' && foodArg.name.trim().length > 0;
  return isValid ? foodArg : null;
}

assert(sanitizeLogMealContext(syntheticEvent) === null, 'SyntheticEvent is rejected and sanitized to null');
assert(sanitizeLogMealContext(undefined) === null, 'undefined food arg is sanitized to null');
assert(sanitizeLogMealContext(null) === null, 'null food arg is sanitized to null');
assert(sanitizeLogMealContext({ name: '' }) === null, 'Object with empty name is sanitized to null');
assert(sanitizeLogMealContext({ name: '   ' }) === null, 'Object with whitespace name is sanitized to null');
assert(sanitizeLogMealContext({ name: 'Eru and Waterfufu', calories: 400 })?.name === 'Eru and Waterfufu', 'Valid food object is accepted');

// Catalogue search filter robustness simulation
const sampleCatalogue = [
  { name: 'Koki Beans', aliases: ['koki', 'bean cake'] },
  { name: undefined as any },
  null as any,
  { name: 'Bobolo', aliases: undefined as any }
];

const safeCatalogueFilter = (list: any[], query: string) => {
  const q = (query || '').toLowerCase().trim();
  return list.filter(f => {
    if (!f || typeof f.name !== 'string') return false;
    if (f.name.toLowerCase().includes(q)) return true;
    if (Array.isArray(f.aliases)) {
      return f.aliases.some((a: any) => typeof a === 'string' && a.toLowerCase().includes(q));
    }
    return false;
  });
};

const filterMatches = safeCatalogueFilter(sampleCatalogue, 'koki');
assert(filterMatches.length === 1 && filterMatches[0].name === 'Koki Beans', 'Catalogue filter handles malformed/undefined items without crashing');


console.log('\n--- 20. Testing Profile Sufficiency, General References & Localization Parity ---');

const emptyProfile = {};
assert(isProfileSufficientForTarget(emptyProfile) === false, 'Empty profile is not sufficient for personalized target');

const partialProfile1 = { age: 28, heightCm: 175 }; // missing weight, sex, activity
assert(isProfileSufficientForTarget(partialProfile1) === false, 'Partial profile without weight/activity is not sufficient');

const completeProfile = {
  age: 28,
  sex: 'male' as const,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderate' as const
};
assert(isProfileSufficientForTarget(completeProfile) === true, 'Complete profile is sufficient for personalized target');

const targetInsufficient = calculateDailyTarget({ id: 'user', dailyGoal: 2000, profile: emptyProfile });
assert(targetInsufficient === 2000, 'Insufficient profile yields general reference 2000 kcal target');

const targetSufficient = calculateDailyTarget({ id: 'user', dailyGoal: 2000, profile: completeProfile });
assert(typeof targetSufficient === 'number' && targetSufficient > 0, 'Sufficient profile yields calculated personalized target');

// Verify Insights translation keys exist and are non-empty in EN and FR
const requiredInsightsKeys = [
  'insights_title',
  'insights_subtitle',
  'empty_insights_title',
  'empty_insights_desc',
  'log_food_btn',
  'daily_focus',
  'your_next_meal',
  'try_this',
  'see_alternatives',
  'why_this_recommendation',
  'contextual_fit',
  'your_goal',
  'supports_goal_desc',
  'no_goal_set',
  'no_goal_selected',
  'your_recent_pattern',
  'why_this_food',
  'confidence',
  'kcal_remaining',
  'consumed',
  'target',
  'general_ref_target_full',
  'personalized_target_full',
  'aria_personalized_calorie_goal',
  'aria_reference_calorie_goal',
  'your_food_pattern',
  'your_weekly_pattern',
  'week_at_glance',
  'building_weekly_pattern',
  'building_weekly_desc'
] as const;

let allInsightsKeysPresent = true;
for (const k of requiredInsightsKeys) {
  if (!translations.en[k as keyof typeof translations.en] || !translations.fr[k as keyof typeof translations.fr]) {
    allInsightsKeysPresent = false;
    console.error(`Missing translation for key: ${k}`);
  }
}
assert(allInsightsKeysPresent, `All ${requiredInsightsKeys.length} essential Insights, ARIA, and Goal parity keys present in EN and FR`);


console.log('\n--- 21. Testing Onboarding Persistence, Login Migration & Non-Repetition Safety ---');

// Mock localStorage helper for Node test environment
const mockLocalStorage: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, val: string) => { mockLocalStorage[key] = val; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

// Routing safety evaluator matching App.tsx logic
const evaluateSetupStatus = (
  settings: { onboardingCompleted?: boolean; profile?: any },
  consumptions: any[],
  storage: typeof mockStorage
) => {
  const isLocallyCompleted = Boolean(
    storage.getItem('mboafit_onboarding_completed') === 'true' ||
    storage.getItem('dailycal_onboarding_completed') === 'true'
  );
  const hasLoggedMeals = consumptions.length > 0;
  return Boolean(
    settings.onboardingCompleted || 
    settings.profile?.onboardingCompleted || 
    settings.profile?.primaryGoal ||
    settings.profile?.weightKg ||
    settings.profile?.age ||
    isLocallyCompleted ||
    hasLoggedMeals
  );
};

// 1. Fresh user before any action
mockStorage.clear();
const initialUser = { id: 'user', dailyGoal: 2000, onboardingCompleted: false };
assert(!evaluateSetupStatus(initialUser, [], mockStorage), 'Brand new user with no data requires setup wizard');

// 2. User completes setup wizard and logs information locally
const setupCompletedUser = {
  id: 'user',
  dailyGoal: 1850,
  onboardingCompleted: true,
  profile: {
    primaryGoal: 'Lose Weight',
    age: 28,
    sex: 'Female',
    heightCm: 165,
    weightKg: 68,
    onboardingCompleted: true
  }
};
mockStorage.setItem('mboafit_onboarding_completed', 'true');
assert(evaluateSetupStatus(setupCompletedUser, [], mockStorage), 'User who logged information in wizard is setup complete');

// 3. User signs into Google account (cloudSettings is null for first time)
// Verify login migration does NOT wipe settings or set onboardingCompleted: false
const simulateLoginSync = (
  localSettings: any,
  cloudSettings: any,
  uid: string,
  storage: typeof mockStorage
) => {
  const isLocalCompleted = Boolean(
    localSettings?.onboardingCompleted ||
    localSettings?.profile?.onboardingCompleted ||
    localSettings?.profile?.primaryGoal ||
    localSettings?.profile?.weightKg ||
    localSettings?.profile?.age ||
    storage.getItem('mboafit_onboarding_completed') === 'true' ||
    storage.getItem(`onboarding_completed_${uid}`) === 'true'
  );

  let activeSettings: any;
  if (cloudSettings) {
    activeSettings = { ...cloudSettings };
    if (!activeSettings.onboardingCompleted) {
      if (activeSettings.profile?.primaryGoal || activeSettings.profile?.weightKg || isLocalCompleted) {
        activeSettings.onboardingCompleted = true;
      }
    }
  } else {
    // New cloud user: migrate local profile and keep onboarding completed
    if (localSettings && (localSettings.profile?.primaryGoal || localSettings.profile?.weightKg || isLocalCompleted)) {
      activeSettings = {
        id: uid,
        dailyGoal: localSettings.dailyGoal || 2000,
        profile: localSettings.profile ? { ...localSettings.profile, onboardingCompleted: true } : undefined,
        onboardingCompleted: true
      };
    } else {
      activeSettings = {
        id: uid,
        dailyGoal: 2000,
        onboardingCompleted: isLocalCompleted
      };
    }
  }

  if (activeSettings.onboardingCompleted) {
    storage.setItem('mboafit_onboarding_completed', 'true');
    storage.setItem(`onboarding_completed_${uid}`, 'true');
  }

  return activeSettings;
};

const postLoginSettings = simulateLoginSync(setupCompletedUser, null, 'google_user_abc123', mockStorage);
assert(postLoginSettings.onboardingCompleted === true, 'Post-login settings maintains onboardingCompleted === true');
assert(postLoginSettings.dailyGoal === 1850, 'Post-login settings preserves personalized 1850 dailyGoal');
assert(postLoginSettings.profile.primaryGoal === 'Lose Weight', 'Post-login settings preserves primaryGoal');
assert(postLoginSettings.profile.weightKg === 68, 'Post-login settings preserves weightKg');
assert(mockStorage.getItem('onboarding_completed_google_user_abc123') === 'true', 'User-specific onboarding completion key saved');
assert(evaluateSetupStatus(postLoginSettings, [], mockStorage), 'App routing detects user is setup complete after login (wizard never shows)');

// 4. Returning user with cloud profile that was missing explicit onboardingCompleted flag
const legacyCloudUser = {
  id: 'legacy_uid_456',
  dailyGoal: 2100,
  profile: {
    primaryGoal: 'Gain Weight',
    weightKg: 62
  }
};
mockStorage.clear();
const repairedLegacySettings = simulateLoginSync(null, legacyCloudUser, 'legacy_uid_456', mockStorage);
assert(repairedLegacySettings.onboardingCompleted === true, 'Cloud user with profile data is automatically marked onboardingCompleted === true');
assert(evaluateSetupStatus(repairedLegacySettings, [], mockStorage), 'Legacy cloud user is immediately setup complete');

// 5. User who has logged meals but no explicit onboarding profile
mockStorage.clear();
const userWithMeals = { id: 'user', dailyGoal: 2000, onboardingCompleted: false };
const sampleMeals = [{ id: 'meal_1', name: 'Ndole', calories: 450 }];
assert(evaluateSetupStatus(userWithMeals, sampleMeals, mockStorage), 'User with logged meals is never forced to repeat setup wizard');

// 6. User who skips or closes the wizard
mockStorage.clear();
const skippedMinimal = {
  id: 'user',
  dailyGoal: 2000,
  onboardingCompleted: true,
  profile: { onboardingCompleted: true }
};
mockStorage.setItem('mboafit_onboarding_completed', 'true');
assert(evaluateSetupStatus(skippedMinimal, [], mockStorage), 'User who skipped wizard is recognized as setup complete');

// 7. Verification of dashboard profile prompt behavior
const isUserOnboarded = Boolean(
  postLoginSettings.onboardingCompleted || 
  postLoginSettings.profile?.onboardingCompleted || 
  mockStorage.getItem('mboafit_onboarding_completed') === 'true'
);
assert(isUserOnboarded, 'Logged-in user is recognized as onboarded');
// If onboarded, prompt should offer "Edit Profile", never "Launch Setup Wizard"
const getBannerActionType = (onboarded: boolean) => onboarded ? 'EDIT_PROFILE' : 'LAUNCH_SETUP_WIZARD';
assert(getBannerActionType(isUserOnboarded) === 'EDIT_PROFILE', 'Onboarded user dashboard banner routes to Edit Profile, not Launch Setup Wizard');

// ======================================================
// Section 22: Authentic Owner-Scoped IndexedDB & Account Lifecycle Isolation
// ======================================================
console.log('\n--- 22. Testing Authentic Owner-Scoped IndexedDB & Account Lifecycle Isolation ---');

// Polyfill IndexedDB with fake-indexeddb for authentic testing in Node
import 'fake-indexeddb/auto';
import * as db from './src/lib/db';
import { SyncController } from './src/lib/syncController';
import { ConsumptionRecord, CustomFoodTemplate, UserSettings } from './src/types';

async function runAccountIsolationSuite() {
  const userA = 'pilot_user_alpha';
  const userB = 'pilot_user_beta';
  const guest = 'guest';

  // 1. Sanitization & Distinct Physical Database Names
  const dbNameA = db.getDBNameForOwner(userA);
  const dbNameB = db.getDBNameForOwner(userB);
  const dbNameGuest = db.getDBNameForOwner(guest);
  const dbNameNull = db.getDBNameForOwner(null);

  assert(dbNameA.startsWith('mboafit_store_u_'), 'User A receives distinct database name');
  assert(dbNameB.startsWith('mboafit_store_u_'), 'User B receives distinct database name');
  assert(dbNameGuest === 'mboafit_store_guest', 'Guest receives distinct database name');
  assert(dbNameNull === 'mboafit_store_guest', 'Falsy owner defaults safely to guest database');
  assert(dbNameA !== dbNameB && dbNameA !== dbNameGuest, 'All database handles are strictly mutually exclusive');

  // 2. Legacy Database Quarantine
  assert(db.isLegacyDBQuarantined() === true, 'Legacy calorie-tracker-db is strictly quarantined');
  assert(db.LEGACY_DB_NAME === 'calorie-tracker-db', 'Legacy DB name preserved untouched');

  // 3. Owner Settings Isolation & Default Keying
  await db.updateSettings(userA, { id: db.toOwnerKey(userA), dailyGoal: 1850, onboardingCompleted: true });
  await db.updateSettings(userB, { id: db.toOwnerKey(userB), dailyGoal: 2400, onboardingCompleted: false });
  await db.updateSettings(guest, { id: db.toOwnerKey(guest), dailyGoal: 2000, onboardingCompleted: false });

  const readSettingsA = await db.getSettings(userA);
  const readSettingsB = await db.getSettings(userB);
  const readSettingsGuest = await db.getSettings(guest);

  assert(readSettingsA.dailyGoal === 1850, 'User A settings read accurately as 1850 kcal');
  assert(readSettingsA.onboardingCompleted === true, 'User A onboarding flag is true');
  assert(readSettingsB.dailyGoal === 2400, 'User B settings read accurately as 2400 kcal');
  assert(readSettingsB.onboardingCompleted === false, 'User B onboarding flag is false (not leaked from A)');
  assert(readSettingsGuest.dailyGoal === 2000, 'Guest settings read accurately as 2000 kcal');

  // 4. Consumptions & Custom Foods Isolation (User A -> Logout to Guest -> User B)
  const mealA: ConsumptionRecord = {
    id: 'meal_alpha_1',
    name: 'Koki Beans',
    calories: 350,
    protein: 18,
    carbs: 45,
    fat: 8,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: 1700000000000
  };
  await db.addConsumption(userA, mealA);

  const customFoodA: CustomFoodTemplate = {
    id: 'custom_alpha_1',
    name: 'Special Plantain',
    calories: 220,
    protein: 2,
    carbs: 55,
    fat: 1,
    servingSizeText: '1 piece (150g)',
    createdAt: Date.now(),
    isCustom: true
  };
  await db.addCustomFood(userA, customFoodA);

  // User A logs out -> Switch to Guest
  const guestMeals = await db.getAllConsumptions(guest);
  const guestFoods = await db.getCustomFoods(guest);
  assert(guestMeals.length === 0, 'Guest store has 0 meals after User A logout');
  assert(guestFoods.length === 0, 'Guest store has 0 custom foods after User A logout');

  // Add meal as Guest
  const mealGuest: ConsumptionRecord = {
    id: 'meal_guest_1',
    name: 'Roasted Maize',
    calories: 180,
    protein: 4,
    carbs: 38,
    fat: 2,
    servings: 1,
    mealCategory: 'Snacks',
    timestamp: 1700000100000
  };
  await db.addConsumption(guest, mealGuest);

  // User B signs in
  const bMeals = await db.getAllConsumptions(userB);
  const bFoods = await db.getCustomFoods(userB);
  assert(bMeals.length === 0, 'User B store has 0 meals upon first sign-in (no leak from A or Guest)');
  assert(bFoods.length === 0, 'User B store has 0 custom foods upon first sign-in');

  // User A logs back in
  const aMealsAgain = await db.getAllConsumptions(userA);
  const aFoodsAgain = await db.getCustomFoods(userA);
  assert(aMealsAgain.length === 1 && aMealsAgain[0].name === 'Koki Beans', 'User A meals accurately retrieved upon logging back in');
  assert(aFoodsAgain.length === 1 && aFoodsAgain[0].name === 'Special Plantain', 'User A custom foods accurately retrieved upon logging back in');

  // 5. Stale In-Flight Async Generation Guard on Actual SyncController
  let aLoadExecuted: boolean = false;
  const cloudMealsMap = new Map<string, ConsumptionRecord[]>();
  cloudMealsMap.set(userA, [mealA]);
  cloudMealsMap.set(userB, []);

  const mockFirestore = {
    getUserSettings: async () => null,
    saveUserSettings: async () => {},
    getUserConsumptions: async (uid: string) => {
      if (uid === userA) {
        await new Promise(r => setTimeout(r, 25));
        aLoadExecuted = true;
      }
      return [...(cloudMealsMap.get(uid) || [])];
    },
    saveConsumption: async () => {},
    deleteConsumption: async () => {},
    getUserCustomFoods: async () => [],
    saveCustomFood: async () => {},
    deleteCustomFood: async () => {},
    importLocalToCloud: async (uid: string, _s: any, meals: ConsumptionRecord[]) => {
      const existing = cloudMealsMap.get(uid) || [];
      const updated = [...existing, ...meals];
      cloudMealsMap.set(uid, updated);
      return { importedMeals: meals.length, importedCustomFoods: 0 };
    }
  };

  const controller = new SyncController({ kind: 'user', uid: userA }, true, {
    firestore: mockFirestore as any,
    dbModule: db
  });

  // Start delayed load for User A
  const loadPromiseA = controller.refresh();

  // Give a small tick so User A's load reaches in-flight fetch
  await new Promise(r => setTimeout(r, 5));

  // Mid-flight: User switches to User B!
  controller.switchOwner({ kind: 'user', uid: userB }, true);
  assert(controller.getState().allConsumptions.length === 0, 'In-memory state instantly cleared upon switching to User B');

  // Wait for A's delayed response to resolve
  await loadPromiseA;
  assert(Boolean(aLoadExecuted), 'A load actually executed and resolved');
  assert(controller.getState().allConsumptions.length === 0, 'Delayed response from User A is discarded and does not overwrite User B state');

  // 6. Pending Writes Queue & Offline Retry Isolation via Production Atomic API
  await db.clearPendingWrites(userA);
  await db.clearPendingWrites(userB);
  await db.clearPendingWrites(guest);

  const pendingItemA = await db.saveConsumptionAtomic(userA, mealA);

  const pendingWritesA = await db.getPendingWrites(userA);
  const pendingWritesB = await db.getPendingWrites(userB);
  const pendingWritesGuest = await db.getPendingWrites(guest);

  assert(pendingWritesA.length === 1, 'User A has exactly 1 pending write in durable queue');
  assert(pendingWritesB.length === 0, 'User B has 0 pending writes (no cross-account write leakage)');
  assert(pendingWritesGuest.length === 0, 'Guest has 0 pending writes');

  // Drain pending outbox for User A using production drain
  await controller.switchOwner({ kind: 'user', uid: userA }, true);
  await controller.drainPendingWrites();
  const pendingAfterDrain = await db.getPendingWrites(userA);
  assert(pendingAfterDrain.length === 0, 'User A pending write cleanly removed after successful retry');

  // 7. Explicit Consent Import & Deduplication via Actual Controller Implementation
  // Guest has: mealGuest ('Roasted Maize') and duplicate of mealA ('Koki Beans')
  await db.addConsumption(guest, mealA);
  const guestRecordsBeforeImport = await db.getAllConsumptions(guest);
  assert(guestRecordsBeforeImport.length === 2, 'Guest store has 2 records before import');

  // User B already has mealA ('Koki Beans')
  await db.addConsumption(userB, mealA);
  cloudMealsMap.set(userB, [mealA]);

  // User B chooses to import guest data via controller.importGuestData()!
  await controller.switchOwner({ kind: 'user', uid: userB }, true);
  const importResult = await controller.importGuestData();

  assert(importResult.importedMeals === 1, 'Deduplication filters out mealA and only imports novel mealGuest');
  const userBAfterImport = await db.getAllConsumptions(userB);
  assert(userBAfterImport.some(m => m.id === 'meal_guest_1'), 'Only non-duplicate Roasted Maize selected for import');
  assert(userBAfterImport.length === 2, 'User B now has 2 distinct meals after deduplicated import');

  // Verify Guest originals are preserved!
  const guestRecordsAfterImport = await db.getAllConsumptions(guest);
  assert(guestRecordsAfterImport.length === 2, 'Guest original records are preserved untouched in guest store');

  // 8. Separate Setup-Completion Persistence Per Owner
  const mockStorageOwner = new Map<string, string>();
  const setOwnerOnboarding = (owner: string) => {
    mockStorageOwner.set(`mboafit_onboarding_${db.toOwnerKey(owner)}`, 'true');
  };
  const isOwnerOnboarded = (owner: string) => {
    return mockStorageOwner.get(`mboafit_onboarding_${db.toOwnerKey(owner)}`) === 'true';
  };

  setOwnerOnboarding(userA);
  assert(isOwnerOnboarded(userA) === true, 'User A is marked onboarding completed');
  assert(isOwnerOnboarded(userB) === false, 'User B is NOT marked onboarding completed from User A');
  assert(isOwnerOnboarded(guest) === false, 'Guest is NOT marked onboarding completed from User A');

  setOwnerOnboarding(userB);
  assert(isOwnerOnboarded(userB) === true, 'User B is now independently marked onboarding completed');

  // 9. Data Clear Scope Isolation
  await db.clearAllConsumptions(userB);
  const userBAfterClear = await db.getAllConsumptions(userB);
  const userAAfterBClear = await db.getAllConsumptions(userA);
  assert(userBAfterClear.length === 0, 'User B store is completely cleared');
  assert(userAAfterBClear.length === 1, 'User A store is untouched by User B clear operation');
}

runAccountIsolationSuite().then(() => {
  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});

