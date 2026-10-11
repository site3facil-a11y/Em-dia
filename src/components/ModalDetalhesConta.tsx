import React, { useState, useEffect } from 'react';
import { X, Layers, Check, RotateCcw, Calendar, CreditCard, Tag, Bell } from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda, formatarData, getStatusInfo } from '../utils/formatters';
import { BarraProgressoVencimento } from './BarraProgressoVencimento';
import {
  temLembrete,
  alternarLembrete,
} from '../utils/lembretes';

interface ModalDetalhesContaProps {
  aberto: boolean;
  onFechar: () => void;
  parcelas: Parcela[];
  onPagarParcela: (parcela: Parcela) => void;
  onDesfazerPagamento: (parcelaId: number) => void;
}

export const ModalDetalhesConta: React.FC<ModalDetalhesContaProps> = ({
  aberto,
  onFechar,
  parcelas,
  onPagarParcela,
  onDesfazerPagamento,
}) => {
  if (!aberto || parcelas.length === 0) return null;

  const primeira = parcelas[0];
  const [lembreteAtivo, setLembreteAtivo] = useState(() => temLembrete(primeira.conta_id));

  useEffect(() => {
    setLembreteAtivo(temLembrete(primeira.conta_id));
  }, [primeira.conta_id]);

  const handleToggleLembrete = () => {
    const novo = alternarLembrete(primeira.conta_id);
    setLembreteAtivo(novo);
  };

  const totalConta = parcelas.reduce((acc, p) => acc + p.valor, 0);
  const totalPago = parcelas
    .filter((p) => p.status === 'pago')
    .reduce((acc, p) => acc + (p.valor_pago || p.valor), 0);
  const saldoRestante = Math.max(0, totalConta - totalPago);
  const parcelasPagas = parcelas.filter((p) => p.status === 'pago').length;
  const pct = (parcelasPagas / parcelas.length) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8 max-h-[90vh] flex flex-col">
        {/* Topo */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: primeira.categoria_cor || '#3b82f6' }}
            />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {primeira.conta_descricao}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{primeira.categoria_nome}</span>
                <span>•</span>
                <span>{primeira.total_parcelas > 1 ? `${primeira.total_parcelas} parcelas` : 'Pagamento único'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLembrete}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                lembreteAtivo
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-amber-600'
              }`}
              title="Alternar lembrete no dia do vencimento"
            >
              <Bell className={`w-3.5 h-3.5 ${lembreteAtivo ? 'fill-amber-500 stroke-amber-500' : ''}`} />
              <span>{lembreteAtivo ? 'Lembrete Ativo' : 'Ativar Lembrete'}</span>
            </button>

            <button
              onClick={onFechar}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Resumo Financeiro da Conta */}
        <div className="py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400 block font-medium">Valor Total</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                {formatarMoeda(totalConta)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">Total Pago</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatarMoeda(totalPago)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-medium">Saldo Restante</span>
              <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {formatarMoeda(saldoRestante)}
              </span>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>{parcelasPagas} de {parcelas.length} parcelas quitadas</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lista de Parcelas Scrollável */}
        <div className="overflow-y-auto flex-1 py-3 space-y-2 pr-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Todas as Parcelas
          </h4>

          {parcelas.map((p, idx) => {
            const statusInfo = getStatusInfo(p.status);
            const isPago = p.status === 'pago';

            return (
              <div
                key={p.id}
                className="flex flex-col p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {p.numero_parcela}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          Venc: {formatarData(p.data_vencimento)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.badge}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      {p.data_pagamento && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          Pago em {formatarData(p.data_pagamento)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white block">
                        {formatarMoeda(p.valor)}
                      </span>
                      {isPago && p.valor_pago && p.valor_pago !== p.valor && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          (Pago: {formatarMoeda(p.valor_pago)})
                        </span>
                      )}
                    </div>

                    {isPago ? (
                      <button
                        onClick={() => onDesfazerPagamento(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 cursor-pointer"
                        title="Desfazer pagamento"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onPagarParcela(p)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>OK Pago</span>
                      </button>
                    )}
                  </div>
                </div>

                <BarraProgressoVencimento
                  parcela={p}
                  vencimentoAnterior={idx > 0 ? parcelas[idx - 1].data_vencimento : null}
                />
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end flex-shrink-0">
          <button
            onClick={onFechar}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
