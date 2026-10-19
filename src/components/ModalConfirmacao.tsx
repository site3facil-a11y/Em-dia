import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalBase, ModalBotoesRodape } from './ModalBase';

interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  perigo?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export const ModalConfirmacao: React.FC<ModalConfirmacaoProps> = ({
  aberto,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  perigo = false,
  onConfirmar,
  onCancelar,
}) => {
  if (!aberto) return null;

  return (
    <ModalBase
      aberto={aberto}
      onFechar={onCancelar}
      icone={
        <AlertTriangle
          className={`w-5 h-5 ${
            perigo
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        />
      }
      titulo={titulo}
      tamanhoMaximo="max-w-md"
      rodape={
        <ModalBotoesRodape
          textoCancelar={textoCancelar}
          textoConfirmar={textoConfirmar}
          onCancelar={onCancelar}
          onConfirmar={onConfirmar}
          corConfirmar={perigo ? 'vermelho' : 'azul'}
          tipoConfirmar="button"
        />
      }
    >
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        {mensagem}
      </p>
    </ModalBase>
  );
};
