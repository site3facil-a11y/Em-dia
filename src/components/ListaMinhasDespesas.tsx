import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Plus,
  Sparkles,
  Pencil,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { Parcela, DashboardMetrics } from '../types';
import { formatarMoeda, formatarData, formatarMesAno } from '../utils/formatters';
import { BarraProgressoVencimento } from './BarraProgressoVencimento';

interface ListaMinhasDespesasProps {
  parcelas: Parcela[];
  metrics: DashboardMetrics | null;
  mesSelecionado: string;
  setMesSelecionado: (mes: string) => void;
  onPagarParcela: (parcela: Parcela) => void;
  onDesfazerPagamento: (parcelaId: number) => void;
  onNovaConta: () => void;
  onVerDetalhes: (contaId: number) => void;
  onEditarParcela: (parcela: Parcela) => void;
  onExcluirParcela: (parcela: Parcela) => void;
  carregando: boolean;
}

interface ItemDespesaSwipeableProps {
  parcela: Parcela;
  estaAberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  onEditar: (p: Parcela) => void;
  onExcluir: (p: Parcela) => void;
  onPagarParcela: (p: Parcela) => void;
  onDesfazerPagamento: (id: number) => void;
  onVerDetalhes: (contaId: number) => void;
  reducedMotion: boolean;
  vencimentoAnterior: string | null | undefined;
}

