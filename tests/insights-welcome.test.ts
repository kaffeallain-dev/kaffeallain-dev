import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { RecommendationEngine } from '../src/lib/RecommendationEngine';
import { commonFoods } from '../src/data/foodDatabase';
import { translations } from '../src/lib/i18n';
import { ConsumptionRecord, UserSettings } from '../src/types';

function setupDOM(options?: { reducedMotion?: boolean; url?: string }) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    url: options?.url || 'http://localhost:3000/'
  });

  const reducedMotion = Boolean(options?.reducedMotion);
  (dom.window as any).matchMedia = (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  });

  (dom.window as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const origWindow = globalThis.window;
  const origDocument = globalThis.document;
  const origNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const origLocalStorage = globalThis.localStorage;
  const origHTMLElement = globalThis.HTMLElement;
  const origHTMLButtonElement = globalThis.HTMLButtonElement;
  const origSVGElement = (globalThis as any).SVGElement;
  const origCustomEvent = globalThis.CustomEvent;
  const origResizeObserver = (globalThis as any).ResizeObserver;

  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });
  globalThis.localStorage = dom.window.localStorage as any;
  globalThis.HTMLElement = dom.window.HTMLElement as any;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement as any;
  (globalThis as any).SVGElement = (dom.window as any).SVGElement;
  globalThis.CustomEvent = dom.window.CustomEvent as any;
  (globalThis as any).ResizeObserver = (dom.window as any).ResizeObserver;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  return {
    dom,
    cleanup: () => {
      globalThis.window = origWindow;
      globalThis.document = origDocument;
      if (origNavigatorDesc) {
        Object.defineProperty(globalThis, 'navigator', origNavigatorDesc);
      } else {
        delete (globalThis as any).navigator;
      }
      globalThis.localStorage = origLocalStorage;
      globalThis.HTMLElement = origHTMLElement;
      globalThis.HTMLButtonElement = origHTMLButtonElement;
      (globalThis as any).SVGElement = origSVGElement;
      globalThis.CustomEvent = origCustomEvent;
      (globalThis as any).ResizeObserver = origResizeObserver;
      delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    }
  };
}

test('1. Incomplete vs. known ingredient classification: custom or partial entries never infer vegetable absence', () => {
  // Case A: Custom / unclassified food entry with unknown ingredients
  const customMeal: ConsumptionRecord = {
    id: 'custom-1',
    name: 'Homemade Family Stew',
    calories: 520,
    protein: 24,
    carbs: 55,
    fat: 18,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: Date.now(),
    foodId: 'custom-stew-1'
  };

  const customClass = RecommendationEngine.classifyLoggedMeals([customMeal], commonFoods);
  assert.equal(customClass.totalCount, 1);
  assert.equal(customClass.matchedCount, 0);
  assert.equal(customClass.unclassifiedCount, 1);
  assert.equal(customClass.hasIncompleteIngredientData, true);
  assert.equal(
    customClass.vegetablePresenceState,
    'INCOMPLETE_DATA',
    'Custom/unmatched logs must be marked INCOMPLETE_DATA rather than claiming vegetables are absent'
  );

  const summaryForCustom = RecommendationEngine.generate(
    { primaryGoal: 'Eat Healthier' },
    [customMeal],
    [customMeal],
    2000
  );
  assert.ok(
    !summaryForCustom.nextAction.description.toLowerCase().includes('light on vegetables'),
    'Daily insights must NOT claim custom meals are light on vegetables'
  );

  // Case B: Known catalogue vegetable dish (e.g., Ndole or Okra Soup)
  const ndoleTemplate = commonFoods.find(f => f.name.toLowerCase().includes('ndole'))!;
  const ndoleLog: ConsumptionRecord = {
    id: 'cat-ndole',
    name: ndoleTemplate.name,
    calories: ndoleTemplate.calories,
    protein: ndoleTemplate.protein,
    carbs: ndoleTemplate.carbs,
    fat: ndoleTemplate.fat,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: Date.now(),
    foodId: ndoleTemplate.id
  };

  const knownVegClass = RecommendationEngine.classifyLoggedMeals([ndoleLog], commonFoods);
  assert.equal(knownVegClass.matchedCount, 1);
  assert.equal(knownVegClass.unclassifiedCount, 0);
  assert.equal(knownVegClass.knownVegetableMealsCount, 1);
  assert.equal(knownVegClass.vegetablePresenceState, 'PRESENT');
});

