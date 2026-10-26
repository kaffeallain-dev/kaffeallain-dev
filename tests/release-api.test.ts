import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createApi, ApiError, validateFoods, type ApiDependencies, type ApiConfig } from '../server/api';
import { createServices } from '../server/services';

const config: ApiConfig = { scansEnabled: true, deletionEnabled: true, dailyLimit: 5, globalLimit: 50, allowedOrigins: ['https://localhost'] };
const image = Buffer.from([255, 216, 255, 224, 0, 1, 2, 3]).toString('base64');
const foods = { foods: [{ detectedName: 'rice', confidence: 0.6, estimatedAreaPercentage: 0.5, category: 'starch' }] };
async function withApi(run: (url: string, calls: any) => Promise<void>, override: Partial<ApiDependencies> = {}, settings = config) {
  const calls = { provider: 0, deletion: [] as string[], finish: 0 };
  const deps: ApiDependencies = {
    verify: async token => { if (token !== 'verified') throw new ApiError(401, 'sign_in_required'); return { uid: 'owner-A', auth_time: Math.floor(Date.now() / 1000) }; },
    claim: async () => ({}),
    finish: async () => { calls.finish++; },
    detect: async () => { calls.provider++; return foods; },
    deleteAccount: async uid => { calls.deletion.push(uid); },
    ...override,
  };
  const app = express(); app.use('/api', createApi(deps, settings));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as any).port}/api`, calls); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const scan = (url: string, body: unknown = { imageBase64: image }, token = 'verified', key = 'request-id-123456') => fetch(url + '/detect-food', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': key }, body: JSON.stringify(body) });

test('scan denies missing/forged identities before any provider call', () => withApi(async (url, calls) => {
  assert.equal((await fetch(url + '/detect-food', { method: 'POST' })).status, 401);
  assert.equal((await scan(url, { imageBase64: image }, 'forged')).status, 401);
  assert.equal(calls.provider, 0);
}));
test('scan validates input and request IDs before billing', () => withApi(async (url, calls) => {
  for (const body of [{}, { imageBase64: 123 }, { imageBase64: 'not an image' }, { imageBase64: Buffer.from('text').toString('base64') }]) assert.equal((await scan(url, body)).status, 400);
  assert.equal((await scan(url, { imageBase64: image }, 'verified', 'tiny')).status, 400);
  assert.equal(calls.provider, 0);
}));
test('scan validates model output, returns facts and never raw provider errors', () => withApi(async (url, calls) => {
  const result = await scan(url); assert.equal(result.status, 200); assert.deepEqual(await result.json(), foods); assert.equal(calls.provider, 1);
}));
test('AI failure is explicit and records a failed attempt', () => withApi(async (url, calls) => {
  const result = await scan(url); assert.equal(result.status, 502); assert.deepEqual(await result.json(), { code: 'scan_failed' }); assert.equal(calls.finish, 1);
}, { detect: async () => { throw new Error('secret provider internals'); } }));
test('cached request does not call the provider again', () => withApi(async (url, calls) => {
  const result = await scan(url); assert.equal(result.status, 200); assert.deepEqual(await result.json(), foods); assert.equal(calls.provider, 0);
}, { claim: async () => ({ cached: foods }) }));
test('quota rejection is surfaced with retry instructions', () => withApi(async (url, calls) => {
  const result = await scan(url); assert.equal(result.status, 429); assert.ok(result.headers.get('retry-after')); assert.equal(calls.provider, 0);
}, { claim: async () => { throw new ApiError(429, 'scan_quota_reached'); } }));
test('cloud features default-disabled do not perform destructive or billable calls', () => withApi(async (url, calls) => {
  assert.equal((await scan(url)).status, 503);
  assert.equal((await fetch(url + '/account', { method: 'DELETE', headers: { Authorization: 'Bearer verified', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }) })).status, 503);
  assert.equal(calls.provider, 0); assert.deepEqual(calls.deletion, []);
}, {}, { ...config, scansEnabled: false, deletionEnabled: false }));
test('deletion requires recent authentication and exact confirmation', () => withApi(async (url, calls) => {
  const result = await fetch(url + '/account', { method: 'DELETE', headers: { Authorization: 'Bearer verified', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }) });
  assert.equal(result.status, 403); assert.deepEqual(calls.deletion, []);
}, { verify: async () => ({ uid: 'owner-A', auth_time: 1 }) }));
test('deletion targets verified identity, ignoring supplied userId', () => withApi(async (url, calls) => {
  const headers = { Authorization: 'Bearer verified', 'Content-Type': 'application/json' };
  assert.equal((await fetch(url + '/account', { method: 'DELETE', headers, body: JSON.stringify({ confirmation: 'yes' }) })).status, 400);
  const result = await fetch(url + '/account', { method: 'DELETE', headers, body: JSON.stringify({ confirmation: 'DELETE', userId: 'victim-B' }) });
  assert.equal(result.status, 200); assert.deepEqual(calls.deletion, ['owner-A']);
}));
test('partial deletion never returns false success', () => withApi(async (url) => {
  const result = await fetch(url + '/account', { method: 'DELETE', headers: { Authorization: 'Bearer verified', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE' }) });
  assert.equal(result.status, 503); assert.deepEqual(await result.json(), { code: 'account_deletion_incomplete' });
}, { deleteAccount: async () => { throw new Error('retry needed'); } }));
test('CORS only permits configured native origin', () => withApi(async url => {
  assert.equal((await fetch(url + '/detect-food', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } })).status, 403);
  const valid = await fetch(url + '/detect-food', { method: 'OPTIONS', headers: { Origin: 'https://localhost' } }); assert.equal(valid.status, 204); assert.equal(valid.headers.get('access-control-allow-origin'), 'https://localhost');
}));
test('model facts reject non-finite, out-of-range and oversized responses', () => {
  assert.throws(() => validateFoods({ foods: [{ ...foods.foods[0], confidence: NaN }] }));
  assert.throws(() => validateFoods({ foods: [{ ...foods.foods[0], estimatedAreaPercentage: 3 }] }));
  assert.throws(() => validateFoods({ foods: new Array(21).fill(foods.foods[0]) }));
});

// Boundary mock: production services execute their real transactions and deletion order.
function storageFixture() {
  const data = new Map<string, any>(); let chain = Promise.resolve(); let failDelete = false;
  const snapshot = (ref: any) => ({ ref, exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) });
  const db: any = {
    doc: (path: string) => ({ path, set: async (value: any) => { data.set(path, value); } }),
    runTransaction: (run: any) => {
      const result = chain.then(() => run({ getAll: async (...refs: any[]) => refs.map(snapshot), set: (ref: any, value: any) => data.set(ref.path, structuredClone(value)), update: (ref: any, value: any) => data.set(ref.path, { ...data.get(ref.path), ...structuredClone(value) }) }));
      chain = result.catch(() => {}); return result;
    },
    recursiveDelete: async (ref: any) => { if (failDelete) { failDelete = false; throw new Error('interrupted'); } for (const key of data.keys()) if (key === ref.path || key.startsWith(ref.path + '/')) data.delete(key); },
  };
  const auth: any = { deleteUser: async (uid: string) => { data.delete('auth/' + uid); }, verifyIdToken: async (_token: string, revoked: boolean) => { assert.equal(revoked, true); return { uid: 'A', auth_time: 1 }; } };
  return { services: createServices({ db, auth }), data, failNextDelete: () => { failDelete = true; } };
}
const input = (uid: string, key: string) => ({ uid, key, fingerprint: 'image-hash', now: Date.now(), dailyLimit: 5, globalLimit: 50 });
test('production quota transaction enforces concurrent daily limit', async () => {
  const { services, data } = storageFixture();
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, n) => services.claim(input('A', `request-${n}`))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 5);
  assert.equal(data.get(`_scanUsers/A/days/${new Date().toISOString().slice(0, 10)}`).count, 5);
});
test('production transaction deduplicates, rejects image substitution and preserves user isolation', async () => {
  const { services } = storageFixture();
  await services.claim(input('A', 'same-request'));
  await assert.rejects(services.claim(input('A', 'same-request')), /scan_in_progress/);
  await services.finish('A', 'same-request', foods, false);
  assert.deepEqual((await services.claim(input('A', 'same-request'))).cached, foods);
  await assert.rejects(services.claim({ ...input('A', 'same-request'), fingerprint: 'different' }), /request_id_reused/);
  assert.deepEqual(await services.claim(input('B', 'same-request')), {});
});
test('production account cleanup resumes after failure and blocks late scan writes', async () => {
  const fixture = storageFixture(); const { services, data } = fixture;
  data.set('users/A', {}); data.set('users/A/meals/one', {}); data.set('users/B/meals/keep', {}); data.set('auth/A', {});
  await services.claim(input('A', 'pending'));
  fixture.failNextDelete(); await assert.rejects(services.deleteAccount('A'));
  assert.equal(data.get('_accountDeletion/A').phase, 'deleting');
  await assert.rejects(services.claim(input('A', 'new')), /account_deletion_in_progress/);
  await services.deleteAccount('A'); await services.finish('A', 'pending', foods, false);
  assert.equal(data.get('_accountDeletion/A').phase, 'complete');
  assert.ok(data.has('users/B/meals/keep')); assert.ok(!data.has('auth/A'));
  assert.ok(![...data.keys()].some(k => k.startsWith('users/A') || k.startsWith('_scanUsers/A/')));
});
