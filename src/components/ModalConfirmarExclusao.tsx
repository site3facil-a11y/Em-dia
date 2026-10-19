import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Parcela } from '../types';
import { formatarMoeda } from '../utils/formatters';
import { ModalBase, ModalBotoesRodape } from './ModalBase';

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
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      icone={<Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
      titulo="Confirmar Exclusão"
      subtitulo={parcela.conta_descricao}
      tamanhoMaximo="max-w-md"
      rodape={
        <ModalBotoesRodape
          textoCancelar="Cancelar"
          textoConfirmar="Sim, Excluir"
          textoSaving="Excluindo..."
          onCancelar={onFechar}
          onConfirmar={handleConfirmar}
          salvando={excluindo}
          corConfirmar="vermelho"
          tipoConfirmar="button"
        />
      }
    >

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

    </ModalBase>
  );
};
