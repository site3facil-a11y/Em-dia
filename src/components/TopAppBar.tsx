import React from 'react';
import { Database, Sun, Moon, Plus } from 'lucide-react';

interface TopAppBarProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onNovaConta: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ darkMode, setDarkMode, onNovaConta }) => {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-blue-950 dark:to-slate-950 text-white px-4 py-3 flex items-center justify-between transition-colors shadow-md dark:border-b dark:border-slate-800">
      <div className="flex items-center gap-2.5">
        <img
          src="/icon.svg"
          alt="Ícone Em Dia"
          className="w-7 h-7 rounded-lg shadow-xs flex-shrink-0"
          width="28"
          height="28"
        />
        <h1 className="font-extrabold text-base tracking-tight text-white">
          Em Dia
        </h1>
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-white/15 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-white/20 dark:border-blue-800 text-blue-100 dark:text-blue-300">
          <Database className="w-2.5 h-2.5" />
          SQLite
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onNovaConta}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-blue-950 dark:bg-blue-600 dark:text-white font-extrabold text-xs shadow-sm hover:bg-blue-50 dark:hover:bg-blue-500 active:scale-95 transition-all cursor-pointer"
          title="Cadastrar nova despesa"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>+ Nova Conta</span>
        </button>

        {/* Botão de Alternar Modo Claro / Escuro com feedback visual claro */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 transition-all text-white text-xs font-semibold cursor-pointer"
          title={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          aria-label={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-300" />
              <span className="text-[11px] font-bold">Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-200" />
              <span className="text-[11px] font-bold">Escuro</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