const ItemDespesaSwipeable: React.FC<ItemDespesaSwipeableProps> = ({
  parcela: p,
  estaAberto,
  onAbrir,
  onFechar,
  onEditar,
  onExcluir,
  onPagarParcela,
  onDesfazerPagamento,
  onVerDetalhes,
  reducedMotion,
  vencimentoAnterior,
}) => {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const directionRef = React.useRef<'horizontal' | 'vertical' | null>(null);

  const isPago = p.status === 'pago';
  const isAtrasado = p.status === 'atrasado';
  const isEconomia =
    p.categoria_nome?.toLowerCase().includes('poupança') ||
    p.categoria_nome?.toLowerCase().includes('economia');
  const isReserva = p.categoria_nome?.toLowerCase().includes('reserva');
  const nomeCategoriaExibida = isEconomia ? 'Economias' : isReserva ? 'Reservas' : 'Gastos';
  const corCategoriaExibida = isEconomia ? '#10b981' : isReserva ? '#f59e0b' : '#2563eb';

  const ACTION_WIDTH = 140; // largura dos botões combinados (Editar + Excluir)
  const LOCK_THRESHOLD = 56; // ~40% da largura dos botões para travar aberto

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    directionRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;

    if (!directionRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
        directionRef.current = 'vertical';
        return; // Permite rolagem vertical normal
      } else if (Math.abs(deltaX) > 6) {
        directionRef.current = 'horizontal';
      }
    }

    if (directionRef.current === 'horizontal') {
      const baseOffset = estaAberto ? -ACTION_WIDTH : 0;
      // Permite arrastar para a esquerda (valores negativos)
      const novoOffset = Math.min(0, Math.max(-ACTION_WIDTH - 20, baseOffset + deltaX));
      setDragOffset(novoOffset);
    }
  };

  const handleTouchEnd = () => {
    if (directionRef.current === 'horizontal' && dragOffset !== null) {
      // Se passou de 40% da largura dos botões, trava aberto; senão, fecha
      if (dragOffset <= -LOCK_THRESHOLD) {
        onAbrir();
      } else {
        onFechar();
      }
    }
    touchStartRef.current = null;
    directionRef.current = null;
    setDragOffset(null);
  };

  const currentTranslateX = dragOffset !== null ? dragOffset : estaAberto ? -ACTION_WIDTH : 0;

  return (
    <div className="relative rounded-2xl overflow-hidden select-none">
      {/* Botões Revelados ATRÁS do card (Editar azul e Excluir vermelho) */}
      <div className="absolute right-0 top-0 bottom-0 w-[140px] flex z-0 rounded-2xl overflow-hidden">
        {/* Botão Editar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFechar();
            onEditar(p);
          }}
          className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Editar este pagamento"
        >
          <Pencil className="w-5 h-5" />
          <span className="text-[11px] font-bold">Editar</span>
        </button>

        {/* Botão Excluir */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFechar();
            onExcluir(p);
          }}
          className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          title="Excluir este pagamento"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[11px] font-bold">Excluir</span>
        </button>
      </div>

      {/* Card da Frente (desliza para a esquerda) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          if (estaAberto) onFechar();
        }}
        style={{
          transform: `translateX(${currentTranslateX}px)`,
          transition:
            dragOffset !== null || reducedMotion ? 'none' : 'transform 200ms ease-out',
        }}
        className={`relative z-10 bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border flex flex-col justify-between shadow-2xs hover:shadow-xs transition-colors ${
          isEconomia
            ? isPago
              ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50/20'
              : 'border-emerald-200 dark:border-emerald-900/60'
            : isPago
            ? 'border-emerald-200/80 dark:border-emerald-950/60 opacity-90'
            : isAtrasado
            ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/20'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Linha Superior */}
        <div className="flex items-center justify-between gap-2.5">
          {/* Lado Esquerdo: Check + Detalhes */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Botão Circular de Quitar */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (estaAberto) {
                  onFechar();
                  return;
                }
                if (isPago) {
                  onDesfazerPagamento(p.id);
                } else {
                  onPagarParcela(p);
                }
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 cursor-pointer ${
                isPago
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : isEconomia
                  ? 'border-2 border-emerald-400 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  : isAtrasado
                  ? 'border-2 border-rose-400 text-rose-500 hover:bg-rose-50'
                  : 'border-2 border-slate-300 dark:border-slate-700 text-transparent hover:border-blue-600 hover:text-blue-600'
              }`}
              title={
                isPago
                  ? isEconomia
                    ? 'Clique para desmarcar economia'
                    : 'Clique para desmarcar como pago'
                  : isEconomia
                  ? 'Clique para confirmar valor guardado'
                  : 'Clique para marcar como pago'
              }
            >
              <Check className={`w-4 h-4 ${isPago ? 'stroke-[3]' : ''}`} />
            </button>

            {/* Informações da Conta */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (estaAberto) onFechar();
                else onVerDetalhes(p.conta_id);
              }}
              className="cursor-pointer min-w-0 flex-1"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4
                  className={`text-sm font-bold truncate ${
                    isPago
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {p.conta_descricao}
                </h4>
                {isEconomia && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    💰 Economia
                  </span>
                )}
                {isReserva && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    🛡️ Reserva
                  </span>
                )}
                {p.total_parcelas > 1 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50">
                    {p.numero_parcela}/{p.total_parcelas}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <span className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: corCategoriaExibida }}
                  />
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">
                    {nomeCategoriaExibida}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  {isEconomia ? 'Dia de guardar:' : 'Vence'}{' '}
                  {formatarData(p.data_vencimento)}
                </span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Valor + Três Pontinhos */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <span
                className={`font-mono font-extrabold text-sm block ${
                  isEconomia || isPago
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPago
                  ? `✓ ${formatarMoeda(p.valor_pago || p.valor)}`
                  : isEconomia
                  ? `💰 ${formatarMoeda(p.valor)}`
                  : `- ${formatarMoeda(p.valor)}`}
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                {isPago
                  ? isEconomia
                    ? 'Guardado no cofre'
                    : 'Pago'
                  : isAtrasado
                  ? 'Em atraso'
                  : isEconomia
                  ? 'A guardar'
                  : 'A pagar'}
              </span>
            </div>

            {/* Três pontinhos alternativo ao swipe */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (estaAberto) onFechar();
                else onAbrir();
              }}
              className="p-1.5 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Opções (Editar / Excluir)"
              aria-label="Mais opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Linha Inferior: Barra de Progresso do Vencimento */}
        <BarraProgressoVencimento
          parcela={p}
          vencimentoAnterior={vencimentoAnterior}
        />
      </div>
    </div>
  );
};

export const ListaMinhasDespesas: React.FC<ListaMinhasDespesasProps> = ({
  parcelas,
  metrics,
  mesSelecionado,
  setMesSelecionado,
  onPagarParcela,
  onDesfazerPagamento,
  onNovaConta,
  onVerDetalhes,
  onEditarParcela,
  onExcluirParcela,
  carregando,
}) => {
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendente' | 'pago' | 'atrasado'>('todas');
  const [cardAbertoId, setCardAbertoId] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener?.('change', listener);
      return () => mq.removeEventListener?.('change', listener);
    } catch {}
  }, []);

  // Fecha qualquer card aberto ao clicar em qualquer lugar fora
  useEffect(() => {
    const handleGlobalClick = () => {
      setCardAbertoId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Navegação de mês
  const navegarMes = (direcao: number) => {
    const [ano, mes] = mesSelecionado.split('-').map(Number);
    const d = new Date(ano, mes - 1 + direcao, 1);
    const novoMesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setMesSelecionado(novoMesStr);
    setCardAbertoId(null);
  };

  // Filtragem das parcelas
  const parcelasFiltradas = parcelas.filter((p) => {
    if (filtroStatus === 'todas') return true;
    return p.status === filtroStatus;
  });

  // Mapeia vencimentos das parcelas para encontrar a parcela anterior da mesma conta
  const mapaVencimentoAnterior = useMemo(() => {
    const map = new Map<string, string>();
    parcelas.forEach((p) => {
      map.set(`${p.conta_id}-${p.numero_parcela}`, p.data_vencimento);
    });
    return map;
  }, [parcelas]);

  const totalMes = metrics ? metrics.totalPagoMes + metrics.totalAPagarMes : 0;
  const pagoMes = metrics?.totalPagoMes || 0;
  const aPagarMes = metrics?.totalAPagarMes || 0;
  const atrasadasQtd = metrics?.qtdAtrasadas || 0;
  const vencendoHojeQtd = metrics?.qtdVencendoHoje || 0;

  return (
    <div
      onClick={() => setCardAbertoId(null)}
      className="space-y-4 pb-28"
    >
      {/* CARD PRINCIPAL SUPERIOR: TOTAL DE DESPESAS DO MÊS (SEM O BOTÃO BRANCO) */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 text-white rounded-3xl p-5 shadow-xl shadow-blue-950/25 border border-blue-800/40 dark:border-blue-900/40 relative overflow-hidden">
        {/* Efeitos decorativos de luz e degradê suave */}
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 text-center">
          <span className="text-blue-200 dark:text-blue-300 text-xs font-bold tracking-wide uppercase">
            Total de Despesas do Mês
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight font-mono mt-1 text-white">
            {formatarMoeda(totalMes)}
          </h2>

          {/* Cards internos: Pago vs A Pagar */}
          <div className="grid grid-cols-2 gap-2.5 mt-3.5">
            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-2xl p-2.5 text-left border border-white/15">
              <span className="text-[11px] text-blue-200 dark:text-blue-300 font-medium block">
                Pago
              </span>
              <span className="text-sm font-bold font-mono text-emerald-300">
                {formatarMoeda(pagoMes)}
              </span>
            </div>

            <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-2xl p-2.5 text-left border border-white/15">
              <span className="text-[11px] text-blue-200 dark:text-blue-300 font-medium block">
                A pagar
              </span>
              <span className="text-sm font-bold font-mono text-amber-300">
                {formatarMoeda(aPagarMes)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* LEMBRETE DE VENCIMENTO */}
      {(atrasadasQtd > 0 || vencendoHojeQtd > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <strong className="block font-bold">Lembrete de Vencimento</strong>
            <span>
              {atrasadasQtd > 0
                ? `Você tem ${atrasadasQtd} conta(s) em atraso!`
                : `${vencendoHojeQtd} conta(s) vencem hoje!`}
            </span>
          </div>
          {atrasadasQtd > 0 && (
            <button
              onClick={() => setFiltroStatus('atrasado')}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px] flex-shrink-0 hover:bg-amber-700 cursor-pointer"
            >
              Ver
            </button>
          )}
        </div>
      )}

      {/* SELETOR RÁPIDO DE MÊS */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <button
          onClick={() => navegarMes(-1)}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 capitalize">
          {formatarMesAno(mesSelecionado)}
        </span>

        <button
          onClick={() => navegarMes(1)}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* FILTROS POR STATUS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        <button
          onClick={() => setFiltroStatus('todas')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all flex-shrink-0 cursor-pointer ${
            filtroStatus === 'todas'
              ? 'bg-blue-900 dark:bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Todas ({parcelas.length})
        </button>
        <button
          onClick={() => setFiltroStatus('pendente')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all flex-shrink-0 cursor-pointer ${
            filtroStatus === 'pendente'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          A pagar ({parcelas.filter((p) => p.status === 'pendente').length})
        </button>
        <button
          onClick={() => setFiltroStatus('pago')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all flex-shrink-0 cursor-pointer ${
            filtroStatus === 'pago'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Pagas ({parcelas.filter((p) => p.status === 'pago').length})
        </button>
        <button
          onClick={() => setFiltroStatus('atrasado')}
          className={`px-3 py-1.5 rounded-full font-bold transition-all flex-shrink-0 cursor-pointer ${
            filtroStatus === 'atrasado'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Atrasadas ({parcelas.filter((p) => p.status === 'atrasado').length})
        </button>
      </div>

      {/* LISTA DE CONTAS COM SWIPE HORIZONTAL (ARRASTE PARA A ESQUERDA) */}
      {carregando ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          Carregando contas...
        </div>
      ) : parcelasFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800">
          <Sparkles className="w-8 h-8 text-blue-500 mx-auto mb-2 opacity-60" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhuma despesa encontrada
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Clique no botão abaixo para adicionar um pagamento.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {parcelasFiltradas.map((p) => {
            const vencimentoAnterior =
              p.numero_parcela > 1
                ? mapaVencimentoAnterior.get(`${p.conta_id}-${p.numero_parcela - 1}`)
                : null;

            return (
              <ItemDespesaSwipeable
                key={p.id}
                parcela={p}
                estaAberto={cardAbertoId === p.id}
                onAbrir={() => setCardAbertoId(p.id)}
                onFechar={() => setCardAbertoId(null)}
                onEditar={onEditarParcela}
                onExcluir={onExcluirParcela}
                onPagarParcela={onPagarParcela}
                onDesfazerPagamento={onDesfazerPagamento}
                onVerDetalhes={onVerDetalhes}
                reducedMotion={reducedMotion}
                vencimentoAnterior={vencimentoAnterior}
              />
            );
          })}
        </div>
      )}

      {/* Botão tracejado mantido no final da lista */}
      <div className="pt-2">
        <button
          onClick={onNovaConta}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Adicionar Outra Despesa ou Pagamento</span>
        </button>
      </div>
    </div>
  );
};
