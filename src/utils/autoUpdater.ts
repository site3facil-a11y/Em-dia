import { ReleaseInfo } from '../components/ModalAtualizacao';
import { compararVersoes } from './versao';

export const INTERVALO_CHECAGEM_AUTO_MS = 6 * 60 * 60 * 1000; // 6 horas
export const INTERVALO_ADIAR_LEMBRETE_MS = 24 * 60 * 60 * 1000; // 24 horas
export const TIMEOUT_FETCH_MS = 4000; // 4 segundos
export const URL_VERSION_JSON = 'https://site3facil-a11y.github.io/Em-dia/version.json';

export interface ResultadoChecagemAtualizacao {
  temAtualizacao: boolean;
  versao: string;
  exigeNovoApk: boolean;
  release: ReleaseInfo;
  tamanhoFormatado?: string;
  isDadosMoveis: boolean;
}

export function formatarTamanhoBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detecta se a conexão atual é via rede móvel (celular) sem plugins adicionais,
 * inspecionando navigator.connection caso disponível no WebView/navegador.
 */
export function isConexaoDadosMoveis(customConn?: any): boolean {
  try {
    const conn =
      customConn !== undefined
        ? customConn
        : typeof navigator !== 'undefined'
        ? (navigator as any).connection
        : null;
    if (!conn) return false;
    return (
      conn.type === 'cellular' ||
      conn.type === 'mobile' ||
      conn.effectiveType === '2g' ||
      conn.effectiveType === '3g' ||
      conn.effectiveType === '4g' ||
      conn.saveData === true
    );
  } catch {
    return false;
  }
}

export interface StorageSimples {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Adia o aviso de atualização para uma versão específica por 24 horas.
 */
export function adiarAvisoAtualizacao(
  versao: string,
  storage?: StorageSimples,
  agora = Date.now()
): void {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!store) return;
  const expiraEm = agora + INTERVALO_ADIAR_LEMBRETE_MS;
  store.setItem(`depois_atualizacao_${versao}`, String(expiraEm));
}

/**
 * Verifica se a versão foi adiada pelo usuário ("Depois") e ainda está dentro das 24 horas.
 */
export function foiAdiadoRecentemente(
  versao: string,
  storage?: StorageSimples,
  agora = Date.now()
): boolean {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!store) return false;
  const adiarTimestamp = parseInt(store.getItem(`depois_atualizacao_${versao}`) || '0', 10);
  return agora < adiarTimestamp;
}

export interface ChecarAtualizacaoParams {
  versaoAtual?: string;
  nativeBuildAtual?: number;
  ignorarIntervalo?: boolean;
  fetchFn?: typeof fetch;
  storage?: StorageSimples;
  online?: boolean;
  customConn?: any;
  agora?: number;
}

/**
 * Executa a checagem automática de atualização:
 * 1. Não-bloqueante (executa em background).
 * 2. Sem internet (navigator.onLine === false), pula na hora sem erro.
 * 3. Se online, faz fetch com AbortController de 4s. Erro/timeout é ignorado silenciosamente.
 * 4. Respeita intervalo de 6h (salva hora em localStorage).
 * 5. Se houver falha prévia de inicialização (init_falhas > 0 ou versao_falha), não exibe na abertura.
 * 6. Se o nativeBuild for maior, sinaliza exigeNovoApk = true (sem oferecer download).
 */
export async function checarAtualizacaoAuto(
  params: ChecarAtualizacaoParams = {}
): Promise<ResultadoChecagemAtualizacao | null> {
  const {
    versaoAtual = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.29',
    nativeBuildAtual = typeof __NATIVE_BUILD__ === 'number' ? __NATIVE_BUILD__ : 3,
    ignorarIntervalo = false,
    fetchFn = typeof fetch !== 'undefined' ? fetch : undefined,
    storage = typeof localStorage !== 'undefined' ? localStorage : undefined,
    online = typeof navigator !== 'undefined' ? navigator.onLine : true,
    customConn,
    agora = Date.now(),
  } = params;

  // 1. Sem internet, siga direto sem erro nem mensagem
  if (online === false) {
    return null;
  }

  if (!fetchFn || !storage) {
    return null;
  }

  // 2. Segurança: se a última tentativa falhou (init_falhas > 0), não exibe aviso na abertura
  const initFalhas = parseInt(storage.getItem('init_falhas') || '0', 10);
  if (!ignorarIntervalo && initFalhas > 0) {
    return null;
  }

  // 3. Frequência: só consulta novamente após 6 horas
  if (!ignorarIntervalo) {
    const ultimaChecagem = parseInt(storage.getItem('ultima_checagem_atualizacao_auto') || '0', 10);
    if (agora - ultimaChecagem < INTERVALO_CHECAGEM_AUTO_MS) {
      return null;
    }
  }

  // 4. Fetch com AbortController de 4 segundos
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId: any = null;
  if (controller) {
    timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, TIMEOUT_FETCH_MS);
  }

  try {
    const url = `${URL_VERSION_JSON}?t=${agora}`;
    const res = await fetchFn(url, { signal: controller ? controller.signal : undefined });
    if (timeoutId) clearTimeout(timeoutId);

    if (!res || !res.ok) {
      console.warn('Checagem automática de atualização: servidor retornou status não-ok');
      return null;
    }

    const data = await res.json();
    if (!data || !data.version) {
      console.warn('Checagem automática de atualização: payload inválido');
      return null;
    }

    // Grava timestamp da última checagem bem-sucedida
    storage.setItem('ultima_checagem_atualizacao_auto', String(agora));

    const novaVersao = String(data.version);
    const comparacao = compararVersoes(novaVersao, versaoAtual);
    if (comparacao <= 0) {
      return null; // Não há versão superior
    }

    // Se essa versão foi marcada como falha anteriormente, não exibe aviso na abertura
    const versaoFalha = storage.getItem('versao_atualizacao_falha') || storage.getItem('versao_falha');
    if (!ignorarIntervalo && versaoFalha === novaVersao) {
      return null;
    }

    // Se o usuário selecionou 'Depois' para esta versão nas últimas 24h, respeita o adiamento
    if (!ignorarIntervalo && foiAdiadoRecentemente(novaVersao, storage, agora)) {
      return null;
    }

    const releaseNativeBuild = typeof data.nativeBuild === 'number' ? data.nativeBuild : undefined;
    const exigeNovoApk = typeof releaseNativeBuild === 'number' && releaseNativeBuild > nativeBuildAtual;

    const dadosMoveis = isConexaoDadosMoveis(customConn);
    const tamanhoFormatado =
      typeof data.size === 'number' && data.size > 0 ? formatarTamanhoBytes(data.size) : undefined;

    const release: ReleaseInfo = {
      version: novaVersao,
      url: String(data.url || ''),
      checksum: data.checksum ? String(data.checksum) : undefined,
      size: typeof data.size === 'number' ? data.size : undefined,
      notes: data.notes ? String(data.notes) : undefined,
      nativeBuild: releaseNativeBuild,
      nomeArquivo: (data.url ? String(data.url) : '').split('/').pop()?.split('?')[0] || 'dist.zip',
      tag_name: novaVersao,
      name: `Versão ${novaVersao}`,
      body: data.notes,
    };

    return {
      temAtualizacao: true,
      versao: novaVersao,
      exigeNovoApk,
      release,
      tamanhoFormatado,
      isDadosMoveis: dadosMoveis,
    };
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('Checagem automática de atualização ignorada silenciosamente:', err?.message || err);
    return null;
  }
}
