import { Capacitor } from '@capacitor/core';
import { auth } from './firebase';

export function apiUrl(route: string): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  if (configured && !configured.startsWith('https://')) throw new Error('API must use HTTPS');
  if (Capacitor.isNativePlatform() && !configured) throw new Error('Android cloud service is not configured');
  return `${configured}/api/${route}`;
}
export async function accountRequest(route: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('sign_in_required');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const { signal } = options;
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 35_000);
  try {
    const token = await user.getIdToken();
    if (auth.currentUser?.uid !== user.uid) throw new Error('sign_in_required');
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(apiUrl(route), { ...options, headers, signal: controller.signal });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.code || 'service_unavailable');
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