test('2. Changing logged meals updates contextual suggestions & avoids fixed Eru and Water Fufu 780 kcal lock', () => {
  // With empty logs, should NOT default to 780 kcal Eru and Water Fufu
  const emptyRec = RecommendationEngine.getContextualRecommendation(
    { primaryGoal: 'Eat Healthier' },
    [],
    [],
    commonFoods,
    { dailyGoal: 2000 }
  );
  assert.ok(emptyRec.food, 'Must return a valid catalogue food');
  assert.equal(emptyRec.isCatalogueBacked, true);
  assert.ok(emptyRec.servingBasis && emptyRec.servingBasis.length > 0, 'Must include documented serving basis');
  assert.notEqual(
    emptyRec.food.name,
    'Eru and Water Fufu',
    'Must not hard-lock onto Eru and Water Fufu (780 kcal) as a fixed recommendation'
  );

  // When a user logs a meal, that meal must not be immediately repeated as the primary suggestion,
  // and cycling optionOffset must return distinct catalogue-backed dishes.
  const firstSuggested = emptyRec.food;
  const loggedFirst: ConsumptionRecord = {
    id: 'log-1',
    name: firstSuggested.name,
    calories: firstSuggested.calories,
    protein: firstSuggested.protein,
    carbs: firstSuggested.carbs,
    fat: firstSuggested.fat,
    servings: 1,
    mealCategory: 'Lunch',
    timestamp: Date.now(),
    foodId: firstSuggested.id
  };

  const afterLogRec = RecommendationEngine.getContextualRecommendation(
    { primaryGoal: 'Eat Healthier' },
    [loggedFirst],
    [loggedFirst],
    commonFoods,
    { dailyGoal: 2000, optionOffset: 0 }
  );
  assert.notEqual(
    afterLogRec.food.id,
    firstSuggested.id,
    'Suggestion must adapt when the user logs a meal and not repeat the just-logged dish'
  );

  const cycledRec = RecommendationEngine.getContextualRecommendation(
    { primaryGoal: 'Eat Healthier' },
    [loggedFirst],
    [loggedFirst],
    commonFoods,
    { dailyGoal: 2000, optionOffset: 1 }
  );
  assert.notEqual(
    cycledRec.food.id,
    afterLogRec.food.id,
    'Cycling suggestion offset must offer a different catalogue-backed option'
  );
});

