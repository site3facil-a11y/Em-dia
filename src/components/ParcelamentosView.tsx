import React, { useState } from 'react';
import {
  Layers,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
} from 'lucide-react';
import { ParcelamentoItem, Parcela } from '../types';
import { formatarMoeda, formatarData } from '../utils/formatters';

interface ParcelamentosViewProps {
  itens: ParcelamentoItem[];
  onPagarParcela: (parcela: Parcela) => void;
  onDesfazerPagamento: (parcelaId: number) => void;
  onNovaConta: () => void;
  carregando: boolean;
}

export const ParcelamentosView: React.FC<ParcelamentosViewProps> = ({
  itens,
  onPagarParcela,
  onDesfazerPagamento,
  onNovaConta,
  carregando,
}) => {
  const [expandidoId, setExpandidoId] = useState<number | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_andamento' | 'concluido'>('todos');

  // Métricas consolidadas dos parcelamentos
  const totalParcelado = itens.reduce((acc, i) => acc + i.valor_total, 0);
  const totalAmortizado = itens.reduce((acc, i) => acc + i.valor_pago, 0);
  const saldoDevedorGeral = itens.reduce((acc, i) => acc + i.saldo_restante, 0);

  const toggleExpandir = (contaId: number) => {
    setExpandidoId((atual) => (atual === contaId ? null : contaId));
  };

  const itensFiltrados = itens.filter((i) => {
    if (filtroStatus === 'em_andamento') return i.saldo_restante > 0;
    if (filtroStatus === 'concluido') return i.saldo_restante <= 0;
    return true;
  });

  if (carregando) {
    return (
      <div className="py-20 text-center text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs font-semibold">Carregando parcelamentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo Unificado Compacto (Sem poluição de textos e números transbordando) */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 text-white rounded-3xl p-5 shadow-lg shadow-blue-950/20 border border-blue-800/40 relative overflow-hidden">
        <div className="text-center pb-3 border-b border-white/10">
          <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block">
            Saldo Restante a Pagar
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1">
            {formatarMoeda(saldoDevedorGeral)}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 text-center">
          <div>
            <span className="text-[11px] text-blue-300 block">Total Contratado</span>
            <span className="text-sm font-bold font-mono text-slate-100">
              {formatarMoeda(totalParcelado)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-blue-300 block">
              Já Quitado ({totalParcelado > 0 ? ((totalAmortizado / totalParcelado) * 100).toFixed(0) : 0}%)
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {formatarMoeda(totalAmortizado)}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Simples */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => setFiltroStatus('todos')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
              filtroStatus === 'todos'
                ? 'bg-blue-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Todas ({itens.length})
          </button>
          <button
            onClick={() => setFiltroStatus('em_andamento')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
              filtroStatus === 'em_andamento'
                ? 'bg-blue-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Em Aberto ({itens.filter((i) => i.saldo_restante > 0).length})
          </button>
          <button
            onClick={() => setFiltroStatus('concluido')}
            className={`px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
              filtroStatus === 'concluido'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Quitadas ({itens.filter((i) => i.saldo_restante <= 0).length})
          </button>
        </div>

        <button
          onClick={onNovaConta}
          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 cursor-pointer"
        >
          + Cadastrar
        </button>
      </div>

      {/* Lista de Compras Parceladas (Design Limpo e Direto) */}
      {itensFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Nenhum parcelamento encontrado
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Cadastre compras parceladas para acompanhar aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {itensFiltrados.map((item) => {
            const isExpandido = expandidoId === item.conta_id;
            const isEconomia = item.categoria_nome?.toLowerCase().includes('poupança') || item.categoria_nome?.toLowerCase().includes('economia');
            const pct = item.total_parcelas > 0 ? (item.parcelas_pagas / item.total_parcelas) * 100 : 0;
            const valorParcelaMedia = item.total_parcelas > 0 ? item.valor_total / item.total_parcelas : 0;
            const isQuitado = item.saldo_restante <= 0;

            return (
              <div
                key={item.conta_id}
                className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all space-y-3 shadow-2xs hover:shadow-xs ${
                  isEconomia
                    ? 'border-emerald-200 dark:border-emerald-900/60'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Linha 1: Título da Conta + Saldo Restante / Já Guardado */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.categoria_cor || (isEconomia ? '#059669' : '#2563eb') }}
                      />
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.descricao}
                      </h4>
                      {isEconomia ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-0.5">
                          💰 Poupança
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50">
                          {item.total_parcelas}x
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.categoria_nome} • {isEconomia ? 'Meta de' : '~'}{formatarMoeda(valorParcelaMedia)}/mês
                    </p>
                  </div>

                  {/* Valor Restante / Guardado */}
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] font-semibold block uppercase ${isEconomia ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {isEconomia ? 'Já Guardado' : 'Falta Pagar'}
                    </span>
                    <span className={`text-base font-extrabold font-mono ${
                      isEconomia
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isQuitado
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                    }`}>
                      {formatarMoeda(isEconomia ? item.valor_pago : item.saldo_restante)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {isEconomia ? 'meta de ' : 'de '}{formatarMoeda(item.valor_total)}
                    </span>
                  </div>
                </div>

                {/* Linha 2: Barra de Progresso Fina e Limpa */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>
                      <strong>{item.parcelas_pagas}</strong> de <strong>{item.total_parcelas}</strong> {isEconomia ? 'meses guardados' : 'parcelas pagas'} ({pct.toFixed(0)}%)
                    </span>
                    {item.proximo_vencimento && !isQuitado ? (
                      <span>Próx: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatarData(item.proximo_vencimento)}</strong></span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {isEconomia ? 'Meta Atingida! 🎯' : 'Quitado'}
                      </span>
                    )}
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isQuitado || isEconomia
                          ? 'bg-emerald-500'
                          : 'bg-blue-600 dark:bg-blue-500'
                      }`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Linha 3: Botão Simples para Expandir e Visualizar Parcelas */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => toggleExpandir(item.conta_id)}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>
                      {isExpandido
                        ? 'Ocultar detalhes'
                        : isEconomia
                        ? `Ver depósitos mensais (${item.parcelas_pagas}/${item.total_parcelas})`
                        : `Ver parcelas (${item.parcelas_pagas}/${item.total_parcelas})`}
                    </span>
                    {isExpandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {item.status_geral === 'com_atraso' && !isEconomia && (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/60">
                      Parcela em atraso
                    </span>
                  )}
                </div>

                {/* Lista Expandida de Parcelas */}
                {isExpandido && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 animate-in fade-in duration-150">
                    {item.parcelas.map((p) => {
                      const isPago = p.status === 'pago';
                      return (
                        <div
                          key={p.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                            isPago
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                              : p.status === 'atrasado'
                              ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                              : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 font-mono text-[11px] font-bold flex items-center justify-center text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {p.numero_parcela}
                            </span>
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                                {isEconomia ? 'Depósito:' : 'Vencimento:'} {formatarData(p.data_vencimento)}
                              </span>
                              {isPago && p.data_pagamento && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                                  {isEconomia ? 'Guardado em ' : 'Pago em '}{formatarData(p.data_pagamento)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {formatarMoeda(p.valor)}
                            </span>
                            {isPago ? (
                              <button
                                onClick={() => onDesfazerPagamento(p.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 cursor-pointer"
                                title={isEconomia ? "Desfazer depósito" : "Desfazer pagamento"}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  onPagarParcela({
                                    ...p,
                                    conta_descricao: item.descricao,
                                    categoria_nome: item.categoria_nome,
                                    categoria_cor: item.categoria_cor,
                                  })
                                }
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs cursor-pointer"
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>{isEconomia ? 'Guardar' : 'Pagar'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
