import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.advaitsolutions.hydrocolon',
  appName: 'Dasatva',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
