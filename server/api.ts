import express from 'express';
import { createHash } from 'node:crypto';
export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export interface Identity { uid: string; auth_time: number }
export interface ScanInput { uid: string; key: string; fingerprint: string; now: number; dailyLimit: number; globalLimit: number }
export interface ApiDependencies {
  verify(token: string): Promise<Identity>;
  claim(input: ScanInput): Promise<{ cached?: unknown }>;
  finish(uid: string, key: string, result: unknown, failed: boolean): Promise<void>;
  detect(image: string, mime: string): Promise<unknown>;
  deleteAccount(uid: string): Promise<void>;
}
export interface ApiConfig { scansEnabled: boolean; deletionEnabled: boolean; dailyLimit: number; globalLimit: number; allowedOrigins: string[] }
export function validateImage(body: unknown) {
  const image = (body as any)?.imageBase64;
  if (typeof image !== 'string' || !image.length || image.length > 5_592_408 || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new ApiError(400, 'invalid_image');
  const bytes = Buffer.from(image, 'base64');
  if (bytes.length > 4 * 1024 * 1024 || bytes.toString('base64') !== image) throw new ApiError(413, 'image_too_large');
  let mime: string;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
  else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'image/png';
  else if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') mime = 'image/webp';
  else throw new ApiError(400, 'unsupported_image');
  return { image, mime, fingerprint: createHash('sha256').update(bytes).digest('hex') };
}
export function validateFoods(value: any) {
  if (!Array.isArray(value?.foods) || value.foods.length > 20) throw new ApiError(502, 'invalid_ai_response');
  return { foods: value.foods.map((food: any) => {
    if (typeof food?.detectedName !== 'string' || !food.detectedName.trim() || food.detectedName.length > 160 || !Number.isFinite(food.confidence) || food.confidence < 0 || food.confidence > 1 || !Number.isFinite(food.estimatedAreaPercentage) || food.estimatedAreaPercentage < 0 || food.estimatedAreaPercentage > 1 || typeof food.category !== 'string' || food.category.length > 80) throw new ApiError(502, 'invalid_ai_response');
    return { detectedName: food.detectedName.trim(), confidence: food.confidence, estimatedAreaPercentage: food.estimatedAreaPercentage, category: food.category };
  }) };
}
export function createApi(deps: ApiDependencies, config: ApiConfig) {
  const api = express.Router();
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(origin && config.allowedOrigins.includes(origin) ? 204 : 403).end();
    next();
  });
  api.get('/capabilities', (_req, res) => res.json({ scansEnabled: config.scansEnabled, deletionEnabled: config.deletionEnabled }));
  api.use(async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ code: 'sign_in_required' });
    try {
      const identity = await deps.verify(match[1]);
      if (!identity.uid) throw new ApiError(401, 'invalid_identity');
      res.locals.identity = identity;
      next();
    } catch (error) {
      const known = error instanceof ApiError ? error : new ApiError(503, 'account_service_unavailable');
      res.status(known.status).json({ code: known.code });
    }
  });
  api.use(express.json({ limit: '6mb', strict: true }));
  api.post('/detect-food', async (req, res) => {
    let claimed = false;
    const uid = res.locals.identity.uid;
    const key = req.headers['idempotency-key'];
    try {
      if (!config.scansEnabled) throw new ApiError(503, 'scanning_unavailable');
      if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new ApiError(400, 'invalid_request_id');
      const { image, mime, fingerprint } = validateImage(req.body);
      const claim = await deps.claim({ uid, key, fingerprint, now: Date.now(), dailyLimit: config.dailyLimit, globalLimit: config.globalLimit });
      if (claim.cached !== undefined) return res.json(claim.cached);
      claimed = true;
      const result = validateFoods(await deps.detect(image, mime));
      await deps.finish(uid, key, result, false);
      return res.json(result);
    } catch (error) {
      if (claimed && typeof key === 'string') await deps.finish(uid, key, null, true).catch(() => {});
      const known = error instanceof ApiError ? error : new ApiError(502, 'scan_failed');
      if (known.status === 429) res.setHeader('Retry-After', '3600');
      return res.status(known.status).json({ code: known.code });
    }
  });
  api.delete('/account', async (req, res) => {
    try {
      if (!config.deletionEnabled) throw new ApiError(503, 'account_deletion_unavailable');
      const identity: Identity = res.locals.identity;
      const age = Math.floor(Date.now() / 1000) - identity.auth_time;
      if (!Number.isFinite(age) || age < -60 || age > 300) throw new ApiError(403, 'recent_sign_in_required');
      if (req.body?.confirmation !== 'DELETE') throw new ApiError(400, 'confirmation_required');
      await deps.deleteAccount(identity.uid);
      return res.json({ deleted: true });
    } catch (error) {
      const known = error instanceof ApiError ? error : new ApiError(503, 'account_deletion_incomplete');
      return res.status(known.status).json({ code: known.code });
    }
  });
  api.use((error: any, _req: any, res: any, _next: any) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ code: 'invalid_request_body' });
  });
  return api;
}
