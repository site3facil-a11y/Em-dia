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
import { ModalEditarParcela } from './components/ModalEditarParcela';
import { ModalConfirmarExclusao } from './components/ModalConfirmarExclusao';
import { SnackbarDesfazer } from './components/SnackbarDesfazer';
import { ModalDetalhesConta } from './components/ModalDetalhesConta';
import { ModalConfirmacao } from './components/ModalConfirmacao';
import { SplashScreen } from './components/SplashScreen';
import { ModalLembretesHoje } from './components/ModalLembretesHoje';

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
  editarParcelaEConta,
  excluirParcelaIndividual,
  excluirContaInteiraTransacao,
  restaurarExclusao,
  EditarParcelaInput,
  DadosRestauracaoExclusao,
  registrarNotificacaoEnviadaNoBanco,
  verificarERepararParcelas,
  recalcularTotaisContas,
} from './db/repository';
import { getMesAnoAtual, dispararConfetes } from './utils/formatters';
import {
  obterParcelasLembreteHoje,
  reagendarNotificacoes,
  cancelarNotificacoesParcela,
  verificarNotificacaoResumoAtrasadas,
  inicializarOuvinteNotificacoes,
} from './utils/lembretes';
import { executarCopiaAutomaticaSemanalSeNecessario } from './utils/copiaAutomatica';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export default function App() {
  // Modo Escuro (segue o sistema por padrão, com opção manual)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('contas_dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
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

  // Splash Screen de Inicialização
  const [splashConcluida, setSplashConcluida] = useState<boolean>(false);

  // Dados do SQLite
  const [carregando, setCarregando] = useState<boolean>(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [parcelamentos, setParcelamentos] = useState<ParcelamentoItem[]>([]);
  const [metricas, setMetricas] = useState<DashboardMetrics | null>(null);

  // Modais com chaves de renovação de estado (Item 2)
  const [modalNovaContaKey, setModalNovaContaKey] = useState(0);
  const [modalNovaContaAberto, setModalNovaContaAberto] = useState(false);
  const abrirNovaConta = useCallback(() => {
    setModalNovaContaKey((k) => k + 1);
    setModalNovaContaAberto(true);
  }, []);
  const [modalPorquinhoAberto, setModalPorquinhoAberto] = useState(false);
  const [parcelaEmPagamento, setParcelaEmPagamento] = useState<Parcela | null>(null);
  const [contaEmEdicao, setContaEmEdicao] = useState<Conta | null>(null);
  const [parcelaEmEdicao, setParcelaEmEdicao] = useState<Parcela | null>(null);
  const [parcelaEmExclusao, setParcelaEmExclusao] = useState<Parcela | null>(null);
  const [dadosDesfazer, setDadosDesfazer] = useState<DadosRestauracaoExclusao | null>(null);
  const [snackbarDesfazerAberto, setSnackbarDesfazerAberto] = useState(false);
  const [detalhesContaParcelas, setDetalhesContaParcelas] = useState<Parcela[] | null>(null);
  const [exclusaoPendente, setExclusaoPendente] = useState<{ contaId: number; descricao: string } | null>(null);
  const [modalLembretesHojeAberto, setModalLembretesHojeAberto] = useState(false);
  const [parcelasLembreteHoje, setParcelasLembreteHoje] = useState<Parcela[]>([]);
  const lembretesAberturaExibidosRef = React.useRef(false);

  const carregarParcelamentos = useCallback(async () => {
    try {
      const parts = await listarParcelamentos();
      setParcelamentos(parts);
    } catch (error) {
      console.error('Erro ao consultar parcelamentos:', error);
    }
  }, []);

  const carregarDados = useCallback(async (atualizarParcelamentos = false) => {
    try {
      setCarregando(true);
      const promessas: [Promise<Categoria[]>, Promise<Parcela[]>, Promise<DashboardMetrics>, Promise<ParcelamentoItem[] | null>] = [
        listarCategorias(),
        listarParcelas({ mesAno: mesSelecionado, ordenacao: 'vencimento_asc' }),
        obterMetricasDashboard(mesSelecionado),
        atualizarParcelamentos || abaAtiva === 'parcelas' ? listarParcelamentos() : Promise.resolve(null),
      ];

      const [cats, parcs, mets, parts] = await Promise.all(promessas);

      setCategorias(cats);
      setParcelas(parcs);
      setMetricas(mets);
      if (parts) {
        setParcelamentos(parts);
      }
    } catch (error) {
      console.error('Erro ao consultar banco SQLite:', error);
    } finally {
      setCarregando(false);
    }
  }, [mesSelecionado, abaAtiva]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Ouvinte de toque na notificação: abre o app na tela Início, no mês da parcela (Item 7)
  useEffect(() => {
    const removerOuvinte = inicializarOuvinteNotificacoes((mesAno) => {
      setMesSelecionado(mesAno);
      setAbaAtiva('inicio');
    });
    return () => {
      removerOuvinte();
    };
  }, []);

  // Item 1: notifyAppReady() SOMENTE depois que o banco abriu, as migrações terminaram e a primeira tela renderizou
  useEffect(() => {
    if (splashConcluida && !carregando && metricas !== null) {
      try {
        localStorage.setItem('init_falhas', '0');
        localStorage.removeItem('ultima_atualizacao_falhou');
      } catch (err) {
        console.warn('Aviso ao zerar init_falhas no localStorage:', err);
      }

      try {
        if (Capacitor.isPluginAvailable('CapacitorUpdater')) {
          CapacitorUpdater.notifyAppReady().catch((err) => {
            console.warn('CapacitorUpdater.notifyAppReady aviso no App:', err);
          });
        }
      } catch (err) {
        console.warn('CapacitorUpdater.notifyAppReady erro:', err);
      }
    }
  }, [splashConcluida, carregando, metricas]);

  // Reagendamento ao voltar do segundo plano (appStateChange) ou tela visível (Item 3)
  useEffect(() => {
    let handleListener: any = null;
    try {
      if (Capacitor.isPluginAvailable('App')) {
        CapApp.addListener('appStateChange', (state) => {
          if (state.isActive) {
            reagendarNotificacoes().catch((err) => console.error('Erro ao reagendar no appStateChange:', err));
          }
        }).then((h) => {
          handleListener = h;
        }).catch((err) => console.error('Erro ao registrar listener appStateChange:', err));
      }
    } catch (err) {
      console.error('Erro na checagem do plugin App:', err);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        reagendarNotificacoes().catch((err) => console.error('Erro ao reagendar no visibilitychange:', err));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (handleListener?.remove) handleListener.remove();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Tarefas opcionais (reparar parcelas, recalcular totais, reagendar notificações, resumo de atrasadas)
  // rodam DEPOIS da primeira tela, em segundo plano, cada uma com try/catch e console.error (Item 4)
  useEffect(() => {
    if (!splashConcluida) return;

    const timer = setTimeout(() => {
      // 1. Recalcular totais de contas
      try {
        recalcularTotaisContas()
          .then((resumoTotais) => {
            if (resumoTotais.contasCorrigidas > 0) {
              carregarDados(true).catch((e) => console.error('Erro ao recarregar dados pós-recalculo:', e));
            }
          })
          .catch((err) => {
            console.error('Erro em segundo plano ao recalcular totais:', err);
          });
      } catch (err) {
        console.error('Exceção síncrona ao recalcular totais:', err);
      }

      // 2. Verificar e reparar parcelas
      try {
        verificarERepararParcelas()
          .then((resumoReparacao) => {
            if (resumoReparacao.parcelasGeradas > 0) {
              carregarDados(true).catch((e) => console.error('Erro ao recarregar dados pós-reparação:', e));
            }
          })
          .catch((err) => {
            console.error('Erro em segundo plano ao reparar parcelas:', err);
          });
      } catch (err) {
        console.error('Exceção síncrona ao reparar parcelas:', err);
      }

      // 3. Cópia automática semanal do banco de dados
      try {
        executarCopiaAutomaticaSemanalSeNecessario().catch((err) => {
          console.error('Erro em segundo plano na cópia automática semanal:', err);
        });
      } catch (err) {
        console.error('Exceção síncrona na cópia automática semanal:', err);
      }

      // 4. Lembretes e reagendamento de notificações
      try {
        if (!lembretesAberturaExibidosRef.current) {
          lembretesAberturaExibidosRef.current = true;
          listarParcelas({ status: 'pendente', mesAno: 'todos' })
            .then((todasPendentes) => {
              reagendarNotificacoes(todasPendentes).catch((err) => {
                console.error('Erro em segundo plano ao reagendar notificações:', err);
              });
              verificarNotificacaoResumoAtrasadas(todasPendentes).catch((err) => {
                console.error('Erro em segundo plano ao verificar resumo de atrasadas:', err);
              });

              const lembretes = obterParcelasLembreteHoje(todasPendentes);
              if (lembretes.length > 0) {
                setParcelasLembreteHoje(lembretes);
                setModalLembretesHojeAberto(true);
              }
            })
            .catch((err) => {
              console.error('Erro em segundo plano ao listar parcelas para lembretes:', err);
            });
        }
      } catch (err) {
        console.error('Exceção síncrona ao inicializar lembretes:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [splashConcluida, carregarDados]);

  useEffect(() => {
    if (abaAtiva === 'parcelas') {
      carregarParcelamentos();
    }
  }, [abaAtiva, carregarParcelamentos]);

  // Ações de Pagamento (Item 6: cancela as notificações da parcela ao marcar como paga e reagenda)
  const handlePagarParcelaRapido = async (parcela: Parcela) => {
    // Se for pagamento direto pelo círculo, quita na data de hoje e dispara confete
    const hoje = new Date().toISOString().slice(0, 10);
    await marcarParcelaComoPaga(parcela.id, hoje, parcela.valor);
    dispararConfetes();
    await cancelarNotificacoesParcela(parcela.id);
    await reagendarNotificacoes();
    await carregarDados();
  };

  const handlePagarParcelaLembrete = async (parcela: Parcela) => {
    const hoje = new Date().toISOString().slice(0, 10);
    await marcarParcelaComoPaga(parcela.id, hoje, parcela.valor);
    dispararConfetes();
    await cancelarNotificacoesParcela(parcela.id);
    await reagendarNotificacoes();
    await carregarDados();
    setParcelasLembreteHoje((prev) => prev.filter((p) => p.id !== parcela.id));
  };

  const handleConfirmarModalPagamento = async (parcelaId: number, dataPagamento: string, valorPago: number) => {
    await marcarParcelaComoPaga(parcelaId, dataPagamento, valorPago);
    await cancelarNotificacoesParcela(parcelaId);
    await reagendarNotificacoes();
    await carregarDados();
    if (detalhesContaParcelas) {
      const todas = await listarParcelas({ ordenacao: 'vencimento_asc' });
      setDetalhesContaParcelas(todas.filter((p) => p.conta_id === detalhesContaParcelas[0]?.conta_id));
    }
  };

  const handleDesfazerPagamento = async (parcelaId: number) => {
    await desfazerPagamentoParcela(parcelaId);
    await reagendarNotificacoes();
    await carregarDados();
    if (detalhesContaParcelas) {
      const todas = await listarParcelas({ ordenacao: 'vencimento_asc' });
      setDetalhesContaParcelas(todas.filter((p) => p.conta_id === detalhesContaParcelas[0]?.conta_id));
    }
  };

  const handleSalvarNovaConta = async (input: NovaContaInput): Promise<number> => {
    const id = await criarConta(input);
    await carregarDados(true);
    await reagendarNotificacoes();
    return id;
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
    await reagendarNotificacoes();
    await carregarDados();
  };

  const handleConfirmarExclusao = async () => {
    if (!exclusaoPendente) return;
    await excluirConta(exclusaoPendente.contaId);
    setExclusaoPendente(null);
    if (detalhesContaParcelas && detalhesContaParcelas[0]?.conta_id === exclusaoPendente.contaId) {
      setDetalhesContaParcelas(null);
    }
    await reagendarNotificacoes();
    await carregarDados();
  };

  // Ações de Edição e Exclusão Swipe/Menu de Parcelas
  const handleEditarParcela = (parcela: Parcela) => {
    setParcelaEmEdicao(parcela);
  };

  const handleSalvarEdicaoParcela = async (dados: EditarParcelaInput) => {
    await editarParcelaEConta(dados);
    await reagendarNotificacoes();
    await carregarDados(true);
    if (detalhesContaParcelas) {
      const todas = await listarParcelas({ ordenacao: 'vencimento_asc' });
      setDetalhesContaParcelas(todas.filter((p) => p.conta_id === detalhesContaParcelas[0]?.conta_id));
    }
  };

  const handleAbrirExclusaoParcela = (parcela: Parcela) => {
    setParcelaEmExclusao(parcela);
  };

  const handleConfirmarExclusaoParcela = async (tipo: 'parcela' | 'conta') => {
    if (!parcelaEmExclusao) return;
    let dadosRestauracao: DadosRestauracaoExclusao;
    if (tipo === 'parcela') {
      dadosRestauracao = await excluirParcelaIndividual(parcelaEmExclusao.id);
    } else {
      dadosRestauracao = await excluirContaInteiraTransacao(parcelaEmExclusao.conta_id);
    }
    setDadosDesfazer(dadosRestauracao);
    setSnackbarDesfazerAberto(true);
    setParcelaEmExclusao(null);
    await reagendarNotificacoes();
    await carregarDados();
  };

  const handleDesfazerExclusao = async () => {
    if (!dadosDesfazer) return;
    try {
      await restaurarExclusao(dadosDesfazer);
      setDadosDesfazer(null);
      setSnackbarDesfazerAberto(false);
      await reagendarNotificacoes();
      await carregarDados();
    } catch (err) {
      console.error('Erro ao desfazer exclusão:', err);
    }
  };

  const totalContas = React.useMemo(() => {
    return new Set(parcelas.map((p) => p.conta_id)).size;
  }, [parcelas]);

  return (
    <>
      {!splashConcluida && (
        <SplashScreen
          onPronto={() => {
            setSplashConcluida(true);
            carregarDados();
          }}
        />
      )}
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
          onNovaConta={abrirNovaConta}
        />

        {/* Conteúdo Dinâmico das Abas */}
        <main
          className="flex-1 p-4 overflow-y-auto"
          style={{
            paddingBottom: 'calc(64px + max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 12px) + 16px)',
          }}
        >
          {abaAtiva === 'inicio' && (
            <ListaMinhasDespesas
              parcelas={parcelas}
              metrics={metricas}
              mesSelecionado={mesSelecionado}
              setMesSelecionado={setMesSelecionado}
              onPagarParcela={handlePagarParcelaRapido}
              onDesfazerPagamento={handleDesfazerPagamento}
              onNovaConta={abrirNovaConta}
              onVerDetalhes={handleVerDetalhesConta}
              onEditarParcela={handleEditarParcela}
              onExcluirParcela={handleAbrirExclusaoParcela}
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
                onNovaConta={abrirNovaConta}
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
                onAbrirLembretesHoje={() => {
                  listarParcelas({ status: 'pendente', mesAno: 'todos' }).then((todasPendentes) => {
                    const lembretes = obterParcelasLembreteHoje(todasPendentes);
                    setParcelasLembreteHoje(lembretes);
                    setModalLembretesHojeAberto(true);
                  });
                }}
              />
            </div>
          )}
        </main>

        {/* Barra de Navegação Inferior (Fixa no rodapé do container) */}
        <BottomNavigation
          abaAtiva={abaAtiva}
          setAbaAtiva={setAbaAtiva}
          qtdAtrasadas={metricas?.qtdAtrasadas || 0}
          onNovaConta={abrirNovaConta}
          ocultar={
            modalNovaContaAberto ||
            modalPorquinhoAberto ||
            parcelaEmPagamento !== null ||
            contaEmEdicao !== null ||
            parcelaEmEdicao !== null ||
            parcelaEmExclusao !== null ||
            detalhesContaParcelas !== null ||
            exclusaoPendente !== null
          }
        />

        {/* Modais */}
        {modalNovaContaAberto && (
          <ModalNovaConta
            key={`nova-conta-${modalNovaContaKey}`}
            aberto={modalNovaContaAberto}
            onFechar={() => setModalNovaContaAberto(false)}
            categorias={categorias}
            onSalvar={handleSalvarNovaConta}
          />
        )}

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

        {parcelaEmEdicao && (
          <ModalEditarParcela
            key={`editar-parcela-${parcelaEmEdicao.id}`}
            aberto={parcelaEmEdicao !== null}
            onFechar={() => setParcelaEmEdicao(null)}
            parcela={parcelaEmEdicao}
            categorias={categorias}
            onSalvar={handleSalvarEdicaoParcela}
          />
        )}

        <ModalConfirmarExclusao
          aberto={parcelaEmExclusao !== null}
          onFechar={() => setParcelaEmExclusao(null)}
          parcela={parcelaEmExclusao}
          onConfirmar={handleConfirmarExclusaoParcela}
        />

        <SnackbarDesfazer
          visivel={snackbarDesfazerAberto}
          mensagem="Excluído."
          onDesfazer={handleDesfazerExclusao}
          onFechar={() => setSnackbarDesfazerAberto(false)}
          duracaoMs={5000}
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
    </>
  );
}
