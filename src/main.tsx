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

// Registro do Service Worker e Periodic Background Sync para notificações confiáveis
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(async (registration) => {
        // Tenta registrar Periodic Background Sync se suportado
        try {
          if ('periodicSync' in registration) {
            const periodicSync = (registration as any).periodicSync;
            const tags = await periodicSync.getTags();
            if (!tags.includes('verificar-vencimentos-em-dia')) {
              await periodicSync.register('verificar-vencimentos-em-dia', {
                minInterval: 12 * 60 * 60 * 1000, // a cada 12 horas
              });
            }
          }
        } catch {
          // Ignora caso permissão ou suporte a periodicSync não esteja disponível
        }
      })
      .catch((err) => {
        console.warn('Aviso no registro do Service Worker:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
