import { Capacitor, PluginListenerHandle, PermissionState } from '@capacitor/core';
import {
  LocalNotifications,
  LocalNotificationSchema,
  PermissionStatus,
} from '@capacitor/local-notifications';
import { Parcela } from '../types';
import { formatarMoeda } from './formatters';
import { listarParcelas } from '../db/repository';

export type StatusPermissaoLembretes = PermissionState | 'unsupported';

const STORAGE_KEY_LEMBRETES = 'em_dia_lembretes_contas';
const STORAGE_KEY_CONFIG = 'em_dia_config_lembretes_vencimento';
const STORAGE_KEY_ULTIMO_AVISO_ATRASADAS = 'em_dia_ultimo_aviso_atrasadas';

export interface ConfiguracaoLembretes {
  habilitado: boolean;
  horario: string; // HH:mm, padrão "09:00"
  antecedencia: {
    noDia: boolean; // padrão true
    umDiaAntes: boolean; // padrão true
    tresDiasAntes: boolean; // padrão false
  };
}

const CONFIG_PADRAO: ConfiguracaoLembretes = {
  habilitado: true,
  horario: '09:00',
  antecedencia: {
    noDia: true,
    umDiaAntes: true,
    tresDiasAntes: false,
  },
};

/**
 * Verifica se a plataforma nativa e o plugin LocalNotifications estão disponíveis
 * Item 1: Antes de qualquer chamada, verifica isNativePlatform() e isPluginAvailable('LocalNotifications')
 */
export function isLocalNotificationsDisponivel(): boolean {
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('LocalNotifications')
    );
  } catch {
    return false;
  }
}

/**
 * Obtém a configuração salva de lembretes
 */
export function obterConfiguracaoLembretes(): ConfiguracaoLembretes {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return { ...CONFIG_PADRAO };
    const parsed = JSON.parse(raw);
    return {
      habilitado: typeof parsed.habilitado === 'boolean' ? parsed.habilitado : CONFIG_PADRAO.habilitado,
      horario: typeof parsed.horario === 'string' && /^\d{2}:\d{2}$/.test(parsed.horario) ? parsed.horario : CONFIG_PADRAO.horario,
      antecedencia: {
        noDia: typeof parsed?.antecedencia?.noDia === 'boolean' ? parsed.antecedencia.noDia : CONFIG_PADRAO.antecedencia.noDia,
        umDiaAntes: typeof parsed?.antecedencia?.umDiaAntes === 'boolean' ? parsed.antecedencia.umDiaAntes : CONFIG_PADRAO.antecedencia.umDiaAntes,
        tresDiasAntes: typeof parsed?.antecedencia?.tresDiasAntes === 'boolean' ? parsed.antecedencia.tresDiasAntes : CONFIG_PADRAO.antecedencia.tresDiasAntes,
      },
    };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

/**
 * Salva a configuração de lembretes e despacha evento para sincronização
 */
export function salvarConfiguracaoLembretes(config: ConfiguracaoLembretes): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('em-dia-config-lembretes-alterada', { detail: config }));
    }
  } catch (err) {
    console.warn('Erro ao salvar configuração de lembretes:', err);
  }
}

/**
 * Verifica o status atual da permissão de notificações do sistema operacional
 */
export async function verificarStatusPermissao(): Promise<StatusPermissaoLembretes> {
  if (!isLocalNotificationsDisponivel()) return 'unsupported';
  try {
    const status: PermissionStatus = await LocalNotifications.checkPermissions();
    return status.display;
  } catch (err) {
    console.warn('Erro ao verificar status de permissão:', err);
    return 'unsupported';
  }
}

/**
 * Solicita a permissão de notificações do Android
 */
export async function solicitarPermissaoLembretes(): Promise<{
  concedida: boolean;
  status: StatusPermissaoLembretes;
}> {
  if (!isLocalNotificationsDisponivel()) {
    return { concedida: false, status: 'unsupported' };
  }
  try {
    const status: PermissionStatus = await LocalNotifications.requestPermissions();
    return {
      concedida: status.display === 'granted',
      status: status.display,
    };
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificações:', err);
    return { concedida: false, status: 'denied' };
  }
}

/**
 * Cria ou atualiza o canal de notificações Android "Vencimentos" (Item 5)
 */
