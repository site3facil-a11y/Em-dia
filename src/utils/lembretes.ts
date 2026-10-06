import { Parcela } from '../types';
import { formatarMoeda } from './formatters';

const STORAGE_KEY_LEMBRETES = 'em_dia_lembretes_contas';
const STORAGE_KEY_HISTORICO_ALERTAS = 'em_dia_alertas_enviados';

/**
 * Retorna os IDs das contas que possuem lembrete ativo
 */
export function obterContasComLembrete(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEMBRETES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Verifica se uma conta específica possui lembrete ativo
 */
export function temLembrete(contaId: number): boolean {
  const ids = obterContasComLembrete();
  return ids.includes(contaId);
}

/**
 * Define se uma conta específica possui lembrete ativo
 */
export function definirLembrete(contaId: number, ativo: boolean): void {
  const ids = new Set(obterContasComLembrete());
  if (ativo) {
    ids.add(contaId);
  } else {
    ids.delete(contaId);
  }
  try {
    localStorage.setItem(STORAGE_KEY_LEMBRETES, JSON.stringify(Array.from(ids)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('em-dia-lembretes-alterados', { detail: { contaId, ativo } }));
    }
  } catch (err) {
    console.warn('Erro ao salvar preferência de lembrete:', err);
  }
}

/**
 * Alterna o lembrete de uma conta específica
 */
export function alternarLembrete(contaId: number): boolean {
  const novoEstado = !temLembrete(contaId);
  definirLembrete(contaId, novoEstado);
  return novoEstado;
}

/**
 * Verifica o status atual da permissão de notificação no navegador/sistema
 */
export function verificarPermissaoNotificacao(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Solicita permissão ao usuário para emitir notificações no sistema
 */
export async function solicitarPermissaoNotificacao(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificação:', err);
    return false;
  }
}

/**
 * Emite uma notificação local no aparelho
 */
export async function dispararNotificacaoLocal(titulo: string, corpo: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Tenta primeiro via Service Worker (recomendado para PWAs e Android/Chrome)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(titulo, {
            body: corpo,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'em-dia-lembrete-' + Date.now(),
          });
          return true;
        }
      } catch (swErr) {
        // Fallback para new Notification padrão
      }
    }

    new Notification(titulo, {
      body: corpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'em-dia-lembrete-' + Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('Falha ao emitir notificação nativa:', err);
    return false;
  }
}

/**
 * Envia uma notificação de teste para verificar se o aparelho do usuário está apto
 */
export async function testarNotificacaoLocal(): Promise<boolean> {
  const perm = verificarPermissaoNotificacao();
  if (perm === 'unsupported') return false;
  if (perm !== 'granted') {
    const permitiu = await solicitarPermissaoNotificacao();
    if (!permitiu) return false;
  }
  return await dispararNotificacaoLocal(
    '🔔 Teste de Notificação - Em Dia',
    'Excelente! As notificações no seu aparelho estão ativas e funcionando para suas contas selecionadas.'
  );
}

/**
 * Verifica parcelas pendentes com lembrete ativo e emite notificação para vencimentos de hoje
 */
export async function verificarAlertasVencimentoHoje(parcelas: Parcela[]): Promise<Parcela[]> {
  if (typeof window === 'undefined' || !('Notification' in window)) return [];
  if (Notification.permission !== 'granted') return [];

  const hoje = new Date().toISOString().slice(0, 10);
  const contasComLembrete = new Set(obterContasComLembrete());
  if (contasComLembrete.size === 0) return [];

  // Carrega histórico para não reenviar o mesmo alerta múltiplas vezes no mesmo dia
  let alertasEnviados: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORICO_ALERTAS);
    if (raw) alertasEnviados = JSON.parse(raw);
  } catch {}

  const parcelasHoje = parcelas.filter(
    (p) =>
      p.status !== 'pago' &&
      p.data_vencimento === hoje &&
      contasComLembrete.has(p.conta_id)
  );

  const disparadas: Parcela[] = [];

  for (const p of parcelasHoje) {
    const chaveAlerta = `${hoje}-${p.id}`;
    if (!alertasEnviados[chaveAlerta]) {
      const sucesso = await dispararNotificacaoLocal(
        `🔔 Vence Hoje: ${p.conta_descricao}`,
        `A conta no valor de ${formatarMoeda(p.valor)} vence hoje. Toque para conferir!`
      );
      if (sucesso) {
        alertasEnviados[chaveAlerta] = new Date().toISOString();
        disparadas.push(p);
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY_HISTORICO_ALERTAS, JSON.stringify(alertasEnviados));
  } catch {}

  return disparadas;
}