test('3. Rendered AnalyticsView shows transparent counts, incomplete-data banner, catalogue estimate basis, reduced-motion & bottom clearance', async () => {
  const { dom, cleanup } = setupDOM({ reducedMotion: true });
  try {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { act } = React;
    const { default: AnalyticsView } = await import('../src/views/AnalyticsView');
    const { DataContext } = await import('../src/context/DataContext');

    const customMeal: ConsumptionRecord = {
      id: 'custom-today-1',
      name: 'Custom Office Lunch',
      calories: 610,
      protein: 22,
      carbs: 70,
      fat: 20,
      servings: 1,
      mealCategory: 'Lunch',
      timestamp: Date.now(),
      foodId: 'custom-99'
    };

    const mockContext: any = {
      settings: {
        id: 'user-insights-test',
        dailyGoal: 2000,
        onboardingCompleted: true,
        profile: { primaryGoal: 'Eat Healthier' }
      },
      allConsumptions: [customMeal],
      selectedDateConsumptions: [customMeal],
      customFoods: [],
      isLoading: false
    };

    const container = dom.window.document.getElementById('root')!;
    const root = ReactDOMClient.createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(
          DataContext.Provider,
          { value: mockContext },
          React.createElement(AnalyticsView, { onLogFood: () => {} })
        )
      );
    });

    const viewEl = container.querySelector('[data-testid="insights-view"]')!;
    assert.ok(viewEl, 'AnalyticsView must render');
    assert.equal(
      viewEl.getAttribute('data-reduced-motion'),
      'true',
      'AnalyticsView must respect prefers-reduced-motion: reduce'
    );
    assert.ok(
      viewEl.className.includes('pb-44'),
      'AnalyticsView container must have pb-44 bottom padding so bottom nav and floating camera button do not cover content'
    );
    assert.ok(
      container.querySelector('[data-testid="insights-bottom-clearance"]'),
      'AnalyticsView must include bottom clearance spacer'
    );

    // Must show incomplete data disclosure banner for custom/unmatched meal
    const incompleteBanner = container.querySelector('[data-testid="incomplete-data-banner"]');
    assert.ok(incompleteBanner, 'Must display explicit incomplete ingredient data banner when custom/unclassified meals are logged');
    assert.ok(
      incompleteBanner.textContent?.includes('does not infer missing vegetables'),
      'Incomplete data banner must clearly explain that missing vegetables are not inferred'
    );

    // Must NOT claim "Vegetables haven't appeared"
    assert.ok(
      !container.textContent?.includes("Vegetables haven't appeared"),
      'AnalyticsView must never falsely claim vegetables are absent when entries are unclassified'
    );

    // Suggested meal must display catalogue estimate badge with serving basis
    const servingBasisEl = container.querySelector('[data-testid="suggested-meal-serving-basis"]');
    assert.ok(servingBasisEl, 'Suggested meal must identify its catalogue serving basis');
    assert.ok(
      servingBasisEl.textContent?.toLowerCase().includes('catalogue estimate'),
      'Suggested meal nutrition must be explicitly labelled as a catalogue estimate'
    );

    // Clicking "Show another idea" cycles to a different catalogue meal
    const initialSuggestedName = container.querySelector('[data-testid="suggested-meal-name"]')?.textContent;
    const cycleBtn = container.querySelector('[data-testid="cycle-suggestion-btn"]') as HTMLButtonElement;
    assert.ok(cycleBtn, 'Cycle suggestion button must be present');

    await act(async () => {
      cycleBtn.click();
    });

    const nextSuggestedName = container.querySelector('[data-testid="suggested-meal-name"]')?.textContent;
    assert.notEqual(
      nextSuggestedName,
      initialSuggestedName,
      'Clicking Show another idea must update the suggested meal'
    );

    await act(async () => {
      root.unmount();
    });
  } finally {
    cleanup();
  }
});

