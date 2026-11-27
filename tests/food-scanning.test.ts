/**
 * Focused Food Scanning & Portion Confirmation Regression Test Suite
 *
 * Exercises production FoodDetectionEngine, FoodRecognitionPipeline, PortionEstimationEngine,
 * NutritionEngine, scanPortionHelpers, nutritionScaling, and rendered ResultsScreen component
 * (mocking only the fetch network boundary).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FoodDetectionEngine } from '../src/features/vision/domain/detection/FoodDetectionEngine';
import { FoodDetectionServiceError } from '../src/features/vision/domain/detection/DetectedFood';
import { FoodRecognitionPipeline } from '../src/features/vision/domain/pipeline/FoodRecognitionPipeline';
import { PortionEstimationEngine } from '../src/features/vision/domain/estimation/PortionEstimationEngine';
import { NutritionEngine } from '../src/features/nutrition/domain/engine/NutritionEngine';
import {
  isScanItemReadyForLogging,
  getScanItemNutrition,
  mapCatalogFoodToKnowledge
} from '../src/features/vision/domain/pipeline/scanPortionHelpers';
import {
  parseServingGrams,
  parsePositiveGramsInput,
  deriveServingPortionOptions,
  calculateGramScaledNutrients
} from '../src/lib/nutritionScaling';
import { commonFoods } from '../src/data/foodDatabase';
import type { ProcessedImageResult } from '../src/features/vision/presentation/acquisition/CameraEngine';
import type { FoodRecognitionConfig } from '../src/features/vision/domain/pipeline/FoodRecognitionPipelineTypes';

const originalFetch = globalThis.fetch;

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function buildTestConfig(): FoodRecognitionConfig {
  const foodIndex = commonFoods.map(f => ({
    id: f.id,
    name: f.name,
    aliases: f.aliases || [],
    searchKeywords: [...(f.aliases || []), f.name.toLowerCase()],
    category: f.category
  }));

  return {
    userProfile: {
      primaryGoal: 'healthyEating',
      conditions: [],
      dailyTargets: { calories: 2000, protein: 100, carbs: 250, fat: 67 },
      currentIntake: { calories: 0, protein: 0, carbs: 0, fat: 0 }
    },
    foodIndex,
    fetchFoodKnowledgeById: async (id: string) => {
      const item = commonFoods.find(f => f.id === id);
      if (!item) return null;
      return mapCatalogFoodToKnowledge(item);
    }
  };
}

const sampleImage: ProcessedImageResult = {
  image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==',
  width: 640,
  height: 480,
  orientation: 0,
  quality: 1.0,
  blurScore: 500,
  brightnessScore: 120
};

const largePhoneImage: ProcessedImageResult = {
  image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==',
  width: 1600,
  height: 1200,
  orientation: 0,
  quality: 1.0,
  blurScore: 500,
  brightnessScore: 120
};

async function withDom<T>(lang: 'en' | 'fr', fn: (dom: any) => Promise<T>): Promise<T> {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="results-root"></div></body></html>', {
    url: 'http://localhost:3000/'
  });
  dom.window.localStorage.setItem('mboafit_lang', lang);

  const origWindow = globalThis.window;
  const origDocument = globalThis.document;
  const origLocalStorage = (globalThis as any).localStorage;
  const origNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const origHTMLElement = globalThis.HTMLElement;
  const origHTMLButtonElement = globalThis.HTMLButtonElement;
  const origHTMLInputElement = globalThis.HTMLInputElement;
  const origEvent = globalThis.Event;
  const origCustomEvent = globalThis.CustomEvent;

  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  (globalThis as any).localStorage = dom.window.localStorage;
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });
  globalThis.HTMLElement = dom.window.HTMLElement as any;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement as any;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement as any;
  globalThis.Event = dom.window.Event as any;
  globalThis.CustomEvent = dom.window.CustomEvent as any;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  try {
    return await fn(dom);
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDocument;
    if (origLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = origLocalStorage;
    }
    if (origNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
    } else {
      delete (globalThis as any).navigator;
    }
    globalThis.HTMLElement = origHTMLElement;
    globalThis.HTMLButtonElement = origHTMLButtonElement;
    globalThis.HTMLInputElement = origHTMLInputElement;
    globalThis.Event = origEvent;
    globalThis.CustomEvent = origCustomEvent;
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  }
}

function setReactInputValue(input: HTMLInputElement, value: string, domWindow: any) {
  const descriptor = Object.getOwnPropertyDescriptor(domWindow.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new domWindow.Event('input', { bubbles: true }));
}

test('1. HTTP 503/500 failure throws FoodDetectionServiceError instead of returning empty detection', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Food recognition service is temporarily unavailable.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })) as any;

  try {
    await assert.rejects(
      () =>
        FoodDetectionEngine.detect({
          imageUri: sampleImage.image,
          imageWidth: 640,
          imageHeight: 480,
          base64Data: 'AAAA'
        }),
      (err: unknown) => {
        assert.ok(err instanceof FoodDetectionServiceError, 'Error must be FoodDetectionServiceError');
        assert.equal(err.code, 'HTTP_ERROR');
        assert.equal(err.statusCode, 503);
        assert.equal(err.retryable, true);
        assert.match(err.message, /unavailable/i);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('2. Network failure (fetch throws) throws FoodDetectionServiceError instead of empty detection', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as any;

  try {
    await assert.rejects(
      () =>
        FoodDetectionEngine.detect({
          imageUri: sampleImage.image,
          imageWidth: 640,
          imageHeight: 480,
          base64Data: 'AAAA'
        }),
      (err: unknown) => {
        assert.ok(err instanceof FoodDetectionServiceError);
        assert.equal(err.code, 'NETWORK_ERROR');
        assert.equal(err.retryable, true);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('3. Malformed response payload throws FoodDetectionServiceError instead of empty detection', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ unexpected: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })) as any;

  try {
    await assert.rejects(
      () =>
        FoodDetectionEngine.detect({
          imageUri: sampleImage.image,
          imageWidth: 640,
          imageHeight: 480,
          base64Data: 'AAAA'
        }),
      (err: unknown) => {
        assert.ok(err instanceof FoodDetectionServiceError);
        assert.equal(err.code, 'INVALID_RESPONSE');
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test('4. Non-food image returning HTTP 200 { foods: [] } succeeds with 0 items and invents no foods', async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ foods: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })) as any;

  try {
    const result = await FoodRecognitionPipeline.process(sampleImage, buildTestConfig());
    assert.equal(result.items.length, 0);
    assert.equal(result.analysis, null);
  } finally {
    restoreFetch();
  }
});

test('5. 1500g regression: large photo of unknown mixed dish never fabricates 1500g or clamped weights and separates identity vs portion confidence', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            detectedName: 'Rice And Beans With Sausage',
            confidence: 0.94,
            estimatedAreaPercentage: 0.78,
            category: 'mixed_meal'
          }
        ]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as any;

  try {
    const result = await FoodRecognitionPipeline.process(largePhoneImage, buildTestConfig());
    assert.equal(result.items.length, 1);

    const item = result.items[0];
    // High food identity confidence is preserved
    assert.equal(item.detectionConfidence, 0.94);
    // Unknown mixed dish is NOT silently substituted with "Rice and Beans"
    assert.equal(item.match.decision, 'UNKNOWN');
    assert.equal(item.match.foodKnowledgeId, '');
    assert.equal(item.nutritionStatus, 'needs_confirmation');
    assert.equal(item.foodKnowledge, undefined);

    // Portion weight is strictly unmeasured — NEVER 1500g or pixel-derived
    assert.equal(item.estimatedPortion.estimatedWeight, null);
    assert.notEqual(item.estimatedPortion.estimatedWeight, 1500);
    assert.equal(item.estimatedPortion.confidence, 0);
    assert.equal(item.estimatedPortion.portionConfidenceLevel, 'unmeasured');
    assert.equal(item.estimatedPortion.isConfirmed, false);
    assert.equal(isScanItemReadyForLogging(item), false);

    // Direct call to PortionEstimationEngine also never produces 1500g
    const directPortion = PortionEstimationEngine.estimatePortion(
      'Rice And Beans With Sausage',
      { xMin: 0, yMin: 0, xMax: 1400, yMax: 1000 },
      1600,
      1200,
      true
    );
    assert.equal(directPortion.estimatedWeight, null);
    assert.equal(directPortion.confidence, 0);
    assert.equal(directPortion.isConfirmed, false);
  } finally {
    restoreFetch();
  }
});

test('6. Rice and beans detection suggests Rice and Beans with unmeasured portion requiring both food and portion confirmation', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            detectedName: 'rice and beans',
            confidence: 0.93,
            estimatedAreaPercentage: 0.55,
            category: 'mixed_meal'
          }
        ]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as any;

  try {
    const result = await FoodRecognitionPipeline.process(sampleImage, buildTestConfig());
    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.equal(item.match.foodKnowledgeId, 'cp9');
    assert.equal(item.match.matchedName, 'Rice and Beans');
    assert.equal(item.nutritionStatus, 'needs_confirmation');
    assert.equal(item.foodKnowledge, undefined);
    assert.equal(item.estimatedPortion.estimatedWeight, null);
    assert.equal(item.estimatedPortion.isConfirmed, false);
    assert.equal(result.analysis, null);
  } finally {
    restoreFetch();
  }
});

test('7. Separate rice and beans detections on the same plate suggest Rice and Beans and require confirmation', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            detectedName: 'white rice',
            confidence: 0.91,
            estimatedAreaPercentage: 0.35,
            category: 'starch'
          },
          {
            detectedName: 'stewed beans',
            confidence: 0.88,
            estimatedAreaPercentage: 0.25,
            category: 'legume'
          }
        ]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as any;

  try {
    const result = await FoodRecognitionPipeline.process(sampleImage, buildTestConfig());
    assert.equal(result.items.length, 2);

    const riceItem = result.items[0];
    const beansItem = result.items[1];

    assert.equal(riceItem.nutritionStatus, 'needs_confirmation');
    assert.equal(beansItem.nutritionStatus, 'needs_confirmation');
    assert.equal(riceItem.estimatedPortion.estimatedWeight, null);
    assert.equal(beansItem.estimatedPortion.estimatedWeight, null);

    const riceAllIds = [
      riceItem.match.foodKnowledgeId,
      ...riceItem.match.fallbackSuggestions.map(s => s.foodKnowledgeId)
    ];
    const beansAllIds = [
      beansItem.match.foodKnowledgeId,
      ...beansItem.match.fallbackSuggestions.map(s => s.foodKnowledgeId)
    ];

    assert.ok(riceAllIds.includes('st15'), 'Rice detection should suggest Rice (White, Boiled)');
    assert.ok(riceAllIds.includes('cp9'), 'Rice detection alongside beans should include Rice and Beans suggestion');
    assert.ok(beansAllIds.includes('cp9'), 'Beans detection should include Rice and Beans suggestion');
  } finally {
    restoreFetch();
  }
});

test('8. Serving conversion & NutritionEngine consistency: documented serving/100g basis, no /250 bug, no silent upper clamp', () => {
  const riceAndBeans = commonFoods.find(f => f.id === 'cp9')!;
  assert.equal(parseServingGrams(riceAndBeans.servingSizeText), 300);

  // Small / Regular / Large derived from 300g documented serving
  const options = deriveServingPortionOptions(300);
  assert.deepEqual(options, [
    { key: 'small', multiplier: 0.5, grams: 150 },
    { key: 'regular', multiplier: 1.0, grams: 300 },
    { key: 'large', multiplier: 1.5, grams: 450 }
  ]);

  // Half serving (150g out of 300g -> 0.5x = 225 kcal, NOT 150/250 = 270 kcal)
  const scaled150 = calculateGramScaledNutrients(riceAndBeans, 150);
  assert.equal(scaled150.valid, true);
  if (scaled150.valid) {
    assert.equal(scaled150.basisGrams, 300);
    assert.equal(scaled150.calories, 225);
    assert.equal(scaled150.protein, 9);
    assert.equal(scaled150.carbs, 42.5);
    assert.equal(scaled150.fat, 2.5);
  }

  // NutritionEngine matches calculateGramScaledNutrients identically
  const knowledge = mapCatalogFoodToKnowledge(riceAndBeans);
  const totals150 = NutritionEngine.calculateMealTotals([
    { foodKnowledge: knowledge, estimatedWeightGrams: 150 }
  ]);
  assert.equal(totals150.calories, 225);
  assert.equal(totals150.protein, 9);
  assert.equal(totals150.carbs, 42.5);
  assert.equal(totals150.fat, 2.5);

  // Legitimate large quantity (2000g) is NOT silently capped at 1500g
  const scaled2000 = calculateGramScaledNutrients(riceAndBeans, 2000);
  assert.equal(scaled2000.valid, true);
  if (scaled2000.valid) {
    assert.equal(scaled2000.calories, 3000);
  }
  const totals2000 = NutritionEngine.calculateMealTotals([
    { foodKnowledge: knowledge, estimatedWeightGrams: 2000 }
  ]);
  assert.equal(totals2000.calories, 3000);

  // 100g-basis food scales cleanly from 100g to confirmed grams
  const per100gFood = {
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    servingSizeText: '100g cooked'
  };
  const scaled175 = calculateGramScaledNutrients(per100gFood, 175);
  assert.equal(scaled175.valid, true);
  if (scaled175.valid) {
    assert.equal(scaled175.basisGrams, 100);
    assert.equal(scaled175.calories, 228);
  }

  // Missing serving weight in grams (e.g. "2 eggs") never invents default options or /250 denominator
  const friedEggs = commonFoods.find(f => f.id === 'bf7')!;
  assert.equal(parseServingGrams(friedEggs.servingSizeText), null);
  assert.deepEqual(deriveServingPortionOptions(null), []);
  const missingBasis = calculateGramScaledNutrients(friedEggs, 120);
  assert.equal(missingBasis.valid, false);
  if (!missingBasis.valid) {
    assert.equal(missingBasis.error, 'MISSING_SERVING_BASIS');
  }

  // Explicit user-supplied reference serving weight allows honest gram scaling
  const explicitBasis = calculateGramScaledNutrients(friedEggs, 120, 100);
  assert.equal(explicitBasis.valid, true);
  if (explicitBasis.valid) {
    assert.equal(explicitBasis.calories, Math.round(friedEggs.calories * 1.2));
  }
});

test('9. Invalid, zero, negative, non-finite, and missing inputs are rejected without producing misleading numbers', () => {
  const riceAndBeans = commonFoods.find(f => f.id === 'cp9')!;
  const knowledge = mapCatalogFoodToKnowledge(riceAndBeans);

  for (const badInput of ['', '   ', '0', '-10', '-0.5', 'abc', '100g', 'Infinity', 'NaN', null, undefined]) {
    assert.equal(parsePositiveGramsInput(badInput as any), null, `Expected null for input ${String(badInput)}`);
  }

  for (const badNum of [0, -1, -250, NaN, Infinity, -Infinity, null, undefined]) {
    const res = calculateGramScaledNutrients(riceAndBeans, badNum as any);
    assert.equal(res.valid, false, `Expected invalid for grams=${String(badNum)}`);
  }

  // Invalid nutrient data rejected
  assert.equal(
    calculateGramScaledNutrients({ calories: NaN, servingSizeText: '100g' }, 100).valid,
    false
  );
  assert.equal(
    calculateGramScaledNutrients({ calories: -50, servingSizeText: '100g' }, 100).valid,
    false
  );

  // NutritionEngine never leaks NaN or invents calories from invalid inputs
  const totalsBad = NutritionEngine.calculateMealTotals([
    { foodKnowledge: knowledge, estimatedWeightGrams: 0 },
    { foodKnowledge: knowledge, estimatedWeightGrams: -200 },
    { foodKnowledge: knowledge, estimatedWeightGrams: Number.NaN },
    { foodKnowledge: knowledge, estimatedWeightGrams: Number.POSITIVE_INFINITY }
  ]);
  assert.equal(totalsBad.calories, 0);
  assert.equal(totalsBad.protein, 0);
  assert.equal(totalsBad.carbs, 0);
  assert.equal(totalsBad.fat, 0);
});

test('10. Rendered ResultsScreen blocks View Analysis until BOTH food and valid portion are confirmed and rejects invalid inputs', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            detectedName: 'rice and beans',
            confidence: 0.92,
            estimatedAreaPercentage: 0.65,
            category: 'mixed_meal'
          }
        ]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as any;

  const pipelineResult = await FoodRecognitionPipeline.process(largePhoneImage, buildTestConfig());
  restoreFetch();

  await withDom('en', async (dom) => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { act } = React;
    const { ResultsScreen } = await import('../src/components/ResultsScreen');

    const container = dom.window.document.getElementById('results-root')!;
    const root = ReactDOMClient.createRoot(container);
    let confirmedPayload: any = null;

    await act(async () => {
      root.render(
        React.createElement(ResultsScreen, {
          result: pipelineResult,
          onConfirm: (res) => {
            confirmedPayload = res;
          },
          onRetake: () => {},
          onManualAdd: () => {}
        })
      );
    });

    const getButtons = () => Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];

    // Never displays 1500g; shows separate identity & portion status + kitchen scale note
    assert.ok(!container.textContent?.includes('1500'), 'Must never display arbitrary 1500g weight');
    assert.ok(container.textContent?.includes('Not measured from photo'), 'Must label portion as unmeasured from photo');
    assert.ok(container.textContent?.includes('kitchen scale'), 'Must inform user a kitchen scale gives best accuracy');

    // View Analysis disabled before food confirmation
    const viewBtnBeforeFood = getButtons().find(b => b.textContent?.includes('View Analysis'))!;
    assert.equal(viewBtnBeforeFood.disabled, true);

    // Step 1: Confirm food identity
    const confirmFoodBtn = getButtons().find(b => b.textContent?.includes('Confirm Rice and Beans'))!;
    await act(async () => {
      confirmFoodBtn.click();
    });

    // Food confirmed, but portion NOT confirmed yet -> View Analysis MUST STILL be disabled!
    const viewBtnBeforePortion = getButtons().find(b => b.textContent?.includes('View Analysis'))!;
    assert.equal(
      viewBtnBeforePortion.disabled,
      true,
      'View Analysis must remain disabled after food confirmation until portion is also confirmed'
    );

    // Documented serving estimates (150g / 300g / 450g) are shown and labelled as estimates
    assert.ok(container.textContent?.includes('~150g'), 'Small estimate (0.5x = 150g) must appear');
    assert.ok(container.textContent?.includes('~300g'), 'Regular estimate (1x = 300g) must appear');
    assert.ok(container.textContent?.includes('~450g'), 'Large estimate (1.5x = 450g) must appear');
    assert.ok(container.textContent?.includes('not photo measurements'), 'Presets must be labelled as estimates, not measurements');

    // Enter invalid grams (0 and -50) -> Confirm portion disabled and error shown
    const gramsInput = container.querySelector('input[id="scan-grams-0"]') as HTMLInputElement;
    assert.ok(gramsInput, 'Editable grams input must be rendered');

    await act(async () => {
      setReactInputValue(gramsInput, '0', dom.window);
    });
    assert.ok(container.textContent?.includes('greater than 0 g'), 'Zero grams must show inline validation error');
    let confirmPortionBtn = getButtons().find(b => b.textContent?.includes('Enter valid grams to confirm'))!;
    assert.equal(confirmPortionBtn.disabled, true);

    await act(async () => {
      setReactInputValue(gramsInput, '-50', dom.window);
    });
    confirmPortionBtn = getButtons().find(b => b.textContent?.includes('Enter valid grams to confirm'))!;
    assert.equal(confirmPortionBtn.disabled, true);

    // Select Small (0.5x = 150g) and explicitly confirm portion
    const smallBtn = getButtons().find(b => b.textContent?.includes('Small (0.5×)'))!;
    await act(async () => {
      smallBtn.click();
    });

    confirmPortionBtn = getButtons().find(b => b.textContent?.includes('Confirm portion (150g)'))!;
    assert.equal(confirmPortionBtn.disabled, false);

    await act(async () => {
      confirmPortionBtn.click();
    });

    const viewBtnAfterBoth = getButtons().find(b => b.textContent?.includes('View Analysis'))!;
    assert.equal(viewBtnAfterBoth.disabled, false, 'View Analysis must enable once BOTH food and portion are confirmed');

    await act(async () => {
      viewBtnAfterBoth.click();
    });

    assert.ok(confirmedPayload, 'onConfirm must be called after confirming both food and portion');
    assert.equal(confirmedPayload.items[0].nutritionStatus, 'matched');
    assert.equal(confirmedPayload.items[0].estimatedPortion.isConfirmed, true);
    assert.equal(confirmedPayload.items[0].estimatedPortion.estimatedWeight, 150);

    const nutrition = getScanItemNutrition(confirmedPayload.items[0]);
    assert.equal(nutrition.valid, true);
    if (nutrition.valid) {
      assert.equal(nutrition.calories, 225);
    }

    await act(async () => {
      root.unmount();
    });
  });
});

test('11. Rendered ResultsScreen for unknown mixed dish allows splitting into separate components without double counting or silently substituting (and supports FR)', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            detectedName: 'Rice And Beans With Sausage',
            confidence: 0.94,
            estimatedAreaPercentage: 0.75,
            category: 'mixed_meal'
          }
        ]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as any;

  const pipelineResult = await FoodRecognitionPipeline.process(largePhoneImage, buildTestConfig());
  restoreFetch();

  await withDom('fr', async (dom) => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { act } = React;
    const { ResultsScreen } = await import('../src/components/ResultsScreen');

    const container = dom.window.document.getElementById('results-root')!;
    const root = ReactDOMClient.createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(ResultsScreen, {
          result: pipelineResult,
          onConfirm: () => {},
          onRetake: () => {},
          onManualAdd: () => {}
        })
      );
    });

    const getButtons = () => Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];

    // French UI checks + zero 1500g + honest mixed dish handling
    assert.ok(!container.textContent?.includes('1500'), 'Must never show 1500g in French UI either');
    assert.ok(container.textContent?.includes('balance de cuisine'), 'Must show French kitchen scale tip');
    assert.ok(container.textContent?.includes('Non mesuré depuis la photo'), 'Must show French unmeasured portion label');

    // Open Split into separate components
    const splitBtn = getButtons().find(b => b.textContent?.includes('Ajouter des composants séparés'))!;
    assert.ok(splitBtn, 'Split components action must be rendered for unknown mixed dish');

    await act(async () => {
      splitBtn.click();
    });

    // Notes that "sausage" is not in the catalogue
    assert.ok(container.textContent?.toLowerCase().includes('sausage'), 'Must note unmatched term (sausage)');

    // Select Rice and Beans as component and replace the original mixed dish card
    const riceBeansChip = getButtons().find(b => b.textContent?.includes('Rice and Beans'))!;
    assert.ok(riceBeansChip, 'Related component chip Rice and Beans must be selectable');

    await act(async () => {
      riceBeansChip.click();
    });

    const replaceBtn = getButtons().find(b => b.textContent?.includes('Remplacer par 1 composant'))!;
    assert.ok(replaceBtn && !replaceBtn.disabled);

    await act(async () => {
      replaceBtn.click();
    });

    // Original "Rice And Beans With Sausage" card is replaced (no double counting!)
    assert.ok(
      !container.textContent?.includes('Rice And Beans With Sausage'),
      'Original unknown mixed dish card must be replaced to prevent double counting'
    );
    assert.ok(
      container.textContent?.includes('Confirmé : Rice and Beans'),
      'Replaced component card must show selected food'
    );

    // Portion is still NOT confirmed -> Voir l’analyse remains disabled
    const viewBtn = getButtons().find(b => b.textContent?.includes('Voir l’analyse'))!;
    assert.equal(viewBtn.disabled, true, 'View Analysis must remain disabled until replacement component portion is confirmed');

    await act(async () => {
      root.unmount();
    });
  });
});

test('12. Rendered ResultsScreen for matched food with missing serving weight (2 eggs) invents no default grams and requires user input', async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            detectedName: 'Fried Eggs',
            confidence: 0.9,
            estimatedAreaPercentage: 0.3,
            category: 'protein'
          }
        ]
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )) as any;

  const pipelineResult = await FoodRecognitionPipeline.process(sampleImage, buildTestConfig());
  restoreFetch();

  await withDom('en', async (dom) => {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { act } = React;
    const { ResultsScreen } = await import('../src/components/ResultsScreen');

    const container = dom.window.document.getElementById('results-root')!;
    const root = ReactDOMClient.createRoot(container);
    let confirmedPayload: any = null;

    await act(async () => {
      root.render(
        React.createElement(ResultsScreen, {
          result: pipelineResult,
          onConfirm: (res) => {
            confirmedPayload = res;
          },
          onRetake: () => {},
          onManualAdd: () => {}
        })
      );
    });

    const getButtons = () => Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];

    // Confirm Fried Eggs
    const confirmEggsBtn = getButtons().find(b => b.textContent?.includes('Confirm Fried Eggs'))!;
    assert.ok(confirmEggsBtn, 'Confirm Fried Eggs button must be rendered');
    await act(async () => {
      confirmEggsBtn.click();
    });

    // No default grams invented (input value must be blank "") and no Small/Regular/Large gram presets
    const gramsInput = container.querySelector('input[id="scan-grams-0"]') as HTMLInputElement;
    const refInput = container.querySelector('input[id="scan-ref-grams-0"]') as HTMLInputElement;
    assert.ok(gramsInput, 'User-entered grams input must be shown');
    assert.ok(refInput, 'Reference 1-serving grams input must be shown when database lacks gram weight');
    assert.equal(gramsInput.value, '', 'Must NOT invent a default gram weight');
    assert.equal(refInput.value, '', 'Must NOT invent a default reference serving weight');
    assert.ok(!container.textContent?.includes('Small (0.5×)'), 'Must NOT fabricate gram presets when serving weight is missing');

    // Enter user portion (150g) and 1-serving weight (100g) -> enables Confirm portion
    await act(async () => {
      setReactInputValue(gramsInput, '150', dom.window);
      setReactInputValue(refInput, '100', dom.window);
    });

    const confirmPortionBtn = getButtons().find(b => b.textContent?.includes('Confirm portion (150g)'))!;
    assert.ok(confirmPortionBtn && !confirmPortionBtn.disabled);

    await act(async () => {
      confirmPortionBtn.click();
    });

    const viewBtn = getButtons().find(b => b.textContent?.includes('View Analysis'))!;
    assert.equal(viewBtn.disabled, false);

    await act(async () => {
      viewBtn.click();
    });

    assert.ok(confirmedPayload);
    const nutrition = getScanItemNutrition(confirmedPayload.items[0]);
    assert.equal(nutrition.valid, true);
    if (nutrition.valid) {
      // Fried Eggs = 180 kcal for 2 eggs; 150g / 100g = 1.5x -> 270 kcal
      assert.equal(nutrition.calories, 270);
    }

    await act(async () => {
      root.unmount();
    });
  });
});
