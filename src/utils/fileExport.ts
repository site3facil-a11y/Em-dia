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
 * Exporta ou compartilha um arquivo.
 * No ambiente nativo do Android/iOS (Capacitor):
 * 1. Grava no Directory.Cache com dados em base64
 * 2. Obtém a URI pelo Filesystem.getUri
 * 3. Abre a folha de compartilhamento nativa (Share.share) com dialogTitle="Salvar backup"
 *
 * No ambiente web padrão (fora do nativo):
 * Mantém o fluxo atual utilizando Blob e <a download>.
 */
export async function exportarOuCompartilharArquivo({
  fileName,
  data,
  mimeType,
  dialogTitle = 'Salvar backup',
  title,
}: OpcoesExportarArquivo): Promise<{ fileName: string }> {
  if (Capacitor.isNativePlatform()) {
    // 1. Converter dados para base64
    const base64Data = typeof data === 'string' ? stringToBase64(data) : uint8ArrayToBase64(data);

    // 2. Gravar no Directory.Cache
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    // 3. Obter a URI do arquivo
    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    // 4. Abrir a folha de compartilhamento
    await Share.share({
      title: title || fileName,
      url: uriResult.uri,
      dialogTitle: dialogTitle || 'Salvar backup',
    });

    return { fileName };
  } else {
    // Fora do app nativo: download tradicional via Blob e tag <a>
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

    return { fileName };
  }
}
