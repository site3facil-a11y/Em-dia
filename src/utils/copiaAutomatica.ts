import { Filesystem, Directory } from '@capacitor/filesystem';
import { getDb, persistirDbImediato } from '../db/sqlite';
import { uint8ArrayToBase64, base64ToArrayBuffer } from './fileExport';

const CHAVE_ULTIMA_COPIA_TS = 'em_dia_ultima_copia_automatica_ts';
const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias em milissegundos

export interface InfoCopiaAutomatica {
  nome: string;
  dataFormatada: string;
}

/**
 * Executa uma cópia automática do banco de dados para Directory.Data uma vez por semana ao abrir o app,
 * mantendo apenas as 3 últimas cópias gravadas.
 */
export async function executarCopiaAutomaticaSemanalSeNecessario(): Promise<boolean> {
  try {
    const agora = Date.now();
    const ultimoTsStr = localStorage.getItem(CHAVE_ULTIMA_COPIA_TS);
    const ultimoTs = ultimoTsStr ? Number(ultimoTsStr) : null;

    if (ultimoTs && agora - ultimoTs < UMA_SEMANA_MS) {
      // Já foi feita uma cópia há menos de 7 dias
      return false;
    }

    // Garante que o banco em memória está gravado no IndexedDB
    await persistirDbImediato();
    const db = await getDb();
    const binaryArray = db.export();

    if (!binaryArray || binaryArray.length === 0) {
      return false;
    }

    // Formata o nome do arquivo com timestamp ISO: auto-backup-YYYY-MM-DDTHH-mm-ss.sqlite
    const dataIsoFormatada = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `auto-backup-${dataIsoFormatada}.sqlite`;
    const base64Data = uint8ArrayToBase64(binaryArray);

    // Grava no Directory.Data (armazenamento persistente privado do app)
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    // Mantém apenas as 3 últimas cópias
    await limparCopiasExcedentes();

    // Registra a data da cópia
    localStorage.setItem(CHAVE_ULTIMA_COPIA_TS, String(agora));
    return true;
  } catch (err) {
    console.warn('Aviso ao executar cópia automática semanal do banco:', err);
    return false;
  }
}

/**
 * Remove cópias antigas em Directory.Data além das 3 mais recentes
 */
async function limparCopiasExcedentes(): Promise<void> {
  try {
    const dirResult = await Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    });

    const arquivos = (dirResult.files || [])
      .map((f: any) => (typeof f === 'string' ? f : f?.name || ''))
      .filter((nome: string) => nome.startsWith('auto-backup-') && nome.endsWith('.sqlite'))
      .sort((a: string, b: string) => b.localeCompare(a)); // Ordena decrescente (mais recentes primeiro)

    if (arquivos.length > 3) {
      const excedentes = arquivos.slice(3);
      for (const nome of excedentes) {
        try {
          await Filesystem.deleteFile({
            path: nome,
            directory: Directory.Data,
          });
        } catch (delErr) {
          console.warn('Aviso ao remover cópia automática antiga:', nome, delErr);
        }
      }
    }
  } catch (err) {
    console.warn('Aviso ao gerenciar retenção de cópias automáticas:', err);
  }
}

/**
 * Retorna as informações da última cópia automática armazenada em Directory.Data
 */
export async function obterInfoUltimaCopiaAutomatica(): Promise<InfoCopiaAutomatica | null> {
  try {
    const dirResult = await Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    });

    const arquivos = (dirResult.files || [])
      .map((f: any) => (typeof f === 'string' ? f : f?.name || ''))
      .filter((nome: string) => nome.startsWith('auto-backup-') && nome.endsWith('.sqlite'))
      .sort((a: string, b: string) => b.localeCompare(a));

    if (arquivos.length === 0) return null;

    const nome = arquivos[0];
    let dataFormatada = nome;
    try {
      const match = nome.match(/auto-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
      if (match) {
        const [, ano, mes, dia, hora, min] = match;
        dataFormatada = `${dia}/${mes}/${ano} às ${hora}:${min}`;
      }
    } catch {}

    return {
      nome,
      dataFormatada,
    };
  } catch {
    return null;
  }
}

/**
 * Lê o arquivo da última cópia automática e retorna seu nome e ArrayBuffer
 */
export async function carregarBufferUltimaCopiaAutomatica(): Promise<{
  nome: string;
  buffer: ArrayBuffer;
  dataFormatada: string;
} | null> {
  const info = await obterInfoUltimaCopiaAutomatica();
  if (!info) return null;

  const res = await Filesystem.readFile({
    path: info.nome,
    directory: Directory.Data,
  });

  let buffer: ArrayBuffer;
  if (typeof res.data === 'string') {
    buffer = base64ToArrayBuffer(res.data);
  } else if (res.data instanceof Blob) {
    buffer = await res.data.arrayBuffer();
  } else {
    throw new Error('Formato retornado pelo sistema de arquivos não é compatível.');
  }

  return {
    nome: info.nome,
    buffer,
    dataFormatada: info.dataFormatada,
  };
}
