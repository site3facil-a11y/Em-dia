import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen as NativeSplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

// Garante que a SplashScreen nativa seja liberada e o app considerado pronto imediatamente
if (Capacitor.isNativePlatform()) {
  NativeSplashScreen.hide().catch((err) => {
    console.warn('NativeSplashScreen.hide aviso:', err);
  });
}

CapacitorUpdater.notifyAppReady().catch((err) => {
  console.warn('CapacitorUpdater.notifyAppReady aviso:', err);
});

createRoot(document.getElementById('root')!).render(<App />);
