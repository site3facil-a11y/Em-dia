import { describe, it, expect } from 'vitest';
import {
  uint8ArrayToBase64,
  stringToBase64,
  base64ToArrayBuffer,
} from '../src/utils/fileExport';
import { validarCabecalhoSqlite } from '../src/db/sqlite';

describe('fileExport and base64 conversions', () => {
  it('deve converter Uint8Array para base64 e de volta para ArrayBuffer corretamente', () => {
    const originalBytes = new Uint8Array([83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0]);
    const base64 = uint8ArrayToBase64(originalBytes);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    const buffer = base64ToArrayBuffer(base64);
    const recoveredBytes = new Uint8Array(buffer);
    expect(recoveredBytes).toEqual(originalBytes);
  });

  it('deve converter string com caracteres UTF-8 para base64 e decodificar perfeitamente', () => {
    const texto = 'Relatório de Contas: R$ 1.500,00; Açúcar e Café; Mês 10';
    const base64 = stringToBase64(texto);
    expect(typeof base64).toBe('string');

    const buffer = base64ToArrayBuffer(base64);
    const decoded = new TextDecoder().decode(buffer);
    expect(decoded).toBe(texto);
  });

  it('deve validar corretamente o cabeçalho SQLite format 3', () => {
    // Cabeçalho válido de 16 bytes: "SQLite format 3\0"
    const validHeader = new Uint8Array(16);
    const str = 'SQLite format 3\0';
    for (let i = 0; i < str.length; i++) {
      validHeader[i] = str.charCodeAt(i);
    }
    expect(validarCabecalhoSqlite(validHeader.buffer)).toBe(true);

    // Cabeçalho inválido
    const invalidHeader = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(validarCabecalhoSqlite(invalidHeader.buffer)).toBe(false);

    // Buffer menor que 16 bytes
    const shortBuffer = new Uint8Array([1, 2, 3]);
    expect(validarCabecalhoSqlite(shortBuffer.buffer)).toBe(false);
  });
});
