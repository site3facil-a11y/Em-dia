import React, { useRef, useState } from 'react';
import {
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Database,
  Moon,
  Sun,
  ShieldCheck,
  HardDrive,
  Info,
  CheckCircle,
  Smartphone,
  Copy,
  Check,
  Terminal,
  PiggyBank,
  Plus,
} from 'lucide-react';
import { exportarArquivoSqlite, restaurarArquivoSqlite, popularDadosIniciais, limparBancoDeDados } from '../db/sqlite';
import { gerarCsvParcelas } from '../db/repository';

interface ConfiguracoesViewProps {
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onDadosModificados: () => Promise<void>;
  totalContas: number;
  totalParcelas: number;
  totalCategorias: number;
  onCriarPorquinho?: () => void;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  darkMode,
  setDarkMode,
  onDadosModificados,
  totalContas,
  totalParcelas,
  totalCategorias,
  onCriarPorquinho,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [copiadoComandos, setCopiadoComandos] = useState(false);

  const notificarSucesso = (msg: string) => {
    setMensagemSucesso(msg);
    setTimeout(() => setMensagemSucesso(null), 4000);
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

  // Gerar dados de exemplo
  const handleSeed = async () => {
    if (!confirm('Deseja recriar as 6 categorias e 12 contas de exemplo? Os dados existentes serão substituídos pelos exemplos.')) {
      return;
    }

    try {
      setProcessando(true);
      await popularDadosIniciais();
      await onDadosModificados();
      notificarSucesso('Dados de exemplo gerados com sucesso!');
    } catch (err: any) {
      setErro('Erro ao gerar dados de exemplo: ' + err.message);
    } finally {
      setProcessando(false);
    }
  };

  // Limpar Banco de Dados
  const handleLimparBanco = async () => {
    if (!confirm('PERIGO: Esta ação apagará permanentemente todas as contas, parcelas e categorias do banco SQLite. Tem certeza?')) {
      return;
    }
    if (!confirm('CONFIRMAÇÃO FINAL: Deseja mesmo esvaziar o banco de dados?')) {
      return;
    }

    try {
      setProcessando(true);
      await limparBancoDeDados();
      await onDadosModificados();
      notificarSucesso('Banco de dados SQLite foi limpo com sucesso.');
    } catch (err: any) {
      setErro('Erro ao limpar banco: ' + err.message);
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

      {/* Estatísticas e Status do SQLite */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Status do Banco de Dados SQLite (sql.js)
            </h3>
            <p className="text-xs text-slate-500">
              Mecanismo relacional SQLite em WebAssembly com persistência em IndexedDB nativo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Total de Contas</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
              {totalContas}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Total de Parcelas</span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {totalParcelas}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Categorias</span>
            <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
              {totalCategorias}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 font-semibold block">Persistência</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
              <ShieldCheck className="w-4 h-4" />
              IndexedDB OK
            </span>
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

      {/* Opção 2: Gerar um arquivo .apk ou publicar na Google Play Store com Capacitor */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Opção 2: Gerar APK ou Publicar na Google Play Store (Capacitor)
              </h4>
              <p className="text-xs text-slate-500">
                Transforme este código em um aplicativo nativo Android (.apk / .aab)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const comandos = `npm install @capacitor/core @capacitor/cli @capacitor/android\nnpm run build\nnpx cap add android\nnpx cap sync\nnpx cap open android`;
              navigator.clipboard?.writeText(comandos);
              setCopiadoComandos(true);
              setTimeout(() => setCopiadoComandos(false), 3000);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {copiadoComandos ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Comandos Copiados!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copiar Todos os Comandos</span>
              </>
            )}
          </button>
        </div>

        {/* Bloco de Comandos do Terminal */}
        <div className="relative bg-slate-950 rounded-xl p-3.5 text-xs font-mono text-emerald-400 border border-slate-800 space-y-1.5 overflow-x-auto">
          <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5 pb-1 border-b border-slate-800">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Terminal (na pasta raiz do projeto baixado):</span>
          </div>
          <div><span className="text-slate-500"># 1. Instalar dependências do Capacitor</span></div>
          <div className="text-slate-100">npm install @capacitor/core @capacitor/cli @capacitor/android</div>
          <div className="pt-1"><span className="text-slate-500"># 2. Compilar aplicação e inicializar o projeto Android nativo</span></div>
          <div className="text-slate-100">npm run build && npx cap add android && npx cap sync</div>
          <div className="pt-1"><span className="text-slate-500"># 3. Abrir o projeto diretamente no Android Studio</span></div>
          <div className="text-slate-100">npx cap open android</div>
        </div>

        {/* Passos Detalhados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1">
            <strong className="text-blue-700 dark:text-blue-400 font-bold block">
              1. Para Gerar o Arquivo .apk (Instalação Direta)
            </strong>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
              No menu do Android Studio, clique em:
              <br />
              <code className="text-slate-800 dark:text-slate-200 font-bold bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">
                Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)
              </code>
              <br />
              O Android Studio gerará o arquivo <code className="font-mono text-emerald-600 dark:text-emerald-400">app-debug.apk</code>. Você pode transferi-lo via cabo USB, WhatsApp ou Google Drive para qualquer celular Android e instalar na hora!
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1">
            <strong className="text-emerald-700 dark:text-emerald-400 font-bold block">
              2. Para Publicar na Google Play Store (.aab)
            </strong>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
              No menu do Android Studio, clique em:
              <br />
              <code className="text-slate-800 dark:text-slate-200 font-bold bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">
                Build &gt; Generate Signed Bundle / APK
              </code>
              <br />
              Selecione <strong>Android App Bundle (.aab)</strong>, assine com seu certificado e faça upload diretamente no Google Play Console.
            </p>
          </div>
        </div>

        {/* Recursos Prontos */}
        <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="block font-bold">Configuração do Capacitor já pronta no projeto:</strong>
            <p className="text-[11.5px] leading-relaxed text-blue-800 dark:text-blue-300">
              O arquivo <code className="font-mono bg-blue-100 dark:bg-blue-900/80 px-1 rounded">capacitor.config.json</code> já está configurado com o ID <code className="font-mono">com.emdia.app</code>. O banco de dados SQLite (sql.js) e IndexedDB funcionam 100% nativos e offline no APK, sem exigir conexão com a internet.
            </p>
          </div>
        </div>
      </div>

      {/* Preferências Visuais (Tema) */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>Tema da Interface</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Alterne entre modo claro para ambientes iluminados e modo escuro para menor fadiga visual.
          </p>
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-950 dark:bg-blue-600 text-white font-bold text-xs hover:opacity-90 active:scale-95 cursor-pointer shadow-xs transition-all"
        >
          {darkMode ? '☀️ Mudar para Modo Claro' : '🌙 Mudar para Modo Escuro'}
        </button>
      </div>

      {/* Zona de Gerenciamento & Manutenção do Banco */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Manutenção de Dados (Seed & Reset)</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Ações para demonstração ou redefinição total dos registros.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Botão Gerar Dados de Exemplo */}
          <button
            onClick={handleSeed}
            disabled={processando}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold text-xs transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Gerar Dados de Exemplo</span>
          </button>

          {/* Botão Limpar Banco */}
          <button
            onClick={handleLimparBanco}
            disabled={processando}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-semibold text-xs transition-colors sm:ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Banco de Dados</span>
          </button>
        </div>
      </div>
    </div>
  );
};
