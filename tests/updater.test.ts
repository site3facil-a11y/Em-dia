import { describe, it, expect } from 'vitest';
import { compararVersoes } from '../src/utils/versao';

describe('compararVersoes e validação de releases', () => {
  it('deve comparar versões semânticas corretamente com ou sem prefixo v', () => {
    expect(compararVersoes('v1.0.6', '1.0.5')).toBe(1);
    expect(compararVersoes('1.0.5', '1.0.6')).toBe(-1);
    expect(compararVersoes('1.0.6', '1.0.6')).toBe(0);
    expect(compararVersoes('v1.1.0', 'v1.0.9')).toBe(1);
    expect(compararVersoes('2.0.0', 'v1.99.99')).toBe(1);
  });

  it('deve identificar corretamente a presença do asset dist.zip ignorando maiúsculas e minúsculas', () => {
    const assetsValidos = [
      { name: 'release.txt', browser_download_url: 'https://example.com/txt' },
      { name: 'DIST.ZIP', browser_download_url: 'https://example.com/dist.zip', size: 1048576 },
    ];
    const assetDist = assetsValidos.find((a) => a.name.toLowerCase() === 'dist.zip');
    expect(assetDist).toBeDefined();
    expect(assetDist?.browser_download_url).toBe('https://example.com/dist.zip');
    expect(assetDist?.size).toBe(1048576);

    const assetsSemDist = [
      { name: 'source.tar.gz', browser_download_url: 'https://example.com/source' },
    ];
    const assetFaltando = assetsSemDist.find((a) => a.name.toLowerCase() === 'dist.zip');
    expect(assetFaltando).toBeUndefined();
  });
});
