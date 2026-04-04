import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradify.app',
  appName: 'Tradify',
  webDir: 'dist',
  server: {
    url: 'https://tradify-usdc.vercel.app/',
    cleartext: false,
    allowNavigation: [
      'tradify-usdc.vercel.app'
    ]
  },
  android: {
    allowMixedContent: false,
    captureInput: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#0B0E11",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#F3BA2F",
      splashFullScreen: true,
      splashImmersive: true,
    }
  }
};

export default config;
