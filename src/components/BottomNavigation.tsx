import React from 'react';
import { Home, PieChart, Layers, Settings, Plus } from 'lucide-react';

interface BottomNavigationProps {
  abaAtiva: string;
  setAbaAtiva: (aba: string) => void;
  qtdAtrasadas: number;
  onNovaConta: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  abaAtiva,
  setAbaAtiva,
  qtdAtrasadas,
  onNovaConta,
}) => {
  return (
    <nav className="sticky bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-md mx-auto px-3 h-16 flex items-center justify-between">
        {/* Início */}
        <button
          onClick={() => setAbaAtiva('inicio')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors relative cursor-pointer ${
            abaAtiva === 'inicio'
              ? 'text-blue-900 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <Home className={`w-5 h-5 ${abaAtiva === 'inicio' ? 'stroke-[2.5]' : ''}`} />
            {qtdAtrasadas > 0 && (
              <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Início</span>
        </button>

        {/* Gráficos */}
        <button
          onClick={() => setAbaAtiva('graficos')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors cursor-pointer ${
            abaAtiva === 'graficos'
              ? 'text-blue-900 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <PieChart className={`w-5 h-5 ${abaAtiva === 'graficos' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-1 tracking-tight">Gráficos</span>
        </button>

        {/* BOTÃO CENTRAL (+) NOVO PAGAMENTO / DESPESA COM DEGRADÊ AZUL */}
        <div className="flex-1 flex items-center justify-center -mt-5">
          <button
            onClick={onNovaConta}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-900 via-blue-800 to-indigo-700 hover:from-blue-800 hover:to-indigo-600 active:scale-95 text-white shadow-lg shadow-blue-950/40 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
            title="Cadastrar Novo Pagamento"
            aria-label="Cadastrar Novo Pagamento"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Parcelas */}
        <button
          onClick={() => setAbaAtiva('parcelas')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors cursor-pointer ${
            abaAtiva === 'parcelas'
              ? 'text-blue-900 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Layers className={`w-5 h-5 ${abaAtiva === 'parcelas' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-1 tracking-tight">Parcelas</span>
        </button>

        {/* Ajustes */}
        <button
          onClick={() => setAbaAtiva('ajustes')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-center transition-colors cursor-pointer ${
            abaAtiva === 'ajustes'
              ? 'text-blue-900 dark:text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Settings className={`w-5 h-5 ${abaAtiva === 'ajustes' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-1 tracking-tight">Ajustes</span>
        </button>
      </div>
    </nav>
  );
};
