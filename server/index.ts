import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createApi } from './api';
import { createServices } from './services';
const app = express();
app.disable('x-powered-by');
const limit = (key: string, fallback: number, max: number) => {
  const value = Number(process.env[key] || fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${key}`);
  return value;
};
app.use('/api', createApi(createServices(), {
  scansEnabled: process.env.ENABLE_CLOUD_SCANS === 'true' && !!process.env.GEMINI_API_KEY && !!process.env.GEMINI_MODEL,
  deletionEnabled: process.env.ENABLE_ACCOUNT_DELETION === 'true',
  dailyLimit: limit('SCAN_DAILY_LIMIT', 5, 100),
  globalLimit: limit('SCAN_GLOBAL_DAILY_LIMIT', 50, 10000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean),
}));
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const web = path.resolve('dist/web');
  app.use(express.static(web));
  app.get('*', (_req, res) => res.sendFile(path.join(web, 'index.html')));
}
app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('MboaFit server ready'));
