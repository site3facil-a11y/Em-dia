import React, { useState } from 'react';
import {
  LayoutDashboard,
  Receipt,
  Layers,
  CalendarDays,
  Tags,
  Settings,
  PlusCircle,
  Sun,
  Moon,
  Menu,
  X,
  Database,
  AlertTriangle,
} from 'lucide-react';

interface HeaderProps {
  abaAtiva: string;
  setAbaAtiva: (aba: string) => void;
  onNovaConta: () => void;
  mesSelecionado: string;
  setMesSelecionado: (mes: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  qtdAtrasadas: number;
}

export const Header: React.FC<HeaderProps> = ({
  abaAtiva,
  setAbaAtiva,
  onNovaConta,
  mesSelecionado,
  setMesSelecionado,
  darkMode,
  setDarkMode,
  qtdAtrasadas,
}) => {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const abas = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'contas', label: 'Contas & Parcelas', icon: Receipt },
    { id: 'parcelamentos', label: 'Parcelamentos', icon: Layers },
    { id: 'calendario', label: 'Calendário', icon: CalendarDays },
    { id: 'categorias', label: 'Categorias', icon: Tags },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  // Gera lista de meses para o seletor rápido (ano atual +/- 1 ano)
  const mesesOpcoes = [];
  const anoAtual = new Date().getFullYear();
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  for (let ano = anoAtual - 1; ano <= anoAtual + 1; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      const val = `${ano}-${String(mes).padStart(2, '0')}`;
      const label = `${nomesMeses[mes - 1]} / ${ano}`;
      mesesOpcoes.push({ val, label });
    }
  }

  const handleNavegacao = (id: string) => {
    setAbaAtiva(id);
    setMenuMobileAberto(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Marca */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleNavegacao('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    Contas a Pagar
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <Database className="w-2.5 h-2.5" />
                    SQLite
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                  Controle Financeiro
                </p>
              </div>
            </button>
          </div>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {abas.map((aba) => {
              const Icon = aba.icon;
              const ativa = abaAtiva === aba.id;
              return (
                <button
                  key={aba.id}
                  onClick={() => handleNavegacao(aba.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all relative ${
                    ativa
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{aba.label}</span>
                  {aba.id === 'contas' && qtdAtrasadas > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                      {qtdAtrasadas}
                    </span>
                  )}
                  {ativa && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Controles da Direita */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Seletor Rápido de Mês */}
            <div className="hidden md:flex items-center">
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                title="Filtrar por Mês"
              >
                <option value="todos">Todos os Meses</option>
                {mesesOpcoes.map((op) => (
                  <option key={op.val} value={op.val}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Alternador Modo Claro / Escuro */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>

            {/* Botão + Nova Conta */}
            <button
              onClick={onNovaConta}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Conta</span>
            </button>

            {/* Botão Hambúrguer Mobile */}
            <button
              onClick={() => setMenuMobileAberto(!menuMobileAberto)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              aria-label="Abrir Menu"
            >
              {menuMobileAberto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile Dropdown */}
      {menuMobileAberto && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-5 space-y-2 animate-in slide-in-from-top duration-200">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Mês de Referência
            </label>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-lg p-2 border border-slate-200 dark:border-slate-700"
            >
              <option value="todos">Todos os Meses</option>
              {mesesOpcoes.map((op) => (
                <option key={op.val} value={op.val}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {abas.map((aba) => {
              const Icon = aba.icon;
              const ativa = abaAtiva === aba.id;
              return (
                <button
                  key={aba.id}
                  onClick={() => handleNavegacao(aba.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    ativa
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{aba.label}</span>
                </button>
              );
            })}
          </div>

          {qtdAtrasadas > 0 && (
            <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span>Atenção: Você possui {qtdAtrasadas} conta(s) em atraso!</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
