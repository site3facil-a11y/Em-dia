import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Parcela } from '../types';
import { getHojeString } from '../utils/formatters';

interface BarraProgressoVencimentoProps {
  parcela: Parcela;
  vencimentoAnterior?: string | null;
}

// Converte YYYY-MM-DD para Date local sem problemas de fuso horário
function parseDataLocal(dataStr: string): Date {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// Retorna diferença em dias: dataA - dataB
function diferencaEmDias(dataAStr: string, dataBStr: string): number {
  const a = parseDataLocal(dataAStr);
  const b = parseDataLocal(dataBStr);
  const diffMs = a.getTime() - b.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export const BarraProgressoVencimento: React.FC<BarraProgressoVencimentoProps> = ({
  parcela,
  vencimentoAnterior,
}) => {
  const [animado, setAnimado] = useState(false);

  useEffect(() => {
    // Efeito suave de entrada para a barra preencher ao carregar
    const frame = requestAnimationFrame(() => {
      setAnimado(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const hoje = getHojeString();
  const { data_vencimento, data_pagamento, status } = parcela;
  const isPago = status === 'pago';

  // 1. Determina a duração do ciclo inicial (até o vencimento)
  // Período: de 30 dias antes até o vencimento. Se tiver parcela anterior, usa a diferença limitada a 30 dias.
  let cicloTotal = 30;
  if (vencimentoAnterior) {
    const diffAnterior = diferencaEmDias(data_vencimento, vencimentoAnterior);
    if (diffAnterior > 0) {
      cicloTotal = Math.min(30, diffAnterior);
    }
  } else if (parcela.numero_parcela > 1) {
    // Parcela subsequente sem o registro anterior no lote: calcula ~1 mês anterior
    const [ano, mes, dia] = data_vencimento.split('-').map(Number);
    const dataEstimadaAnterior = new Date(ano, mes - 2, dia);
    const diffEstimada = Math.round(
      (parseDataLocal(data_vencimento).getTime() - dataEstimadaAnterior.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    cicloTotal = Math.min(30, Math.max(1, diffEstimada));
  }

  // O marcador vertical de vencimento fica fixado em 70% da extensão da barra.
  // Os 30% restantes correspondem à margem de atraso (de 1 a 30 dias de atraso).
  const POSICAO_MARCADOR = 70;
  const ESPACO_ATRASO = 30;

  let progressoPercent = 0;
  let textoStatus = '';
  let corBarra = 'bg-blue-600 dark:bg-blue-500';
  let corTexto = 'text-blue-600 dark:text-blue-400';

  if (isPago) {
    // ----------------------------------------------------
    // ESTADO 4: CONTA PAGA
    // ----------------------------------------------------
    corBarra = 'bg-emerald-500 dark:bg-emerald-400';
    corTexto = 'text-emerald-600 dark:text-emerald-400 font-semibold';

    if (data_pagamento) {
      const diffPago = diferencaEmDias(data_vencimento, data_pagamento);

      if (diffPago > 0) {
        // Paga antes do prazo
        const diasAntes = diffPago;
        textoStatus = diasAntes === 1 ? 'paga 1 dia antes' : `paga ${diasAntes} dias antes`;
        // Para na posição do dia do pagamento; sobra espaço vazio até o marcador (70%)
        const diasPercorridos = Math.max(0, cicloTotal - diasAntes);
        const fracao = Math.min(1, Math.max(0.06, diasPercorridos / cicloTotal));
        progressoPercent = fracao * POSICAO_MARCADOR;
      } else if (diffPago === 0) {
        // Paga exatamente no dia
        textoStatus = 'paga no dia';
        progressoPercent = POSICAO_MARCADOR;
      } else {
        // Paga com atraso (data_pagamento posterior ao vencimento)
        const diasAtraso = Math.abs(diffPago);
        textoStatus = diasAtraso === 1 ? 'paga com 1 dia de atraso' : `paga com ${diasAtraso} dias de atraso`;
        const fracaoAtraso = Math.min(30, diasAtraso) / 30;
        progressoPercent = Math.min(100, POSICAO_MARCADOR + fracaoAtraso * ESPACO_ATRASO);
      }
    } else {
      textoStatus = 'paga';
      progressoPercent = POSICAO_MARCADOR;
    }
  } else {
    // Não está paga ainda: calcula relação com a data de hoje
    const diffDiasVencimento = diferencaEmDias(data_vencimento, hoje);

    if (diffDiasVencimento === 0) {
      // ----------------------------------------------------
      // ESTADO 2: VENCE HOJE
      // ----------------------------------------------------
      progressoPercent = POSICAO_MARCADOR;
      corBarra = 'bg-orange-500 dark:bg-orange-400';
      corTexto = 'text-orange-600 dark:text-orange-400 font-bold';
      textoStatus = 'vence hoje';
    } else if (diffDiasVencimento > 0) {
      // ----------------------------------------------------
      // ESTADO 1: A PAGAR, NO PRAZO
      // ----------------------------------------------------
      const diasRestantes = diffDiasVencimento;
      const diasDecorridos = Math.max(0, cicloTotal - diasRestantes);
      const fracao = Math.min(1, Math.max(0.06, diasDecorridos / cicloTotal));
      progressoPercent = fracao * POSICAO_MARCADOR;

      if (diasRestantes <= 3) {
        // 3 dias ou menos: muda para amarelo / laranja
        corBarra = 'bg-amber-500 dark:bg-amber-400';
        corTexto = 'text-amber-600 dark:text-amber-400 font-bold';
      } else {
        // No prazo com folga: azul
        corBarra = 'bg-blue-600 dark:bg-blue-500';
        corTexto = 'text-blue-600 dark:text-blue-400 font-medium';
      }

      textoStatus = diasRestantes === 1 ? 'falta 1 dia' : `faltam ${diasRestantes} dias`;
    } else {
      // ----------------------------------------------------
      // ESTADO 3: ATRASADA
      // ----------------------------------------------------
      const diasAtraso = Math.abs(diffDiasVencimento);
      const fracaoAtraso = Math.min(30, diasAtraso) / 30;
      progressoPercent = Math.min(100, POSICAO_MARCADOR + fracaoAtraso * ESPACO_ATRASO);

      corBarra = 'bg-rose-500 dark:bg-rose-400';
      corTexto = 'text-rose-600 dark:text-rose-400 font-bold';

      if (diasAtraso > 30) {
        textoStatus = '30+ dias em atraso';
      } else {
        textoStatus = diasAtraso === 1 ? '1 dia em atraso' : `${diasAtraso} dias em atraso`;
      }
    }
  }

  return (
    <div className="w-full mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
      {/* Container da Barra Fina (6px) com Cantos Arredondados */}
      <div className="relative flex-1 h-[6px] bg-slate-200 dark:bg-slate-800 rounded-full">
        {/* Marcador Vertical de Vencimento: Alto Contraste (12px de altura, 2px de largura) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[2px] h-[12px] bg-slate-800 dark:bg-white rounded-full z-10 pointer-events-none shadow-xs ring-1 ring-white/30 dark:ring-black/40"
          style={{ left: `${POSICAO_MARCADOR}%` }}
          title={`Data de vencimento: ${data_vencimento}`}
        />

        {/* Barra de Progresso com Animação Suave */}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${corBarra}`}
          style={{
            width: animado ? `${progressoPercent}%` : '0%',
          }}
        />
      </div>

      {/* Texto Curto ao Lado da Barra */}
      <div className="flex items-center gap-1 text-[11px] whitespace-nowrap flex-shrink-0 select-none">
        {isPago && (
          <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 stroke-[3]" />
        )}
        <span className={corTexto}>{textoStatus}</span>
      </div>
    </div>
  );
};
