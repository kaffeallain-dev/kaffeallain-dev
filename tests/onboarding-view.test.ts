import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Exercise the real view while mocking only its account-data boundary.
// Loading the entire Firebase browser SDK inside a Node/JSDOM environment is not a view test.
async function withView(profile: any, run: (container: HTMLElement, calls: any) => Promise<void>) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
  const keys = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'SVGElement', 'Element', 'requestAnimationFrame', 'cancelAnimationFrame', 'IS_REACT_ACT_ENVIRONMENT', '__mboaContextTest'];
  const previous = new Map(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const context = React.createContext<any>(null);
  const calls = { close: 0, complete: 0, writes: [] as any[] };
  const settings = { id: 'guest-test', dailyGoal: 2000, profile };
  const value = { settings, updateSettings: async (next: any) => { calls.writes.push(next); } };
  for (const key of ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'SVGElement', 'Element']) Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : (dom.window as any)[key], writable: true, configurable: true });
  (globalThis as any).requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  (globalThis as any).cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).__mboaContextTest = context;
  const cacheRoot = path.resolve('node_modules');
  const directory = await mkdtemp(path.join(cacheRoot, '.mboafit-view-test-'));
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  try {
    const result = await build({
      entryPoints: ['src/views/OnboardingView.tsx'], bundle: true, platform: 'node', format: 'cjs', write: false,
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      plugins: [{ name: 'account-context-boundary', setup(builder) {
        builder.onResolve({ filter: /context\/DataContext$/ }, () => ({ path: 'test-account-context', namespace: 'boundary' }));
        builder.onLoad({ filter: /.*/, namespace: 'boundary' }, () => ({ contents: "import React from 'react'; export const useData=()=>React.useContext(globalThis.__mboaContextTest);", loader: 'js' }));
      } }],
    });
    const modulePath = path.join(directory, 'view.cjs'); await writeFile(modulePath, result.outputFiles[0].contents);
    const loaded = await import(pathToFileURL(modulePath).href);
    const View = loaded.default.default || loaded.default;
    await act(async () => root.render(React.createElement(context.Provider, { value }, React.createElement(View, { onClose: () => calls.close++, onComplete: () => calls.complete++ }))));
    await run(container as any, calls);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const key of keys) { const descriptor = previous.get(key); if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
    if (!directory.startsWith(cacheRoot + path.sep)) throw new Error('Unexpected test output path');
    await rm(directory, { recursive: true, force: true });
  }
}
test('real onboarding close invokes callback without saving existing profile', { timeout: 15000 }, () => withView({ age: 26, primaryGoal: 'Build Muscle', weightKg: 78 }, async (container, calls) => {
  const button = [...container.querySelectorAll('button')].find(x => /Close & Return/.test(x.textContent || x.getAttribute('aria-label') || ''));
  assert.ok(button); await act(async () => button.click());
  assert.equal(calls.close, 1); assert.equal(calls.complete, 0); assert.deepEqual(calls.writes, []);
}));
test('real onboarding permits Skip without inventing a fitness goal', { timeout: 15000 }, () => withView({}, async (container, calls) => {
  const button = [...container.querySelectorAll('button')].find(x => x.textContent?.trim() === 'Skip');
  assert.ok(button); await act(async () => button.click());
  assert.equal(calls.complete, 1); assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].onboardingCompleted, true); assert.equal(calls.writes[0].dailyGoal, 2000); assert.equal(calls.writes[0].profile.primaryGoal, undefined);
}));
