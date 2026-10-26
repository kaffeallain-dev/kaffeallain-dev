import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { GoogleGenAI, Type } from '@google/genai';
import { createHash } from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json';
import { ApiError, type ApiDependencies, type ScanInput } from './api';
export function createServices(overrides: { db?: Firestore; auth?: Auth } = {}): ApiDependencies {
  const app = getApps().find(a => a.name === 'mboafit-server') || initializeApp({ credential: applicationDefault(), projectId: firebaseConfig.projectId }, 'mboafit-server');
  const auth = overrides.auth || getAuth(app);
  const db = overrides.db || getFirestore(app, firebaseConfig.firestoreDatabaseId);
  const requestRef = (uid: string, key: string) => db.doc(`_scanUsers/${uid}/requests/${createHash('sha256').update(key).digest('hex')}`);
  return {
    async verify(token) {
      try { return await auth.verifyIdToken(token, true); }
      catch (error: any) {
        if (['auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error', 'auth/invalid-id-token', 'auth/user-disabled', 'auth/user-not-found'].includes(error?.code)) throw new ApiError(401, 'sign_in_required');
        throw new ApiError(503, 'account_service_unavailable');
      }
    },
    async claim(input: ScanInput) {
      const day = new Date(input.now).toISOString().slice(0, 10);
      const request = requestRef(input.uid, input.key);
      const userDay = db.doc(`_scanUsers/${input.uid}/days/${day}`);
      const globalDay = db.doc(`_scanGlobal/${day}`);
      return db.runTransaction(async tx => {
        const [job, prior, usage, global] = await tx.getAll(db.doc(`_accountDeletion/${input.uid}`), request, userDay, globalDay);
        if (job.exists) throw new ApiError(409, 'account_deletion_in_progress');
        if (prior.exists) {
          const data = prior.data()!;
          if (data.fingerprint !== input.fingerprint) throw new ApiError(409, 'request_id_reused');
          if (data.status === 'complete') return { cached: data.result };
          throw new ApiError(409, data.status === 'failed' ? 'previous_scan_failed' : 'scan_in_progress');
        }
        const used = usage.data()?.count || 0, total = global.data()?.count || 0;
        if (used >= input.dailyLimit || total >= input.globalLimit) throw new ApiError(429, 'scan_quota_reached');
        tx.set(request, { fingerprint: input.fingerprint, status: 'processing', createdAt: input.now });
        tx.set(userDay, { count: used + 1 });
        tx.set(globalDay, { count: total + 1 });
        return {};
      });
    },
    async finish(uid, key, result, failed) {
      await db.runTransaction(async tx => {
        const [job, request] = await tx.getAll(db.doc(`_accountDeletion/${uid}`), requestRef(uid, key));
        if (!job.exists && request.exists) tx.update(request.ref, { status: failed ? 'failed' : 'complete', result, completedAt: Date.now() });
      });
    },
    async detect(image, mime) {
      if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) throw new ApiError(503, 'scanning_unavailable');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 25_000 } });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL,
        contents: [{ inlineData: { data: image, mimeType: mime } }, { text: 'Identify visible meal components, considering Cameroonian dishes. Return foods with detectedName, confidence (0..1), estimatedAreaPercentage (0..1), and category. Return an empty foods array when no food is identifiable. Never invent foods or medical advice. Image portions are approximate and require user confirmation.' }],
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, required: ['foods'], properties: { foods: { type: Type.ARRAY, items: { type: Type.OBJECT, required: ['detectedName', 'confidence', 'estimatedAreaPercentage', 'category'], properties: { detectedName: { type: Type.STRING }, confidence: { type: Type.NUMBER }, estimatedAreaPercentage: { type: Type.NUMBER }, category: { type: Type.STRING } } } } } } },
      });
      try { return JSON.parse(response.text || '{}'); }
      catch { throw new ApiError(502, 'invalid_ai_response'); }
    },
    async deleteAccount(uid) {
      const job = db.doc(`_accountDeletion/${uid}`);
      await job.set({ phase: 'deleting', startedAt: Date.now() }, { merge: true });
      await db.recursiveDelete(db.doc(`users/${uid}`));
      await db.recursiveDelete(db.doc(`_scanUsers/${uid}`));
      try { await auth.deleteUser(uid); }
      catch (error: any) { if (error?.code !== 'auth/user-not-found') throw error; }
      await job.set({ phase: 'complete', completedAt: Date.now() });
    },
  };
}
