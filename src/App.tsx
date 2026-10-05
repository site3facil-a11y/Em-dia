/**
 * Aplicativo Minhas Despesas - Controle Simples de Contas com SQLite
 * Inspirado no design direto e funcional do app mobile "Minhas Despesas"
 */
import React, { useState, useEffect, useCallback } from 'react';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavigation } from './components/BottomNavigation';
import { ListaMinhasDespesas } from './components/ListaMinhasDespesas';
import { GraficosSimplesView } from './components/GraficosSimplesView';
import { ParcelamentosView } from './components/ParcelamentosView';
import { CategoriasSimplesView } from './components/CategoriasSimplesView';
import { ConfiguracoesView } from './components/ConfiguracoesView';

import { ModalNovaConta } from './components/ModalNovaConta';
import { ModalCriarPorquinho } from './components/ModalCriarPorquinho';
import { ModalPagarParcela } from './components/ModalPagarParcela';
import { ModalEditarConta } from './components/ModalEditarConta';
import { ModalDetalhesConta } from './components/ModalDetalhesConta';
import { ModalConfirmacao } from './components/ModalConfirmacao';

import {
  Categoria,
  Conta,
  Parcela,
  ParcelamentoItem,
  DashboardMetrics,
} from './types';
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  criarConta,
  atualizarConta,
  excluirConta,
  listarParcelas,
  marcarParcelaComoPaga,
  desfazerPagamentoParcela,
  listarParcelamentos,
  obterMetricasDashboard,
  NovaContaInput,
} from './db/repository';
import { getMesAnoAtual, dispararConfetes } from './utils/formatters';

