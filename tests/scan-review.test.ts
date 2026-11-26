import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ResultsScreen } from '../src/components/ResultsScreen';
import type { FoodRecognitionResult, RecognizedItemDetails } from '../src/features/vision/domain/pipeline/FoodRecognitionPipelineTypes';

const image = { image: 'data:image/jpeg;base64,AA==', width: 320, height: 240, orientation: 0, quality: 1, blurScore: 120, brightnessScore: 120 };

test('scan review separates empty outcomes and requires a verified food and portion for rice and beans', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
  const keys = ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'] as const;
  const originals = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  })) Object.defineProperty(globalThis, key, { value, configurable: true });
  const container = document.querySelector('#root')!;
  const root = createRoot(container);
  let confirmed: FoodRecognitionResult | undefined;
  const render = (result: FoodRecognitionResult) => act(async () => root.render(React.createElement(ResultsScreen, {
    key: result.outcome, result, onConfirm: value => { confirmed = value; }, onRetake: () => {}, onManualAdd: () => {},
  })));
  const button = (label: RegExp) => [...container.querySelectorAll('button')].find(element => label.test(element.textContent ?? ''));

  try {
    for (const [outcome, title] of [['non_food', 'No meal visible'], ['uncertain', 'The meal could not be identified']] as const) {
      await render({ outcome, image, items: [] });
      assert.equal(container.querySelector('h2')?.textContent, title);
      assert.equal(button(/Review meal/), undefined);
      assert.ok(button(/Log Manually/));
    }
    const match = { foodKnowledgeId: '', fallbackSuggestions: [] } as unknown as RecognizedItemDetails['match'];
    await render({ outcome: 'food', image, items: [{ detectionId: 'cloud-0', detectedLabel: 'Rice and Beans', match }] });
    assert.equal(button(/Review meal/)?.disabled, true);
    await act(async () => button(/^Rice and Beans$/)!.click());
    assert.equal(button(/Review meal/)?.disabled, true);
    await act(async () => button(/^1 catalog serving/)!.click());
    assert.equal(button(/Review meal/)?.disabled, false);
    await act(async () => button(/Review meal/)!.click());
    assert.equal(confirmed?.items[0].food?.name, 'Rice and Beans');
    assert.ok(confirmed?.items[0].grams);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [index, key] of keys.entries()) {
      const previous = originals[index];
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
