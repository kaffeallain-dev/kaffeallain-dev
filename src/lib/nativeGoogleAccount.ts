import { Capacitor, registerPlugin } from '@capacitor/core';

interface GoogleAccountPlugin {
  signIn(options: { webClientId: string }): Promise<{ idToken: string }>;
  clearSession(): Promise<void>;
}

export const isAndroid = Capacitor.getPlatform() === 'android';
export const androidGoogleClientId = import.meta.env.VITE_ANDROID_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
export const nativeGoogleAccount = registerPlugin<GoogleAccountPlugin>('GoogleAccount');