export default function App() {
  // Modo Escuro
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('contas_dark_mode');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('contas_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  // Aba selecionada na barra inferior: 'inicio' | 'graficos' | 'parcelas' | 'categorias' | 'ajustes'
  const [abaAtiva, setAbaAtiva] = useState<string>('inicio');
  const [mesSelecionado, setMesSelecionado] = useState<string>(getMesAnoAtual());

  // Dados do SQLite
  const [carregando, setCarregando] = useState<boolean>(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [parcelamentos, setParcelamentos] = useState<ParcelamentoItem[]>([]);
  const [metricas, setMetricas] = useState<DashboardMetrics | null>(null);

  // Modais
  const [modalNovaContaAberto, setModalNovaContaAberto] = useState(false);
  const [modalPorquinhoAberto, setModalPorquinhoAberto] = useState(false);
  const [parcelaEmPagamento, setParcelaEmPagamento] = useState<Parcela | null>(null);
  const [contaEmEdicao, setContaEmEdicao] = useState<Conta | null>(null);
  const [detalhesContaParcelas, setDetalhesContaParcelas] = useState<Parcela[] | null>(null);
  const [exclusaoPendente, setExclusaoPendente] = useState<{ contaId: number; descricao: string } | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      const [cats, parcs, parts, mets] = await Promise.all([
        listarCategorias(),
        listarParcelas({ mesAno: mesSelecionado, ordenacao: 'vencimento_asc' }),
        listarParcelamentos(),
        obterMetricasDashboard(mesSelecionado),
      ]);

      setCategorias(cats);
      setParcelas(parcs);
      setParcelamentos(parts);
      setMetricas(mets);
    } catch (error) {
      console.error('Erro ao consultar banco SQLite:', error);
    } finally {
      setCarregando(false);
    }
  }, [mesSelecionado]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Ações de Pagamento
  const handlePagarParcelaRapido = async (parcela: Parcela) => {
    // Se for pagamento direto pelo círculo, quita na data de hoje e dispara confete
    const hoje = new Date().toISOString().slice(0, 10);
    await marcarParcelaComoPaga(parcela.id, hoje, parcela.valor);
    dispararConfetes();
    await carregarDados();
  };

  const handleConfirmarModalPagamento = async (parcelaId: number, dataPagamento: string, valorPago: number) => {
    await marcarParcelaComoPaga(parcelaId, dataPagamento, valorPago);
    await carregarDados();
    if (detalhesContaParcelas) {
      const todas = await listarParcelas({ ordenacao: 'vencimento_asc' });
      setDetalhesContaParcelas(todas.filter((p) => p.conta_id === detalhesContaParcelas[0]?.conta_id));
    }
  };

  const handleDesfazerPagamento = async (parcelaId: number) => {
    await desfazerPagamentoParcela(parcelaId);
    await carregarDados();
    if (detalhesContaParcelas) {
      const todas = await listarParcelas({ ordenacao: 'vencimento_asc' });
      setDetalhesContaParcelas(todas.filter((p) => p.conta_id === detalhesContaParcelas[0]?.conta_id));
    }
  };

  const handleSalvarNovaConta = async (input: NovaContaInput) => {
    await criarConta(input);
    await carregarDados();
  };

  const handleVerDetalhesConta = async (contaId: number) => {
    const todas = await listarParcelas({ ordenacao: 'vencimento_asc' });
    setDetalhesContaParcelas(todas.filter((p) => p.conta_id === contaId));
  };

  const handleEditarConta = (contaId: number) => {
    const parc = parcelas.find((p) => p.conta_id === contaId);
    if (parc) {
      setContaEmEdicao({
        id: parc.conta_id,
        descricao: parc.conta_descricao || '',
        categoria_id: parc.categoria_id || 1,
        forma_pagamento: parc.forma_pagamento || '',
        observacoes: parc.observacoes || '',
        valor_total: parc.valor,
        tipo: parc.tipo_conta || 'unica',
        data_criacao: '',
      });
    }
  };

  const handleSalvarEdicaoConta = async (
    contaId: number,
    dados: { descricao: string; categoria_id: number; forma_pagamento: string; observacoes?: string }
  ) => {
    await atualizarConta(contaId, dados);
    await carregarDados();
  };

  const handleConfirmarExclusao = async () => {
    if (!exclusaoPendente) return;
    await excluirConta(exclusaoPendente.contaId);
    setExclusaoPendente(null);
    if (detalhesContaParcelas && detalhesContaParcelas[0]?.conta_id === exclusaoPendente.contaId) {
      setDetalhesContaParcelas(null);
    }
    await carregarDados();
  };

  const totalContas = React.useMemo(() => {
    return new Set(parcelas.map((p) => p.conta_id)).size;
  }, [parcelas]);

  return (
    <div
      className={`min-h-screen ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      } flex flex-col justify-center items-center p-0 sm:py-6 transition-colors selection:bg-blue-600 selection:text-white`}
    >
      {/* Container estilo aplicativo móvel */}
      <div
        className={`w-full max-w-md min-h-screen sm:min-h-[820px] ${
          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/80'
        } sm:rounded-[36px] shadow-2xl border flex flex-col overflow-hidden relative transition-colors`}
      >
        {/* Barra Superior Simples */}
        <TopAppBar
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onNovaConta={() => setModalNovaContaAberto(true)}
        />

        {/* Conteúdo Dinâmico das Abas */}
        <main className="flex-1 p-4 overflow-y-auto">
          {abaAtiva === 'inicio' && (
            <ListaMinhasDespesas
              parcelas={parcelas}
              metrics={metricas}
              mesSelecionado={mesSelecionado}
              setMesSelecionado={setMesSelecionado}
              onPagarParcela={handlePagarParcelaRapido}
              onDesfazerPagamento={handleDesfazerPagamento}
              onNovaConta={() => setModalNovaContaAberto(true)}
              onVerDetalhes={handleVerDetalhesConta}
              onExcluir={(id, desc) => setExclusaoPendente({ contaId: id, descricao: desc })}
              carregando={carregando}
            />
          )}

          {abaAtiva === 'graficos' && (
            <GraficosSimplesView
              metrics={metricas}
              mesSelecionado={mesSelecionado}
              setMesSelecionado={setMesSelecionado}
              carregando={carregando}
            />
          )}

          {abaAtiva === 'parcelas' && (
            <div className="space-y-4 pb-20">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Contas Parceladas & Financiamentos
              </h3>
              <ParcelamentosView
                itens={parcelamentos}
                onPagarParcela={(p) => setParcelaEmPagamento(p)}
                onDesfazerPagamento={handleDesfazerPagamento}
                onNovaConta={() => setModalNovaContaAberto(true)}
                carregando={carregando}
              />
            </div>
          )}

          {abaAtiva === 'categorias' && (
            <CategoriasSimplesView
              categorias={categorias}
              onCriarCategoria={async (n, c) => {
                await criarCategoria(n, c);
                await carregarDados();
              }}
              onAtualizarCategoria={async (id, n, c) => {
                await atualizarCategoria(id, n, c);
                await carregarDados();
              }}
              onExcluirCategoria={async (id) => {
                const res = await excluirCategoria(id);
                if (res.success) await carregarDados();
                return res;
              }}
              carregando={carregando}
            />
          )}

          {abaAtiva === 'ajustes' && (
            <div className="space-y-4 pb-20">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Configurações & Backup SQLite
              </h3>
              <ConfiguracoesView
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                onDadosModificados={carregarDados}
                totalContas={totalContas}
                totalParcelas={parcelas.length}
                totalCategorias={categorias.length}
                onCriarPorquinho={() => setModalPorquinhoAberto(true)}
              />
            </div>
          )}
        </main>

        {/* Barra de Navegação Inferior (Fixa no rodapé do container) */}
        <BottomNavigation
          abaAtiva={abaAtiva}
          setAbaAtiva={setAbaAtiva}
          qtdAtrasadas={metricas?.qtdAtrasadas || 0}
          onNovaConta={() => setModalNovaContaAberto(true)}
        />

        {/* Modais */}
        <ModalNovaConta
          aberto={modalNovaContaAberto}
          onFechar={() => setModalNovaContaAberto(false)}
          categorias={categorias}
          onSalvar={handleSalvarNovaConta}
        />

        <ModalCriarPorquinho
          aberto={modalPorquinhoAberto}
          onFechar={() => setModalPorquinhoAberto(false)}
          categorias={categorias}
          onSalvar={handleSalvarNovaConta}
        />

        <ModalPagarParcela
          parcela={parcelaEmPagamento}
          onFechar={() => setParcelaEmPagamento(null)}
          onConfirmar={handleConfirmarModalPagamento}
        />

        <ModalEditarConta
          aberto={contaEmEdicao !== null}
          onFechar={() => setContaEmEdicao(null)}
          conta={contaEmEdicao}
          categorias={categorias}
          onSalvar={handleSalvarEdicaoConta}
        />

        <ModalDetalhesConta
          aberto={detalhesContaParcelas !== null}
          onFechar={() => setDetalhesContaParcelas(null)}
          parcelas={detalhesContaParcelas || []}
          onPagarParcela={handlePagarParcelaRapido}
          onDesfazerPagamento={handleDesfazerPagamento}
        />

        <ModalConfirmacao
          aberto={exclusaoPendente !== null}
          titulo="Excluir Conta"
          mensagem={`Deseja excluir "${exclusaoPendente?.descricao}" e suas parcelas do SQLite?`}
          textoConfirmar="Sim, Excluir"
          textoCancelar="Cancelar"
          perigo={true}
          onConfirmar={handleConfirmarExclusao}
          onCancelar={() => setExclusaoPendente(null)}
        />
      </div>
    </div>
  );
}
