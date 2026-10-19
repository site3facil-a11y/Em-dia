import React, { useEffect, useState, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

export interface ModalBaseProps {
  aberto: boolean;
  onFechar: () => void;
  icone?: React.ReactNode;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  tamanhoMaximo?: string; // default: 'max-w-lg'
  zIndex?: string; // default: 'z-[100]'
  asForm?: boolean;
  onSubmit?: (e: React.FormEvent) => void;
}

export const ModalBase: React.FC<ModalBaseProps> = ({
  aberto,
  onFechar,
  icone,
  titulo,
  subtitulo,
  children,
  rodape,
  tamanhoMaximo = 'max-w-lg',
  zIndex = 'z-[100]',
  asForm = false,
  onSubmit,
}) => {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);

  // 1. Bloqueia a rolagem do body enquanto o modal estiver aberto e restaura ao fechar (Item 4)
  useEffect(() => {
    if (!aberto) return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, [aberto]);

  // 2. Botão voltar nativo do Android fecha o modal (Item 4) e suporte a tecla Esc
  useEffect(() => {
    if (!aberto) return;

    let handleListener: any = null;
    try {
      CapApp.addListener('backButton', () => {
        onFechar();
      })
        .then((h) => {
          handleListener = h;
        })
        .catch(() => {});
    } catch {}

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFechar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (handleListener?.remove) {
        handleListener.remove();
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [aberto, onFechar]);

  // 3. Monitoramento de visualViewport para teclado virtual aberto (Item 3)
  useEffect(() => {
    if (!aberto) return;

    const vv = window.visualViewport;
    if (!vv) return;

    const handleViewportChange = () => {
      const h = vv.height;
      setViewportHeight(h);
      const isKeyboard = window.innerHeight - h > 120;
      setTecladoAberto(isKeyboard);

      if (isKeyboard) {
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
          setTimeout(() => {
            active.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 150);
        }
      }
    };

    handleViewportChange();
    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);

    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, [aberto]);

  // 4. Role o campo focado para o centro com scrollIntoView({ block: "center" }) (Item 3)
  useEffect(() => {
    if (!aberto) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        setTimeout(() => {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 200);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    return () => window.removeEventListener('focusin', handleFocusIn);
  }, [aberto]);

  if (!aberto) return null;

  // Variáveis CSS e margens seguras (Item 1 e 3)
  const estiloPainel: React.CSSProperties = {
    // --m-top: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 32px) mais 8px
    // --m-bottom: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 48px) mais 8px
    ['--m-top' as any]: 'calc(max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 32px) + 8px)',
    ['--m-bottom' as any]: 'calc(max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 48px) + 8px)',
    marginTop: tecladoAberto
      ? 'calc(max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 16px) + 4px)'
      : 'var(--m-top)',
    marginBottom: tecladoAberto ? '8px' : 'var(--m-bottom)',
    maxHeight:
      tecladoAberto && viewportHeight
        ? `${Math.max(260, viewportHeight - 40)}px`
        : 'calc(100dvh - var(--m-top) - var(--m-bottom))',
  };

  const ComponenteConteudo = asForm ? 'form' : 'div';

  return (
    <div
      className={`fixed inset-0 ${zIndex} flex items-center justify-center px-3 sm:px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-hidden`}
      onPointerDown={(e) => {
        // Fecha apenas se clicar estritamente no backdrop fora do painel
        if (e.target === e.currentTarget) {
          onFechar();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={estiloPainel}
        className={`w-full ${tamanhoMaximo} rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-150`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ComponenteConteudo
          onSubmit={asForm && onSubmit ? onSubmit : undefined}
          className="flex flex-col flex-1 overflow-hidden min-h-0 select-text"
        >
          {/* Cabeçalho Fixo no topo do painel (Item 1) */}
          <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-between gap-3 z-10">
            <div className="flex items-center gap-3 min-w-0">
              {icone && (
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center flex-shrink-0 shadow-2xs">
                  {icone}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {titulo}
                </h3>
                {subtitulo && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {subtitulo}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 active:scale-95 transition-all cursor-pointer flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Corpo rolável com overflow-y: auto e overscroll-behavior: contain (Item 1) */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4">
            {children}
          </div>

          {/* Rodapé fixo na base do painel com fundo opaco e borda superior (Item 1 e 2) */}
          {rodape && (
            <div className="flex-shrink-0 px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
              {rodape}
            </div>
          )}
        </ComponenteConteudo>
      </div>
    </div>
  );
};

export interface ModalBotoesRodapeProps {
  textoCancelar?: string;
  textoConfirmar?: string;
  onCancelar: () => void;
  onConfirmar?: () => void;
  salvando?: boolean;
  textoSaving?: string;
  desabilitado?: boolean;
  corConfirmar?: 'azul' | 'verde' | 'vermelho' | 'laranja';
  iconeConfirmar?: React.ReactNode;
  tipoConfirmar?: 'button' | 'submit';
}

/**
 * Componente padronizado para botões do rodapé (Item 2):
 * - "Cancelar" e "Salvar Alterações" lado a lado em largura igual (flex: 1)
 * - Altura mínima de 48px (min-h-[48px])
 * - Gap de 12px (gap-3)
 * - Em telas estreitas (até 360px), empilha um sobre o outro com o botão principal em cima (flex-col-reverse)
 */
export const ModalBotoesRodape: React.FC<ModalBotoesRodapeProps> = ({
  textoCancelar = 'Cancelar',
  textoConfirmar = 'Salvar Alterações',
  onCancelar,
  onConfirmar,
  salvando = false,
  textoSaving = 'Salvando...',
  desabilitado = false,
  corConfirmar = 'azul',
  iconeConfirmar,
  tipoConfirmar,
}) => {
  const gradientes = {
    azul: 'bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 shadow-blue-900/20',
    verde: 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 shadow-emerald-900/20',
    vermelho: 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 shadow-rose-900/20',
    laranja: 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 shadow-amber-900/20',
  };

  const tipoBtn = tipoConfirmar || (onConfirmar ? 'button' : 'submit');

  return (
    <div className="flex flex-col-reverse min-[361px]:flex-row items-stretch gap-3 w-full">
      {/* Botão Cancelar (em telas <= 360px fica em baixo) */}
      <button
        type="button"
        onClick={onCancelar}
        disabled={salvando}
        className="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center select-none disabled:opacity-50"
      >
        {textoCancelar}
      </button>

      {/* Botão Principal / Confirmar (em telas <= 360px fica em cima) */}
      <button
        type={tipoBtn}
        onClick={onConfirmar}
        disabled={salvando || desabilitado}
        className={`flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl text-white text-xs font-bold shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 select-none disabled:opacity-50 disabled:cursor-not-allowed ${gradientes[corConfirmar]}`}
      >
        {salvando ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>{textoSaving}</span>
          </>
        ) : (
          <>
            {iconeConfirmar}
            <span className="truncate">{textoConfirmar}</span>
          </>
        )}
      </button>
    </div>
  );
};
