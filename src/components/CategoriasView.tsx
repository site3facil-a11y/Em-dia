import React, { useState } from 'react';
import { Tags, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { Categoria } from '../types';

interface CategoriasViewProps {
  categorias: Categoria[];
  onCriarCategoria: (nome: string, cor: string) => Promise<void>;
  onAtualizarCategoria: (id: number, nome: string, cor: string) => Promise<void>;
  onExcluirCategoria: (id: number) => Promise<{ success: boolean; message?: string }>;
  carregando: boolean;
}

const CORES_PALETA = [
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Âmbar
  '#ec4899', // Rosa
  '#8b5cf6', // Roxo
  '#06b6d4', // Ciano
  '#ef4444', // Vermelho
  '#6366f1', // Índigo
  '#14b8a6', // Teal
  '#f97316', // Laranja
  '#84cc16', // Lima
  '#64748b', // Slate
];

export const CategoriasView: React.FC<CategoriasViewProps> = ({
  categorias,
  onCriarCategoria,
  onAtualizarCategoria,
  onExcluirCategoria,
  carregando,
}) => {
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#3b82f6');
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrirNovo = () => {
    setEditandoCategoria(null);
    setNome('');
    setCor(CORES_PALETA[Math.floor(Math.random() * CORES_PALETA.length)]);
    setErroMsg(null);
    setModalAberto(true);
  };

  const abrirEdicao = (cat: Categoria) => {
    setEditandoCategoria(cat);
    setNome(cat.nome);
    setCor(cat.cor);
    setErroMsg(null);
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErroMsg('Por favor, informe o nome da categoria.');
      return;
    }

    setSalvando(true);
    setErroMsg(null);
    try {
      if (editandoCategoria) {
        await onAtualizarCategoria(editandoCategoria.id, nome, cor);
      } else {
        await onCriarCategoria(nome, cor);
      }
      setModalAberto(false);
    } catch (err: any) {
      setErroMsg(err?.message || 'Erro ao salvar categoria no banco SQLite.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (cat: Categoria) => {
    if (!confirm(`Deseja realmente excluir a categoria "${cat.nome}"?`)) return;
    const res = await onExcluirCategoria(cat.id);
    if (!res.success && res.message) {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Tags className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Categorias de Despesas
            </h3>
            <p className="text-xs text-slate-500">
              Organize seus gastos por centros de custo e personalize as cores dos relatórios
            </p>
          </div>
        </div>

        <button
          onClick={abrirNovo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Grade de Categorias */}
      {carregando ? (
        <div className="py-16 text-center text-slate-500 text-xs">
          Carregando categorias...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {categorias.map((cat) => (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <span
                  className="w-5 h-5 rounded-lg flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: cat.cor }}
                />
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {cat.nome}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {cat.cor}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => abrirEdicao(cat)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60"
                  title="Editar Categoria"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleExcluir(cat)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                  title="Excluir Categoria"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação / Edição de Categoria */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tags className="w-4 h-4 text-blue-600" />
                <span>{editandoCategoria ? 'Editar Categoria' : 'Nova Categoria'}</span>
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="mt-4 space-y-4">
              {erroMsg && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{erroMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Investimentos, Pet Shop, Streaming..."
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Cor de Identificação
                </label>
                {/* Paleta pré-definida */}
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {CORES_PALETA.map((corItem) => (
                    <button
                      type="button"
                      key={corItem}
                      onClick={() => setCor(corItem)}
                      className={`h-8 rounded-lg flex items-center justify-center transition-all ${
                        cor === corItem ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-105' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: corItem }}
                    >
                      {cor === corItem && <Check className="w-4 h-4 text-white drop-shadow-sm" />}
                    </button>
                  ))}
                </div>

                {/* Input color livre */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="w-28 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
