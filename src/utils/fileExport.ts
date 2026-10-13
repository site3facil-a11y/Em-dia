import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Converte Uint8Array em base64 de forma eficiente e segura contra estouro de pilha
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Converte string UTF-8 (inclusive caracteres acentuados) em base64
 */
export function stringToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return uint8ArrayToBase64(bytes);
}

/**
 * Converte string base64 em ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

export interface OpcoesExportarArquivo {
  fileName: string;
  data: Uint8Array | string;
  mimeType: string;
  dialogTitle?: string;
  title?: string;
}

/**
 * Download padrão em navegador web (via Blob e tag <a>)
 */
export function downloadNavegador(fileName: string, data: Uint8Array | string, mimeType: string) {
  const blob =
    typeof data === 'string'
      ? new Blob([data], { type: mimeType })
      : new Blob([data.buffer as ArrayBuffer], { type: mimeType });

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Salva o arquivo diretamente no armazenamento do aparelho (Pasta Documentos).
 * No app nativo (Android/iOS): grava em Directory.Documents sem precisar de app intermediário.
 * No navegador web: faz o download direto na pasta Downloads do browser.
 */
export async function salvarArquivoNoDispositivo({
  fileName,
  data,
  mimeType = 'application/x-sqlite3',
}: {
  fileName: string;
  data: Uint8Array | string;
  mimeType?: string;
}): Promise<{ path: string; fileName: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== 'granted') {
        await Filesystem.requestPermissions();
      }
    } catch {
      // Ignora erro de checagem se permissões não forem suportadas diretamente
    }

    const base64Data = typeof data === 'string' ? stringToBase64(data) : uint8ArrayToBase64(data);

    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });

    return { path: result.uri, fileName };
  } else {
    downloadNavegador(fileName, data, mimeType);
    return { path: fileName, fileName };
  }
}

/**
 * Salva o arquivo no Google Drive.
 * No app nativo: envia o arquivo real (.sqlite) para o Google Drive via Share nativo com anexo de stream.
 * No navegador web: baixa o arquivo para upload manual no Drive.
 */
export async function salvarNoGoogleDrive({
  fileName,
  data,
  mimeType = 'application/x-sqlite3',
  title,
}: {
  fileName: string;
  data: Uint8Array | string;
  mimeType?: string;
  title?: string;
}): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64Data = typeof data === 'string' ? stringToBase64(data) : uint8ArrayToBase64(data);

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: title || fileName,
      files: [uriResult.uri],
      dialogTitle: 'Salvar no Google Drive',
    });
  } else {
    downloadNavegador(fileName, data, mimeType);
  }
}

/**
 * Envia o arquivo por E-mail.
 * No app nativo: abre o app de e-mail (Gmail/Outlook) com o arquivo anexado e assunto pré-configurado.
 * No navegador web: baixa o arquivo para envio.
 */
export async function enviarPorEmail({
  fileName,
  data,
  mimeType = 'application/x-sqlite3',
  assunto,
  corpo,
}: {
  fileName: string;
  data: Uint8Array | string;
  mimeType?: string;
  assunto?: string;
  corpo?: string;
}): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64Data = typeof data === 'string' ? stringToBase64(data) : uint8ArrayToBase64(data);

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: assunto || `Backup Em Dia - ${fileName}`,
      text: corpo || 'Segue em anexo o arquivo de backup do aplicativo Em Dia (.sqlite).',
      files: [uriResult.uri],
      dialogTitle: 'Enviar backup por e-mail',
    });
  } else {
    downloadNavegador(fileName, data, mimeType);
  }
}

/**
 * Exporta ou compartilha um arquivo genérico.
 * Usa files: [uri] para que o Android reconheça como arquivo anexado real.
 */
export async function exportarOuCompartilharArquivo({
  fileName,
  data,
  mimeType,
  dialogTitle = 'Salvar backup',
  title,
}: OpcoesExportarArquivo): Promise<{ fileName: string }> {
  if (Capacitor.isNativePlatform()) {
    const base64Data = typeof data === 'string' ? stringToBase64(data) : uint8ArrayToBase64(data);

    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title: title || fileName,
      files: [uriResult.uri],
      dialogTitle: dialogTitle || 'Salvar backup',
    });

    return { fileName };
  } else {
    downloadNavegador(fileName, data, mimeType);
    return { fileName };
  }
}
