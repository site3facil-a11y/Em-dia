import React, { useState } from 'react';
import {
  Search,
  Filter,
  Check,
  RotateCcw,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  ArrowUpDown,
  FileText,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  CreditCard,
} from 'lucide-react';
import { Parcela, Categoria, FiltrosParcela, StatusParcela } from '../types';
import { formatarMoeda, formatarData, getStatusInfo } from '../utils/formatters';

interface ContasViewProps {
  parcelas: Parcela[];
  categorias: Categoria[];
  filtros: FiltrosParcela;
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosParcela>>;
  onPagarParcela: (parcela: Parcela) => void;
  onDesfazerPagamento: (parcelaId: number) => void;
  onEditarConta: (contaId: number) => void;
  onExcluirConta: (contaId: number, descricao: string) => void;
  onVerDetalhesConta: (contaId: number) => void;
  carregando: boolean;
}

export const ContasView: React.FC<ContasViewProps> = ({
  parcelas,
  categorias,
  filtros,
  setFiltros,
  onPagarParcela,
  onDesfazerPagamento,
  onEditarConta,
  onExcluirConta,
  onVerDetalhesConta,
  carregando,
}) => {
  const [visaoModo, setVisaoModo] = useState<'parcelas' | 'agrupado'>('parcelas');

  // Cálculos do resumo da lista filtrada atual
  const totalFiltrado = parcelas.reduce((acc, p) => acc + p.valor, 0);
  const totalPagoFiltrado = parcelas
    .filter((p) => p.status === 'pago')
    .reduce((acc, p) => acc + (p.valor_pago || p.valor), 0);
  const totalPendenteFiltrado = parcelas
    .filter((p) => p.status === 'pendente')
    .reduce((acc, p) => acc + p.valor, 0);
  const totalAtrasadoFiltrado = parcelas
    .filter((p) => p.status === 'atrasado')
    .reduce((acc, p) => acc + p.valor, 0);

  const limparFiltros = () => {
    setFiltros({
      status: 'todos',
      mesAno: 'todos',
      categoria_id: 'todas',
      tipo: 'todos',
      busca: '',
      ordenacao: 'vencimento_asc',
    });
  };

  const temFiltroAtivo =
    filtros.status !== 'todos' ||
    filtros.mesAno !== 'todos' ||
    filtros.categoria_id !== 'todas' ||
    filtros.tipo !== 'todos' ||
    Boolean(filtros.busca);

  // Agrupamento por conta (para modo 'agrupado')
  const contasAgrupadas = React.useMemo(() => {
    const mapa = new Map<number, {
      conta_id: number;
      descricao: string;
      categoria_nome: string;
      categoria_cor: string;
      tipo_conta: string;
      forma_pagamento: string;
      parcelas: Parcela[];
      valor_total: number;
      total_pago: number;
      total_pendente: number;
      proximo_vencimento: string | null;
      todas_pagas: boolean;
    }>();

    for (const p of parcelas) {
      if (!mapa.has(p.conta_id)) {
        mapa.set(p.conta_id, {
          conta_id: p.conta_id,
          descricao: p.conta_descricao || 'Sem descrição',
          categoria_nome: p.categoria_nome || 'Sem categoria',
          categoria_cor: p.categoria_cor || '#3b82f6',
          tipo_conta: p.tipo_conta || 'unica',
          forma_pagamento: p.forma_pagamento || '-',
          parcelas: [],
          valor_total: 0,
          total_pago: 0,
          total_pendente: 0,
          proximo_vencimento: null,
          todas_pagas: true,
        });
      }
      const item = mapa.get(p.conta_id)!;
      item.parcelas.push(p);
      item.valor_total += p.valor;
      if (p.status === 'pago') {
        item.total_pago += p.valor_pago || p.valor;
      } else {
        item.todas_pagas = false;
        item.total_pendente += p.valor;
        if (!item.proximo_vencimento || p.data_vencimento < item.proximo_vencimento) {
          item.proximo_vencimento = p.data_vencimento;
        }
      }
    }

    return Array.from(mapa.values());
  }, [parcelas]);

  return (
    <div className="space-y-5">
      {/* Barra de Filtros e Busca */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por descrição, forma de pagamento, categoria..."
              value={filtros.busca || ''}
              onChange={(e) => setFiltros((prev) => ({ ...prev, busca: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filtros.busca && (
              <button
                onClick={() => setFiltros((prev) => ({ ...prev, busca: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle de Visualização (Parcelas vs Agrupado) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setVisaoModo('parcelas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                visaoModo === 'parcelas'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Por Parcelas ({parcelas.length})</span>
            </button>
            <button
              onClick={() => setVisaoModo('agrupado')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                visaoModo === 'agrupado'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Contas ({contasAgrupadas.length})</span>
            </button>
          </div>
        </div>

        {/* Filtros em Linha: Status pills, Categoria, Tipo, Ordenação */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg">
            {(
              [
                { id: 'todos', label: 'Todas' },
                { id: 'pendente', label: 'A Pagar' },
                { id: 'pago', label: 'Pagas' },
                { id: 'atrasado', label: 'Atrasadas' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setFiltros((prev) => ({ ...prev, status: st.id }))}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  filtros.status === st.id
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filtro Categoria */}
          <select
            value={filtros.categoria_id || 'todas'}
            onChange={(e) =>
              setFiltros((prev) => ({
                ...prev,
                categoria_id: e.target.value === 'todas' ? 'todas' : Number(e.target.value),
              }))
            }
            className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todas">Todas as Categorias</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome}
              </option>
            ))}
          </select>

          {/* Filtro Tipo */}
          <select
            value={filtros.tipo || 'todos'}
            onChange={(e) => setFiltros((prev) => ({ ...prev, tipo: e.target.value }))}
            className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="unica">Única</option>
            <option value="recorrente">Recorrente</option>
            <option value="parcelada">Parcelada</option>
          </select>

          {/* Ordenação */}
          <div className="flex items-center gap-1.5 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={filtros.ordenacao || 'vencimento_asc'}
              onChange={(e) =>
                setFiltros((prev) => ({
                  ...prev,
                  ordenacao: e.target.value as FiltrosParcela['ordenacao'],
                }))
              }
              className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="vencimento_asc">Vencimento (Mais Próximo)</option>
              <option value="vencimento_desc">Vencimento (Mais Distante)</option>
              <option value="valor_desc">Maior Valor</option>
              <option value="valor_asc">Menor Valor</option>
              <option value="descricao_asc">Descrição (A-Z)</option>
            </select>

            {temFiltroAtivo && (
              <button
                onClick={limparFiltros}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold px-2 py-1 flex items-center gap-1"
                title="Limpar todos os filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Faixa Resumo dos Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div>
          <span className="text-slate-400 font-medium block">Total Selecionado:</span>
          <span className="font-extrabold text-slate-900 dark:text-white font-mono text-sm">
            {formatarMoeda(totalFiltrado)}
          </span>
        </div>
        <div>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium block">Total Pago:</span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
            {formatarMoeda(totalPagoFiltrado)}
          </span>
        </div>
        <div>
          <span className="text-amber-600 dark:text-amber-400 font-medium block">A Pagar:</span>
          <span className="font-extrabold text-amber-600 dark:text-amber-400 font-mono text-sm">
            {formatarMoeda(totalPendenteFiltrado)}
          </span>
        </div>
        <div>
          <span className="text-rose-600 dark:text-rose-400 font-medium block">Em Atraso:</span>
          <span className="font-extrabold text-rose-600 dark:text-rose-400 font-mono text-sm">
            {formatarMoeda(totalAtrasadoFiltrado)}
          </span>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {carregando ? (
        <div className="py-16 text-center text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-semibold">Consultando SQLite...</p>
        </div>
      ) : parcelas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhuma conta encontrada
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Não encontramos registros com os filtros atuais. Experimente limpar os filtros ou cadastrar uma nova conta.
          </p>
          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      ) : visaoModo === 'parcelas' ? (
        /* VISÃO 1: LISTA DETALHADA DE PARCELAS */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Tabela para Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Descrição da Conta</th>
                  <th className="py-3.5 px-3">Categoria</th>
                  <th className="py-3.5 px-3">Parcela</th>
                  <th className="py-3.5 px-3">Vencimento</th>
                  <th className="py-3.5 px-3">Pagamento</th>
                  <th className="py-3.5 px-3">Valor</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {parcelas.map((p) => {
                  const statusInfo = getStatusInfo(p.status);
                  const isPago = p.status === 'pago';

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Descrição & Forma */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {p.conta_descricao}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{p.forma_pagamento}</span>
                          {p.observacoes && (
                            <span className="italic truncate max-w-[200px]" title={p.observacoes}>
                              • {p.observacoes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: p.categoria_cor || '#3b82f6' }}
                          />
                          {p.categoria_nome}
                        </span>
                      </td>

                      {/* Parcela */}
                      <td className="py-3 px-3">
                        {p.total_parcelas > 1 ? (
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            {p.numero_parcela} / {p.total_parcelas}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Única</span>
                        )}
                      </td>

                      {/* Vencimento */}
                      <td className="py-3 px-3">
                        <span className={`font-mono font-medium ${p.status === 'atrasado' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatarData(p.data_vencimento)}
                        </span>
                      </td>

                      {/* Data de Pagamento */}
                      <td className="py-3 px-3">
                        {p.data_pagamento ? (
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatarData(p.data_pagamento)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-3">
                        <div className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatarMoeda(p.valor)}
                        </div>
                        {isPago && p.valor_pago && p.valor_pago !== p.valor && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono">
                            Pago: {formatarMoeda(p.valor_pago)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${statusInfo.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPago ? (
                            <button
                              onClick={() => onDesfazerPagamento(p.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors"
                              title="Desfazer pagamento e voltar para pendente"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onPagarParcela(p)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                              title="Marcar como Pago"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>OK Pago</span>
                            </button>
                          )}

                          <button
                            onClick={() => onVerDetalhesConta(p.conta_id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                            title="Ver detalhes de todas as parcelas desta conta"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEditarConta(p.conta_id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar conta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onExcluirConta(p.conta_id, p.conta_descricao || 'esta conta')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                            title="Excluir conta completa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards para Mobile */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {parcelas.map((p) => {
              const statusInfo = getStatusInfo(p.status);
              const isPago = p.status === 'pago';

              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {p.conta_descricao}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: p.categoria_cor }}
                          />
                          {p.categoria_nome}
                        </span>
                        {p.total_parcelas > 1 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold">
                            {p.numero_parcela}/{p.total_parcelas}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono block">
                        {formatarMoeda(p.valor)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusInfo.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <span>Vencimento: <strong className="text-slate-800 dark:text-slate-200">{formatarData(p.data_vencimento)}</strong></span>
                    {p.data_pagamento && (
                      <span>Pago em: <strong className="text-emerald-600 dark:text-emerald-400">{formatarData(p.data_pagamento)}</strong></span>
                    )}
                  </div>

                  {/* Ações Mobile */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onVerDetalhesConta(p.conta_id)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-600"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditarConta(p.conta_id)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-600"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onExcluirConta(p.conta_id, p.conta_descricao || 'esta conta')}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isPago ? (
                      <button
                        onClick={() => onDesfazerPagamento(p.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-400 text-xs font-semibold"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Desfazer</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onPagarParcela(p)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-xs"
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
        </div>
      ) : (
        /* VISÃO 2: AGRUPADO POR CONTA */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contasAgrupadas.map((c) => {
            const totalParcelas = c.parcelas.length;
            const pagas = c.parcelas.filter((p) => p.status === 'pago').length;
            const pct = totalParcelas > 0 ? (pagas / totalParcelas) * 100 : 0;

            return (
              <div
                key={c.conta_id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">
                        {c.descricao}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: c.categoria_cor }}
                          />
                          {c.categoria_nome}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                          {c.tipo_conta}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono block">
                        {formatarMoeda(c.valor_total)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {pagas} de {totalParcelas} pagas
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>Progresso: {pct.toFixed(0)}%</span>
                      <span>Restante: {formatarMoeda(c.total_pendente)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Próximo Vencimento */}
                  {c.proximo_vencimento && (
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Próximo vencimento: <strong className="text-slate-800 dark:text-slate-200">{formatarData(c.proximo_vencimento)}</strong></span>
                    </div>
                  )}
                </div>

                {/* Rodapé com Ações */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {c.forma_pagamento}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onVerDetalhesConta(c.conta_id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold text-xs hover:bg-blue-100"
                    >
                      Ver Parcelas
                    </button>
                    <button
                      onClick={() => onEditarConta(c.conta_id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onExcluirConta(c.conta_id, c.descricao)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