export async function garantirCanalNotificacao(): Promise<void> {
  if (!isLocalNotificationsDisponivel()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'vencimentos',
      name: 'Vencimentos',
      description: 'Lembretes de vencimento de contas',
      importance: 4, // High importance (alerta com som e banner)
      vibration: true,
    });
  } catch (err) {
    console.warn('Erro ao criar canal de notificações vencimentos:', err);
  }
}

/**
 * Retorna os IDs das contas que possuem lembrete ativo individual (Sininho 🔔)
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
  if (contasComLembrete.size === 0) {
    // Se nenhuma conta tiver sininho ligado, mostra todas que vencem hoje ou atrasadas
    return parcelas.filter((p) => p.status !== 'pago' && p.data_vencimento <= hoje);
  }

  return parcelas.filter(
    (p) =>
      p.status !== 'pago' &&
      p.data_vencimento <= hoje &&
      contasComLembrete.has(p.conta_id)
  );
}

/**
 * Calcula a data de agendamento retroagindo N dias da data de vencimento
 */
function calcularDataAgendamento(dataVencimentoIso: string, diasAntes: number, horarioStr: string): Date {
  const [ano, mes, dia] = dataVencimentoIso.split('-').map(Number);
  const [hora, minuto] = horarioStr.split(':').map(Number);
  const data = new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
  if (diasAntes > 0) {
    data.setDate(data.getDate() - diasAntes);
  }
  return data;
}

/**
 * Formata o valor numérico em moeda pt-BR sem duplicar o prefixo R$
 */
function formatarValorTexto(valor: number): string {
  const texto = formatarMoeda(valor);
  return texto.replace(/^R\$\s*/, '').trim();
}

/**
 * Agendamento aproximado de notificações (Item 3, 4, 5)
 * Cancela as notificações antigas do app (getPending + cancel) e agenda novas
 * para as parcelas pendentes dos próximos 45 dias.
 * Limite a 60 notificações pendentes, priorizando as mais próximas.
 */
