import { Capacitor, PluginListenerHandle, PermissionState } from '@capacitor/core';
import {
  LocalNotifications,
  LocalNotificationSchema,
  PermissionStatus,
} from '@capacitor/local-notifications';
import { Parcela } from '../types';
import { formatarMoeda, getHojeString, getMesAnoAtual } from './formatters';
import { listarParcelas } from '../db/repository';

export type StatusPermissaoLembretes = PermissionState | 'unsupported';
export type StatusAlarmeExato = PermissionState | 'unsupported';

export const NOTIFICACAO_TESTE_ID = 999999;
export const NOTIFICACAO_ATRASADAS_ID = 888888;
const IDS_RESERVADOS_SISTEMA = new Set<number>([
  NOTIFICACAO_TESTE_ID,
  NOTIFICACAO_ATRASADAS_ID,
]);

const STORAGE_KEY_LEMBRETES = 'em_dia_lembretes_contas';
const STORAGE_KEY_CONFIG = 'em_dia_config_lembretes_vencimento';
const STORAGE_KEY_ULTIMO_AVISO_ATRASADAS = 'em_dia_ultimo_aviso_atrasadas';
const STORAGE_KEY_AVISOS_CONTAS_HOJE = 'em_dia_avisos_contas_hoje';

export interface ConfiguracaoLembretes {
  habilitado: boolean;
  horario: string; // HH:mm, padrão "09:00"
  antecedencia: {
    noDia: boolean; // padrão true
    umDiaAntes: boolean; // padrão true
    tresDiasAntes: boolean; // padrão false
  };
}

export interface OpcoesReagendamento {
  solicitarPermissaoSePrompt?: boolean;
  forcarSolicitacaoPermissao?: boolean;
}

export interface ResultadoNotificacaoTeste {
  sucesso: boolean;
  imediata?: boolean;
  alarmeExatoConcedido?: boolean;
  mensagem?: string;
}

export interface ItemNotificacaoAgendadaInfo {
  id: number;
  titulo: string;
  corpo: string;
  dataHoraFormatada: string;
  timestamp: number;
  exato: boolean;
}

export interface CatchUpCandidato {
  parcela: Parcela;
  diasAntes: 0 | 1;
  titulo: string;
  mensagem: string;
  chaveUnica: string;
}

