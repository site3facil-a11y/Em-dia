import React from 'react';
import { Bell, AlertCircle, Check, Calendar } from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda, formatarData, getHojeString } from '../utils/formatters';
import { ModalBase } from './ModalBase';

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
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      icone={<Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
      titulo="Lembretes do Em Dia"
      subtitulo="Resumo complementar de contas vencendo hoje ou atrasadas"
      tamanhoMaximo="max-w-md"
      rodape={
        <button
          type="button"
          onClick={onFechar}
          className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 font-bold text-xs hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer select-none"
        >
          Entendi
        </button>
      }
    >

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

    </ModalBase>
  );
};
