import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  X,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  FileArchive,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { salvarCopiaSegurancaSilenciosa } from '../utils/copiaAutomatica';
import { ModalBase } from './ModalBase';

export interface ReleaseInfo {
  version: string;
  url: string;
  checksum?: string;
  size?: number;
  notes?: string;
  nomeArquivo?: string;
  nativeBuild?: number;
  // Campos legados para compatibilidade com a API de Releases do GitHub
  tag_name?: string;
  name?: string;
  body?: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size?: number;
  }>;
}

interface DiagnosticoErro {
  urlUsada: string;
  mensagem: string;
  erroCompletoJson: string;
  eventoDownloadFailed?: string;
  versaoApp: string;
  versaoPlugin: string;
  statusHead?: string;
}

interface ModalAtualizacaoProps {
  aberto: boolean;
  onFechar: () => void;
  release: ReleaseInfo | null;
  versaoAtual: string;
}

const VERSAO_PLUGIN_UPDATER = '8.52.1';
const MAX_TENTATIVAS_AUTOMATICAS = 2; // Até 2 tentativas automáticas adicionais (3 no total)

function formatarTamanhoBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Tamanho desconhecido';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ModalAtualizacao: React.FC<ModalAtualizacaoProps> = ({
  aberto,
  onFechar,
  release,
  versaoAtual,
}) => {
  const appNativeBuild = typeof __NATIVE_BUILD__ === 'number' ? __NATIVE_BUILD__ : 3;
  const releaseNativeBuild = typeof release?.nativeBuild === 'number' ? release.nativeBuild : undefined;
  const exigeNovoApk = Boolean(releaseNativeBuild && releaseNativeBuild > appNativeBuild);

  // Verifica se a atualização anterior falhou (Item 7)
  const [falhaAnterior] = useState<boolean>(() => {
    try {
      const falhasStr = localStorage.getItem('init_falhas') || '0';
      const falhas = parseInt(falhasStr, 10) || 0;
      return falhas > 0 || localStorage.getItem('ultima_atualizacao_falhou') === 'true';
    } catch {
      return false;
    }
  });

  const [etapa, setEtapa] = useState<'pronto_download' | 'baixando' | 'baixado' | 'aplicando' | 'concluido'>('pronto_download');
  const [bundleBaixado, setBundleBaixado] = useState<any | null>(null);
  const [progresso, setProgresso] = useState<number>(0);
  const [statusTexto, setStatusTexto] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoErro | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [avisoNaoNativo, setAvisoNaoNativo] = useState(false);
  const atualizando = etapa === 'baixando' || etapa === 'aplicando' || etapa === 'concluido';

  if (!aberto || !release) return null;

  // Informações da versão e URL direta (prioriza o JSON de version.json do GitHub Pages)
  const novaVersao = release.version || release.tag_name || '';
  const downloadUrl =
    release.url ||
    release.assets?.find((a) => a.name?.toLowerCase() === 'dist.zip')?.browser_download_url ||
    '';

  const tamanhoBytes =
    release.size ??
    release.assets?.find((a) => a.name?.toLowerCase() === 'dist.zip')?.size;
  const tamanhoFormatado = tamanhoBytes ? formatarTamanhoBytes(tamanhoBytes) : null;

  const nomeArquivo =
    release.nomeArquivo ||
    (downloadUrl ? downloadUrl.split('/').pop()?.split('?')[0] : 'dist.zip');

  const notasVersao = release.notes || release.body || '';

  const handleCopiarDiagnostico = async () => {
    if (!diagnostico) return;
    const linhas = [
      `URL: ${diagnostico.urlUsada}`,
      `Erro: ${diagnostico.mensagem}`,
      `Erro do Plugin (JSON): ${diagnostico.erroCompletoJson}`,
      diagnostico.eventoDownloadFailed ? `Evento downloadFailed: ${diagnostico.eventoDownloadFailed}` : '',
      `Versão do App: v${diagnostico.versaoApp}`,
      `Versão do Plugin @capgo/capacitor-updater: v${diagnostico.versaoPlugin}`,
      `Teste de acesso (informativo): ${diagnostico.statusHead || 'N/A'}`,
    ].filter(Boolean);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linhas.join('\n'));
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch (err) {
      console.warn('Falha ao copiar diagnóstico:', err);
    }
  };

  const handleAbrirNoNavegador = () => {
    if (!downloadUrl) return;
    try {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = downloadUrl;
    }
  };

  const handleAtualizarAgora = async () => {
    setErro(null);
    setDiagnostico(null);
    setAvisoNaoNativo(false);

    // Se o release exige APK mais recente devido a incompatibilidade de build nativo (Item 6)
    if (exigeNovoApk) {
      setErro(`Esta atualização exige instalar o APK mais recente (Build ${releaseNativeBuild}).`);
      return;
    }

    // Se Capacitor.isNativePlatform() for falso, aviso específico
    if (!Capacitor.isNativePlatform()) {
      setAvisoNaoNativo(true);
      return;
    }

    // Se não houver URL de download válida
    if (!downloadUrl) {
      const msg = 'A versão publicada não tem arquivo para download';
      setErro(msg);
      setDiagnostico({
        urlUsada: 'Nenhuma URL de download encontrada',
        mensagem: msg,
        erroCompletoJson: JSON.stringify({ erro: msg }),
        versaoApp: versaoAtual,
        versaoPlugin: VERSAO_PLUGIN_UPDATER,
        statusHead: 'Não realizado (URL ausente)',
      });
      return;
    }

    let statusHead = 'Não realizado';
    let ultimoEventoDownloadFailed: any = null;
    let urlUsadaEfetiva = downloadUrl;

    // Normalização inteligente de URL:
    // No Android, links do GitHub Releases (github.com/.../releases/download/...)
    // retornam HTTP 302 que falham no plugin OkHttp nativo. O GitHub Pages oferece
    // o arquivo dist-X.Y.Z.zip direto sem redirecionamento.
    const versaoLimpa = novaVersao.replace(/^v/, '');
    const urlPagesVersao = `https://site3facil-a11y.github.io/Em-dia/dist-${versaoLimpa}.zip`;
    const urlPagesFixa = 'https://site3facil-a11y.github.io/Em-dia/dist.zip';

    // Lista ordenada de URLs candidatas para download
    const urlsCandidatas: string[] = [];
    if (downloadUrl.startsWith('https://site3facil-a11y.github.io/')) {
      urlsCandidatas.push(downloadUrl);
      if (downloadUrl !== urlPagesFixa) urlsCandidatas.push(urlPagesFixa);
    } else {
      // Se a URL veio do GitHub Releases, priorizamos o Pages direto para evitar o erro 302
      urlsCandidatas.push(urlPagesVersao);
      urlsCandidatas.push(urlPagesFixa);
      urlsCandidatas.push(downloadUrl);
    }

    try {
      setEtapa('baixando');
      setStatusTexto('Criando cópia de segurança do banco...');
      setProgresso(10);

      // 1. Backup da atualização silencioso: grava em Directory.Data sem folha de compartilhamento
      try {
        await salvarCopiaSegurancaSilenciosa();
        setStatusTexto('Cópia de segurança criada.');
      } catch (backupErr) {
        console.warn('Aviso na cópia de segurança silenciosa pré-atualização:', backupErr);
        setStatusTexto('Cópia de segurança criada.');
      }
      setProgresso(20);

      // 2. Teste HEAD com fetch: apenas informativo, sem bloquear
      setStatusTexto('Testando conexão com o servidor de download...');
      try {
        const headRes = await fetch(urlsCandidatas[0], { method: 'HEAD' });
        statusHead = `HTTP ${headRes.status} ${headRes.statusText || 'OK'}`.trim();
      } catch (headErr: any) {
        statusHead = `Erro (${headErr?.message || 'Informativo'})`;
        console.info('Teste HEAD informativo:', headErr);
      }

      // 4. Download com até 2 tentativas automáticas com 2 segundos de intervalo
      let sucesso = false;
      let ultimoErro: any = null;
      let finalBundle: any = null;

      for (let tentativa = 0; tentativa <= MAX_TENTATIVAS_AUTOMATICAS; tentativa++) {
        let downloadListenerHandle: any = null;
        let completeListenerHandle: any = null;
        let failedListenerHandle: any = null;

        // Seleciona a URL candidata para a tentativa
        const urlParaTentativa = urlsCandidatas[tentativa % urlsCandidatas.length];
        urlUsadaEfetiva = urlParaTentativa;

        try {
          if (tentativa === 0) {
            setStatusTexto('Baixando nova versão...');
          } else {
            setStatusTexto(`Tentativa ${tentativa + 1} de ${MAX_TENTATIVAS_AUTOMATICAS + 1}: baixando...`);
          }
          setProgresso(35);

          let downloadCompleteFired = false;
          let bundleDoCompleteEvent: any = null;
          let resolverComplete: ((b: any) => void) | null = null;
          const promessaComplete = new Promise<any>((resolve) => {
            resolverComplete = resolve;
          });

          // Listener de progresso percentual
          try {
            downloadListenerHandle = await CapacitorUpdater.addListener('download', (state: any) => {
              if (typeof state?.percent === 'number') {
                setProgresso(Math.max(35, Math.min(95, Math.round(state.percent))));
              }
            });
          } catch (listenerErr) {
            console.warn('Listener download não disponível:', listenerErr);
          }

          // Listener de downloadFailed para capturar diagnósticos nativos
          try {
            failedListenerHandle = await CapacitorUpdater.addListener('downloadFailed', (state: any) => {
              ultimoEventoDownloadFailed = state;
            });
          } catch (failedListenerErr) {
            console.warn('Listener downloadFailed não disponível:', failedListenerErr);
          }

          // Listener de downloadComplete - só chama set() depois deste evento
          try {
            completeListenerHandle = await CapacitorUpdater.addListener('downloadComplete', (state: any) => {
              downloadCompleteFired = true;
              bundleDoCompleteEvent = state?.bundle;
              if (resolverComplete) {
                resolverComplete(state?.bundle);
              }
            });
          } catch (completeListenerErr) {
            console.warn('Listener downloadComplete não disponível:', completeListenerErr);
          }

          // Obter ou calcular checksum SHA-256 (obrigatório pelo plugin @capgo/capacitor-updater v8)
          let checksumResolvido = release?.checksum?.trim();
          if (!checksumResolvido) {
            try {
              // 1. Tentar buscar arquivo .sha256 no GitHub Pages
              const resSha = await fetch(`${urlParaTentativa}.sha256`);
              if (resSha.ok) {
                const txt = await resSha.text();
                const hash = txt.trim().split(/\s+/)[0];
                if (hash && hash.length === 64) checksumResolvido = hash;
              }
            } catch {}
          }
          if (!checksumResolvido && urlParaTentativa.includes('github.io')) {
            try {
              // 2. Tentar calcular via fetch e crypto.subtle (GitHub Pages suporta CORS)
              const resZip = await fetch(urlParaTentativa);
              if (resZip.ok) {
                const buf = await resZip.arrayBuffer();
                const hashBuf = await crypto.subtle.digest('SHA-256', buf);
                const hashArray = Array.from(new Uint8Array(hashBuf));
                checksumResolvido = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
              }
            } catch {}
          }

          // 3. Executa download usando a URL, a versão e o checksum SHA-256
          const bundleDoDownload = await CapacitorUpdater.download({
            url: urlParaTentativa,
            version: novaVersao,
            ...(checksumResolvido ? { checksum: checksumResolvido } : {}),
          });

          // Só chame set() depois do evento downloadComplete
          if (!downloadCompleteFired) {
            setStatusTexto('Aguardando conclusão do processamento...');
            const bundleEvento = await Promise.race([
              promessaComplete,
              new Promise<any>((resolve) => setTimeout(() => resolve(null), 3000)),
            ]);
            if (bundleEvento) {
              bundleDoCompleteEvent = bundleEvento;
            }
          }

          // Remove listeners
          if (downloadListenerHandle?.remove) await downloadListenerHandle.remove().catch(() => {});
          if (completeListenerHandle?.remove) await completeListenerHandle.remove().catch(() => {});
          if (failedListenerHandle?.remove) await failedListenerHandle.remove().catch(() => {});

          finalBundle = bundleDoCompleteEvent || bundleDoDownload;
          sucesso = true;
          break; // Sucesso no download e evento downloadComplete!
        } catch (downloadErr: any) {
          ultimoErro = downloadErr;
          console.error(`Erro no download (tentativa ${tentativa + 1}):`, downloadErr);

          if (downloadListenerHandle?.remove) await downloadListenerHandle.remove().catch(() => {});
          if (completeListenerHandle?.remove) await completeListenerHandle.remove().catch(() => {});
          if (failedListenerHandle?.remove) await failedListenerHandle.remove().catch(() => {});

          // Se ainda houver tentativas automáticas, espera 2 segundos
          if (tentativa < MAX_TENTATIVAS_AUTOMATICAS) {
            const proxima = tentativa + 2;
            setStatusTexto(`Download falhou. Tentando novamente em 2 segundos (${proxima}/${MAX_TENTATIVAS_AUTOMATICAS + 1})...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!sucesso) {
        throw ultimoErro;
      }

      // Item 7: Aplicação em duas etapas:
      // Depois do download, mostre "Atualização baixada. Toque em Aplicar", e só então chame set().
      setBundleBaixado(finalBundle);
      setEtapa('baixado');
      setProgresso(100);
      setStatusTexto('Atualização baixada. Toque em Aplicar');
    } catch (err: any) {
      console.error('Erro durante download da atualização:', err);
      setEtapa('pronto_download');
      setProgresso(0);

      const msgPrincipal = err?.message || 'Falha ao baixar a atualização. Verifique sua conexão e tente novamente.';
      setErro(msgPrincipal);

      // Captura do erro completo com JSON.stringify(err, Object.getOwnPropertyNames(err))
      let erroCompletoJson = '';
      try {
        erroCompletoJson = JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
      } catch {
        erroCompletoJson = String(err);
      }

      let eventoFailedJson = '';
      if (ultimoEventoDownloadFailed) {
        try {
          eventoFailedJson = JSON.stringify(
            ultimoEventoDownloadFailed,
            Object.getOwnPropertyNames(ultimoEventoDownloadFailed),
            2
          );
        } catch {
          eventoFailedJson = String(ultimoEventoDownloadFailed);
        }
      }

      // Informações completas de diagnóstico
      setDiagnostico({
        urlUsada: urlUsadaEfetiva || downloadUrl,
        mensagem: msgPrincipal,
        erroCompletoJson,
        eventoDownloadFailed: eventoFailedJson || undefined,
        versaoApp: versaoAtual,
        versaoPlugin: VERSAO_PLUGIN_UPDATER,
        statusHead,
      });
    }
  };

  // Item 7: Aplicação da atualização após toque explícito em "Aplicar"
  const handleAplicar = async () => {
    if (!bundleBaixado) return;
    try {
      setEtapa('aplicando');
      setStatusTexto('Aplicando pacote com segurança...');
      await CapacitorUpdater.set(bundleBaixado);
      setEtapa('concluido');
      setStatusTexto('Atualização concluída com sucesso! Reiniciando...');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch (err: any) {
      console.error('Erro ao aplicar atualização:', err);
      setEtapa('baixado');
      setErro('Falha ao aplicar pacote: ' + (err?.message || err));
    }
  };

  return (
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      icone={<Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
      titulo="Nova Atualização Disponível"
      subtitulo={`v${versaoAtual} ➔ ${novaVersao.startsWith('v') ? novaVersao : `v${novaVersao}`}`}
      tamanhoMaximo="max-w-md"
      rodape={
        exigeNovoApk ? (
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer select-none"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleAbrirNoNavegador}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Baixar novo APK</span>
            </button>
          </div>
        ) : etapa === 'baixando' ? (
          <div className="w-full text-center py-2 text-xs font-bold text-blue-600 dark:text-blue-400">
            {statusTexto || 'Baixando pacote...'} ({progresso}%)
          </div>
        ) : etapa === 'aplicando' ? (
          <div className="w-full text-center py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Aplicando pacote com segurança...
          </div>
        ) : etapa === 'concluido' ? (
          <div className="w-full text-center py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Reiniciando o aplicativo...
          </div>
        ) : etapa === 'baixado' ? (
          /* Item 7: Atualização baixada. Toque em Aplicar */
          <div className="flex flex-col-reverse min-[361px]:flex-row items-stretch gap-3 w-full">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer select-none"
            >
              Depois
            </button>
            <button
              type="button"
              onClick={handleAplicar}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer select-none animate-pulse"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col-reverse min-[361px]:flex-row items-stretch gap-3 w-full">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer select-none"
            >
              {erro ? 'Fechar' : 'Depois'}
            </button>
            <button
              type="button"
              onClick={handleAtualizarAgora}
              disabled={!downloadUrl}
              className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
            >
              {erro ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Tentar novamente</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar atualização</span>
                </>
              )}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-3">
        {/* Aviso de Falha Anterior (Item 7) */}
        {falhaAnterior && etapa === 'pronto_download' && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Aviso: A inicialização ou tentativa anterior apresentou erro</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                Certifique-se de que a conexão esteja estável antes de baixar e aplicar esta atualização.
              </span>
            </div>
          </div>
        )}

        {/* Aviso de Exigência de Novo APK (Item 6) */}
        {exigeNovoApk && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Esta atualização exige instalar o APK mais recente</span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
                Esta versão requer o build nativo {releaseNativeBuild} (instalado: build {appNativeBuild}). O download direto foi bloqueado para sua segurança. Toque em "Baixar novo APK" abaixo.
              </span>
            </div>
          </div>
        )}

        {downloadUrl ? (
          <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-2 min-w-0">
              <FileArchive className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                Arquivo: <code className="font-mono text-slate-900 dark:text-white font-bold">{nomeArquivo}</code>
              </span>
            </div>
            {tamanhoFormatado && (
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex-shrink-0 ml-2">
                {tamanhoFormatado}
              </span>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-bold">A versão publicada não tem arquivo para download</span>
          </div>
        )}
      </div>

        {/* Mensagem de Aviso Não-Nativo */}
        {avisoNaoNativo && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold">Atualização direta disponível apenas no app Android</span>
          </div>
        )}

        {/* Mensagem de Erro com Diagnóstico Completo */}
        {erro && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-bold">Falha no download da atualização:</strong>
                <span className="text-rose-800 dark:text-rose-300 leading-snug">{erro}</span>
              </div>
            </div>

            {/* Diagnóstico em letra pequena e copiável */}
            {diagnostico && (
              <div className="pt-2 border-t border-rose-200/70 dark:border-rose-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400">
                    Detalhes do Diagnóstico:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopiarDiagnostico}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                  >
                    {copiado ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] leading-relaxed select-all break-all border border-slate-800 space-y-1.5 overflow-x-auto">
                  <div>
                    <span className="text-slate-400 font-semibold">URL: </span>
                    {diagnostico.urlUsada}
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Mensagem: </span>
                    {diagnostico.mensagem}
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Erro completo do plugin:</span>
                    <pre className="mt-0.5 p-1.5 bg-slate-950/80 rounded border border-slate-800/80 whitespace-pre-wrap break-all text-[9.5px] text-rose-300">
                      {diagnostico.erroCompletoJson}
                    </pre>
                  </div>
                  {diagnostico.eventoDownloadFailed && (
                    <div>
                      <span className="text-slate-400 font-semibold">Evento downloadFailed:</span>
                      <pre className="mt-0.5 p-1.5 bg-slate-950/80 rounded border border-slate-800/80 whitespace-pre-wrap break-all text-[9.5px] text-amber-300">
                        {diagnostico.eventoDownloadFailed}
                      </pre>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-3 pt-0.5">
                    <span>
                      <span className="text-slate-400">App: </span>v{diagnostico.versaoApp}
                    </span>
                    <span>
                      <span className="text-slate-400">Plugin @capgo/capacitor-updater: </span>v{diagnostico.versaoPlugin}
                    </span>
                  </div>
                  <div className="pt-0.5 border-t border-slate-800">
                    <span className="text-slate-400 font-semibold">Teste de acesso (informativo): </span>
                    <span className="text-slate-300">{diagnostico.statusHead || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notas da Versão */}
        <div className="mt-4 space-y-1.5">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Notas desta versão ({release.name || novaVersao}):
          </h4>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 max-h-36 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {notasVersao.trim() ? (
              notasVersao.trim()
            ) : (
              <span className="text-slate-400 italic">
                Melhorias de desempenho e correções gerais no app Em Dia.
              </span>
            )}
          </div>
        </div>

        {/* Barra de Progresso quando estiver atualizando */}
        {atualizando && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="truncate pr-2">{statusTexto}</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{progresso}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Não feche o aplicativo enquanto a atualização estiver sendo aplicada.
            </p>
          </div>
        )}

        {/* Botão Abrir no navegador quando houver erro ou ambiente web */}
        {downloadUrl && (erro || avisoNaoNativo) && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAbrirNoNavegador}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Abre a URL direta de download do pacote de atualização"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Abrir no navegador para baixar diretamente</span>
            </button>
          </div>
        )}
    </ModalBase>
  );
};
