import React, { useState } from 'react';
import { formatarMoeda } from '../utils/formatters';

interface CategoriaItem {
  categoria_id: number;
  categoria_nome: string;
  categoria_cor: string;
  total: number;
  percentual: number;
}

interface GraficoCategoriasProps {
  dados: CategoriaItem[];
}

export const GraficoCategorias: React.FC<GraficoCategoriasProps> = ({ dados }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalGeral = dados.reduce((acc, item) => acc + item.total, 0);

  if (dados.length === 0 || totalGeral === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        <div className="w-12 h-12 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 mb-2"></div>
        <p>Nenhuma conta neste período</p>
      </div>
    );
  }

  // Raio e centro do Donut Chart SVG
  const size = 200;
  const strokeWidth = 34;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Calcula os offsets para cada fatia circular
  let cumulativePercent = 0;
  const slices = dados.map((item, index) => {
    const strokeDasharray = `${(item.percentual / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((cumulativePercent / 100) * circumference);
    cumulativePercent += item.percentual;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      index,
    };
  });

  const activeItem = hoverIndex !== null ? dados[hoverIndex] : null;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
      {/* Gráfico Donut SVG */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Fundo sutil do trilho */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice) => {
            const isHovered = hoverIndex === slice.index;
            return (
              <circle
                key={slice.categoria_id}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.categoria_cor}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoverIndex(slice.index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>

        {/* Centro do Donut com informações contextuais */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {activeItem ? activeItem.categoria_nome : 'Total do Mês'}
          </span>
          <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 font-mono tracking-tight mt-0.5">
            {activeItem ? formatarMoeda(activeItem.total) : formatarMoeda(totalGeral)}
          </span>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {activeItem ? `${activeItem.percentual.toFixed(1)}%` : `${dados.length} categorias`}
          </span>
        </div>
      </div>

      {/* Legenda com detalhes e percentual */}
      <div className="flex-1 w-full space-y-2 max-h-60 overflow-y-auto pr-1">
        {dados.map((cat, idx) => {
          const isSelected = hoverIndex === idx;
          return (
            <div
              key={cat.categoria_id}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              className={`flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-100 dark:bg-slate-800 scale-[1.01]'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: cat.categoria_cor }}
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                  {cat.categoria_nome}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-right">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatarMoeda(cat.total)}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 w-10 text-right">
                  {cat.percentual.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
