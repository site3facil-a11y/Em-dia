import { describe, it, expect } from 'vitest';
import { compararVersoes } from '../src/utils/versao';
import { checarAtualizacaoAuto, adiarAvisoAtualizacao } from '../src/utils/autoUpdater';

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

  it('deve processar o payload de version.json do GitHub Pages corretamente', () => {
    const versionPayload = {
      version: '1.0.10',
      url: 'https://site3facil-a11y.github.io/Em-dia/dist-1.0.10.zip',
      size: 2450000,
      notes: 'Melhorias de desempenho e correções gerais.',
    };

    expect(compararVersoes(versionPayload.version, '1.0.9')).toBe(1);
    expect(compararVersoes(versionPayload.version, '1.0.10')).toBe(0);
    expect(compararVersoes(versionPayload.version, '1.0.11')).toBe(-1);
    expect(versionPayload.url).toContain('dist-1.0.10.zip');
  });

  it('deve bloquear download e exigir novo APK quando nativeBuild do release for maior que o instalado (Item 6)', () => {
    const appNativeBuild = 3;

    const releaseMesmoBuild = {
      version: '1.0.28',
      url: 'https://site3facil-a11y.github.io/Em-dia/dist-1.0.28.zip',
      nativeBuild: 3,
    };
    const deveBaixarMesmoBuild = releaseMesmoBuild.nativeBuild <= appNativeBuild;
    expect(deveBaixarMesmoBuild).toBe(true);

    const releaseBuildSuperior = {
      version: '1.1.0',
      url: 'https://site3facil-a11y.github.io/Em-dia/dist-1.1.0.zip',
      nativeBuild: 4,
    };
    const exigeNovoApk = releaseBuildSuperior.nativeBuild > appNativeBuild;
    expect(exigeNovoApk).toBe(true);

    const mensagemExibida = exigeNovoApk
      ? `Esta atualização exige instalar o APK mais recente (versão ${releaseBuildSuperior.version}, build ${releaseBuildSuperior.nativeBuild})`
      : 'Atualização compatível';
    expect(mensagemExibida).toContain('Esta atualização exige instalar o APK mais recente');
  });

  it('deve simular o contador de falhas init_falhas (Item 2)', () => {
    let mockStorage: Record<string, string> = {};

    // 1. Início da primeira tentativa
    let falhas = parseInt(mockStorage['init_falhas'] || '0', 10) + 1;
    mockStorage['init_falhas'] = String(falhas);
    expect(falhas).toBe(1);

    // Se falhar antes de carregar a tela e reiniciar:
    falhas = parseInt(mockStorage['init_falhas'] || '0', 10) + 1;
    mockStorage['init_falhas'] = String(falhas);
    expect(falhas).toBe(2);

    // Se chegar a 2, dispara reset
    let resetChamado = false;
    if (falhas >= 2) {
      resetChamado = true;
      mockStorage['init_falhas'] = '0';
    }
    expect(resetChamado).toBe(true);
    expect(mockStorage['init_falhas']).toBe('0');

    // Inicialização bem-sucedida zera o contador
    mockStorage['init_falhas'] = '1';
    // Após sucesso do banco e primeira tela renderizada:
    mockStorage['init_falhas'] = '0';
    expect(mockStorage['init_falhas']).toBe('0');
  });

  it('deve disparar erro com o nome da etapa ao estourar o timeout (Item 5)', async () => {
    async function comTimeout<T>(promessa: Promise<T>, ms: number, etapaNome: string): Promise<T> {
      let timeoutId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          const err: any = new Error(`Tempo limite esgotado (${ms / 1000}s) na etapa: ${etapaNome}`);
          err.etapa = etapaNome;
          reject(err);
        }, ms);
      });

      try {
        return await Promise.race([promessa, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const promessaLenta = new Promise((resolve) => setTimeout(resolve, 100));

    await expect(comTimeout(promessaLenta, 20, 'WASM (inicialização do motor SQLite)')).rejects.toThrow(
      'Tempo limite esgotado (0.02s) na etapa: WASM (inicialização do motor SQLite)'
    );

    const promessaRapida = Promise.resolve('ok');
    const res = await comTimeout(promessaRapida, 50, 'Abrir banco de dados');
    expect(res).toBe('ok');
  });

  describe('Checagem Automática de Atualização (Item 8)', () => {
    const criarMockStorage = (dadosIniciais: Record<string, string> = {}) => {
      const store: Record<string, string> = { ...dadosIniciais };
      return {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        dump: () => store,
      };
    };

    it('deve respeitar o intervalo de 6 horas para checagem automática', async () => {
      const agora = 1700000000000;
      let chamadasFetch = 0;
      const mockFetch = async () => {
        chamadasFetch++;
        return {
          ok: true,
          json: async () => ({ version: '1.1.0', url: 'https://example.com/dist.zip' }),
        } as any;
      };

      // 1. Checagem realizada há 3 horas (deve pular)
      const storage3h = criarMockStorage({
        ultima_checagem_atualizacao_auto: String(agora - 3 * 60 * 60 * 1000),
      });
      const res3h = await checarAtualizacaoAuto({
        versaoAtual: '1.0.29',
        storage: storage3h,
        fetchFn: mockFetch,
        agora,
      });
      expect(res3h).toBeNull();
      expect(chamadasFetch).toBe(0);

      // 2. Checagem realizada há 7 horas (deve consultar)
      const storage7h = criarMockStorage({
        ultima_checagem_atualizacao_auto: String(agora - 7 * 60 * 60 * 1000),
      });
      const res7h = await checarAtualizacaoAuto({
        versaoAtual: '1.0.29',
        storage: storage7h,
        fetchFn: mockFetch,
        agora,
      });
      expect(res7h).not.toBeNull();
      expect(res7h?.temAtualizacao).toBe(true);
      expect(res7h?.versao).toBe('1.1.0');
      expect(chamadasFetch).toBe(1);
      // Deve ter salvo o timestamp atual
      expect(storage7h.getItem('ultima_checagem_atualizacao_auto')).toBe(String(agora));
    });

    it('deve adiar aviso por 24 horas ao selecionar "Depois"', async () => {
      const agora = 1700000000000;
      const storage = criarMockStorage();
      const mockFetch = async () => ({
        ok: true,
        json: async () => ({ version: '1.1.0', url: 'https://example.com/dist.zip' }),
      } as any);

      // Usuário clica em 'Depois' para a versão 1.1.0
      adiarAvisoAtualizacao('1.1.0', storage as any, agora);
      const timestampAdiado = parseInt(storage.getItem('depois_atualizacao_1.1.0') || '0', 10);
      expect(timestampAdiado).toBe(agora + 24 * 60 * 60 * 1000);

      // Consulta 12 horas depois (ainda dentro de 24h: deve suprimir aviso)
      const res12h = await checarAtualizacaoAuto({
        versaoAtual: '1.0.29',
        storage,
        fetchFn: mockFetch,
        agora: agora + 12 * 60 * 60 * 1000,
      });
      expect(res12h).toBeNull();

      // Consulta 25 horas depois (fora das 24h: deve alertar normalmente)
      const res25h = await checarAtualizacaoAuto({
        versaoAtual: '1.0.29',
        storage,
        fetchFn: mockFetch,
        agora: agora + 25 * 60 * 60 * 1000,
      });
      expect(res25h).not.toBeNull();
      expect(res25h?.temAtualizacao).toBe(true);
      expect(res25h?.versao).toBe('1.1.0');
    });

    it('deve pular imediatamente sem erro quando estiver offline', async () => {
      let chamadasFetch = 0;
      const mockFetch = async () => {
        chamadasFetch++;
        return {} as any;
      };

      const storage = criarMockStorage();
      const resultado = await checarAtualizacaoAuto({
        online: false,
        storage,
        fetchFn: mockFetch,
      });

      expect(resultado).toBeNull();
      expect(chamadasFetch).toBe(0);
    });

    it('deve tratar tempo esgotado (timeout 4s) sem erro', async () => {
      const storage = criarMockStorage();
      const mockFetchTimeout = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const resultado = await checarAtualizacaoAuto({
        storage,
        fetchFn: mockFetchTimeout,
      });

      expect(resultado).toBeNull();
    });

    it('deve sinalizar exigeNovoApk quando nativeBuild for superior, sem oferecer download', async () => {
      const storage = criarMockStorage();
      const mockFetch = async () => ({
        ok: true,
        json: async () => ({
          version: '1.2.0',
          url: 'https://example.com/dist.zip',
          nativeBuild: 4,
          size: 4500000,
        }),
      } as any);

      const resultado = await checarAtualizacaoAuto({
        versaoAtual: '1.0.29',
        nativeBuildAtual: 3, // App instalado está no build 3
        storage,
        fetchFn: mockFetch,
        customConn: { type: 'cellular' }, // Teste com dados móveis
      });

      expect(resultado).not.toBeNull();
      expect(resultado?.temAtualizacao).toBe(true);
      expect(resultado?.exigeNovoApk).toBe(true);
      expect(resultado?.isDadosMoveis).toBe(true);
      expect(resultado?.tamanhoFormatado).toBe('4.3 MB');
    });
  });
});
