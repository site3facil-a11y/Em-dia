import React, { useEffect, useState } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';

interface SnackbarDesfazerProps {
  visivel: boolean;
  mensagem?: string;
  onDesfazer: () => void;
  onFechar: () => void;
  duracaoMs?: number;
}

export const SnackbarDesfazer: React.FC<SnackbarDesfazerProps> = ({
  visivel,
  mensagem = 'Excluído.',
  onDesfazer,
  onFechar,
  duracaoMs = 5000,
}) => {
  const [segundosRestantes, setSegundosRestantes] = useState(5);

  useEffect(() => {
    if (!visivel) return;

    setSegundosRestantes(Math.round(duracaoMs / 1000));

    const intervalo = setInterval(() => {
      setSegundosRestantes((prev) => Math.max(0, prev - 1));
    }, 1000);

    const timer = setTimeout(() => {
      onFechar();
    }, duracaoMs);

    return () => {
      clearInterval(intervalo);
      clearTimeout(timer);
    };
  }, [visivel, duracaoMs, onFechar]);

  if (!visivel) return null;

  return (
    <aside
      aria-label="Aviso de exclusão com opção de desfazer"
      className="fixed bottom-24 sm:bottom-28 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-bottom duration-200"
    >
      <div className="bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>{mensagem}</span>
          <span className="text-[10px] text-slate-400">({segundosRestantes}s)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDesfazer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Desfazer</span>
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