export async function reagendarNotificacoes(parcelasCarregadas?: Parcela[]): Promise<void> {
  if (!isLocalNotificationsDisponivel()) return;

  const config = obterConfiguracaoLembretes();

  try {
    // 1. Cancela notificações pendentes antigas
    const pendingResult = await LocalNotifications.getPending();
    if (pendingResult.notifications && pendingResult.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pendingResult.notifications.map((n) => ({ id: n.id })),
      });
    }

    // Se o usuário desativou os lembretes, encerra após cancelar
    if (!config.habilitado) {
      return;
    }

    // Verifica se a permissão foi concedida
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      return;
    }

    // 2. Garante o canal de notificações Android
    await garantirCanalNotificacao();

    // 3. Consulta as parcelas pendentes
    const todasParcelas =
      parcelasCarregadas && parcelasCarregadas.length > 0
        ? parcelasCarregadas
        : await listarParcelas({ status: 'pendente', mesAno: 'todos', ordenacao: 'vencimento_asc' });

    // Calcula limite dos próximos 45 dias
    const hoje = new Date();
    const hojeIso = hoje.toISOString().slice(0, 10);
    const limite45 = new Date();
    limite45.setDate(limite45.getDate() + 45);
    const limite45Iso = limite45.toISOString().slice(0, 10);

    // Filtra parcelas pendentes entre hoje e 45 dias à frente
    const parcelasNoIntervalo = todasParcelas.filter(
      (p) => p.status !== 'pago' && p.data_vencimento >= hojeIso && p.data_vencimento <= limite45Iso
    );

    // Respeita o sininho (🔔) individual de cada conta:
    // só agenda as que têm o lembrete ligado; se nenhuma tiver sininho, o padrão é todas as pendentes
    const contasComSininho = obterContasComLembrete();
    let parcelasAlvo = parcelasNoIntervalo;
    if (contasComSininho.length > 0) {
      const sininhoSet = new Set(contasComSininho);
      parcelasAlvo = parcelasNoIntervalo.filter((p) => sininhoSet.has(p.conta_id));
    }

    const agoraTimestamp = Date.now();
    const notificacoesCandidatas: LocalNotificationSchema[] = [];

    for (const p of parcelasAlvo) {
      const descricao = p.conta_descricao || 'Conta';
      const valorFormatado = formatarValorTexto(p.valor);
      const mesAnoParcela = p.data_vencimento.slice(0, 7);

      // Antecedência: "no dia" (0 dias antes)
      if (config.antecedencia.noDia) {
        const dataDisparo = calcularDataAgendamento(p.data_vencimento, 0, config.horario);
        if (dataDisparo.getTime() > agoraTimestamp) {
          notificacoesCandidatas.push({
            id: p.id * 10 + 0, // ID estável derivado do ID da parcela e antecedência
            title: 'Vencimento de Conta',
            body: `Vence hoje: ${descricao} — R$ ${valorFormatado}`,
            largeBody: `Vence hoje: ${descricao} — R$ ${valorFormatado}`,
            channelId: 'vencimentos',
            schedule: { at: dataDisparo, allowWhileIdle: true },
            isExactNotification: false, // Agendamento aproximado (sem SCHEDULE_EXACT_ALARM)
            extra: { mesAno: mesAnoParcela, parcelaId: p.id },
          });
        }
      }

      // Antecedência: "1 dia antes" (1 dia antes)
      if (config.antecedencia.umDiaAntes) {
        const dataDisparo = calcularDataAgendamento(p.data_vencimento, 1, config.horario);
        if (dataDisparo.getTime() > agoraTimestamp) {
          notificacoesCandidatas.push({
            id: p.id * 10 + 1,
            title: 'Vencimento de Conta',
            body: `Vence amanhã: ${descricao} — R$ ${valorFormatado}`,
            largeBody: `Vence amanhã: ${descricao} — R$ ${valorFormatado}`,
            channelId: 'vencimentos',
            schedule: { at: dataDisparo, allowWhileIdle: true },
            isExactNotification: false,
            extra: { mesAno: mesAnoParcela, parcelaId: p.id },
          });
        }
      }

      // Antecedência: "3 dias antes" (3 dias antes)
      if (config.antecedencia.tresDiasAntes) {
        const dataDisparo = calcularDataAgendamento(p.data_vencimento, 3, config.horario);
        if (dataDisparo.getTime() > agoraTimestamp) {
          notificacoesCandidatas.push({
            id: p.id * 10 + 3,
            title: 'Vencimento de Conta',
            body: `Vence em 3 dias: ${descricao} — R$ ${valorFormatado}`,
            largeBody: `Vence em 3 dias: ${descricao} — R$ ${valorFormatado}`,
            channelId: 'vencimentos',
            schedule: { at: dataDisparo, allowWhileIdle: true },
            isExactNotification: false,
            extra: { mesAno: mesAnoParcela, parcelaId: p.id },
          });
        }
      }
    }

    // Prioriza as notificações mais próximas no tempo
    notificacoesCandidatas.sort((a, b) => {
      const tempoA = (a.schedule?.at as Date)?.getTime() || 0;
      const tempoB = (b.schedule?.at as Date)?.getTime() || 0;
      return tempoA - tempoB;
    });

    // Limita a no máximo 60 notificações pendentes
    const finalNotificacoes = notificacoesCandidatas.slice(0, 60);

    if (finalNotificacoes.length > 0) {
      await LocalNotifications.schedule({
        notifications: finalNotificacoes,
      });
    }
  } catch (err) {
    console.warn('Erro ao reagendar notificações locais:', err);
  }
}

/**
 * Cancela imediatamente as notificações agendadas de uma parcela quitada (Item 6)
 */
export async function cancelarNotificacoesParcela(parcelaId: number): Promise<void> {
  if (!isLocalNotificationsDisponivel()) return;
  try {
    const ids = [parcelaId * 10 + 0, parcelaId * 10 + 1, parcelaId * 10 + 3];
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
  } catch (err) {
    console.warn(`Erro ao cancelar notificações da parcela ${parcelaId}:`, err);
  }
}

/**
 * Notificação de teste com disparo em 5 segundos (Item 2)
 */
