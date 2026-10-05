import React, { useState } from 'react';
import { formatarMoeda } from '../utils/formatters';

export interface MesEvolucao {
  mesAno: string;
  label: string;
  pago: number;
  pendente: number;
  total: number;
  gastos?: number;
  economias?: number;
  tipoMes?: 'passado' | 'atual' | 'futuro';
}

interface GraficoBarrasProps {
  dados: MesEvolucao[];
  mesAtivo?: string;
  onSelecionarMes?: (mesAno: string) => void;
}

export const GraficoBarras: React.FC<GraficoBarrasProps> = ({
  dados,
  mesAtivo,
  onSelecionarMes,
}) => {
  const [tooltipItem, setTooltipItem] = useState<MesEvolucao | null>(null);

  const maiorValor = Math.max(...dados.map((d) => d.total), 100);

  return (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Indicador de Legenda */}
      <div className="flex items-center justify-between text-xs pb-3 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
          <span>Linha do Tempo: 2 Meses Anteriores • Mês Atual • 2 Meses Futuros</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span>Realizado (Pago)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
            <span>Previsão (A pagar)</span>
          </div>
        </div>
      </div>

      {/* Área das Barras dos 5 Meses */}
      <div className="h-52 w-full flex items-end justify-between gap-2 sm:gap-4 pt-4 pb-2">
        {dados.map((item) => {
          const isAtual = item.mesAno === mesAtivo;
          const isPassado = item.tipoMes === 'passado';
          const isFuturo = item.tipoMes === 'futuro';

          const alturaPago = (item.pago / maiorValor) * 100;
          const alturaPendente = (item.pendente / maiorValor) * 100;
          const alturaTotal = ((item.pago + item.pendente) / maiorValor) * 100;

          return (
            <div
              key={item.mesAno}
              onClick={() => onSelecionarMes && onSelecionarMes(item.mesAno)}
              onMouseEnter={() => setTooltipItem(item)}
              onMouseLeave={() => setTooltipItem(null)}
              className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all ${
                isAtual ? 'scale-105' : 'hover:opacity-90'
              }`}
            >
              {/* Badge indicativo no topo da coluna */}
              <div className="mb-1 text-center">
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider block ${
                    isAtual
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isPassado
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      : 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {isAtual ? 'Atual' : isPassado ? 'Passado' : 'Previsão'}
                </span>
              </div>

              {/* Coluna com barras empilhadas ou paralelas */}
              <div className="w-full flex items-end justify-center gap-1 h-full px-1">
                {/* Se for mês futuro (onde tudo ou quase tudo é a pagar) ou mês passado */}
                <div
                  style={{ height: `${Math.max(6, alturaPago)}%` }}
                  className={`w-1/2 max-w-[28px] rounded-t transition-all ${
                    item.pago > 0
                      ? 'bg-emerald-500 dark:bg-emerald-600 group-hover:brightness-110'
                      : 'bg-slate-200/50 dark:bg-slate-800/40'
                  }`}
                  title={`Realizado / Pago: ${formatarMoeda(item.pago)}`}
                />
                <div
                  style={{ height: `${Math.max(6, alturaPendente)}%` }}
                  className={`w-1/2 max-w-[28px] rounded-t transition-all ${
                    item.pendente > 0
                      ? isFuturo
                        ? 'bg-indigo-500 dark:bg-indigo-600 group-hover:brightness-110'
                        : 'bg-amber-500 dark:bg-amber-600 group-hover:brightness-110'
                      : 'bg-slate-200/50 dark:bg-slate-800/40'
                  }`}
                  title={`Previsão a Pagar: ${formatarMoeda(item.pendente)}`}
                />
              </div>

              {/* Rótulo do Mês e Valor Total */}
              <div className="mt-2 text-center w-full">
                <span
                  className={`text-xs block transition-colors ${
                    isAtual
                      ? 'font-extrabold text-blue-700 dark:text-blue-400'
                      : 'font-semibold text-slate-600 dark:text-slate-400 group-hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 block">
                  {formatarMoeda(item.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detalhe do mês ao passar o mouse ou em foco */}
      <div className="pt-2.5 min-h-[40px] flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 mt-2">
        {tooltipItem ? (
          <>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                {tooltipItem.label} ({tooltipItem.tipoMes === 'futuro' ? 'Previsão Futura' : tooltipItem.tipoMes === 'passado' ? 'Histórico Consolidado' : 'Mês Atual'}):
              </span>
              <span className="text-slate-500 text-[11px]">
                Total: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatarMoeda(tooltipItem.total)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                Pago: {formatarMoeda(tooltipItem.pago)}
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                A pagar: {formatarMoeda(tooltipItem.pendente)}
              </span>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-slate-400 italic mx-auto">
            Toque em qualquer mês para alternar a visualização e ver o detalhe de gastos futuros e passados
          </span>
        )}
      </div>
    </div>
  );
};
