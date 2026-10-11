import React, { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen as NativeSplashScreen } from '@capacitor/splash-screen';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import {
  RefreshCw,
  AlertCircle,
  Download,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  getDb,
  resetDbPromise,
  exportarBytesRecuperacao,
  recriarBancoDoZero,
} from '../db/sqlite';

interface SplashScreenProps {
  onPronto: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onPronto }) => {
  const [fading, setFading] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [animarEntrada, setAnimarEntrada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroStack, setErroStack] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmandoReset, setConfirmandoReset] = useState(false);
  const [executandoAcao, setExecutandoAcao] = useState(false);
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);

  // Garante que SplashScreen.hide() e notifyAppReady() sejam chamados imediatamente
  const garantirAppLiberado = useCallback(() => {
    try {
      if (Capacitor.isNativePlatform()) {
        NativeSplashScreen.hide().catch((err) => {
          console.warn('NativeSplashScreen.hide aviso:', err);
        });
      }
    } catch {
      // Ignora erro
    }
    try {
      CapacitorUpdater.notifyAppReady().catch((err) => {
        console.warn('CapacitorUpdater.notifyAppReady aviso:', err);
      });
    } catch {
      // Ignora erro
    }
  }, []);

  // Detecta preferência de movimento reduzido
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener?.('change', listener);
      return () => mq.removeEventListener?.('change', listener);
    } catch {
      // Ignora se não suportado
    }
  }, []);

  // Libera telas nativas logo na montagem
  useEffect(() => {
    garantirAppLiberado();
  }, [garantirAppLiberado]);

  // Aciona animação suave de entrada
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimarEntrada(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Inicializa o banco de dados SQLite com tempo mínimo de 1.2s e tratamento de erro
  const inicializarBanco = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setErroStack(null);
    setMsgSucesso(null);
    setConfirmandoReset(false);
    resetDbPromise();

    const inicio = Date.now();

    try {
      // Executa o carregamento com etapas isoladas e migrações seguras
      await getDb();

      // Sucesso: calcula tempo decorrido para evitar flash
      const tempoDecorrido = Date.now() - inicio;
      const tempoRestante = Math.max(0, 1200 - tempoDecorrido);

      setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setVisivel(false);
          onPronto();
        }, 300); // Fade out suave de 300ms
      }, tempoRestante);
    } catch (err: any) {
      console.error('Erro na inicialização do banco SQLite:', err);
      // Garante novamente a liberação nativa mesmo em caso de falha
      garantirAppLiberado();

      setCarregando(false);
      const mensagem = err?.message || 'Falha ao inicializar o banco de dados.';
      setErro(mensagem);

      // Extrai as primeiras linhas do stack trace para diagnóstico
      if (err?.detalheStack || err?.stack) {
        const stackCompleto = String(err.detalheStack || err.stack);
        const primeirasLinhas = stackCompleto.split('\n').slice(0, 5).join('\n');
        setErroStack(primeirasLinhas);
      } else {
        setErroStack(null);
      }
    }
  }, [garantirAppLiberado, onPronto]);

  useEffect(() => {
    inicializarBanco();
  }, [inicializarBanco]);

  // Copia o texto do erro para a área de transferência
  const handleCopiarErro = () => {
    const textoCompleto = `${erro || ''}\n\n${erroStack || ''}`.trim();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textoCompleto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  // Exporta os bytes atuais do SQLite mesmo com falha na inicialização
  const handleExportarRecuperacao = async () => {
    try {
      setExecutandoAcao(true);
      const fileName = await exportarBytesRecuperacao();
      setMsgSucesso(`Arquivo de recuperação "${fileName}" exportado com sucesso!`);
      setTimeout(() => setMsgSucesso(null), 4000);
    } catch (expErr: any) {
      alert('Não foi possível exportar: ' + (expErr?.message || 'Arquivo não encontrado.'));
    } finally {
      setExecutandoAcao(false);
    }
  };

  // Recria o banco de dados limpo do zero após confirmação
  const handleConfirmarRecriar = async () => {
    try {
      setExecutandoAcao(true);
      setConfirmandoReset(false);
      await recriarBancoDoZero();
      setFading(true);
      setTimeout(() => {
        setVisivel(false);
        onPronto();
      }, 300);
    } catch (recriaErr: any) {
      console.error('Falha ao recriar banco do zero:', recriaErr);
      setErro('Erro ao recriar banco: ' + (recriaErr?.message || 'Tente reiniciar o app.'));
      setExecutandoAcao(false);
    }
  };

  if (!visivel) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 24px)',
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 sm:p-8 bg-gradient-to-br from-[#1E3A8A] to-[#1E1B4B] text-white select-none overflow-y-auto ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${reducedMotion ? '' : 'transition-opacity duration-300'}`}
    >
      {/* Top spacer */}
      <div className="w-full h-4" />

      {/* Conteúdo Central */}
      <div className="flex flex-col items-center text-center max-w-md w-full px-2 my-auto">
        {/* Ícone da Lua Crescente vetorial */}
        <div
          className={`relative ${
            reducedMotion
              ? 'opacity-100 scale-100'
              : animarEntrada
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-90'
          } ${reducedMotion ? '' : 'transition-all duration-700 ease-out'}`}
        >
          <img
            src="/icon.svg"
            alt="Em Dia - Ícone"
            className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] rounded-3xl shadow-2xl drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)]"
            width="120"
            height="120"
          />
        </div>

        {/* Título e Subtítulo */}
        <div
          className={`mt-5 space-y-1 ${
            reducedMotion
              ? 'opacity-100 translate-y-0'
              : animarEntrada
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          } ${reducedMotion ? '' : 'transition-all duration-700 delay-150 ease-out'}`}
        >
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Em Dia
          </h1>
          <p className="text-sm font-medium text-sky-200 tracking-wide">
            Suas contas sob controle
          </p>
        </div>

        {/* Notificação de Sucesso */}
        {msgSucesso && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold animate-in fade-in">
            {msgSucesso}
          </div>
        )}

        {/* Painel de Diagnóstico e Recuperação em caso de Erro */}
        {erro && (
          <div className="mt-6 w-full p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-100 text-xs text-left space-y-3 shadow-2xl backdrop-blur-md animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>Não foi possível carregar o banco de dados</span>
            </div>

            {/* Mensagem e Etapa de Falha */}
            <div className="text-[12px] text-rose-100 font-semibold leading-relaxed">
              {erro}
            </div>

            {/* Bloco de Código com o Erro Real e Stack Copiável */}
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-black/60 border border-rose-900/60 font-mono text-[10.5px] text-rose-300 overflow-x-auto max-h-36 select-all whitespace-pre leading-snug">
                {erro}
                {erroStack ? `\n\nStack trace:\n${erroStack}` : ''}
              </div>

              <button
                type="button"
                onClick={handleCopiarErro}
                className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-rose-200 text-[11px] font-semibold transition-all cursor-pointer"
                title="Copiar mensagem e stack"
              >
                {copiado ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Erro copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-rose-300" />
                    <span>Copiar erro completo</span>
                  </>
                )}
              </button>
            </div>

            {/* Confirmação de Reset Limpo */}
            {confirmandoReset ? (
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 space-y-2 text-center">
                <div className="flex items-center justify-center gap-1.5 font-bold text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Confirmação: Recriar banco do zero?</span>
                </div>
                <p className="text-[11px] text-amber-200 leading-normal">
                  Esta ação apagará permanentemente as contas e categorias salvas neste aparelho. Faça a exportação antes se desejar guardar uma cópia.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmandoReset(false)}
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={executandoAcao}
                    onClick={handleConfirmarRecriar}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Sim, apagar e recriar
                  </button>
                </div>
              </div>
            ) : (
              /* Três Botões de Ação para Recuperação sem Perder Dados */
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {/* 1. Tentar Novamente */}
                <button
                  type="button"
                  disabled={executandoAcao}
                  onClick={() => inicializarBanco()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-950" />
                  <span>Tentar novamente</span>
                </button>

                {/* 2. Exportar banco atual (.sqlite) */}
                <button
                  type="button"
                  disabled={executandoAcao}
                  onClick={handleExportarRecuperacao}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  title="Baixa cópia do banco para não perder os dados"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar .sqlite</span>
                </button>

                {/* 3. Recriar banco do zero */}
                <button
                  type="button"
                  disabled={executandoAcao}
                  onClick={() => setConfirmandoReset(true)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 active:scale-95 text-rose-200 font-semibold text-xs transition-all cursor-pointer"
                  title="Apaga os dados corrompidos e recria o banco limpo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Recriar do zero</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Indicador de Carregamento Discreto (3 pontinhos pulsando) */}
      <div className="flex flex-col items-center gap-2 pb-4 min-h-[36px]">
        {carregando && !erro && (
          <div className="flex items-center gap-2" aria-label="Carregando banco de dados...">
            <span
              className={`w-2.5 h-2.5 rounded-full bg-sky-300/80 ${
                reducedMotion ? '' : 'animate-bounce [animation-delay:-0.3s]'
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full bg-sky-300/80 ${
                reducedMotion ? '' : 'animate-bounce [animation-delay:-0.15s]'
              }`}
            />
            <span
              className={`w-2.5 h-2.5 rounded-full bg-sky-300/80 ${
                reducedMotion ? '' : 'animate-bounce'
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );
};