test('4. WelcomeScreen first-visit flow, reduced-motion support, and SettingsView "View welcome" non-destructive replay', async () => {
  const { dom, cleanup } = setupDOM({ reducedMotion: false });
  try {
    const React = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    const { act } = React;
    const { default: WelcomeScreen } = await import('../src/components/WelcomeScreen');
    const { default: SettingsView } = await import('../src/views/SettingsView');
    const { DataContext } = await import('../src/context/DataContext');
    const { AuthContext } = await import('../src/context/AuthContext');

    const existingSettings: UserSettings = {
      id: 'existing-owner',
      dailyGoal: 2150,
      onboardingCompleted: true,
      profile: {
        primaryGoal: 'Maintain Weight',
        weightKg: 74,
        age: 30
      }
    };

    const existingMeal: ConsumptionRecord = {
      id: 'saved-meal-1',
      name: 'Rice and Beans',
      calories: 500,
      protein: 18,
      carbs: 85,
      fat: 9,
      servings: 1,
      mealCategory: 'Dinner',
      timestamp: Date.now()
    };

    let settingsMutated = false;
    let mealsCleared = false;
    let welcomeOpenedFromSettings = false;

    const mockDataContext: any = {
      settings: existingSettings,
      updateSettings: async () => {
        settingsMutated = true;
      },
      clearAllData: async () => {
        mealsCleared = true;
      },
      allConsumptions: [existingMeal],
      selectedDateConsumptions: [existingMeal],
      customFoods: [],
      isLoading: false,
      isCloudSynced: false,
      syncStatus: 'idle',
      syncError: null,
      retrySync: async () => {}
    };

    const mockAuthContext: any = {
      user: null,
      loading: false,
      signInWithGoogle: async () => {},
      logout: async () => {}
    };

    const container = dom.window.document.getElementById('root')!;
    const root = ReactDOMClient.createRoot(container);

    // Part A: Render SettingsView and verify "View welcome" button triggers non-destructive preview
    await act(async () => {
      root.render(
        React.createElement(
          AuthContext.Provider,
          { value: mockAuthContext },
          React.createElement(
            DataContext.Provider,
            { value: mockDataContext },
            React.createElement(SettingsView, {
              onOpenOnboarding: () => {},
              onOpenWelcome: () => {
                welcomeOpenedFromSettings = true;
              }
            })
          )
        )
      );
    });

    const viewWelcomeBtn = container.querySelector('[data-testid="view-welcome-btn"]') as HTMLButtonElement;
    assert.ok(viewWelcomeBtn, 'SettingsView must include the "View welcome" button in Profile/Settings');

    await act(async () => {
      viewWelcomeBtn.click();
    });

    assert.equal(welcomeOpenedFromSettings, true, 'Clicking "View welcome" must invoke onOpenWelcome');
    assert.equal(settingsMutated, false, 'Clicking "View welcome" must NOT mutate or reset profile settings');
    assert.equal(mealsCleared, false, 'Clicking "View welcome" must NOT clear or alter saved meals');

    // Part B: Render WelcomeScreen and verify Start -> Auth Choice (Google Sign-In or Guest) -> Onboarding transition
    let proceededToOnboarding = false;
    let dismissedToDashboard = false;

    await act(async () => {
      root.render(
        React.createElement(
          AuthContext.Provider,
          { value: mockAuthContext },
          React.createElement(WelcomeScreen, {
            isReplay: true,
            onProceedToOnboarding: () => {
              proceededToOnboarding = true;
            },
            onDismissToDashboard: () => {
              dismissedToDashboard = true;
            }
          })
        )
      );
    });

    const welcomeEl = container.querySelector('[data-testid="welcome-screen"]');
    assert.ok(welcomeEl, 'WelcomeScreen must render');
    assert.ok(
      container.querySelector('[data-testid="welcome-moving-plate"]'),
      'WelcomeScreen must render the animated local meal graphic'
    );

    // Click Start button
    const startBtn = container.querySelector('[data-testid="welcome-start-btn"]') as HTMLButtonElement;
    assert.ok(startBtn, 'WelcomeScreen must have a clear Start button');

    await act(async () => {
      startBtn.click();
    });

    // Must reveal Google Sign-In and Continue as Guest options
    const googleBtn = container.querySelector('[data-testid="welcome-google-signin-btn"]');
    const guestBtn = container.querySelector('[data-testid="welcome-continue-guest-btn"]') as HTMLButtonElement;
    assert.ok(googleBtn, 'After clicking Start, Google sign-in option must be visible');
    assert.ok(guestBtn, 'After clicking Start, Continue as Guest option must be visible');

    await act(async () => {
      guestBtn.click();
    });
    assert.equal(proceededToOnboarding, true, 'Choosing Continue as Guest must proceed to optional profile onboarding');

    // Verify quick return to app in replay mode leaves data untouched
    const skipToAppBtn = container.querySelector('[data-testid="welcome-skip-to-app-btn"]') as HTMLButtonElement;
    await act(async () => {
      skipToAppBtn.click();
    });
    assert.equal(dismissedToDashboard, true, 'Dismissing welcome replay returns directly to Dashboard');
    assert.equal(settingsMutated, false, 'Replaying welcome screen must not mutate user settings');

    await act(async () => {
      root.unmount();
    });
  } finally {
    cleanup();
  }
});

test('5. Bilingual EN/FR parity for all new Insights and Welcome translation keys', () => {
  const requiredNewKeys: Array<keyof typeof translations.en> = [
    'insights_time_window_today',
    'insights_time_window_week',
    'insights_catalogue_coverage',
    'insights_incomplete_data_title',
    'insights_incomplete_data_desc',
    'insights_partial_day_desc',
    'insights_catalogue_estimate_badge',
    'insights_optional_badge',
    'welcome_badge',
    'welcome_title',
    'welcome_subtitle',
    'welcome_start_btn',
    'welcome_choose_how_to_begin',
    'welcome_continue_guest',
    'welcome_back_to_app',
    'view_welcome_btn',
    'view_welcome_desc'
  ];

  for (const key of requiredNewKeys) {
    assert.ok(
      typeof translations.en[key] === 'string' && translations.en[key].trim().length > 0,
      `English translation missing for ${key}`
    );
    assert.ok(
      typeof translations.fr[key] === 'string' && translations.fr[key].trim().length > 0,
      `French translation missing for ${key}`
    );
  }
});
