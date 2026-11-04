import React, { useState } from 'react';
import { PiggyBank, AlertCircle, Sparkles } from 'lucide-react';
import { Categoria } from '../types';
import { NovaContaInput } from '../db/repository';
import { formatarData, getHojeString } from '../utils/formatters';
import { parseMoedaParaCentavos, formatarCentavos, calcularPorquinhoCentavos } from '../utils/finance';
import { ModalBase, ModalBotoesRodape } from './ModalBase';

interface ModalCriarPorquinhoProps {
  aberto: boolean;
  onFechar: () => void;
  categorias: Categoria[];
  onSalvar: (conta: NovaContaInput) => Promise<number | void>;
}

export const ModalCriarPorquinho: React.FC<ModalCriarPorquinhoProps> = ({
  aberto,
  onFechar,
  categorias,
  onSalvar,
}) => {
  const [nomeMeta, setNomeMeta] = useState('');
  const [modoValor, setModoValor] = useState<'total' | 'parcela'>('total');
  const [valorStr, setValorStr] = useState('');
  const [numeroMeses, setNumeroMeses] = useState<number>(10);
  const [dataPrimeiroDeposito, setDataPrimeiroDeposito] = useState(getHojeString());
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!aberto) return null;

  // Busca a categoria 'Economias'
  const economiasCat =
    categorias.find((c) => c.nome === 'Economias') ||
    categorias.find((c) => c.nome.toLowerCase().includes('econ') || c.nome.toLowerCase().includes('poup')) ||
    categorias[0];
  const categoriaId = economiasCat?.id || 2;

  const meses = Math.max(1, Math.min(120, numeroMeses));
  const { metaTotalCentavos, parcelasCentavos, valorParcelaBaseCentavos } = calcularPorquinhoCentavos(
    modoValor,
    valorStr,
    meses
  );

  const valorDigitadoCentavos = parseMoedaParaCentavos(valorStr);
  const sugestaoFormatada =
    valorStr.trim() !== '' &&
    !valorStr.includes(',') &&
    valorDigitadoCentavos > 0
      ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          valorDigitadoCentavos / 100
        )
      : null;

  const handleValorBlur = () => {
    const limpo = valorStr.trim();
    if (!limpo) return;
    const centavos = parseMoedaParaCentavos(limpo);
    if (centavos > 0) {
      setValorStr(
        new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(centavos / 100)
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeMeta.trim()) {
      setErro('Informe o nome do seu porquinho ou meta.');
      return;
    }
    if (metaTotalCentavos <= 0) {
      setErro(modoValor === 'total' ? 'Informe a meta total que deseja economizar.' : 'Informe o valor da parcela mensal.');
      return;
    }
    if (!dataPrimeiroDeposito) {
      setErro('Informe a data do primeiro depósito.');
      return;
    }
    if (meses < 1) {
      setErro('O prazo deve ser de no mínimo 1 mês.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        descricao: nomeMeta.trim(),
        categoria_id: categoriaId,
        valor_total: metaTotalCentavos / 100,
        tipo: 'parcelada',
        forma_pagamento: 'Geral',
        observacoes: 'Porquinho de Economia parcelada',
        data_primeiro_vencimento: dataPrimeiroDeposito,
        numero_parcelas: meses,
        modo_valor_parcelado: modoValor,
        valor_parcela: valorParcelaBaseCentavos / 100,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao criar o porquinho.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      icone={<PiggyBank className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
      titulo={
        <div className="flex items-center gap-1.5">
          <span>Criar Novo Porquinho</span>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold px-1.5 py-0.5 rounded-full">
            Economia
          </span>
        </div>
      }
      subtitulo="Poupe um valor fixo todo mês na forma de parcelas"
      asForm={true}
      onSubmit={handleSubmit}
      tamanhoMaximo="max-w-lg"
      rodape={
        <ModalBotoesRodape
          textoCancelar="Cancelar"
          textoConfirmar="Criar Porquinho 🐷"
          textoSaving="Criando..."
          onCancelar={onFechar}
          salvando={salvando}
          corConfirmar="verde"
          iconeConfirmar={<PiggyBank className="w-4 h-4" />}
        />
      }
    >
      {erro && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Nome da Meta / Porquinho */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Nome do Porquinho / Meta *
        </label>
        <input
          type="text"
          required
          placeholder="Ex: Poupança 2026, Reserva de Emergência, Férias..."
          value={nomeMeta}
          onChange={(e) => setNomeMeta(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>

      {/* Seletor do Modo de Valor: Meta total vs Valor por parcela */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          Informar:
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setModoValor('total')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              modoValor === 'total'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>🎯 Meta total</span>
          </button>
          <button
            type="button"
            onClick={() => setModoValor('parcela')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              modoValor === 'parcela'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>💵 Valor por parcela</span>
          </button>
        </div>
      </div>

      {/* Campo de Valor com rótulo e placeholder contextualizados */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {modoValor === 'total' ? 'Meta Total a Juntar (R$) *' : 'Valor por Parcela / Mês (R$) *'}
          </label>
          <span className="text-[11px] text-slate-400">
            {modoValor === 'total' ? 'Meta total dividida nos meses' : 'Valor fixo guardado por mês'}
          </span>
        </div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            R$
          </span>
          <input
            type="text"
            inputMode="decimal"
            required
            placeholder={modoValor === 'total' ? '1.000,00' : '100,00'}
            value={valorStr}
            onChange={(e) => setValorStr(e.target.value)}
            onBlur={handleValorBlur}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        {sugestaoFormatada && (
          <button
            type="button"
            onClick={() => setValorStr(sugestaoFormatada)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-all active:scale-95"
            title={`Toque para preencher R$ ${sugestaoFormatada}`}
          >
            💡 Formatar: R$ {sugestaoFormatada}
          </button>
        )}
      </div>

      {/* Prazo em Meses e Primeiro Depósito */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Prazo (Meses) *
            </label>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {meses} parcelas
            </span>
          </div>
          <input
            type="number"
            min="1"
            max="120"
            required
            value={numeroMeses}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setNumeroMeses(isNaN(val) ? 1 : Math.max(1, Math.min(120, val)));
            }}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            placeholder="10"
          />
          <span className="text-[10px] text-slate-400 block mt-1">
            {meses === 12 ? 'Ex: 12 meses = 1 ano' : `${meses} depósitos mensais`}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Primeiro Depósito *
          </label>
          <input
            type="date"
            required
            value={dataPrimeiroDeposito}
            onChange={(e) => setDataPrimeiroDeposito(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
          />
          <span className="text-[10px] text-slate-400 block mt-1">
            Dia do depósito mensal
          </span>
        </div>
      </div>

      {/* Card Resumo do Porquinho em Tempo Real */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1.5">
        <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Simulação da sua Economia:</span>
        </div>
        {metaTotalCentavos > 0 ? (
          <div className="space-y-1">
            <p className="font-extrabold text-sm text-emerald-700 dark:text-emerald-300 leading-snug">
              {parcelasCentavos.length > 1 && parcelasCentavos[0] !== parcelasCentavos[parcelasCentavos.length - 1]
                ? `${meses} parcelas: 1ª de ${formatarCentavos(parcelasCentavos[0])} e ${meses - 1} de ${formatarCentavos(parcelasCentavos[1])} (meta total ${formatarCentavos(metaTotalCentavos)})`
                : `${meses} parcelas de ${formatarCentavos(valorParcelaBaseCentavos)} (meta total ${formatarCentavos(metaTotalCentavos)})`}
            </p>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
              Você guardará todo mês a partir de <strong>{formatarData(dataPrimeiroDeposito)}</strong> até atingir sua meta de <strong>{formatarCentavos(metaTotalCentavos)}</strong>.
            </p>
          </div>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">
            {modoValor === 'total'
              ? 'Digite a meta total acima para calcular o valor mensal a ser guardado.'
              : 'Digite o valor da parcela mensal acima para calcular a meta total.'}
          </p>
        )}
      </div>
    </ModalBase>
  );
};
