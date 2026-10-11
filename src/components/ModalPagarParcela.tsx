import React, { useState } from 'react';
import { X, Check, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda, formatarData, getHojeString, dispararConfetes } from '../utils/formatters';
import { centavosParaReais, reaisParaCentavos } from '../utils/finance';

interface ModalPagarParcelaProps {
  parcela: Parcela | null;
  onFechar: () => void;
  onConfirmar: (parcelaId: number, dataPagamento: string, valorPago: number) => Promise<void>;
}

export const ModalPagarParcela: React.FC<ModalPagarParcelaProps> = ({
  parcela,
  onFechar,
  onConfirmar,
}) => {
  if (!parcela) return null;

  const valorPrevistoReais = centavosParaReais(parcela.valor);
  const [dataPagamento, setDataPagamento] = useState(getHojeString());
  const [valorPagoStr, setValorPagoStr] = useState(valorPrevistoReais.toFixed(2).replace('.', ','));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorPagoNum = parseFloat(valorPagoStr.replace(/\./g, '').replace(',', '.')) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (valorPagoNum <= 0) {
      setErro('Informe um valor de pagamento válido.');
      return;
    }
    if (!dataPagamento) {
      setErro('Informe a data de pagamento.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onConfirmar(parcela.id, dataPagamento, reaisParaCentavos(valorPagoNum));
      dispararConfetes();
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao registrar pagamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirmar Pagamento
              </h3>
              <p className="text-xs text-slate-500">
                Registrar quitação desta conta no SQLite
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo da Parcela */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {parcela.conta_descricao}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">
                  {parcela.categoria_nome}
                </span>
                {parcela.total_parcelas > 1 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                    Parcela {parcela.numero_parcela}/{parcela.total_parcelas}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Vencimento</span>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                {formatarData(parcela.data_vencimento)}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-500">Valor Original:</span>
            <span className="font-mono font-extrabold text-slate-900 dark:text-white text-sm">
              {formatarMoeda(parcela.valor)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Data do Pagamento *
            </label>
            <input
              type="date"
              required
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Valor Efetivamente Pago (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={valorPagoStr}
                onChange={(e) => setValorPagoStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            
            {/* Indicador de Desconto ou Juros em tempo real */}
            {valorPagoNum > 0 && (
              <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                Number((valorPrevistoReais - valorPagoNum).toFixed(2)) > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : Number((valorPrevistoReais - valorPagoNum).toFixed(2)) < 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                <span>
                  {Number((valorPrevistoReais - valorPagoNum).toFixed(2)) > 0 ? (
                    <strong>✨ Desconto obtido:</strong>
                  ) : Number((valorPrevistoReais - valorPagoNum).toFixed(2)) < 0 ? (
                    <strong>⚠️ Juros / Acréscimo:</strong>
                  ) : (
                    <span>Valor exato previsto:</span>
                  )}
                </span>
                <strong className="font-mono text-sm">
                  {Number((valorPrevistoReais - valorPagoNum).toFixed(2)) > 0
                    ? `-${formatarMoeda(valorPrevistoReais - valorPagoNum)}`
                    : Number((valorPrevistoReais - valorPagoNum).toFixed(2)) < 0
                    ? `+${formatarMoeda(valorPagoNum - valorPrevistoReais)}`
                    : formatarMoeda(valorPrevistoReais)}
                </strong>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{salvando ? 'Registrando...' : 'Confirmar e Quitar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
