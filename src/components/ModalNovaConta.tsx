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
  const [tipo, setTipo] = useState<TipoConta>('unica');
  const [numeroParcelas, setNumeroParcelas] = useState<number>(2);
  const [dataVencimento, setDataVencimento] = useState(getHojeString());
  const [formaPagamento, setFormaPagamento] = useState('Geral');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!aberto) return null;

  // Busca a categoria 'Gastos' (todas as contas normais são gastos; apenas o porquinho é economia)
  const catGastos =
    categorias.find((c) => c.nome.toLowerCase() === 'gastos') ||
    categorias.find((c) => !c.nome.toLowerCase().includes('economia') && !c.nome.toLowerCase().includes('reserva')) ||
    categorias[0];
  const categoriaFinalId = catGastos?.id || 1;
  const valorTotalNum = parseFloat(valorTotalStr.replace(/\./g, '').replace(',', '.')) || 0;

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
    if (tipo === 'parcelada' && numeroParcelas < 2) {
      setErro('Para contas parceladas, informe no mínimo 2 parcelas.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        descricao: descricao.trim(),
        categoria_id: categoriaFinalId,
        valor_total: valorTotalNum,
        tipo,
        forma_pagamento: formaPagamento.trim() || 'Geral',
        observacoes: observacoes.trim() || undefined,
        data_primeiro_vencimento: dataVencimento,
        numero_parcelas: tipo === 'parcelada' ? numeroParcelas : (tipo === 'recorrente' ? 12 : 1),
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Tipo de Pagamento: Única, Parcelada, Recorrente */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tipo de Pagamento *
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTipo('unica')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  tipo === 'unica'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Única (1x)
              </button>
              <button
                type="button"
                onClick={() => setTipo('parcelada')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  tipo === 'parcelada'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Parcelada
              </button>
              <button
                type="button"
                onClick={() => setTipo('recorrente')}
                className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  tipo === 'recorrente'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Recorrente
              </button>
            </div>
          </div>

          {/* Linha: Número de Parcelas (se parcelada) e Data de Vencimento */}
          <div className={`grid ${tipo === 'parcelada' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3`}>
            {tipo === 'parcelada' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Número de Parcelas *
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {numeroParcelas}x
                  </span>
                </div>
                <input
                  type="number"
                  min="2"
                  max="120"
                  required
                  value={numeroParcelas}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setNumeroParcelas(isNaN(val) ? 2 : Math.max(2, Math.min(120, val)));
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="12"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Ex: 12 parcelas mensais de {formatarMoeda(valorTotalNum > 0 ? valorTotalNum / Math.max(1, numeroParcelas) : 0)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {tipo === 'parcelada' ? 'Primeiro Vencimento *' : 'Data de Vencimento *'}
              </label>
              <input
                type="date"
                required
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {tipo === 'recorrente' ? 'Dia do vencimento a cada mês' : 'Data do pagamento'}
              </span>
            </div>
          </div>

          {/* Forma de Pagamento e Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Forma de Pagamento
              </label>
              <input
                type="text"
                placeholder="Ex: Geral, Cartão, Dinheiro..."
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Observações (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Código de barras, notas..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Resumo Dinâmico do Pagamento */}
          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Resumo do Pagamento:</span>
            </div>
            {tipo === 'unica' && (
              <p>
                Será gerado <strong>1 pagamento único de {formatarMoeda(valorTotalNum)}</strong> com vencimento em{' '}
                <strong>{formatarData(dataVencimento)}</strong>.
              </p>
            )}
            {tipo === 'parcelada' && (
              <p>
                Serão geradas <strong>{numeroParcelas} parcelas de ~{formatarMoeda(valorTotalNum / Math.max(1, numeroParcelas))}</strong>, iniciando em <strong>{formatarData(dataVencimento)}</strong> (total: {formatarMoeda(valorTotalNum)}).
              </p>
            )}
            {tipo === 'recorrente' && (
              <p>
                Serão gerados <strong>12 pagamentos mensais de {formatarMoeda(valorTotalNum)}</strong> (conta fixa/assinatura), iniciando em <strong>{formatarData(dataVencimento)}</strong>.
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
