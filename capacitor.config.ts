import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mycompany.myapp',
  appName: 'Veritas Ledger',
  webDir: 'dist', // This must be 'dist'
  bundledWebRuntime: false,
};

export default config;