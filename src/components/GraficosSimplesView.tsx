import React from 'react';
import { BarChart3, ChevronLeft, ChevronRight, TrendingUp, ShieldCheck, Wallet, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { DashboardMetrics } from '../types';
import { formatarMoeda, formatarMesAno } from '../utils/formatters';
import { GraficoBarras } from './GraficoBarras';

interface GraficosSimplesViewProps {
  metrics: DashboardMetrics | null;
  mesSelecionado: string;
  setMesSelecionado: (mes: string) => void;
  carregando: boolean;
}

export const GraficosSimplesView: React.FC<GraficosSimplesViewProps> = ({
  metrics,
  mesSelecionado,
  setMesSelecionado,
  carregando,
}) => {
  const navegarMes = (direcao: number) => {
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    const d = new Date(ano, mes - 1 + direcao, 1);
    setMesSelecionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (carregando || !metrics) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs">
        Carregando balanço...
      </div>
    );
  }

  const {
    totalGastosMes,
    totalEconomiasMes,
    reservaAcumuladaTotal,
    evolucaoMensal,
  } = metrics;

  // Cálculos da previsão futura (próximos 2 meses) e histórico (2 meses anteriores)
  const mesesFuturos = evolucaoMensal.filter((m) => m.tipoMes === 'futuro');
  const totalComprometidoFuturo = mesesFuturos.reduce((acc, m) => acc + m.total, 0);

  const mesesPassados = evolucaoMensal.filter((m) => m.tipoMes === 'passado');
  const totalGastoPassado = mesesPassados.reduce((acc, m) => acc + m.pago, 0);

  return (
    <div className="space-y-4 pb-20">
      {/* Seletor de Mês Simples com Setas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <button
          onClick={() => navegarMes(-1)}
          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Mês Anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
            {formatarMesAno(mesSelecionado)}
          </span>
          <span className="text-[10px] text-slate-400 block">
            Mês de Referência
          </span>
        </div>
        <button
          onClick={() => navegarMes(1)}
          className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Próximo Mês"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* CARDS RESUMO DO MÊS: GASTOS E ECONOMIAS (SEM RESÍDUO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gastos do Mês */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. Gastos do Mês
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {formatarMoeda(totalGastosMes)}
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Contas e despesas operacionais do período
          </p>
        </div>

        {/* Economias (Porquinho) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              2. Economias (Porquinho)
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
            {formatarMoeda(totalEconomiasMes)}
          </h4>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-400/80 mt-1">
            Dinheiro planejado para o Porquinho neste mês
          </p>
          {reservaAcumuladaTotal > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
              <span>Total guardado no Porquinho:</span>
              <strong className="font-mono text-emerald-700 dark:text-emerald-300">
                {formatarMoeda(reservaAcumuladaTotal)}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* GRÁFICO DE BARRAS DOS 5 MESES (Substituindo o antigo gráfico de rosca) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-800 dark:text-blue-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Visão Temporal de 5 Meses (Passado • Presente • Futuro)
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Veja quanto foi gasto nos <strong>2 meses anteriores</strong>, acompanhe o <strong>mês atual</strong> e antecipe os <strong>gastos futuros</strong> para os <strong>próximos 2 meses</strong>.
        </p>

        {/* Componente Gráfico dos 5 Meses */}
        <div className="h-72">
          <GraficoBarras
            dados={evolucaoMensal}
            mesAtivo={mesSelecionado}
            onSelecionarMes={(m) => setMesSelecionado(m)}
          />
        </div>

        {/* Resumo Rápido Passado vs Futuro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Total Pago nos 2 Meses Anteriores</span>
              <strong className="font-mono text-sm text-slate-900 dark:text-white">
                {formatarMoeda(totalGastoPassado)}
              </strong>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center flex-shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Gastos Futuros (Próximos 2 Meses)</span>
              <strong className="font-mono text-sm text-indigo-700 dark:text-indigo-300">
                {formatarMoeda(totalComprometidoFuturo)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
