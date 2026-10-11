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
 * Retorna parcelas pendentes com lembrete ativo que vencem hoje ou estão atrasadas
 * para exibição como lembrete interno dentro do aplicativo na abertura
 */
export function obterParcelasLembreteHoje(parcelas: Parcela[]): Parcela[] {
  const hoje = new Date().toISOString().slice(0, 10);
  const contasComLembrete = new Set(obterContasComLembrete());
  if (contasComLembrete.size === 0) return [];

  return parcelas.filter(
    (p) =>
      p.status !== 'pago' &&
      p.data_vencimento <= hoje &&
      contasComLembrete.has(p.conta_id)
  );
}

/**
 * Verifica o status atual da permissão de notificação (sem suporte a notificações de sistema)
 */
export function verificarPermissaoNotificacao(): 'unsupported' {
  return 'unsupported';
}

/**
 * Solicitação de notificação (compatibilidade)
 */
export async function solicitarPermissaoNotificacao(): Promise<boolean> {
  return false;
}

/**
 * Emite uma notificação local (compatibilidade)
 */
export async function dispararNotificacaoLocal(_titulo: string, _corpo: string): Promise<boolean> {
  return false;
}

/**
 * Teste de lembrete
 */
export async function testarNotificacaoLocal(): Promise<boolean> {
  return false;
}

/**
 * Verifica parcelas pendentes com lembrete ativo para exibição no app
 */
export async function verificarAlertasVencimentoHoje(
  parcelas: Parcela[],
  _onNotificarBanco?: (parcelaId: number, dataVencimento: string) => Promise<void>
): Promise<Parcela[]> {
  return obterParcelasLembreteHoje(parcelas);
}
