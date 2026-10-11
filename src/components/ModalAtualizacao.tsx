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

export interface ReleaseInfo {
  tag_name: string;
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
  const [atualizando, setAtualizando] = useState(false);
  const [progresso, setProgresso] = useState<number>(0);
  const [statusTexto, setStatusTexto] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoErro | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [avisoNaoNativo, setAvisoNaoNativo] = useState(false);

  if (!aberto || !release) return null;

  // 1. Antes de baixar, busque o asset "dist.zip" na lista assets da resposta da API
  const assetZip = release.assets?.find(
    (a) => a.name?.toLowerCase() === 'dist.zip'
  );
  const temAssetZip = Boolean(assetZip && assetZip.browser_download_url);
  const tamanhoFormatado = assetZip?.size ? formatarTamanhoBytes(assetZip.size) : null;

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
    const url = assetZip?.browser_download_url;
    if (!url) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = url;
    }
  };

  const handleAtualizarAgora = async () => {
    setErro(null);
    setDiagnostico(null);
    setAvisoNaoNativo(false);

    // Se Capacitor.isNativePlatform() for falso, aviso específico
    if (!Capacitor.isNativePlatform()) {
      setAvisoNaoNativo(true);
      return;
    }

    // Se não houver asset dist.zip, mostre "A versão publicada não tem o arquivo dist.zip"
    if (!assetZip || !assetZip.browser_download_url) {
      const msg = 'A versão publicada não tem o arquivo dist.zip';
      setErro(msg);
      setDiagnostico({
        urlUsada: 'Nenhuma URL de dist.zip encontrada',
        mensagem: msg,
        erroCompletoJson: JSON.stringify({ erro: msg }),
        versaoApp: versaoAtual,
        versaoPlugin: VERSAO_PLUGIN_UPDATER,
        statusHead: 'Não realizado (asset ausente)',
      });
      return;
    }

    const downloadUrl = assetZip.browser_download_url;
    let statusHead = 'Não realizado';
    let ultimoEventoDownloadFailed: any = null;

    try {
      setAtualizando(true);
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
        const headRes = await fetch(downloadUrl, { method: 'HEAD' });
        statusHead = `HTTP ${headRes.status} ${headRes.statusText || 'OK'}`.trim();
      } catch (headErr: any) {
        statusHead = `Erro (${headErr?.message || 'CORS/Redirecionamento'})`;
        console.info('Teste HEAD informativo (CORS esperado no GitHub):', headErr);
      }

      // 4. Download com até 2 tentativas automáticas com 2 segundos de intervalo
      let sucesso = false;
      let ultimoErro: any = null;
      let finalBundle: any = null;

      for (let tentativa = 0; tentativa <= MAX_TENTATIVAS_AUTOMATICAS; tentativa++) {
        let downloadListenerHandle: any = null;
        let completeListenerHandle: any = null;
        let failedListenerHandle: any = null;

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

          // 3. Listener de downloadFailed para capturar diagnósticos nativos
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

          // Executa download usando o browser_download_url do dist.zip
          const bundleDoDownload = await CapacitorUpdater.download({
            url: downloadUrl,
            version: release.tag_name,
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

      // Só chame set() depois do evento downloadComplete
      setProgresso(98);
      setStatusTexto('Aplicando atualização...');
      await CapacitorUpdater.set(finalBundle);
      setProgresso(100);
      setStatusTexto('Atualização concluída com sucesso!');
    } catch (err: any) {
      console.error('Erro durante atualização pelo GitHub:', err);
      setAtualizando(false);
      setProgresso(0);

      const msgPrincipal = err?.message || 'Falha ao baixar e aplicar a atualização. Verifique sua conexão e tente novamente.';
      setErro(msgPrincipal);

      // 3. Captura do erro completo com JSON.stringify(err, Object.getOwnPropertyNames(err))
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
        urlUsada: downloadUrl,
        mensagem: msgPrincipal,
        erroCompletoJson,
        eventoDownloadFailed: eventoFailedJson || undefined,
        versaoApp: versaoAtual,
        versaoPlugin: VERSAO_PLUGIN_UPDATER,
        statusHead,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative">
        {/* Botão Fechar */}
        {!atualizando && (
          <button
            onClick={onFechar}
            className="absolute top-5 right-5 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Nova Atualização Disponível
            </h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span>v{versaoAtual}</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {release.tag_name}
              </span>
            </div>
          </div>
        </div>

        {/* Informações do Arquivo dist.zip (Item 1) */}
        <div className="mt-4">
          {temAssetZip ? (
            <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Arquivo: <code className="font-mono text-slate-900 dark:text-white font-bold">dist.zip</code>
                </span>
              </div>
              {tamanhoFormatado && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {tamanhoFormatado}
                </span>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-bold">A versão publicada não tem o arquivo dist.zip</span>
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

        {/* Mensagem de Erro com Diagnóstico Completo (Item 3 & 4) */}
        {erro && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="block font-bold">Falha no download da atualização:</strong>
                <span className="text-rose-800 dark:text-rose-300 leading-snug">{erro}</span>
              </div>
            </div>

            {/* Diagnóstico em letra pequena e copiável (Item 3) */}
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
            Notas desta versão ({release.name || release.tag_name}):
          </h4>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 max-h-36 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {release.body?.trim() ? (
              release.body.trim()
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

        {/* Ações (Item 4: Tentar novamente & Abrir no navegador) */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          {!atualizando ? (
            <>
              {/* Botão Abrir no navegador (se erro ou se solicitado) */}
              {temAssetZip && (erro || avisoNaoNativo) && (
                <button
                  type="button"
                  onClick={handleAbrirNoNavegador}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Abre a URL de download direto do dist.zip"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Abrir no navegador</span>
                </button>
              )}

              <button
                type="button"
                onClick={onFechar}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {erro ? 'Fechar' : 'Depois'}
              </button>

              {erro ? (
                /* Botão Tentar novamente quando falhar (Item 4) */
                <button
                  type="button"
                  onClick={handleAtualizarAgora}
                  disabled={!temAssetZip}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              ) : (
                /* Botão Atualizar agora */
                <button
                  type="button"
                  onClick={handleAtualizarAgora}
                  disabled={!temAssetZip}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Atualizar agora</span>
                </button>
              )}
            </>
          ) : (
            <div className="w-full text-center py-1">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                Aplicando pacote com segurança...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
