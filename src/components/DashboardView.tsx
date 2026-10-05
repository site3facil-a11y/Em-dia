import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ArrowRight,
  TrendingUp,
  PieChart,
  BarChart3,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { DashboardMetrics, Parcela } from '../types';
import { formatarMoeda, formatarData, formatarMesAno, getStatusInfo } from '../utils/formatters';
import { GraficoCategorias } from './GraficoCategorias';
import { GraficoBarras } from './GraficoBarras';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  mesSelecionado: string;
  onSelecionarMes: (mesAno: string) => void;
  onPagarParcela: (parcela: Parcela) => void;
  onVerTodasContas: () => void;
  onVerParcelamentos: () => void;
  carregando: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  mesSelecionado,
  onSelecionarMes,
  onPagarParcela,
  onVerTodasContas,
  onVerParcelamentos,
  carregando,
}) => {
  if (carregando || !metrics) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-500">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">Carregando dados financeiros do SQLite...</p>
      </div>
    );
  }

  const {
    totalPagoMes,
    totalAPagarMes,
    totalAtrasado,
    totalVencendo7Dias,
    qtdVencendoHoje,
    qtdAtrasadas,
    gastosPorCategoria,
    evolucaoMensal,
    proximosVencimentos,
  } = metrics;

  return (
    <div className="space-y-6">
      {/* Alertas Urgentes */}
      {(qtdAtrasadas > 0 || qtdVencendoHoje > 0) && (
        <div className="space-y-2">
          {qtdAtrasadas > 0 && (
            <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    {qtdAtrasadas} conta{qtdAtrasadas > 1 ? 's estão' : ' está'} em atraso!
                  </h4>
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                    Total atrasado acumulado: <strong className="font-mono">{formatarMoeda(totalAtrasado)}</strong>. Evite juros quitando agora.
                  </p>
                </div>
              </div>
              <button
                onClick={onVerTodasContas}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
              >
                <span>Ver Atrasadas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {qtdVencendoHoje > 0 && (
            <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    {qtdVencendoHoje} conta{qtdVencendoHoje > 1 ? 's vencem' : ' vence'} hoje!
                  </h4>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                    Não se esqueça de efetuar o pagamento até o final do expediente bancário.
                  </p>
                </div>
              </div>
              <button
                onClick={onVerTodasContas}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
              >
                <span>Conferir</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pago no Mês */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pago no Mês
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {formatarMoeda(totalPagoMes)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              {formatarMesAno(mesSelecionado)}
            </p>
          </div>
        </div>

        {/* Total a Pagar no Mês */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              A Pagar no Mês
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {formatarMoeda(totalAPagarMes)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
              Pendente para o mês
            </p>
          </div>
        </div>

        {/* Total em Atraso */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-rose-300 dark:hover:border-rose-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total em Atraso
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
              {formatarMoeda(totalAtrasado)}
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {qtdAtrasadas} parcela{qtdAtrasadas !== 1 ? 's' : ''} vencida{qtdAtrasadas !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Próximos 7 Dias */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Próximos 7 Dias
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
              {formatarMoeda(totalVencendo7Dias)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
              Vencendo na semana
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos Interativos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico de Pizza/Donut por Categoria (5 colunas) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Despesas por Categoria
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {formatarMesAno(mesSelecionado)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Distribuição proporcional das contas do mês atual.
            </p>
          </div>

          <GraficoCategorias dados={gastosPorCategoria} />
        </div>

        {/* Gráfico de Barras Mensal: Pago x Pendente (7 colunas) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Comparativo Mensal (Pago x Pendente)
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Visão de 6 meses
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Acompanhe sua taxa de quitação e planejamento financeiro ao longo do tempo.
            </p>
          </div>

          <GraficoBarras
            dados={evolucaoMensal}
            mesAtivo={mesSelecionado}
            onSelecionarMes={onSelecionarMes}
          />
        </div>
      </div>

      {/* Lista Rápida de Próximos Vencimentos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Próximos Vencimentos & Contas Prioritárias</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Contas vencidas e mais próximas de vencer com ação rápida de quitação.
            </p>
          </div>
          <button
            onClick={onVerTodasContas}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <span>Ver todas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {proximosVencimentos.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">
              Tudo em dia!
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Não há contas pendentes ou atrasadas no momento.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {proximosVencimentos.map((p) => {
              const statusInfo = getStatusInfo(p.status);
              return (
                <div
                  key={p.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.categoria_cor || '#3b82f6' }}
                      title={p.categoria_nome}
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          {p.conta_descricao}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {p.categoria_nome}
                        </span>
                        {p.total_parcelas > 1 && (
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                            {p.numero_parcela}/{p.total_parcelas}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Vencimento: <strong className="text-slate-700 dark:text-slate-300">{formatarData(p.data_vencimento)}</strong></span>
                        <span>•</span>
                        <span>{p.forma_pagamento}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pl-6 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono block">
                        {formatarMoeda(p.valor)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                    </div>

                    <button
                      onClick={() => onPagarParcela(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors"
                      title="Marcar esta parcela como paga"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>OK Pago</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Banner de Acesso aos Parcelamentos */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-2xl p-5 sm:p-6 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-base sm:text-lg font-extrabold">
            Acompanhe o progresso de compras parceladas
          </h4>
          <p className="text-xs sm:text-sm text-blue-100 mt-1">
            Veja quantas parcelas já foram quitadas, quanto ainda falta amortizar e o saldo restante de cada financiamento.
          </p>
        </div>
        <button
          onClick={onVerParcelamentos}
          className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm shadow-sm transition-all hover:scale-105"
        >
          Ver Parcelamentos
        </button>
      </div>
    </div>
  );
};
