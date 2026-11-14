import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myteleproject.vexatradetransactiontools',
  appName: 'VexaTrade Transaction Tools',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#080f1c',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile'
  },
  android: {
    backgroundColor: '#080f1c',
    allowMixedContent: false
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
