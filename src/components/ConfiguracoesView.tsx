import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  HardDrive,
  Info,
  CheckCircle,
  PiggyBank,
  Bell,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Wrench,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  exportarArquivoSqlite,
  restaurarArquivoSqlite,
  validarCabecalhoSqlite,
  solicitarPersistenciaStorage,
  verificarPersistenciaStorage,
} from '../db/sqlite';
import {
  gerarCsvParcelas,
  verificarERepararParcelas,
  ResumoReparacaoParcelas,
} from '../db/repository';
import { ModalAtualizacao, ReleaseInfo } from './ModalAtualizacao';
import { compararVersoes } from '../utils/versao';
import { obterContasComLembrete } from '../utils/lembretes';
import { exportarOuCompartilharArquivo } from '../utils/fileExport';
import {
  obterInfoUltimaCopiaAutomatica,
  carregarBufferUltimaCopiaAutomatica,
  InfoCopiaAutomatica,
} from '../utils/copiaAutomatica';

interface ConfiguracoesViewProps {
  darkMode?: boolean;
  setDarkMode?: (dark: boolean) => void;
  onDadosModificados: () => Promise<void>;
  totalContas?: number;
  totalParcelas?: number;
  totalCategorias?: number;
  onCriarPorquinho?: () => void;
  onAbrirLembretesHoje?: () => void;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  onDadosModificados,
  onCriarPorquinho,
  onAbrirLembretesHoje,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [verificandoAtualizacao, setVerificandoAtualizacao] = useState(false);
  const [modalAtualizacaoAberto, setModalAtualizacaoAberto] = useState(false);
  const [releaseEncontrada, setReleaseEncontrada] = useState<ReleaseInfo | null>(null);
  const [reparandoParcelas, setReparandoParcelas] = useState(false);
  const [resumoReparacao, setResumoReparacao] = useState<ResumoReparacaoParcelas | null>(null);
  const [modalResumoReparacaoAberto, setModalResumoReparacaoAberto] = useState(false);
  const [qtdLembretes, setQtdLembretes] = useState(() => obterContasComLembrete().length);
  const [persistenciaAtiva, setPersistenciaAtiva] = useState<boolean | null>(null);
  const [modalRestaurarAberto, setModalRestaurarAberto] = useState(false);
  const [bufferRestauracao, setBufferRestauracao] = useState<ArrayBuffer | null>(null);
  const [nomeArquivoRestauracao, setNomeArquivoRestauracao] = useState<string>('');
  const [infoUltimaCopia, setInfoUltimaCopia] = useState<InfoCopiaAutomatica | null>(null);

  useEffect(() => {
    obterInfoUltimaCopiaAutomatica().then(setInfoUltimaCopia);
  }, []);

