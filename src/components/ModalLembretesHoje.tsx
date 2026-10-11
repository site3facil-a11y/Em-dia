import React from 'react';
import { Bell, AlertCircle, Check, X, Calendar } from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda, formatarData, getHojeString } from '../utils/formatters';

interface ModalLembretesHojeProps {
  aberto: boolean;
  onFechar: () => void;
  parcelasLembrete: Parcela[];
  onPagarParcela: (parcela: Parcela) => void;
}

export const ModalLembretesHoje: React.FC<ModalLembretesHojeProps> = ({
  aberto,
  onFechar,
  parcelasLembrete,
  onPagarParcela,
}) => {
  if (!aberto || parcelasLembrete.length === 0) return null;

  const hoje = getHojeString();
  const vencendoHoje = parcelasLembrete.filter((p) => p.data_vencimento === hoje);
  const atrasadas = parcelasLembrete.filter((p) => p.data_vencimento < hoje);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative max-h-[85vh] flex flex-col">
        {/* Botão Fechar */}
        <button
          onClick={onFechar}
          className="absolute top-5 right-5 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          aria-label="Fechar lembretes"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 flex-shrink-0">
            <Bell className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Lembretes do Em Dia
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
              Lembrete exibido dentro do aplicativo (não é uma notificação do sistema).
            </p>
          </div>
        </div>

        {/* Lista com Rolagem */}
        <div className="mt-4 space-y-3 overflow-y-auto flex-1 pr-1">
          {vencendoHoje.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
                🔔 Vencem Hoje ({vencendoHoje.length})
              </span>
              {vencendoHoje.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {p.conta_descricao}
                    </h4>
                    <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 block mt-0.5">
                      {formatarMoeda(p.valor)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      onPagarParcela(p);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Quitar</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {atrasadas.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                ⚠️ Contas Atrasadas ({atrasadas.length})
              </span>
              {atrasadas.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {p.conta_descricao}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatarMoeda(p.valor)}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        • Venceu em {formatarData(p.data_vencimento)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onPagarParcela(p);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Quitar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onFechar}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
