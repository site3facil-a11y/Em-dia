import confetti from 'canvas-confetti';
import { StatusParcela } from '../types';

export function formatarMoeda(valor?: number | null): string {
  if (valor === undefined || valor === null || isNaN(valor)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export function formatarData(dataStr?: string | null): string {
  if (!dataStr) return '-';
  const partes = dataStr.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

export function formatarMesAno(mesAnoStr: string): string {
  if (!mesAnoStr || mesAnoStr === 'todos') return 'Todos os Meses';
  const [ano, mes] = mesAnoStr.split('-');
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(mes, 10) - 1;
  if (idx >= 0 && idx < 12) {
    return `${nomesMeses[idx]} de ${ano}`;
  }
  return mesAnoStr;
}

export function getHojeString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getMesAnoAtual(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function getStatusInfo(status: StatusParcela) {
  switch (status) {
    case 'pago':
      return {
        label: 'Pago',
        corTexto: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      };
    case 'atrasado':
      return {
        label: 'Atrasado',
        corTexto: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
        badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
        dot: 'bg-rose-500 animate-pulse',
      };
    case 'pendente':
    default:
      return {
        label: 'A Pagar',
        corTexto: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
        dot: 'bg-amber-500',
      };
  }
}

export function dispararConfetes() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;
    }
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#14b8a6'],
    });
  } catch {
    // Fallback silencioso se confetti não estiver disponível
  }
}
