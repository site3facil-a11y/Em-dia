import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda, formatarData, getStatusInfo } from '../utils/formatters';

interface CalendarioViewProps {
  parcelas: Parcela[];
  onPagarParcela: (parcela: Parcela) => void;
  onDesfazerPagamento: (parcelaId: number) => void;
  carregando: boolean;
}

export const CalendarioView: React.FC<CalendarioViewProps> = ({
  parcelas,
  onPagarParcela,
  onDesfazerPagamento,
  carregando,
}) => {
  const hoje = new Date();
  const [dataVisualizada, setDataVisualizada] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const ano = dataVisualizada.getFullYear();
  const mes = dataVisualizada.getMonth();

  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const mesAnterior = () => {
    setDataVisualizada(new Date(ano, mes - 1, 1));
    setDiaSelecionado(null);
  };

  const proximoMes = () => {
    setDataVisualizada(new Date(ano, mes + 1, 1));
    setDiaSelecionado(null);
  };

  const irParaHoje = () => {
    setDataVisualizada(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    const hojeStr = hoje.toISOString().slice(0, 10);
    setDiaSelecionado(hojeStr);
  };

  // Mapeamento de parcelas por data de vencimento (YYYY-MM-DD)
  const mapaPorData = React.useMemo(() => {
    const mapa = new Map<string, Parcela[]>();
    for (const p of parcelas) {
      if (!mapa.has(p.data_vencimento)) {
        mapa.set(p.data_vencimento, []);
      }
      mapa.get(p.data_vencimento)!.push(p);
    }
    return mapa;
  }, [parcelas]);

  // Construção dos dias do calendário
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 = Domingo
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diasNoMesAnterior = new Date(ano, mes, 0).getDate();

  const celulas = [];

  // Dias do mês anterior para preencher a primeira semana
  for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
    const diaNum = diasNoMesAnterior - i;
    const mesAnt = mes === 0 ? 11 : mes - 1;
    const anoAnt = mes === 0 ? ano - 1 : ano;
    const dataStr = `${anoAnt}-${String(mesAnt + 1).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
    celulas.push({
      diaNum,
      dataStr,
      outroMes: true,
      parcelas: mapaPorData.get(dataStr) || [],
    });
  }

  // Dias do mês atual
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    celulas.push({
      diaNum: dia,
      dataStr,
      outroMes: false,
      parcelas: mapaPorData.get(dataStr) || [],
    });
  }

  // Dias do próximo mês para fechar a grade (múltiplo de 7)
  const restante = (7 - (celulas.length % 7)) % 7;
  for (let i = 1; i <= restante; i++) {
    const mesProx = mes === 11 ? 0 : mes + 1;
    const anoProx = mes === 11 ? ano + 1 : ano;
    const dataStr = `${anoProx}-${String(mesProx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    celulas.push({
      diaNum: i,
      dataStr,
      outroMes: true,
      parcelas: mapaPorData.get(dataStr) || [],
    });
  }

  const hojeFormatado = hoje.toISOString().slice(0, 10);
  const parcelasDoDiaSelecionado = diaSelecionado ? mapaPorData.get(diaSelecionado) || [] : [];

  return (
    <div className="space-y-5">
      {/* Barra Superior do Calendário */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {nomesMeses[mes]} de {ano}
            </h3>
            <p className="text-xs text-slate-500">
              Visão cronológica de vencimentos e compromissos
            </p>
          </div>
        </div>

        {/* Legenda de Cores do Calendário */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
            <span>Pago</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
            <span>A Vencer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs animate-pulse"></span>
            <span>Atrasado</span>
          </div>
        </div>

        {/* Controles de Navegação */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={irParaHoje}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Hoje
          </button>
          <button
            onClick={mesAnterior}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={proximoMes}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Próximo Mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center py-2.5 text-xs font-bold text-slate-500 dark:text-slate-400">
          {diasSemana.map((d, idx) => (
            <div key={d} className={idx === 0 || idx === 6 ? 'text-blue-600 dark:text-blue-400' : ''}>
              {d}
            </div>
          ))}
        </div>

        {/* Células dos Dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
          {celulas.map((cel, index) => {
            const isHoje = cel.dataStr === hojeFormatado;
            const isSelecionado = cel.dataStr === diaSelecionado;
            const temContas = cel.parcelas.length > 0;

            const temAtrasada = cel.parcelas.some((p) => p.status === 'atrasado');
            const temPendente = cel.parcelas.some((p) => p.status === 'pendente');
            const todasPagas = cel.parcelas.length > 0 && cel.parcelas.every((p) => p.status === 'pago');

            const totalDia = cel.parcelas.reduce((acc, p) => acc + p.valor, 0);

            return (
              <div
                key={index}
                onClick={() => setDiaSelecionado(cel.dataStr)}
                className={`min-h-[90px] sm:min-h-[105px] p-1.5 sm:p-2.5 transition-colors cursor-pointer flex flex-col justify-between group ${
                  cel.outroMes
                    ? 'bg-slate-50/50 dark:bg-slate-950/30 opacity-40'
                    : isSelecionado
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500 ring-inset'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Cabeçalho do Dia */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      isHoje
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isSelecionado
                        ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {cel.diaNum}
                  </span>

                  {/* Indicadores de Cores (Verde, Amarelo, Vermelho) */}
                  {temContas && (
                    <div className="flex items-center gap-1">
                      {todasPagas ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Todas pagas" />
                      ) : (
                        <>
                          {temAtrasada && (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" title="Conta em atraso" />
                          )}
                          {temPendente && (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Conta a vencer" />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Resumo do Dia */}
                {temContas ? (
                  <div className="mt-1 space-y-1">
                    <div className="hidden sm:block">
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 font-mono block">
                        {formatarMoeda(totalDia)}
                      </span>
                      <span className="text-[9px] text-slate-500 font-medium">
                        {cel.parcelas.length} {cel.parcelas.length === 1 ? 'conta' : 'contas'}
                      </span>
                    </div>
                    {/* Versão compacta mobile */}
                    <div className="sm:hidden text-center">
                      <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {cel.parcelas.length}c
                      </span>
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel de Detalhes do Dia Selecionado */}
      {diaSelecionado && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                <span>Contas com vencimento em {formatarData(diaSelecionado)}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {parcelasDoDiaSelecionado.length} conta{parcelasDoDiaSelecionado.length !== 1 ? 's' : ''} encontrada{parcelasDoDiaSelecionado.length !== 1 ? 's' : ''} nesta data.
              </p>
            </div>
            <button
              onClick={() => setDiaSelecionado(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {parcelasDoDiaSelecionado.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhuma conta agendada para este dia.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-1">
              {parcelasDoDiaSelecionado.map((p) => {
                const statusInfo = getStatusInfo(p.status);
                const isPago = p.status === 'pago';

                return (
                  <div
                    key={p.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.categoria_cor || '#3b82f6' }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {p.conta_descricao}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {p.categoria_nome}
                          </span>
                          {p.total_parcelas > 1 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 font-bold">
                              {p.numero_parcela}/{p.total_parcelas}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.forma_pagamento}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-6 sm:pl-0">
                      <div className="text-right">
                        <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono block">
                          {formatarMoeda(p.valor)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>
                      </div>

                      {isPago ? (
                        <button
                          onClick={() => onDesfazerPagamento(p.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-400 text-xs font-semibold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Desfazer</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onPagarParcela(p)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>OK Pago</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
