import React, { useState } from 'react';
import { Sparkles, Download, X, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { exportarArquivoSqlite } from '../db/sqlite';

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

interface ModalAtualizacaoProps {
  aberto: boolean;
  onFechar: () => void;
  release: ReleaseInfo | null;
  versaoAtual: string;
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
  const [avisoNaoNativo, setAvisoNaoNativo] = useState(false);

  if (!aberto || !release) return null;

  const novaVersaoLimpa = release.tag_name.replace(/^v/, '');

  const handleAtualizarAgora = async () => {
    setErro(null);
    setAvisoNaoNativo(false);

    // 1. Se Capacitor.isNativePlatform() for falso, mostre mensagem específica
    if (!Capacitor.isNativePlatform()) {
      setAvisoNaoNativo(true);
      return;
    }

    try {
      setAtualizando(true);
      setStatusTexto('Criando backup do banco SQLite...');
      setProgresso(10);

      // 2. Faz backup automático do banco SQLite (exporta o .sqlite)
      try {
        await exportarArquivoSqlite();
      } catch (backupErr) {
        console.warn('Aviso: backup antes da atualização falhou ou foi bloqueado:', backupErr);
      }

      setStatusTexto('Localizando pacote de atualização (dist.zip)...');
      setProgresso(25);

      const assetZip = release.assets?.find(
        (a) => a.name.toLowerCase() === 'dist.zip'
      );

      if (!assetZip || !assetZip.browser_download_url) {
        throw new Error('O pacote de atualização (dist.zip) não foi encontrado neste release do GitHub.');
      }

      setStatusTexto('Baixando nova versão...');
      setProgresso(35);

      // Listener para a barra de progresso do download
      let listenerHandle: any = null;
      try {
        listenerHandle = await CapacitorUpdater.addListener('download', (state: any) => {
          if (typeof state?.percent === 'number') {
            setProgresso(Math.max(35, Math.min(95, Math.round(state.percent))));
          }
        });
      } catch (listenerErr) {
        console.warn('Listener de progresso não suportado neste ambiente:', listenerErr);
      }

      // Baixa o asset dist.zip
      const bundle = await CapacitorUpdater.download({
        url: assetZip.browser_download_url,
        version: release.tag_name,
      });

      if (listenerHandle?.remove) {
        await listenerHandle.remove();
      }

      setProgresso(98);
      setStatusTexto('Aplicando atualização...');

      // Aplica a nova versão
      await CapacitorUpdater.set(bundle);
      setProgresso(100);
      setStatusTexto('Atualização concluída com sucesso!');
    } catch (err: any) {
      console.error('Erro durante atualização pelo GitHub:', err);
      setAtualizando(false);
      setProgresso(0);
      setErro(err?.message || 'Falha ao baixar e aplicar a atualização. Verifique sua conexão e tente novamente.');
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

        {/* Mensagens de Aviso / Erro */}
        {avisoNaoNativo && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold">Atualização disponível apenas no app Android</span>
          </div>
        )}

        {erro && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">Erro na atualização:</strong>
              <span>{erro}</span>
            </div>
          </div>
        )}

        {/* Notas da Versão */}
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Notas desta versão ({release.name || release.tag_name}):
          </h4>
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 max-h-48 overflow-y-auto text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
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
              <span>{statusTexto}</span>
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

        {/* Ações */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          {!atualizando ? (
            <>
              <button
                type="button"
                onClick={onFechar}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Depois
              </button>
              <button
                type="button"
                onClick={handleAtualizarAgora}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Atualizar agora</span>
              </button>
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
