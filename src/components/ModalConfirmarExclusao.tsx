import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda } from '../utils/formatters';

interface ModalConfirmarExclusaoProps {
  aberto: boolean;
  onFechar: () => void;
  parcela: Parcela | null;
  onConfirmar: (tipo: 'parcela' | 'conta') => Promise<void>;
}

export const ModalConfirmarExclusao: React.FC<ModalConfirmarExclusaoProps> = ({
  aberto,
  onFechar,
  parcela,
  onConfirmar,
}) => {
  const [opcao, setOpcao] = useState<'parcela' | 'conta'>('parcela');
  const [excluindo, setExcluindo] = useState(false);

  if (!aberto || !parcela) return null;

  const isParceladaOuRecorrente =
    parcela.total_parcelas > 1 ||
    parcela.tipo_conta === 'parcelada' ||
    parcela.tipo_conta === 'recorrente';

  const handleConfirmar = async () => {
    try {
      setExcluindo(true);
      await onConfirmar(isParceladaOuRecorrente ? opcao : 'conta');
      onFechar();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirmar Exclusão
              </h3>
              <p className="text-xs text-slate-500">
                {parcela.conta_descricao}
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="mt-4 space-y-3">
          {isParceladaOuRecorrente ? (
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-3">
                Esta conta possui <strong>{parcela.total_parcelas} parcelas</strong> cadastradas. O que você deseja excluir?
              </p>

              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="tipoExclusao"
                    checked={opcao === 'parcela'}
                    onChange={() => setOpcao('parcela')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900 dark:text-white">
                      Excluir só esta parcela
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Remove apenas a parcela {parcela.numero_parcela} de {parcela.total_parcelas} ({formatarMoeda(parcela.valor)}). As outras continuam ativas.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="tipoExclusao"
                    checked={opcao === 'conta'}
                    onChange={() => setOpcao('conta')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-rose-600 dark:text-rose-400">
                      Excluir a conta inteira (todas as parcelas)
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Remove a conta e todas as suas {parcela.total_parcelas} parcelas do banco SQLite.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Deseja excluir a despesa <strong>"{parcela.conta_descricao}"</strong> no valor de <strong>{formatarMoeda(parcela.valor)}</strong>?
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                  Você poderá desfazer esta ação nos próximos 5 segundos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={excluindo}
            onClick={handleConfirmar}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer transition-all"
          >
            {excluindo ? 'Excluindo...' : 'Sim, Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};
