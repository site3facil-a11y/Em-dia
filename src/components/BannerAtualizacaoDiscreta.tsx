import React from 'react';
import { Sparkles, Download, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { ResultadoChecagemAtualizacao } from '../utils/autoUpdater';

interface BannerAtualizacaoDiscretaProps {
  resultado: ResultadoChecagemAtualizacao;
  onAtualizar: () => void;
  onDepois: () => void;
}

export const BannerAtualizacaoDiscreta: React.FC<BannerAtualizacaoDiscretaProps> = ({
  resultado,
  onAtualizar,
  onDepois,
}) => {
  const { versao, exigeNovoApk, tamanhoFormatado, isDadosMoveis } = resultado;

  return (
    <div
      data-testid="banner-atualizacao-discreta"
      className="mb-3.5 p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/60 to-sky-50 dark:from-slate-800/90 dark:via-blue-950/40 dark:to-slate-800/80 border border-blue-200/80 dark:border-blue-900/50 shadow-xs transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5 sm:mt-0">
            {exigeNovoApk ? (
              <AlertTriangle className="w-4 h-4 text-amber-200" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                Nova versão {versao} disponível
              </span>
              {isDadosMoveis && tamanhoFormatado && (
                <span className="text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-md">
                  📶 Dados móveis: {tamanhoFormatado}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5">
              {exigeNovoApk
                ? 'Nova versão exige instalar o APK mais recente'
                : 'Atualização rápida disponível sem reiniciar o dispositivo.'}
            </p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onDepois}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            title="Lembrar novamente em 24 horas"
          >
            Depois
          </button>

          {!exigeNovoApk && (
            <button
              type="button"
              onClick={onAtualizar}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
