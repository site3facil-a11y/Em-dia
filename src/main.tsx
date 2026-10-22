import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen as NativeSplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

// 1. Contador de falhas de inicialização (Item 2)
// Aumenta no início da inicialização e zera depois do sucesso completo da primeira tela
try {
  const falhasStr = localStorage.getItem('init_falhas') || '0';
  const falhas = parseInt(falhasStr, 10) || 0;
  if (falhas >= 2) {
    console.error(`[Updater] ${falhas} falhas consecutivas de inicialização detectadas. Restaurando versão original do APK...`);
    localStorage.setItem('init_falhas', '0');
    localStorage.setItem('ultima_atualizacao_falhou', 'true');
    if (Capacitor.isPluginAvailable('CapacitorUpdater')) {
      CapacitorUpdater.reset()
        .catch((err) => console.warn('Erro ao resetar CapacitorUpdater:', err))
        .finally(() => {
          window.location.reload();
        });
    } else {
      window.location.reload();
    }
  } else {
    localStorage.setItem('init_falhas', String(falhas + 1));
  }
} catch (e) {
  console.warn('Aviso ao verificar contador init_falhas no main.tsx:', e);
}

// 2. Garante que SplashScreen nativa só seja chamada com try/catch e verificação de plugin (Item 3)
try {
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SplashScreen')) {
    NativeSplashScreen.hide().catch((err) => {
      console.warn('NativeSplashScreen.hide aviso:', err);
    });
  }
} catch (err) {
  console.warn('Erro ao verificar SplashScreen nativa:', err);
}

// NOTA (Item 1): CapacitorUpdater.notifyAppReady() foi REMOVIDO do início do app!
// Ele é chamado ESTRITAMENTE em App.tsx após o banco abrir, as migrações terminarem e a primeira tela renderizar.

// Remove qualquer Service Worker residual para garantir que não haja PWA ativo
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
