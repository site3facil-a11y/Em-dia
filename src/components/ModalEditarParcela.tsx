import React, { useState, useEffect, useCallback } from 'react';
import { X, Edit3, AlertCircle, Info, Calendar, Bell } from 'lucide-react';
import { Categoria, Parcela } from '../types';
import { EditarParcelaInput } from '../db/repository';
import { parseMoedaParaCentavos } from '../utils/finance';
import { ModalBase, ModalBotoesRodape } from './ModalBase';
import {
  temLembrete,
  definirLembrete,
} from '../utils/lembretes';

interface ModalEditarParcelaProps {
  aberto: boolean;
  onFechar: () => void;
  parcela: Parcela | null;
  categorias: Categoria[];
  onSalvar: (dados: EditarParcelaInput) => Promise<void>;
}

export const ModalEditarParcela: React.FC<ModalEditarParcelaProps> = ({
  aberto,
  onFechar,
  parcela,
  categorias,
  onSalvar,
}) => {
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState<number>(1);
  const [valorStr, setValorStr] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('Geral');
  const [observacoes, setObservacoes] = useState('');
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const [escopo, setEscopo] = useState<'apenas_esta' | 'esta_e_proximas'>('esta_e_proximas');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const resetParaParcela = useCallback((p: Parcela) => {
    setDescricao(p.conta_descricao || '');
    setCategoriaId(p.categoria_id || categorias[0]?.id || 1);
    // parcela.valor é armazenado em centavos inteiros (INTEGER)
    setValorStr((p.valor / 100).toFixed(2).replace('.', ','));
    setDataVencimento(p.data_vencimento);
    setFormaPagamento(p.forma_pagamento || 'Geral');
    setObservacoes(p.observacoes || '');
    setLembreteAtivo(temLembrete(p.conta_id));
    // Opção padrão na edição: sempre 'esta_e_proximas' (Item 1)
    setEscopo('esta_e_proximas');
    setErro(null);
    setSalvando(false);
  }, [categorias]);

  useEffect(() => {
    if (parcela && aberto) {
      resetParaParcela(parcela);
    }
  }, [parcela, aberto, resetParaParcela]);

  if (!aberto || !parcela) return null;

  const isPaga = parcela.status === 'pago';
  const isParceladaOuRecorrente =
    parcela.total_parcelas > 1 ||
    parcela.tipo_conta === 'parcelada' ||
    parcela.tipo_conta === 'recorrente';

  const valorCentavos = parseMoedaParaCentavos(valorStr);

  const sugestaoFormatada =
    valorStr.trim() !== '' &&
    !valorStr.includes(',') &&
    !valorStr.includes('.') &&
    valorCentavos > 0
      ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          valorCentavos / 100
        )
      : null;

  const handleValorBlur = () => {
    const limpo = valorStr.trim();
    if (!limpo) return;
    const centavos = parseMoedaParaCentavos(limpo);
    if (centavos > 0) {
      const reais = centavos / 100;
      setValorStr(
        new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(reais)
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      setErro('Informe a descrição da conta.');
      return;
    }
    if (valorCentavos <= 0) {
      setErro('O valor deve ser maior que zero.');
      return;
    }
    if (!dataVencimento) {
      setErro('Informe a data de vencimento.');
      return;
    }

    // Não permite alterar o valor se a parcela já estiver paga
    if (isPaga && Math.abs(valorCentavos - parcela.valor) > 0) {
      setErro('Não é permitido alterar o valor de uma parcela já paga sem antes desfazer o pagamento.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        parcelaId: parcela.id,
        descricao: descricao.trim(),
        categoria_id: categoriaId,
        valor: valorStr.trim(),
        data_vencimento: dataVencimento,
        forma_pagamento: formaPagamento,
        observacoes: observacoes.trim() || undefined,
        escopo: isParceladaOuRecorrente ? escopo : 'apenas_esta',
      });
      definirLembrete(parcela.conta_id, lembreteAtivo);
      if (parcela) resetParaParcela(parcela);
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao salvar alterações.');
    } finally {
      setSalvando(false);
    }
  };

  const handleFecharModal = () => {
    if (parcela) resetParaParcela(parcela);
    onFechar();
  };

  return (
    <ModalBase
      aberto={aberto}
      onFechar={handleFecharModal}
      icone={<Edit3 className="w-5 h-5" />}
      titulo="Editar Pagamento"
      subtitulo={
        parcela.total_parcelas > 1
          ? `Parcela ${parcela.numero_parcela} de ${parcela.total_parcelas}`
          : 'Conta de pagamento único'
      }
      asForm={true}
      onSubmit={handleSubmit}
      tamanhoMaximo="max-w-lg"
      rodape={
        <ModalBotoesRodape
          textoCancelar="Cancelar"
          textoConfirmar="Salvar Alterações"
          onCancelar={onFechar}
          salvando={salvando}
          corConfirmar="azul"
        />
      }
    >
      {erro && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

          {/* Aviso se a parcela estiver paga */}
          {isPaga && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Esta parcela já está <strong>PAGA</strong>. Para alterar o valor, desfaça o pagamento antes.
              </span>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Conta *
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Valor e Número de Parcelas (se parcelada) */}
          <div className={`grid ${(parcela.total_parcelas > 1 || parcela.tipo_conta === 'parcelada') ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3`}>
            {/* Valor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {(parcela.total_parcelas > 1 || parcela.tipo_conta === 'parcelada')
                  ? 'Valor da parcela (R$) *'
                  : 'Valor (R$) *'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  disabled={isPaga}
                  value={valorStr}
                  onChange={(e) => setValorStr(e.target.value)}
                  onBlur={handleValorBlur}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    isPaga ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''
                  }`}
                />
              </div>
              {sugestaoFormatada && !isPaga && (
                <button
                  type="button"
                  onClick={() => setValorStr(sugestaoFormatada)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer transition-all active:scale-95"
                  title={`Toque para preencher ${sugestaoFormatada}`}
                >
                  💡 Sugerir: R$ {sugestaoFormatada}
                </button>
              )}
            </div>

            {/* Número de Parcelas (preenchido com o valor atual) */}
            {(parcela.total_parcelas > 1 || parcela.tipo_conta === 'parcelada') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Número de Parcelas
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    readOnly
                    disabled
                    value={parcela.total_parcelas}
                    className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Parcela {parcela.numero_parcela}/{parcela.total_parcelas}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Data de Vencimento e Forma de Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data de Vencimento *
              </label>
              <input
                type="date"
                required
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Forma de Pagamento
              </label>
              <input
                type="text"
                placeholder="Ex: Geral, Cartão, Dinheiro..."
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Detalhes ou anotações..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
            />
          </div>

          {/* Opção de Lembrete Individual (Apenas para contas escolhidas) */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  lembreteAtivo
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                }`}
              >
                <Bell className={`w-4 h-4 ${lembreteAtivo ? 'fill-white' : ''}`} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                  Lembrar no dia do vencimento
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lembreteAtivo
                    ? '🔔 Esta conta emitirá um alerta no dia do vencimento.'
                    : 'Ative apenas se quiser receber lembrete desta conta.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setLembreteAtivo((prev) => !prev);
              }}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex items-center p-0.5 ${
                lembreteAtivo ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              role="switch"
              aria-checked={lembreteAtivo}
              aria-label="Ativar lembrete para esta conta"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  lembreteAtivo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Escopo da Alteração para Parceladas ou Recorrentes */}
          {isParceladaOuRecorrente && (
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2">
              <label className="block text-xs font-bold text-blue-950 dark:text-blue-200">
                Como deseja aplicar esta alteração?
              </label>

              <div className="space-y-1.5">
                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-900/60 cursor-pointer">
                  <input
                    type="radio"
                    name="escopo"
                    checked={escopo === 'apenas_esta'}
                    onChange={() => setEscopo('apenas_esta')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Aplicar apenas a esta parcela ({parcela.numero_parcela}/{parcela.total_parcelas})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      As outras parcelas da conta permanecerão inalteradas.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-white/60 dark:hover:bg-slate-900/60 cursor-pointer">
                  <input
                    type="radio"
                    name="escopo"
                    checked={escopo === 'esta_e_proximas'}
                    onChange={() => setEscopo('esta_e_proximas')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      Aplicar a esta e às próximas
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Atualiza o valor das parcelas futuras. <em>Parcelas já pagas nunca são alteradas.</em>
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

    </ModalBase>
  );
};
