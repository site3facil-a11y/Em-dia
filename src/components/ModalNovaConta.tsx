import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, Calendar } from 'lucide-react';
import { Categoria, TipoConta } from '../types';
import { NovaContaInput } from '../db/repository';
import { formatarMoeda, formatarData, getHojeString } from '../utils/formatters';

interface ModalNovaContaProps {
  aberto: boolean;
  onFechar: () => void;
  categorias: Categoria[];
  onSalvar: (conta: NovaContaInput) => Promise<void>;
}

export const ModalNovaConta: React.FC<ModalNovaContaProps> = ({
  aberto,
  onFechar,
  categorias,
  onSalvar,
}) => {
  const [descricao, setDescricao] = useState('');
  const [valorTotalStr, setValorTotalStr] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState<number>(1);
  const [dataVencimento, setDataVencimento] = useState(getHojeString());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!aberto) return null;

  // Categoria padrão automática para despesas normais: Gastos
  const gastosCat = categorias.find((c) => c.nome === 'Gastos') || categorias[0];
  const categoriaId = gastosCat?.id || 1;

  const valorTotalNum = parseFloat(valorTotalStr.replace(/\./g, '').replace(',', '.')) || 0;
  const isParcelado = numeroParcelas > 1;
  const tipo: TipoConta = isParcelado ? 'parcelada' : 'unica';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      setErro('Informe a descrição da conta.');
      return;
    }
    if (valorTotalNum <= 0) {
      setErro('O valor deve ser maior que zero.');
      return;
    }
    if (!dataVencimento) {
      setErro('Informe a data de vencimento.');
      return;
    }
    if (numeroParcelas < 1) {
      setErro('O número de parcelas deve ser no mínimo 1.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        descricao: descricao.trim(),
        categoria_id: categoriaId,
        valor_total: valorTotalNum,
        tipo,
        forma_pagamento: 'Geral',
        observacoes: undefined,
        data_primeiro_vencimento: dataVencimento,
        numero_parcelas: isParcelado ? numeroParcelas : 1,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao gravar conta no SQLite.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 my-8">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cadastrar Novo Pagamento
              </h3>
              <p className="text-xs text-slate-500">
                Preencha os dados da conta a pagar
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

        {/* Formulário Simples (Sem categoria e sem observação) */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Conta *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Aluguel, Supermercado, Celular..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Valor Total */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Valor Total (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                R$
              </span>
              <input
                type="text"
                required
                placeholder="0,00"
                value={valorTotalStr}
                onChange={(e) => setValorTotalStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Linha: Número de Parcelas e Data de Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Número de Parcelas *
                </label>
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  {numeroParcelas <= 1 ? '1x (Única)' : `${numeroParcelas}x`}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={numeroParcelas}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNumeroParcelas(isNaN(val) ? 1 : Math.max(1, Math.min(120, val)));
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="1"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {numeroParcelas <= 1 ? '1 = Pagamento único' : `${numeroParcelas} parcelas mensais`}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isParcelado ? 'Primeiro Vencimento *' : 'Data de Vencimento *'}
              </label>
              <input
                type="date"
                required
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Data do pagamento
              </span>
            </div>
          </div>

          {/* Resumo Dinâmico do Pagamento */}
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Resumo do Pagamento:</span>
            </div>
            {!isParcelado ? (
              <p>
                Será gerado <strong>1 pagamento único de {formatarMoeda(valorTotalNum)}</strong> com vencimento em{' '}
                <strong>{formatarData(dataVencimento)}</strong>.
              </p>
            ) : (
              <p>
                Serão geradas <strong>{numeroParcelas} parcelas de ~{formatarMoeda(valorTotalNum / numeroParcelas)}</strong>, iniciando em <strong>{formatarData(dataVencimento)}</strong> (total: {formatarMoeda(valorTotalNum)}).
              </p>
            )}
          </div>

          {/* Ações */}
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 hover:from-blue-800 hover:to-indigo-900 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-950/25 disabled:opacity-50 cursor-pointer transition-all"
            >
              {salvando ? 'Gravando...' : 'Criar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
