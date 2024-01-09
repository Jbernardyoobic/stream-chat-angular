import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'stream-sample-capacitor',
  webDir: 'dist/sample-app',
  server: {
    androidScheme: 'https',
  },
};

export default config;
