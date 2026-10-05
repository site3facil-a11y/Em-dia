import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Notifica imediatamente que o bundle JavaScript foi inicializado para evitar rollback automático
CapacitorUpdater.notifyAppReady().catch((err) => {
  console.warn('CapacitorUpdater.notifyAppReady aviso:', err);
});

createRoot(document.getElementById('root')!).render(<App />);
