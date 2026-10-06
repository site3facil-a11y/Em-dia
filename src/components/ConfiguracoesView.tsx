import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  HardDrive,
  Info,
  CheckCircle,
  PiggyBank,
} from 'lucide-react';
import { exportarArquivoSqlite, restaurarArquivoSqlite } from '../db/sqlite';
import { gerarCsvParcelas } from '../db/repository';
import { ModalAtualizacao, ReleaseInfo } from './ModalAtualizacao';
import { compararVersoes } from '../utils/versao';

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

  const notificarSucesso = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => setMensagemSucesso(null), 4000);
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

  // Restaurar Arquivo .sqlite
  const handleRestaurarSqlite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('ATENÇÃO: Restaurar um arquivo .sqlite irá substituir todos os dados atuais. Deseja continuar?')) {
      e.target.value = '';
      return;
    }

    try {
      setProcessando(true);
      const buffer = await file.arrayBuffer();
      await restaurarArquivoSqlite(buffer);
      await onDadosModificados();
      notificarSucesso('Banco de dados SQLite restaurado com sucesso a partir do arquivo!');
    } catch (err: any) {
      setErro('Erro ao restaurar banco: ' + (err.message || 'Arquivo inválido.'));
    } finally {
      setProcessando(false);
      e.target.value = '';
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
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-semibold text-xs transition-colors"
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
              onChange={handleRestaurarSqlite}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processando}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 font-semibold text-xs transition-colors"
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
              Gera um arquivo compatível com Excel e Google Sheets com todas as parcelas, valores e status.
            </p>
          </div>
          <button
            onClick={handleExportarCsv}
            disabled={processando}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors flex-shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

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
