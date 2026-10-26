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
  const response = await fetch(apiUrl(route), {
    ...options,
    headers: { ...options.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    signal: AbortSignal.timeout(35_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.code || 'service_unavailable');
  return result;
}
