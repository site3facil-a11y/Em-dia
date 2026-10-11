import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, Calendar, Layers, Repeat, Bell } from 'lucide-react';
import { Categoria, TipoConta } from '../types';
import { NovaContaInput } from '../db/repository';
import { formatarMoeda, formatarData, getHojeString } from '../utils/formatters';
import { definirLembrete, solicitarPermissaoNotificacao, verificarPermissaoNotificacao } from '../utils/lembretes';

interface ModalNovaContaProps {
  aberto: boolean;
  onFechar: () => void;
  categorias: Categoria[];
  onSalvar: (conta: NovaContaInput) => Promise<number | void>;
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
  const [numeroParcelas, setNumeroParcelas] = useState<number | string>(2);
  const [frequencia, setFrequencia] = useState<'mensal' | 'anual' | 'semanal' | 'quinzenal'>('mensal');
  const [dataVencimento, setDataVencimento] = useState(getHojeString());
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
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
  const parcelasNum = Math.max(1, Math.min(120, parseInt(String(numeroParcelas), 10) || 1));

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
    if (tipo === 'parcelada' && parcelasNum < 1) {
      setErro('Informe pelo menos 1 parcela.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      const novoId = await onSalvar({
        descricao: descricao.trim(),
        categoria_id: categoriaFinalId,
        valor_total: valorTotalNum,
        tipo,
        forma_pagamento: 'Geral',
        observacoes: observacoes.trim() || undefined,
        data_primeiro_vencimento: dataVencimento,
        numero_parcelas: tipo === 'parcelada' ? parcelasNum : (tipo === 'recorrente' ? (frequencia === 'anual' ? 5 : 12) : 1),
        frequencia_recorrencia: tipo === 'recorrente' ? frequencia : undefined,
      });

      if (typeof novoId === 'number' && novoId > 0 && lembreteAtivo) {
        definirLembrete(novoId, true);
      }

      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao gravar conta no SQLite.');
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

        {/* Formulário Direto e Limpo */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {erro && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Seletor Claro de Tipo de Pagamento */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tipo de Conta *
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTipo('unica')}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  tipo === 'unica'
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Única</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo('parcelada')}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  tipo === 'parcelada'
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Parcelada</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo('recorrente')}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  tipo === 'recorrente'
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <Repeat className="w-4 h-4" />
                <span>Recorrente</span>
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Conta *
            </label>
            <input
              type="text"
              required
              placeholder={
                tipo === 'recorrente'
                  ? 'Ex: Luz, Internet, Netflix, Aluguel...'
                  : tipo === 'parcelada'
                  ? 'Ex: Celular 12x, Sofá, Geladeira...'
                  : 'Ex: Supermercado, Farmácia, Combustível...'
              }
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Linha: Valor Total e Data de Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Valor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {tipo === 'parcelada'
                  ? 'Valor Total da Compra (R$) *'
                  : tipo === 'recorrente'
                  ? 'Valor Mensal da Conta (R$) *'
                  : 'Valor a Pagar (R$) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0,00"
                  value={valorTotalStr}
                  onChange={(e) => setValorTotalStr(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Data de Vencimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {tipo === 'parcelada' || tipo === 'recorrente'
                  ? 'Primeiro Vencimento *'
                  : 'Data de Vencimento *'}
              </label>
              <input
                type="date"
                required
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>
          </div>

          {/* Painel Expansível: Opções de Parcelamento */}
          {tipo === 'parcelada' && (
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-blue-950 dark:text-blue-200">
                  Número de Parcelas *
                </label>
                <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                  {parcelasNum}x de {formatarMoeda(valorTotalNum > 0 ? valorTotalNum / parcelasNum : 0)}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={numeroParcelas}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setNumeroParcelas('');
                    return;
                  }
                  const num = parseInt(val, 10);
                  if (!isNaN(num)) {
                    setNumeroParcelas(Math.min(120, Math.max(1, num)));
                  }
                }}
                onBlur={() => {
                  if (numeroParcelas === '' || Number(numeroParcelas) < 1) {
                    setNumeroParcelas(1);
                  }
                }}
                className="w-full bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="2"
              />
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300">
                Serão criadas <strong>todas as {parcelasNum} parcelas de uma vez</strong> a partir de {formatarData(dataVencimento)}, aparecendo em cada mês correspondente.
              </p>
            </div>
          )}

          {/* Painel Informativo de Recorrência (Fixa Mensal) */}
          {tipo === 'recorrente' && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                <Repeat className="w-4 h-4 text-indigo-600" />
                <span>Conta Fixa Mensal (12 Meses Previstos)</span>
              </div>
              <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300 leading-relaxed">
                São gerados os próximos <strong>12 meses como previstos</strong> ({formatarMoeda(valorTotalNum)}/mês no dia {dataVencimento.slice(8)}). Ao dar baixa a cada mês, o app repõe automaticamente para <strong>sempre manter 12 meses à frente</strong> no calendário.
              </p>
            </div>
          )}

          {/* Observações (Opcional - largura total) */}
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

          {/* Opção de Lembrete Individual (Sininho 🔔) */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  lembreteAtivo
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                }`}
              >
                <Bell className={`w-4 h-4 ${lembreteAtivo ? 'fill-white' : ''}`} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Lembrete no aplicativo (Sininho 🔔)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lembreteAtivo
                    ? '🔔 Lembrete interno ativado ao abrir o app.'
                    : 'Exibido dentro do app na abertura se vencer hoje ou atrasar (não é notificação do sistema).'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLembreteAtivo(!lembreteAtivo)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex items-center p-0.5 ${
                lembreteAtivo ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={lembreteAtivo}
              aria-label="Ativar lembrete para esta conta"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  lembreteAtivo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