export interface ResultadoAtivacaoLembrete {
  ativado: boolean;
  permissaoNegada: boolean;
  alarmeExatoConcedido: boolean;
  totalAgendadas: number;
  agendadasConta: number;
  proximaDataFormatada: string | null;
  avisoImediatoEnviado: boolean;
  mensagemUsuario: string;
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

let reagendamentoEmAndamento: Promise<number> | null = null;
let reagendamentoPendente: {
  parcelas?: Parcela[];
  opcoes?: OpcoesReagendamento;
} | null = null;
let permissaoAutoSolicitadaNaSessao = false;

/**
 * Formata um Date em string YYYY-MM-DD no fuso horário LOCAL do dispositivo
 * (evita deslocamento de dia causado por toISOString() em UTC após as 21h no Brasil).
 */
export function formatarDataLocalIso(data: Date): string {
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const dd = String(data.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatarDataHoraCurta(data: Date): string {
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} às ${hh}:${min}`;
}

/**
 * Verifica se a plataforma nativa e o plugin LocalNotifications estão disponíveis
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
    if (!raw) return { ...CONFIG_PADRAO, antecedencia: { ...CONFIG_PADRAO.antecedencia } };
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
    return { ...CONFIG_PADRAO, antecedencia: { ...CONFIG_PADRAO.antecedencia } };
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
 * Verifica o status atual da permissão de notificações do sistema operacional,
 * checando também areEnabled() para detectar bloqueio direto nas configurações do Android.
 */
export async function verificarStatusPermissao(): Promise<StatusPermissaoLembretes> {
  if (!isLocalNotificationsDisponivel()) return 'unsupported';
  try {
    const status: PermissionStatus = await LocalNotifications.checkPermissions();
    if (status.display === 'granted' && typeof LocalNotifications.areEnabled === 'function') {
      try {
        const enabled = await LocalNotifications.areEnabled();
        if (enabled && enabled.value === false) {
          return 'denied';
        }
      } catch {
        // Ignora caso areEnabled falhe em versões futuras
      }
    }
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
    let finalDisplay: StatusPermissaoLembretes = status.display;
    if (finalDisplay === 'granted' && typeof LocalNotifications.areEnabled === 'function') {
      try {
        const enabled = await LocalNotifications.areEnabled();
        if (enabled && enabled.value === false) {
          finalDisplay = 'denied';
        }
      } catch {
        // noop
      }
    }
    return {
      concedida: finalDisplay === 'granted',
      status: finalDisplay,
    };
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificações:', err);
    return { concedida: false, status: 'denied' };
  }
}

/**
 * Verifica se o Android 12+ permite alarmes exatos (leitura silenciosa, sem abrir Configurações).
 */
export async function verificarPermissaoAlarmeExato(): Promise<StatusAlarmeExato> {
  if (!isLocalNotificationsDisponivel()) return 'unsupported';
  try {
    if (Capacitor.getPlatform() !== 'android') {
      return 'granted';
    }
    if (typeof LocalNotifications.checkExactNotificationSetting !== 'function') {
      return 'granted';
    }
    const res = await LocalNotifications.checkExactNotificationSetting();
    return res?.exact_alarm || 'denied';
  } catch (err) {
    console.warn('Erro ao verificar permissão de alarme exato:', err);
    return 'denied';
  }
}

/**
 * Abre a tela do sistema Android "Alarmes e lembretes" para o usuário autorizar horário exato.
 */
export async function solicitarPermissaoAlarmeExato(): Promise<StatusAlarmeExato> {
  if (!isLocalNotificationsDisponivel()) return 'unsupported';
  try {
    if (Capacitor.getPlatform() !== 'android') {
      return 'granted';
    }
    if (typeof LocalNotifications.changeExactNotificationSetting !== 'function') {
      return 'granted';
    }
    const res = await LocalNotifications.changeExactNotificationSetting();
    return res?.exact_alarm || 'denied';
  } catch (err) {
    console.warn('Erro ao solicitar permissão de alarme exato:', err);
    return 'denied';
  }
}

/**
 * Cria ou atualiza o canal de notificações Android "Vencimentos"
 */
export async function garantirCanalNotificacao(): Promise<void> {
  if (!isLocalNotificationsDisponivel()) return;
  try {
    if (Capacitor.getPlatform() !== 'android') return;
    await LocalNotifications.createChannel({
      id: 'vencimentos',
      name: 'Vencimentos',
      description: 'Lembretes de vencimento de contas',
      importance: 4, // IMPORTANCE_HIGH: alerta com som e banner heads-up
      visibility: 1, // VISIBILITY_PUBLIC: visível na tela de bloqueio
      vibration: true,
      lights: true,
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
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'number' && Number.isFinite(id))
      : [];
  } catch {
    return [];
  }
}

/**
 * Remove da lista de sininhos IDs de contas que não existem mais no banco
 */
function limparSininhoContasInexistentes(idsExistentes: Set<number>): void {
  const atuais = obterContasComLembrete();
  if (atuais.length === 0) return;
  const filtrados = atuais.filter((id) => idsExistentes.has(id));
  if (filtrados.length !== atuais.length) {
    try {
      localStorage.setItem(STORAGE_KEY_LEMBRETES, JSON.stringify(filtrados));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('em-dia-lembretes-alterados', { detail: { contaId: null, ativo: false } }));
      }
    } catch (err) {
      console.warn('Erro ao limpar sininhos órfãos:', err);
    }
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
 * Retorna parcelas não pagas com lembrete ativo que vencem hoje ou estão atrasadas
 * para exibição como lembrete interno dentro do aplicativo na abertura.
 */
export function obterParcelasLembreteHoje(parcelas: Parcela[], hojeOverride?: string): Parcela[] {
  const hoje = hojeOverride || getHojeString();
  const contasComLembrete = new Set(obterContasComLembrete());
  if (contasComLembrete.size === 0) {
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
 * Calcula a data de agendamento retroagindo N dias da data de vencimento no horário local
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

export interface OpcoesMontagemNotificacoes {
  parcelas: Parcela[];
  config: ConfiguracaoLembretes;
  contasComSininho: number[];
  agora?: Date;
  usarAlarmeExato?: boolean;
  limite?: number;
}

/**
 * Função pura que gera a lista de notificações a serem agendadas para os próximos 45 dias.
 * Exportada para cobertura direta em testes unitários.
 */
export function montarNotificacoesAgendadas({
  parcelas,
  config,
  contasComSininho,
  agora = new Date(),
  usarAlarmeExato = false,
  limite = 60,
}: OpcoesMontagemNotificacoes): LocalNotificationSchema[] {
  if (!config.habilitado) return [];

  const hojeIso = formatarDataLocalIso(agora);
  const limite45 = new Date(agora.getTime());
  limite45.setDate(limite45.getDate() + 45);
  const limite45Iso = formatarDataLocalIso(limite45);

  const parcelasNoIntervalo = parcelas.filter(
    (p) => p.status !== 'pago' && p.data_vencimento >= hojeIso && p.data_vencimento <= limite45Iso
  );

  let parcelasAlvo = parcelasNoIntervalo;
  if (contasComSininho.length > 0) {
    const sininhoSet = new Set(contasComSininho);
    parcelasAlvo = parcelasNoIntervalo.filter((p) => sininhoSet.has(p.conta_id));
  }

  const agoraTimestamp = agora.getTime();
  const notificacoesCandidatas: LocalNotificationSchema[] = [];

  for (const p of parcelasAlvo) {
    const descricao = p.conta_descricao || 'Conta';
    const valorFormatado = formatarValorTexto(p.valor);
    const mesAnoParcela = p.data_vencimento.slice(0, 7);

    const adicionarCandidata = (diasAntes: 0 | 1 | 3, prefixoTexto: string) => {
      const dataDisparo = calcularDataAgendamento(p.data_vencimento, diasAntes, config.horario);
      if (dataDisparo.getTime() > agoraTimestamp) {
        const mensagem = `${prefixoTexto}: ${descricao} — R$ ${valorFormatado}`;
        notificacoesCandidatas.push({
          id: p.id * 10 + diasAntes,
          title: 'Vencimento de Conta',
          body: mensagem,
          largeBody: mensagem,
          channelId: 'vencimentos',
          schedule: { at: dataDisparo, allowWhileIdle: true },
          isExactNotification: usarAlarmeExato,
          isExactMandatory: false,
          foreground: true,
          autoCancel: true,
          extra: { mesAno: mesAnoParcela, parcelaId: p.id },
        });
      }
    };

    if (config.antecedencia.noDia) {
      adicionarCandidata(0, 'Vence hoje');
    }
    if (config.antecedencia.umDiaAntes) {
      adicionarCandidata(1, 'Vence amanhã');
    }
    if (config.antecedencia.tresDiasAntes) {
      adicionarCandidata(3, 'Vence em 3 dias');
    }
  }

  notificacoesCandidatas.sort((a, b) => {
    const tempoA = (a.schedule?.at as Date)?.getTime() || 0;
    const tempoB = (b.schedule?.at as Date)?.getTime() || 0;
    return tempoA - tempoB;
  });

  return notificacoesCandidatas.slice(0, limite);
}

/**
 * Filtra os IDs a cancelar no reagendamento, preservando notificações especiais
 * (teste 999999 e resumo de atrasadas 888888).
 */
export function filtrarIdsParaCancelarNoReagendamento(ids: number[]): number[] {
  return ids.filter((id) => !IDS_RESERVADOS_SISTEMA.has(id));
}

/**
 * Consulta quantas notificações de vencimento estão realmente agendadas no sistema
 */
export async function obterQtdNotificacoesAgendadas(): Promise<number> {
  if (!isLocalNotificationsDisponivel()) return 0;
  try {
    if (typeof LocalNotifications.getAll === 'function') {
      const res = await LocalNotifications.getAll({ state: 'SCHEDULED' });
      return (res?.notifications || []).filter(
        (n) => n.id !== NOTIFICACAO_TESTE_ID
      ).length;
    }
    const pending = await LocalNotifications.getPending();
    return (pending?.notifications || []).filter(
      (n) => n.id !== NOTIFICACAO_TESTE_ID
    ).length;
  } catch {
    return 0;
  }
}

/**
 * Retorna os detalhes das notificações atualmente agendadas no Android (ordenadas por data/hora),
 * permitindo ao usuário confirmar na tela de Ajustes exatamente o que está programado.
 */
export async function obterNotificacoesAgendadasDetalhes(): Promise<ItemNotificacaoAgendadaInfo[]> {
  if (!isLocalNotificationsDisponivel()) return [];
  try {
    const exactStatus = await verificarPermissaoAlarmeExato();
    const alarmeExatoSistema = exactStatus === 'granted';

    let lista: any[] = [];
    if (typeof LocalNotifications.getAll === 'function') {
      const res = await LocalNotifications.getAll({ state: 'SCHEDULED' });
      lista = res?.notifications || [];
    } else {
      const pending = await LocalNotifications.getPending();
      lista = pending?.notifications || [];
    }

    const itens: ItemNotificacaoAgendadaInfo[] = [];
    for (const n of lista) {
      if (!n || n.id === NOTIFICACAO_TESTE_ID || n.id === NOTIFICACAO_ATRASADAS_ID) continue;
      const rawAt = n.schedule?.at;
      const dataAt = rawAt ? new Date(rawAt) : null;
      const timestamp = dataAt && !isNaN(dataAt.getTime()) ? dataAt.getTime() : 0;
      const exato =
        typeof n.isExactNotification === 'boolean'
          ? n.isExactNotification && alarmeExatoSistema
          : alarmeExatoSistema;

      itens.push({
        id: Number(n.id),
        titulo: String(n.title || 'Vencimento de Conta'),
        corpo: String(n.body || ''),
        dataHoraFormatada: timestamp > 0 ? formatarDataHoraCurta(new Date(timestamp)) : 'Agendado',
        timestamp,
        exato,
      });
    }

    itens.sort((a, b) => {
      if (a.timestamp === 0 && b.timestamp === 0) return 0;
      if (a.timestamp === 0) return 1;
      if (b.timestamp === 0) return -1;
      return a.timestamp - b.timestamp;
    });

    return itens;
  } catch (err) {
    console.warn('Erro ao obter detalhes das notificações agendadas:', err);
    return [];
  }
}

function lerAvisosContasHoje(hojeIso: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AVISOS_CONTAS_HOJE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Mantém apenas registros do dia atual
    const doDia = parsed.filter((item) => typeof item === 'string' && item.endsWith(`:${hojeIso}`));
    if (doDia.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY_AVISOS_CONTAS_HOJE, JSON.stringify(doDia));
    }
    return doDia;
  } catch {
    return [];
  }
}

function registrarAvisoContaHoje(chaveUnica: string, hojeIso: string): void {
  try {
    const atuais = lerAvisosContasHoje(hojeIso);
    if (!atuais.includes(chaveUnica)) {
      localStorage.setItem(STORAGE_KEY_AVISOS_CONTAS_HOJE, JSON.stringify([...atuais, chaveUnica]));
    }
  } catch (err) {
    console.warn('Erro ao registrar aviso diário da conta:', err);
  }
}

/**
 * Função pura que verifica se uma conta ativada hoje (após o horário configurado, ex: 09:00)
 * possui parcela vencendo HOJE ou AMANHÃ cujo alerta do dia já passou sem ser disparado.
 */
export function identificarParcelaCatchUpHoje({
  parcelasConta,
  config,
  agora = new Date(),
  avisosJaEnviadosHoje = [],
}: {
  parcelasConta: Parcela[];
  config: ConfiguracaoLembretes;
  agora?: Date;
  avisosJaEnviadosHoje?: string[];
}): CatchUpCandidato | null {
  if (!config.habilitado) return null;

  const hojeIso = formatarDataLocalIso(agora);
  const horarioHoje = calcularDataAgendamento(hojeIso, 0, config.horario);
  // Se o horário configurado ainda não passou hoje, o agendamento normal cuidará do disparo.
  if (agora.getTime() < horarioHoje.getTime()) {
    return null;
  }

  const amanhaDate = new Date(agora.getTime());
  amanhaDate.setDate(amanhaDate.getDate() + 1);
  const amanhaIso = formatarDataLocalIso(amanhaDate);

  const pendentes = parcelasConta.filter((p) => p.status !== 'pago');

  if (config.antecedencia.noDia) {
    const venceHoje = pendentes.find((p) => p.data_vencimento === hojeIso);
    if (venceHoje) {
      const chaveUnica = `${venceHoje.id}:0:${hojeIso}`;
      if (!avisosJaEnviadosHoje.includes(chaveUnica)) {
        const desc = venceHoje.conta_descricao || 'Conta';
        const val = formatarValorTexto(venceHoje.valor);
        return {
          parcela: venceHoje,
          diasAntes: 0,
          titulo: 'Vencimento de Conta',
          mensagem: `Vence hoje: ${desc} — R$ ${val}`,
          chaveUnica,
        };
      }
    }
  }

  if (config.antecedencia.umDiaAntes) {
    const venceAmanha = pendentes.find((p) => p.data_vencimento === amanhaIso);
    if (venceAmanha) {
      const chaveUnica = `${venceAmanha.id}:1:${hojeIso}`;
      if (!avisosJaEnviadosHoje.includes(chaveUnica)) {
        const desc = venceAmanha.conta_descricao || 'Conta';
        const val = formatarValorTexto(venceAmanha.valor);
        return {
          parcela: venceAmanha,
          diasAntes: 1,
          titulo: 'Vencimento de Conta',
          mensagem: `Vence amanhã: ${desc} — R$ ${val}`,
          chaveUnica,
        };
      }
    }
  }

  return null;
}

async function executarReagendamentoInterno(
  parcelasCarregadas?: Parcela[],
  opcoes?: OpcoesReagendamento
): Promise<number> {
  if (!isLocalNotificationsDisponivel()) return 0;

  const config = obterConfiguracaoLembretes();

  try {
    // 1. Cancela notificações antigas de parcelas (preservando teste 999999 e resumo 888888)
    const pendingResult = await LocalNotifications.getPending();
    const idsParaCancelar = filtrarIdsParaCancelarNoReagendamento(
      (pendingResult.notifications || []).map((n) => n.id)
    );
    if (idsParaCancelar.length > 0) {
      await LocalNotifications.cancel({
        notifications: idsParaCancelar.map((id) => ({ id })),
      });
    }

    // Se o usuário desativou os lembretes globalmente, encerra após cancelar
    if (!config.habilitado) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('em-dia-notificacoes-reagendadas', { detail: { totalAgendadas: 0 } }));
      }
      return 0;
    }

    // 2. Verifica (e, se aplicável, solicita uma única vez) a permissão POST_NOTIFICATIONS
    let statusPermissao = await verificarStatusPermissao();
    if (
      (statusPermissao === 'prompt' || statusPermissao === 'prompt-with-rationale') &&
      (opcoes?.forcarSolicitacaoPermissao || (opcoes?.solicitarPermissaoSePrompt && !permissaoAutoSolicitadaNaSessao))
    ) {
      permissaoAutoSolicitadaNaSessao = true;
      const req = await solicitarPermissaoLembretes();
      statusPermissao = req.status;
    }

    if (statusPermissao !== 'granted') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('em-dia-notificacoes-reagendadas', { detail: { totalAgendadas: 0 } }));
      }
      return 0;
    }

    // 3. Garante o canal de notificações Android com alta importância e vibração
    await garantirCanalNotificacao();

    // 4. Consulta todas as parcelas (status 'todos' para incluir também 'atrasado' e mapear contas reais)
    let todasParcelas = parcelasCarregadas;
    let carregouBancoCompleto = false;
    if (!todasParcelas) {
      todasParcelas = await listarParcelas({
        status: 'todos',
        mesAno: 'todos',
        ordenacao: 'vencimento_asc',
      });
      carregouBancoCompleto = true;
    }

    if (carregouBancoCompleto && todasParcelas.length > 0) {
      const contasReais = new Set(todasParcelas.map((p) => p.conta_id));
      limparSininhoContasInexistentes(contasReais);
    }

    // 5. Verifica se o Android permite alarmes exatos sem abrir telas de configuração
    const exactStatus = await verificarPermissaoAlarmeExato();
    const usarAlarmeExato = exactStatus === 'granted';

    const finalNotificacoes = montarNotificacoesAgendadas({
      parcelas: todasParcelas,
      config,
      contasComSininho: obterContasComLembrete(),
      agora: new Date(),
      usarAlarmeExato,
      limite: 60,
    });

    if (finalNotificacoes.length > 0) {
      await LocalNotifications.schedule({
        notifications: finalNotificacoes,
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('em-dia-notificacoes-reagendadas', {
          detail: { totalAgendadas: finalNotificacoes.length },
        })
      );
    }

    return finalNotificacoes.length;
  } catch (err) {
    console.warn('Erro ao reagendar notificações locais:', err);
    return 0;
  }
}

/**
 * Reagenda notificações de vencimento com serialização (mutex) para evitar
 * condições de corrida entre chamadas simultâneas (ex: appStateChange + visibilitychange + CRUD).
 */
export async function reagendarNotificacoes(
  parcelasCarregadas?: Parcela[],
  opcoes?: OpcoesReagendamento
): Promise<number> {
  if (!isLocalNotificationsDisponivel()) return 0;

  if (reagendamentoEmAndamento) {
    reagendamentoPendente = {
      parcelas: parcelasCarregadas ?? reagendamentoPendente?.parcelas,
      opcoes: {
        solicitarPermissaoSePrompt:
          Boolean(reagendamentoPendente?.opcoes?.solicitarPermissaoSePrompt) ||
          Boolean(opcoes?.solicitarPermissaoSePrompt),
        forcarSolicitacaoPermissao:
          Boolean(reagendamentoPendente?.opcoes?.forcarSolicitacaoPermissao) ||
          Boolean(opcoes?.forcarSolicitacaoPermissao),
      },
    };
    return reagendamentoEmAndamento;
  }

  reagendamentoEmAndamento = (async () => {
    let ultimoTotal = await executarReagendamentoInterno(parcelasCarregadas, opcoes);
    while (reagendamentoPendente) {
      const prox = reagendamentoPendente;
      reagendamentoPendente = null;
      ultimoTotal = await executarReagendamentoInterno(prox.parcelas, prox.opcoes);
    }
    return ultimoTotal;
  })().finally(() => {
    reagendamentoEmAndamento = null;
  });

  return reagendamentoEmAndamento;
}

/**
 * Ativa o lembrete (sininho 🔔) de uma conta específica garantindo:
 * 1) Que os lembretes globais não estejam silenciosamente desligados;
 * 2) Reagendamento imediato com solicitação de permissão POST_NOTIFICATIONS se necessário;
 * 3) Catch-up imediato se a conta vence hoje ou amanhã e o horário configurado do dia já passou;
 * 4) Retorno claro informando próxima data/hora ou alerta se "Horário exato" estiver desligado.
 */
export async function ativarLembreteConta(
  contaId: number,
  descricao?: string,
  opcoes?: { emitirToast?: boolean }
): Promise<ResultadoAtivacaoLembrete> {
  const nome = (descricao || 'esta conta').trim();
  definirLembrete(contaId, true);

  let config = obterConfiguracaoLembretes();
  if (!config.habilitado) {
    config = { ...config, habilitado: true };
    salvarConfiguracaoLembretes(config);
  }

  const disponivel = isLocalNotificationsDisponivel();
  if (!disponivel) {
    const mensagemUsuario = `🔔 Lembrete ativado para "${nome}" (no Android, notificará às ${config.horario}).`;
    if (opcoes?.emitirToast && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('em-dia-toast-lembrete', {
          detail: { mensagem: mensagemUsuario, alerta: false },
        })
      );
    }
    return {
      ativado: true,
      permissaoNegada: false,
      alarmeExatoConcedido: false,
      totalAgendadas: 0,
      agendadasConta: 0,
      proximaDataFormatada: null,
      avisoImediatoEnviado: false,
      mensagemUsuario,
    };
  }

  const totalAgendadas = await reagendarNotificacoes(undefined, {
    forcarSolicitacaoPermissao: true,
  });

  const statusPermissao = await verificarStatusPermissao();
  const exactStatus = await verificarPermissaoAlarmeExato();
  const alarmeExatoConcedido = exactStatus === 'granted';

  if (statusPermissao !== 'granted') {
    const mensagemUsuario =
      '⚠️ Sininho salvo, mas as notificações estão bloqueadas no Android. Libere em Ajustes.';
    if (opcoes?.emitirToast && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('em-dia-toast-lembrete', {
          detail: { mensagem: mensagemUsuario, alerta: true },
        })
      );
    }
    return {
      ativado: true,
      permissaoNegada: true,
      alarmeExatoConcedido,
      totalAgendadas: 0,
      agendadasConta: 0,
      proximaDataFormatada: null,
      avisoImediatoEnviado: false,
      mensagemUsuario,
    };
  }

  let agendadasConta = 0;
  let proximaDataFormatada: string | null = null;
  let avisoImediatoEnviado = false;
  let catchUp: CatchUpCandidato | null = null;

  try {
    const agora = new Date();
    const hojeIso = formatarDataLocalIso(agora);
    const todasParcelas = await listarParcelas({
      status: 'todos',
      mesAno: 'todos',
      ordenacao: 'vencimento_asc',
    });
    const parcelasConta = todasParcelas.filter(
      (p) => p.conta_id === contaId && p.status !== 'pago'
    );

    const previstasConta = montarNotificacoesAgendadas({
      parcelas: parcelasConta,
      config,
      contasComSininho: [contaId],
      agora,
      usarAlarmeExato: alarmeExatoConcedido,
      limite: 60,
    });
    agendadasConta = previstasConta.length;
    if (previstasConta.length > 0 && previstasConta[0].schedule?.at) {
      proximaDataFormatada = formatarDataHoraCurta(
        new Date(previstasConta[0].schedule.at as any)
      );
    }

    const avisosHoje = lerAvisosContasHoje(hojeIso);
    catchUp = identificarParcelaCatchUpHoje({
      parcelasConta,
      config,
      agora,
      avisosJaEnviadosHoje: avisosHoje,
    });

    if (catchUp) {
      await garantirCanalNotificacao();
      const idCatchUp = catchUp.parcela.id * 10 + catchUp.diasAntes;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: idCatchUp,
            title: catchUp.titulo,
            body: catchUp.mensagem,
            largeBody: catchUp.mensagem,
            channelId: 'vencimentos',
            ...(alarmeExatoConcedido
              ? {
                  schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
                  isExactNotification: true,
                  isExactMandatory: false,
                }
              : {
                  isExactNotification: false,
                  isExactMandatory: false,
                }),
            foreground: true,
            autoCancel: true,
            extra: {
              mesAno: catchUp.parcela.data_vencimento.slice(0, 7),
              parcelaId: catchUp.parcela.id,
            },
          },
        ],
      });
      registrarAvisoContaHoje(catchUp.chaveUnica, hojeIso);
      avisoImediatoEnviado = true;
    }
  } catch (err) {
    console.warn('Erro ao finalizar diagnóstico/catch-up ao ativar sininho:', err);
  }

  let mensagemUsuario = '';
  if (avisoImediatoEnviado && catchUp) {
    const resumoQuando = catchUp.diasAntes === 0 ? 'vence hoje' : 'vence amanhã';
    mensagemUsuario = proximaDataFormatada
      ? `🔔 Lembrete enviado agora (${resumoQuando})! Próximo alerta: ${proximaDataFormatada}.`
      : `🔔 Lembrete enviado agora (${resumoQuando}) para "${nome}"!`;
    if (!alarmeExatoConcedido) {
      mensagemUsuario += ' Ative "Horário exato" em Ajustes para alertas pontuais.';
    }
  } else if (proximaDataFormatada) {
    mensagemUsuario = alarmeExatoConcedido
      ? `🔔 Lembrete agendado para ${proximaDataFormatada}.`
      : `🔔 Agendado para ${proximaDataFormatada}, mas ative "Horário exato" em Ajustes para não atrasar.`;
  } else {
    mensagemUsuario = `🔔 Lembrete ativo para "${nome}" (sem vencimentos pendentes nos próximos 45 dias).`;
  }

  if (opcoes?.emitirToast && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('em-dia-toast-lembrete', {
        detail: {
          mensagem: mensagemUsuario,
          alerta: !alarmeExatoConcedido,
        },
      })
    );
  }

  return {
    ativado: true,
    permissaoNegada: false,
    alarmeExatoConcedido,
    totalAgendadas,
    agendadasConta,
    proximaDataFormatada,
    avisoImediatoEnviado,
    mensagemUsuario,
  };
}

/**
 * Cancela imediatamente as notificações agendadas de uma parcela quitada
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
 * Notificação de teste:
 * - Se alarme exato está concedido: agenda para 5 segundos usando alarme exato + heads-up.
 * - Se alarme exato NÃO está concedido no Android 12+: dispara imediatamente (sem atraso do Doze/setAndAllowWhileIdle)
 *   para o usuário confirmar na hora que as notificações funcionam, orientando ativar o horário exato.
 */
export async function dispararNotificacaoTeste(): Promise<ResultadoNotificacaoTeste> {
  if (!isLocalNotificationsDisponivel()) {
    return { sucesso: false, mensagem: 'Notificações exigem o app mais recente' };
  }
  try {
    let status = await verificarStatusPermissao();
    if (status !== 'granted') {
      const req = await solicitarPermissaoLembretes();
      status = req.status;
      if (!req.concedida || status !== 'granted') {
        return {
          sucesso: false,
          mensagem: 'Permissão de notificação negada no Android. Habilite nas configurações.',
        };
      }
    }

    await garantirCanalNotificacao();

    const exactStatus = await verificarPermissaoAlarmeExato();
    const alarmeExatoConcedido = exactStatus === 'granted';
    const mesAnoAtual = getMesAnoAtual();

    const notificacaoBase: LocalNotificationSchema = {
      id: NOTIFICACAO_TESTE_ID,
      title: 'Em Dia — Notificação de Teste',
      body: 'Suas notificações de vencimento estão configuradas e ativas!',
      largeBody: 'Suas notificações de vencimento estão configuradas e ativas!',
      channelId: 'vencimentos',
      foreground: true,
      autoCancel: true,
      extra: { mesAno: mesAnoAtual },
    };

    if (alarmeExatoConcedido) {
      await LocalNotifications.schedule({
        notifications: [
          {
            ...notificacaoBase,
            schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
            isExactNotification: true,
            isExactMandatory: false,
          },
        ],
      });
      return {
        sucesso: true,
        imediata: false,
        alarmeExatoConcedido: true,
      };
    }

    // Sem alarme exato autorizado no Android 12+, evita setAndAllowWhileIdle (que o sistema atrasa por vários minutos)
    // e dispara imediatamente para validar canal, som e exibição na barra de status.
    await LocalNotifications.schedule({
      notifications: [
        {
          ...notificacaoBase,
          isExactNotification: false,
          isExactMandatory: false,
        },
      ],
    });

    return {
      sucesso: true,
      imediata: true,
      alarmeExatoConcedido: false,
    };
  } catch (err: any) {
    console.warn('Erro ao disparar notificação de teste:', err);
    return { sucesso: false, mensagem: err?.message || 'Falha ao agendar teste.' };
  }
}

/**
 * Para contas atrasadas, uma única notificação de resumo por dia na abertura do app:
 * "Você tem {n} conta(s) atrasada(s)".
 */
export async function verificarNotificacaoResumoAtrasadas(parcelas: Parcela[]): Promise<void> {
  if (!isLocalNotificationsDisponivel()) return;

  const config = obterConfiguracaoLembretes();
  if (!config.habilitado) return;

  try {
    const status = await verificarStatusPermissao();
    if (status !== 'granted') return;

    const hojeIso = getHojeString();
    const ultimoAviso = localStorage.getItem(STORAGE_KEY_ULTIMO_AVISO_ATRASADAS);

    if (ultimoAviso === hojeIso) {
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

    const exactStatus = await verificarPermissaoAlarmeExato();
    const usarAlarmeExato = exactStatus === 'granted';

    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICACAO_ATRASADAS_ID,
          title: 'Contas Atrasadas',
          body: textoAtrasadas,
          largeBody: textoAtrasadas,
          channelId: 'vencimentos',
          ...(usarAlarmeExato
            ? {
                schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
                isExactNotification: true,
                isExactMandatory: false,
              }
            : {
                isExactNotification: false,
                isExactMandatory: false,
              }),
          foreground: true,
          autoCancel: true,
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
 * Ouvinte para quando o usuário toca em uma notificação:
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
        const mesAno = extra?.mesAno || getMesAnoAtual();
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
