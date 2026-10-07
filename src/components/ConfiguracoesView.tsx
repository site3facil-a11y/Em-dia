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
} from 'lucide-react';
import {
  exportarArquivoSqlite,
  restaurarArquivoSqlite,
  validarCabecalhoSqlite,
  solicitarPersistenciaStorage,
  verificarPersistenciaStorage,
} from '../db/sqlite';
import { gerarCsvParcelas } from '../db/repository';
import { ModalAtualizacao, ReleaseInfo } from './ModalAtualizacao';
import { compararVersoes } from '../utils/versao';
import {
  obterContasComLembrete,
  testarNotificacaoLocal,
  verificarPermissaoNotificacao,
  solicitarPermissaoNotificacao,
} from '../utils/lembretes';

interface ConfiguracoesViewProps {
  darkMode?: boolean;
  setDarkMode?: (dark: boolean) => void;
  onDadosModificados: () => Promise<void>;
  totalContas?: number;
  totalParcelas?: number;
  totalCategorias?: number;
  onCriarPorquinho?: () => void;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  onDadosModificados,
  onCriarPorquinho,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [verificandoAtualizacao, setVerificandoAtualizacao] = useState(false);
  const [modalAtualizacaoAberto, setModalAtualizacaoAberto] = useState(false);
  const [releaseEncontrada, setReleaseEncontrada] = useState<ReleaseInfo | null>(null);
  const [testandoNotificacao, setTestandoNotificacao] = useState(false);
  const [permNotificacao, setPermNotificacao] = useState<NotificationPermission | 'unsupported'>(() =>
    verificarPermissaoNotificacao()
  );
  const [qtdLembretes, setQtdLembretes] = useState(() => obterContasComLembrete().length);
  const [persistenciaAtiva, setPersistenciaAtiva] = useState<boolean | null>(null);
  const [ajudaNotificacaoAberta, setAjudaNotificacaoAberta] = useState(false);
  const [modalRestaurarAberto, setModalRestaurarAberto] = useState(false);
  const [bufferRestauracao, setBufferRestauracao] = useState<ArrayBuffer | null>(null);
  const [nomeArquivoRestauracao, setNomeArquivoRestauracao] = useState<string>('');

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
      setPermNotificacao(verificarPermissaoNotificacao());
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

  const handleTestarNotificacao = async () => {
    try {
      setTestandoNotificacao(true);
      const perm = verificarPermissaoNotificacao();
      if (perm === 'unsupported') {
        setErro('Notificações locais não são suportadas neste navegador.');
        return;
      }
      if (perm !== 'granted') {
        const permitiu = await solicitarPermissaoNotificacao();
        setPermNotificacao(verificarPermissaoNotificacao());
        if (!permitiu) {
          setErro('Permissão de notificação não foi concedida.');
          return;
        }
      }
      const disparou = await testarNotificacaoLocal();
      setPermNotificacao(verificarPermissaoNotificacao());
      if (disparou) {
        notificarSucesso('Notificação de teste enviada com sucesso no seu dispositivo!');
      } else {
        setErro('Não foi possível emitir a notificação. Verifique se o navegador está bloqueando alertas.');
      }
    } catch (err: any) {
      setErro('Erro ao testar notificação: ' + err.message);
    } finally {
      setTestandoNotificacao(false);
    }
  };

  // Verificar Atualização no GitHub
  const handleVerificarAtualizacao = async () => {
    setErro(null);
    setMensagemSucesso(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErro('Sem conexão com a internet. Verifique sua rede e tente novamente.');
      return;
    }

    try {
      setVerificandoAtualizacao(true);
      const res = await fetch('https://api.github.com/repos/site3facil-a11y/Em-dia/releases/latest', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.status === 403 || res.status === 429) {
        setErro('Limite de consultas da API do GitHub excedido. Tente novamente mais tarde.');
        return;
      }

      if (res.status === 404) {
        setErro('Nenhuma versão encontrada ou repositório inacessível (Erro 404). Se o repositório for privado, mude a visibilidade para Público no GitHub para permitir atualizações.');
        return;
      }

      if (!res.ok) {
        setErro(`Não foi possível verificar atualizações no momento. (Erro HTTP ${res.status})`);
        return;
      }

      const releaseData: ReleaseInfo = await res.json();
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
      setErro('Não foi possível verificar atualizações. Verifique sua conexão com a internet.');
    } finally {
      setVerificandoAtualizacao(false);
    }
  };

