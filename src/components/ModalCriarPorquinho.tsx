import React, { useState } from 'react';
import { X, PiggyBank, Calendar, AlertCircle, Sparkles } from 'lucide-react';
import { Categoria } from '../types';
import { NovaContaInput } from '../db/repository';
import { formatarMoeda, formatarData, getHojeString } from '../utils/formatters';

interface ModalCriarPorquinhoProps {
  aberto: boolean;
  onFechar: () => void;
  categorias: Categoria[];
  onSalvar: (conta: NovaContaInput) => Promise<number | void>;
}

export const ModalCriarPorquinho: React.FC<ModalCriarPorquinhoProps> = ({
  aberto,
  onFechar,
  categorias,
  onSalvar,
}) => {
  const [nomeMeta, setNomeMeta] = useState('');
  const [valorTotalStr, setValorTotalStr] = useState('');
  const [numeroMeses, setNumeroMeses] = useState<number>(12);
  const [dataPrimeiroDeposito, setDataPrimeiroDeposito] = useState(getHojeString());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!aberto) return null;

  // Busca a categoria 'Economias'
  const economiasCat =
    categorias.find((c) => c.nome === 'Economias') ||
    categorias.find((c) => c.nome.toLowerCase().includes('econ') || c.nome.toLowerCase().includes('poup')) ||
    categorias[0];
  const categoriaId = economiasCat?.id || 2;

  const valorTotalNum = parseFloat(valorTotalStr.replace(/\./g, '').replace(',', '.')) || 0;
  const meses = Math.max(1, Math.min(120, numeroMeses));
  const valorMensal = valorTotalNum > 0 ? valorTotalNum / meses : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeMeta.trim()) {
      setErro('Informe o nome do seu porquinho ou meta.');
      return;
    }
    if (valorTotalNum <= 0) {
      setErro('Informe o valor total que deseja economizar.');
      return;
    }
    if (!dataPrimeiroDeposito) {
      setErro('Informe a data do primeiro depósito.');
      return;
    }
    if (meses < 1) {
      setErro('O prazo deve ser de no mínimo 1 mês.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        descricao: nomeMeta.trim(),
        categoria_id: categoriaId,
        valor_total: valorTotalNum,
        tipo: 'parcelada',
        forma_pagamento: 'Geral',
        observacoes: 'Porquinho de Economia parcelada',
        data_primeiro_vencimento: dataPrimeiroDeposito,
        numero_parcelas: meses,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao criar o porquinho.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-emerald-200 dark:border-emerald-800/80 shadow-2xl p-6 my-8">
        {/* Topo */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-300 dark:border-emerald-800">
              <PiggyBank className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Criar Novo Porquinho</span>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full">
                  Economia
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Poupe um valor fixo todo mês na forma de parcelas
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário do Porquinho */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Nome da Meta / Porquinho */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome do Porquinho / Meta *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Poupança 2026, Reserva de Emergência, Férias..."
              value={nomeMeta}
              onChange={(e) => setNomeMeta(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Valor Total a Guardar */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Meta Total a Juntar (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                R$
              </span>
              <input
                type="text"
                required
                placeholder="1.200,00"
                value={valorTotalStr}
                onChange={(e) => setValorTotalStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Prazo em Meses e Primeiro Depósito */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Prazo (Meses) *
                </label>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {meses} parcelas
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={numeroMeses}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumeroMeses(isNaN(val) ? 1 : Math.max(1, Math.min(120, val)));
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                placeholder="12"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Ex: 12 meses = 1 ano
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primeiro Depósito *
              </label>
              <input
                type="date"
                required
                value={dataPrimeiroDeposito}
                onChange={(e) => setDataPrimeiroDeposito(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Dia do depósito mensal
              </span>
            </div>
          </div>

          {/* Card Resumo do Porquinho */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Simulação da sua Economia:</span>
            </div>
            {valorTotalNum > 0 ? (
              <p className="leading-relaxed">
                Você guardará <strong>{meses} parcelas mensais de {formatarMoeda(valorMensal)}</strong> todo mês, iniciando em <strong>{formatarData(dataPrimeiroDeposito)}</strong> até atingir sua meta de <strong>{formatarMoeda(valorTotalNum)}</strong>!
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Digite a meta total acima para calcular o valor mensal a ser guardado.
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-emerald-950/20 disabled:opacity-50 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <PiggyBank className="w-4 h-4" />
              <span>{salvando ? 'Criando Porquinho...' : 'Criar Porquinho 🐷'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