  const [diasDesdeUltimoBackup, setDiasDesdeUltimoBackup] = useState<number | null>(() => {
    try {
      const ult = localStorage.getItem('em_dia_ultimo_backup_sqlite');
      if (!ult) return 999;
      const dataUlt = new Date(ult);
      const diffMs = Date.now() - dataUlt.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  });

  useEffect(() => {
    verificarPersistenciaStorage().then(setPersistenciaAtiva);
  }, []);

  const handleSolicitarPersistencia = async () => {
    try {
      setProcessando(true);
      const concedida = await solicitarPersistenciaStorage();
      setPersistenciaAtiva(concedida);
      if (concedida) {
        notificarSucesso('Persistência durável ativada com sucesso pelo navegador!');
      } else {
        setErro('O navegador não concedeu persistência durável no momento.');
      }
    } catch (err: any) {
      setErro('Erro ao solicitar persistência: ' + err.message);
    } finally {
      setProcessando(false);
    }
  };

  useEffect(() => {
    const sync = () => {
      setQtdLembretes(obterContasComLembrete().length);
    };
    window.addEventListener('em-dia-lembretes-alterados', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('em-dia-lembretes-alterados', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const notificarSucesso = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => setMensagemSucesso(null), 4000);
  };

  // Verificar e Reparar Parcelas Faltantes (Item 4)
  const handleVerificarEReparar = async () => {
    try {
      setReparandoParcelas(true);
      setErro(null);
      const resumo = await verificarERepararParcelas();
      setResumoReparacao(resumo);
      setModalResumoReparacaoAberto(true);
      await onDadosModificados();
      if (resumo.parcelasGeradas > 0) {
        notificarSucesso(`Reparação concluída: ${resumo.parcelasGeradas} parcelas faltantes geradas com sucesso!`);
      } else {
        notificarSucesso('Todas as contas e parcelas estão corretas e completas.');
      }
    } catch (err: any) {
      setErro('Erro ao verificar e reparar parcelas: ' + (err?.message || err));
    } finally {
      setReparandoParcelas(false);
    }
  };

  // Verificar Atualização no GitHub com Mensagens Separadas (Item 7)
  const handleVerificarAtualizacao = async () => {
    setErro(null);
    setMensagemSucesso(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErro('Sem conexão com a internet');
      return;
    }

    try {
      setVerificandoAtualizacao(true);
      const res = await fetch('https://api.github.com/repos/site3facil-a11y/Em-dia/releases/latest', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.status === 404) {
        setErro('Ainda não há nenhuma versão publicada no GitHub');
        return;
      }

      if (res.status === 403 || res.status === 429) {
        setErro('Limite de consultas do GitHub atingido');
        return;
      }

      if (!res.ok) {
        setErro(`Erro ao consultar GitHub (HTTP ${res.status})`);
        return;
      }

      const releaseData: ReleaseInfo = await res.json();
      const temDistZip = releaseData.assets?.some((a: any) => a.name === 'dist.zip');
      if (!temDistZip) {
        setErro('A versão publicada não tem o arquivo dist.zip');
        return;
      }

      const tag = releaseData.tag_name || '';
      const comparacao = compararVersoes(tag, __APP_VERSION__);
      if (comparacao > 0) {
        setReleaseEncontrada(releaseData);
        setModalAtualizacaoAberto(true);
      } else {
        notificarSucesso('Você já está na versão mais recente');
      }
    } catch (err: any) {
      console.error('Erro ao verificar atualização no GitHub:', err);
      setErro('Sem conexão com a internet');
    } finally {
      setVerificandoAtualizacao(false);
    }
  };

  // Backup do Arquivo .sqlite
  const handleBackupSqlite = async () => {
    try {
      setProcessando(true);
      setErro(null);
      const fileName = await exportarArquivoSqlite();
      notificarSucesso(`Backup "${fileName}" concluído com sucesso!`);
    } catch (err: any) {
      setErro('Falha ao exportar banco de dados SQLite: ' + (err?.message || 'Erro desconhecido.'));
    } finally {
      setProcessando(false);
    }
  };

  // Restaurar Arquivo .sqlite com validação e confirmação segura
  const handleSelecionarArquivoSqlite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessando(true);
      setErro(null);
      const buffer = await file.arrayBuffer();
      if (!validarCabecalhoSqlite(buffer)) {
        setErro('Arquivo inválido: o cabeçalho "SQLite format 3" não foi encontrado no arquivo selecionado.');
        e.target.value = '';
        return;
      }
      setBufferRestauracao(buffer);
      setNomeArquivoRestauracao(file.name);
      setModalRestaurarAberto(true);
    } catch (err: any) {
      setErro('Erro ao ler arquivo: ' + (err?.message || 'Falha ao processar arquivo.'));
    } finally {
      setProcessando(false);
      e.target.value = '';
    }
  };

  // Restaurar última cópia automática semanal
  const handleRestaurarUltimaCopiaAutomatica = async () => {
    try {
      setProcessando(true);
      setErro(null);
      const copia = await carregarBufferUltimaCopiaAutomatica();
      if (!copia) {
        setErro('Nenhuma cópia automática foi encontrada no armazenamento.');
        return;
      }

      if (!validarCabecalhoSqlite(copia.buffer)) {
        setErro('Arquivo de cópia automática inválido: o cabeçalho "SQLite format 3" não foi encontrado.');
        return;
      }

      setBufferRestauracao(copia.buffer);
      setNomeArquivoRestauracao(copia.nome);
      setModalRestaurarAberto(true);
    } catch (err: any) {
      setErro('Falha ao obter cópia automática: ' + (err?.message || 'Erro ao carregar cópia.'));
    } finally {
      setProcessando(false);
    }
  };

  const handleExecutarRestauracao = async (fazerBackupAntes: boolean) => {
    if (!bufferRestauracao) return;
    try {
      setProcessando(true);
      setModalRestaurarAberto(false);
      if (fazerBackupAntes) {
        await exportarArquivoSqlite();
      }
      await restaurarArquivoSqlite(bufferRestauracao);
      await onDadosModificados();
      const nomeRestaurado = nomeArquivoRestauracao;
      setBufferRestauracao(null);
      setNomeArquivoRestauracao('');
      notificarSucesso(`Banco de dados SQLite restaurado com sucesso a partir de "${nomeRestaurado}"!`);
      obterInfoUltimaCopiaAutomatica().then(setInfoUltimaCopia);
    } catch (err: any) {
      setErro('Erro ao restaurar banco: ' + (err.message || 'Arquivo inválido.'));
    } finally {
      setProcessando(false);
    }
  };

  // Exportar Relatório CSV
  const handleExportarCsv = async () => {
    try {
      setProcessando(true);
      setErro(null);
      const csvContent = await gerarCsvParcelas();
      const hoje = new Date().toISOString().slice(0, 10);
      const fileName = `relatorio_contas_parcelas_${hoje}.csv`;

      await exportarOuCompartilharArquivo({
        fileName,
        data: csvContent,
        mimeType: 'text/csv;charset=utf-8;',
        dialogTitle: 'Salvar backup',
        title: fileName,
      });

      notificarSucesso(`Relatório "${fileName}" exportado com sucesso!`);
    } catch (err: any) {
      setErro('Falha ao exportar relatório CSV: ' + (err?.message || 'Erro desconhecido.'));
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Aviso de Lembrete de Backup (+30 dias) */}
      {diasDesdeUltimoBackup !== null && diasDesdeUltimoBackup >= 30 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-medium flex items-start gap-3 shadow-xs animate-in fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h5 className="font-bold text-amber-950 dark:text-amber-100">
              Lembrete de Backup Seguro
            </h5>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
              Faz mais de 30 dias desde o seu último backup exportado. Baixe uma cópia do seu arquivo SQLite para manter seus lançamentos protegidos caso limpe o navegador.
            </p>
            <button
              onClick={handleBackupSqlite}
              disabled={processando}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Cópia Agora (.sqlite)</span>
            </button>
          </div>
        </div>
      )}

      {/* Notificações de Sucesso ou Erro */}
      {mensagemSucesso && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {erro && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
          <Info className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{erro}</span>
        </div>
      )}

      {/* Atualização do App pelo GitHub */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Versão {__APP_VERSION__}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Atualização
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Canal oficial de atualizações do aplicativo
              </p>
            </div>
          </div>

          <button
            onClick={handleVerificarAtualizacao}
            disabled={verificandoAtualizacao}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Consultar novas versões no GitHub"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verificandoAtualizacao ? 'animate-spin' : ''}`} />
            <span>{verificandoAtualizacao ? 'Verificando...' : 'Verificar atualização'}</span>
          </button>
        </div>
      </div>

      {/* Card Porquinho de Economias (Metas Parceladas) */}
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 p-5 rounded-3xl border border-emerald-800/40 text-white shadow-lg space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
              <PiggyBank className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Porquinho de Economias</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  Metas
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 mt-1">
                Poupe dinheiro parcelado mês a mês para si mesmo (ex: meta de R$ 1.200 em 12 parcelas de R$ 100/mês).
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onCriarPorquinho}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <PiggyBank className="w-4 h-4" />
            <span>+ Criar Porquinho (Meta Parcelada)</span>
          </button>
        </div>
      </div>

      {/* Lembretes no Aplicativo (Sininho 🔔) */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Bell className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Lembretes de Vencimento (Sininho 🔔)
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {qtdLembretes} {qtdLembretes === 1 ? 'conta marcada' : 'contas marcadas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Exibido automaticamente dentro do app na abertura para contas que vencem hoje ou estão atrasadas.
              </p>
            </div>
          </div>

          {onAbrirLembretesHoje && (
            <button
              onClick={onAbrirLembretesHoje}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              title="Visualizar lembretes do dia"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Ver Lembretes do Dia</span>
            </button>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-bold">
            ℹ️ Lembrete interno do aplicativo
          </p>
          <p className="text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-300">
            Este lembrete é exibido <strong>dentro do próprio aplicativo na abertura</strong> quando existirem contas que vencem na data ou estão em atraso. <strong>Não é uma notificação do sistema operacional</strong> nem requer permissões do dispositivo.
          </p>
        </div>
      </div>

      {/* Integridade & Reparação de Parcelas (Item 4) */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Verificar e Reparar Parcelas
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Para cada conta com menos parcelas do que total_parcelas, gera as que faltam, sem duplicar nem alterar as pagas.
              </p>
            </div>
          </div>

          <button
            onClick={handleVerificarEReparar}
            disabled={reparandoParcelas}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reparandoParcelas ? 'animate-spin' : ''}`} />
            <span>{reparandoParcelas ? 'Verificando...' : 'Verificar e reparar parcelas'}</span>
          </button>
        </div>
      </div>

      {/* Persistência de Armazenamento Local (Storage Persistence) */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-200 dark:border-teal-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Proteção Durável do Navegador
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Garante que o navegador não apague o banco IndexedDB durante limpezas automáticas de memória.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                persistenciaAtiva
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {persistenciaAtiva ? '✓ Protegido' : 'Padrão'}
            </span>
            {!persistenciaAtiva && (
              <button
                onClick={handleSolicitarPersistencia}
                disabled={processando}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Ativar Proteção
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Backup & Restauração do Arquivo .sqlite */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span>Backup e Restauração de Arquivo SQLite</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Faça download do banco de dados relacional completo em formato binário padrão <strong className="font-mono text-slate-700 dark:text-slate-300">.sqlite</strong> (compatível com SQLite Browser, DBeaver e Python) ou restaure uma cópia prévia.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Baixar .sqlite */}
          <button
            onClick={handleBackupSqlite}
            disabled={processando}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-semibold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Arquivo SQLite (.sqlite)</span>
          </button>

          {/* Restaurar .sqlite */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".sqlite,.db"
              onChange={handleSelecionarArquivoSqlite}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processando}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 font-semibold text-xs transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Restaurar Arquivo .sqlite</span>
            </button>
          </div>
        </div>

        {/* Restaurar Última Cópia Automática (Item 5) */}
        <div>
          <button
            onClick={handleRestaurarUltimaCopiaAutomatica}
            disabled={processando}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Restaurar última cópia automática</span>
            {infoUltimaCopia && (
              <span className="text-[11px] font-normal text-indigo-600/80 dark:text-indigo-400/80">
                ({infoUltimaCopia.dataFormatada})
              </span>
            )}
          </button>
        </div>

        {/* Exportação CSV */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Exportar para Planilha (CSV)
            </h5>
            <p className="text-[11px] text-slate-500">
              Gera um arquivo compatível com Excel (BOM UTF-8 e separador ;) com todas as parcelas e valores.
            </p>
          </div>
          <button
            onClick={handleExportarCsv}
            disabled={processando}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex-shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Modal de Confirmação Segura de Restauração SQLite */}
      {modalRestaurarAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Substituir Banco de Dados?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  A restauração do arquivo <strong>{nomeArquivoRestauracao}</strong> irá <strong>substituir todos os lançamentos atuais</strong> do app pelos registros deste backup.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Deseja salvar uma cópia de segurança do estado atual antes de substituir?
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleExecutarRestauracao(true)}
                disabled={processando}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Backup Atual e Restaurar</span>
              </button>

              <button
                type="button"
                onClick={() => handleExecutarRestauracao(false)}
                disabled={processando}
                className="w-full py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs transition-colors cursor-pointer"
              >
                Substituir Sem Baixar Cópia
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalRestaurarAberto(false);
                  setBufferRestauracao(null);
                }}
                disabled={processando}
                className="w-full py-2 px-4 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumo da Verificação e Reparação de Parcelas (Item 4) */}
      {modalResumoReparacaoAberto && resumoReparacao && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 16px)',
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Resultado da Reparação
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verificação de integridade das parcelas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalResumoReparacaoAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-bold">Verificadas</span>
                <span className="text-base font-mono font-extrabold text-slate-900 dark:text-white">
                  {resumoReparacao.contasVerificadas}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900">
                <span className="text-[10px] text-indigo-500 dark:text-indigo-300 block font-bold">Reparadas</span>
                <span className="text-base font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                  {resumoReparacao.contasReparadas}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-300 block font-bold">Geradas</span>
                <span className="text-base font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                  {resumoReparacao.parcelasGeradas}
                </span>
              </div>
            </div>

            {resumoReparacao.detalhes.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Contas que receberam parcelas faltantes:
                </span>
                {resumoReparacao.detalhes.map((d) => (
                  <div
                    key={d.contaId}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs flex justify-between items-center"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {d.descricao}
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                      +{d.geradas} parcelas ({d.totalEsperado}x)
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Nenhuma inconsistência encontrada. Todas as contas possuem o número correto de parcelas!</span>
              </div>
            )}

            <button
              onClick={() => setModalResumoReparacaoAberto(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {/* Modal de Atualização do GitHub */}
      <ModalAtualizacao
        aberto={modalAtualizacaoAberto}
        onFechar={() => setModalAtualizacaoAberto(false)}
        release={releaseEncontrada}
        versaoAtual={__APP_VERSION__}
      />
    </div>
  );
};