  // Backup do Arquivo .sqlite
  const handleBackupSqlite = async () => {
    try {
      setProcessando(true);
      await exportarArquivoSqlite();
      notificarSucesso('Backup do banco SQLite (.sqlite) baixado com sucesso!');
    } catch (err: any) {
      setErro('Falha ao exportar banco de dados SQLite: ' + err.message);
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
      const buffer = await file.arrayBuffer();
      if (!validarCabecalhoSqlite(buffer)) {
        setErro('Arquivo inválido: o arquivo selecionado não é um banco de dados SQLite válido (cabeçalho SQLite format 3 ausente).');
        e.target.value = '';
        return;
      }
      setBufferRestauracao(buffer);
      setNomeArquivoRestauracao(file.name);
      setModalRestaurarAberto(true);
    } catch (err: any) {
      setErro('Erro ao ler arquivo: ' + err.message);
    } finally {
      setProcessando(false);
      e.target.value = '';
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
      setBufferRestauracao(null);
      notificarSucesso('Banco de dados SQLite restaurado com sucesso a partir do arquivo!');
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
      const csvContent = await gerarCsvParcelas();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const hoje = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_contas_parcelas_${hoje}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notificarSucesso('Relatório em formato CSV exportado com sucesso!');
    } catch (err: any) {
      setErro('Erro ao gerar CSV: ' + err.message);
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

      {/* Lembretes e Notificações no Dispositivo */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Lembretes de Vencimento
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {qtdLembretes} {qtdLembretes === 1 ? 'conta escolhida' : 'contas escolhidas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Apenas as contas que você marcar com o sininho (🔔) recebem aviso no dia do vencimento.
              </p>
            </div>
          </div>

          <button
            onClick={handleTestarNotificacao}
            disabled={testandoNotificacao}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Enviar uma notificação de teste para verificar se o aparelho recebe alertas"
          >
            <Bell className={`w-3.5 h-3.5 ${testandoNotificacao ? 'animate-bounce' : ''}`} />
            <span>{testandoNotificacao ? 'Testando...' : 'Testar no aparelho'}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400">Status das Notificações do Navegador:</span>
          <div className="flex items-center gap-2">
            <span
              className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                permNotificacao === 'granted'
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                  : permNotificacao === 'denied'
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300'
              }`}
            >
              {permNotificacao === 'granted'
                ? '✓ Permitido'
                : permNotificacao === 'denied'
                ? '✕ Bloqueado'
                : 'Não solicitado'}
            </span>
            <button
              type="button"
              onClick={() => setAjudaNotificacaoAberta(!ajudaNotificacaoAberta)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Informações sobre lembretes no navegador e aparelho"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Painel Explicativo Transparente sobre Notificações */}
        {ajudaNotificacaoAberta && (
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300 space-y-2 animate-in fade-in">
            <h5 className="font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Como funcionam os lembretes no seu aparelho</span>
            </h5>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
              <li><strong>Zero Spam:</strong> O app só notifica as contas individuais onde você tocou no ícone do sininho (🔔).</li>
              <li><strong>No iPhone (iOS):</strong> Para receber lembretes com a tela bloqueada ou fora do Safari, toque em <em>Compartilhar</em> e selecione <em>"Adicionar à Tela de Início"</em> (PWA).</li>
              <li><strong>No Android & Computador:</strong> Notificações usam o Service Worker nativo. Se estiver bloqueado, clique no ícone de cadeado na barra de endereços do navegador e permita as Notificações.</li>
              <li><strong>Ao Abrir o App:</strong> O Em Dia sempre confere automaticamente vencimentos de hoje ou atrasados assim que você acessa o sistema.</li>
            </ul>
          </div>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
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
