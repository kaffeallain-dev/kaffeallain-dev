import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'dev.kaffeallain.mboafit.beta',
  appName: 'MboaFit Beta',
  webDir: 'dist/web',
  server: { androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
};
export default config;
