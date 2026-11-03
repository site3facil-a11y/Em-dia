import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen as NativeSplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

// 1. Notifica a camada nativa que o JavaScript inicializou com sucesso
// CRÍTICO: notifyAppReady() DEVE ser chamado no carregamento do bundle para evitar
// o rollback automático de 10s no Android nativo.
try {
  if (Capacitor.isPluginAvailable('CapacitorUpdater')) {
    CapacitorUpdater.notifyAppReady().catch((err) => {
      console.warn('CapacitorUpdater.notifyAppReady aviso no main:', err);
    });
  }
} catch (err) {
  console.warn('Erro ao chamar notifyAppReady no main:', err);
}

// 2. Garante que SplashScreen nativa só seja chamada com try/catch e verificação de plugin
try {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SplashScreen')) {
    NativeSplashScreen.hide().catch((err) => {
      console.warn('NativeSplashScreen.hide aviso:', err);
    });
  }
} catch (err) {
  console.warn('Erro ao verificar SplashScreen nativa:', err);
}

// Remove qualquer Service Worker residual para garantir que não haja PWA ativo
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