export async function dispararNotificacaoTeste(): Promise<{ sucesso: boolean; mensagem?: string }> {
  if (!isLocalNotificationsDisponivel()) {
    return { sucesso: false, mensagem: 'Notificações exigem o app mais recente' };
  }
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') {
        return {
          sucesso: false,
          mensagem: 'Permissão de notificação negada no Android. Habilite nas configurações.',
        };
      }
    }

    await garantirCanalNotificacao();
    const emCincoSegundos = new Date(Date.now() + 5000);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: 'Em Dia — Notificação de Teste',
          body: 'Suas notificações de vencimento estão configuradas e ativas!',
          largeBody: 'Suas notificações de vencimento estão configuradas e ativas!',
          channelId: 'vencimentos',
          schedule: { at: emCincoSegundos, allowWhileIdle: true },
          isExactNotification: false,
          extra: { mesAno: new Date().toISOString().slice(0, 7) },
        },
      ],
    });

    return { sucesso: true };
  } catch (err: any) {
    console.warn('Erro ao disparar notificação de teste:', err);
    return { sucesso: false, mensagem: err?.message || 'Falha ao agendar teste.' };
  }
}

/**
 * Para contas atrasadas, uma única notificação de resumo na abertura do app (Item 4):
 * "Você tem {n} conta(s) atrasada(s)", sem repetir a cada dia.
 */
export async function verificarNotificacaoResumoAtrasadas(parcelas: Parcela[]): Promise<void> {
  if (!isLocalNotificationsDisponivel()) return;

  const config = obterConfiguracaoLembretes();
  if (!config.habilitado) return;

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    const hojeIso = new Date().toISOString().slice(0, 10);
    const ultimoAviso = localStorage.getItem(STORAGE_KEY_ULTIMO_AVISO_ATRASADAS);

    if (ultimoAviso === hojeIso) {
      // Já enviado hoje; não repete a cada dia
      return;
    }

    const atrasadas = parcelas.filter((p) => p.status !== 'pago' && p.data_vencimento < hojeIso);
    const n = atrasadas.length;
    if (n === 0) return;

    await garantirCanalNotificacao();
    const textoAtrasadas =
      n === 1
        ? 'Você tem 1 conta atrasada'
        : `Você tem ${n} contas atrasadas`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 888888,
          title: 'Contas Atrasadas',
          body: textoAtrasadas,
          largeBody: textoAtrasadas,
          channelId: 'vencimentos',
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          isExactNotification: false,
          extra: { mesAno: hojeIso.slice(0, 7) },
        },
      ],
    });

    localStorage.setItem(STORAGE_KEY_ULTIMO_AVISO_ATRASADAS, hojeIso);
  } catch (err) {
    console.warn('Erro ao emitir notificação de resumo de atrasadas:', err);
  }
}

/**
 * Ouvinte para quando o usuário toca em uma notificação (Item 7)
 * Abre o app na tela Início, no mês da parcela
 */
export function inicializarOuvinteNotificacoes(
  onAbrirInicioNoMes: (mesAno: string) => void
): () => void {
  if (!isLocalNotificationsDisponivel()) return () => {};

  let handle: PluginListenerHandle | null = null;
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      try {
        const extra = notificationAction?.notification?.extra;
        const mesAno = extra?.mesAno || new Date().toISOString().slice(0, 7);
        onAbrirInicioNoMes(mesAno);
      } catch (err) {
        console.warn('Erro ao processar toque na notificação:', err);
      }
    })
      .then((h) => {
        handle = h;
      })
      .catch((err) => {
        console.warn('Erro ao registrar listener localNotificationActionPerformed:', err);
      });
  } catch (err) {
    console.warn('Erro ao inicializar ouvinte de notificações:', err);
  }

  return () => {
    try {
      if (handle && typeof handle.remove === 'function') {
        handle.remove();
      }
    } catch {}
  };
}

// Funções legadas mantidas para compatibilidade retroativa
export function verificarPermissaoNotificacao(): 'unsupported' | 'granted' | 'denied' {
  if (!isLocalNotificationsDisponivel()) return 'unsupported';
  return 'unsupported';
}

export async function solicitarPermissaoNotificacao(): Promise<boolean> {
  const res = await solicitarPermissaoLembretes();
  return res.concedida;
}

export async function dispararNotificacaoLocal(_titulo: string, _corpo: string): Promise<boolean> {
  return false;
}

export async function testarNotificacaoLocal(): Promise<boolean> {
  const res = await dispararNotificacaoTeste();
  return res.sucesso;
}

export async function verificarAlertasVencimentoHoje(
  parcelas: Parcela[],
  _onNotificarBanco?: (parcelaId: number, dataVencimento: string) => Promise<void>
): Promise<Parcela[]> {
  return obterParcelasLembreteHoje(parcelas);
}
