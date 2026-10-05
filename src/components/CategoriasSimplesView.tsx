import React, { useState } from 'react';
import { Tags, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { Categoria } from '../types';

interface CategoriasSimplesViewProps {
  categorias: Categoria[];
  onCriarCategoria: (nome: string, cor: string) => Promise<void>;
  onAtualizarCategoria: (id: number, nome: string, cor: string) => Promise<void>;
  onExcluirCategoria: (id: number) => Promise<{ success: boolean; message?: string }>;
  carregando: boolean;
}

const CORES_PALETA = [
  '#1e3a8a', // Azul Marinho
  '#2563eb', // Azul Royal
  '#0284c7', // Azul Claro
  '#0d9488', // Teal
  '#10b981', // Verde
  '#f59e0b', // Âmbar
  '#f97316', // Laranja
  '#ec4899', // Rosa
  '#7c3aed', // Roxo
  '#475569', // Slate
];

export const CategoriasSimplesView: React.FC<CategoriasSimplesViewProps> = ({
  categorias,
  onCriarCategoria,
  onAtualizarCategoria,
  onExcluirCategoria,
  carregando,
}) => {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#1e3a8a');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrirCriar = () => {
    setEditando(null);
    setNome('');
    setCor(CORES_PALETA[Math.floor(Math.random() * CORES_PALETA.length)]);
    setErro(null);
    setModalAberto(true);
  };

  const abrirEditar = (cat: Categoria) => {
    setEditando(cat);
    setNome(cat.nome);
    setCor(cat.cor);
    setErro(null);
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Informe o nome da categoria.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      if (editando) {
        await onAtualizarCategoria(editando.id, nome, cor);
      } else {
        await onCriarCategoria(nome, cor);
      }
      setModalAberto(false);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao salvar categoria.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (cat: Categoria) => {
    if (!confirm(`Deseja excluir a categoria "${cat.nome}"?`)) return;
    const res = await onExcluirCategoria(cat.id);
    if (!res.success && res.message) {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Tags className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          <span>Categorias ({categorias.length})</span>
        </h3>

        <button
          onClick={abrirCriar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {carregando ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          Carregando categorias...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {categorias.map((cat) => (
            <div
              key={cat.id}
              className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: cat.cor }}
                >
                  <Tags className="w-4 h-4" />
                </span>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {cat.nome}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => abrirEditar(cat)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleExcluir(cat)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Categoria */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {editando ? 'Editar Categoria' : 'Nova Categoria'}
              </h4>
              <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="mt-4 space-y-3">
              {erro && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{erro}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Farmácia, Viagens, Lanches..."
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cor
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CORES_PALETA.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCor(c)}
                      className={`h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        cor === c ? 'ring-2 ring-offset-2 ring-blue-600 scale-105' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {cor === c && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
