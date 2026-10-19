import React, { useState, useEffect } from 'react';
import { Edit2, AlertCircle } from 'lucide-react';
import { Categoria, Conta } from '../types';
import { ModalBase, ModalBotoesRodape } from './ModalBase';

interface ModalEditarContaProps {
  aberto: boolean;
  onFechar: () => void;
  conta: Conta | null;
  categorias: Categoria[];
  onSalvar: (contaId: number, dados: { descricao: string; categoria_id: number; forma_pagamento: string; observacoes?: string }) => Promise<void>;
}

const FORMAS_PAGAMENTO = [
  'Boleto Bancário',
  'Pix',
  'Cartão de Crédito',
  'Débito Automático',
  'Transferência Bancária',
  'Dinheiro',
  'Cheque',
  'Outro',
];

export const ModalEditarConta: React.FC<ModalEditarContaProps> = ({
  aberto,
  onFechar,
  conta,
  categorias,
  onSalvar,
}) => {
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState<number>(1);
  const [formaPagamento, setFormaPagamento] = useState('Boleto Bancário');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (conta) {
      setDescricao(conta.descricao);
      setCategoriaId(conta.categoria_id);
      setFormaPagamento(conta.forma_pagamento);
      setObservacoes(conta.observacoes || '');
      setErro(null);
    }
  }, [conta]);

  if (!aberto || !conta) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      setErro('A descrição não pode ser vazia.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(conta.id, {
        descricao,
        categoria_id: categoriaId,
        forma_pagamento: formaPagamento,
        observacoes,
      });
      onFechar();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao atualizar conta.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      icone={<Edit2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
      titulo="Editar Conta"
      subtitulo="Altere informações cadastrais da conta"
      asForm={true}
      onSubmit={handleSubmit}
      tamanhoMaximo="max-w-md"
      rodape={
        <ModalBotoesRodape
          textoCancelar="Cancelar"
          textoConfirmar="Salvar Alterações"
          onCancelar={onFechar}
          salvando={salvando}
          corConfirmar="laranja"
        />
      }
    >
      {erro && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição da Conta *
            </label>
            <input
              type="text"
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Categoria
            </label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Forma de Pagamento
            </label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observações
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

    </ModalBase>
  );
};
