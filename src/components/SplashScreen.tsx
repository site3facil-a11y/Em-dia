import React, { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen as NativeSplashScreen } from '@capacitor/splash-screen';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { getDb } from '../db/sqlite';

interface SplashScreenProps {
  onPronto: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onPronto }) => {
  const [fading, setFading] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [animarEntrada, setAnimarEntrada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detecta preferência de movimento reduzido
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mq.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener?.('change', listener);
      return () => mq.removeEventListener?.('change', listener);
    } catch {
      // Ignora se não for suportado
    }
  }, []);

  // Esconde a splash nativa do Android imediatamente ao montar
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      NativeSplashScreen.hide().catch((err) => {
        console.warn('Erro ao ocultar SplashScreen nativa:', err);
      });
    }
  }, []);

  // Aciona animação suave de entrada logo após montar
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimarEntrada(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Inicializa o banco de dados SQLite com garantia de tempo mínimo de 1.2s
  const inicializarBanco = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const inicio = Date.now();

    try {
      // Inicializa schema, migrações com user_version e seed inicial se necessário
      await getDb();

      const tempoDecorrido = Date.now() - inicio;
      const tempoRestante = Math.max(0, 1200 - tempoDecorrido);

      setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setVisivel(false);
          onPronto();
        }, 300); // Fade out de 300ms
      }, tempoRestante);
    } catch (err: any) {
      console.error('Falha na inicialização do SQLite na splash:', err);
      setCarregando(false);
      setErro('Não foi possível carregar o banco de dados.');
    }
  }, [onPronto]);

  useEffect(() => {
    inicializarBanco();
  }, [inicializarBanco]);

  if (!visivel) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 bg-gradient-to-br from-[#1E3A8A] to-[#1E1B4B] text-white select-none ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${reducedMotion ? '' : 'transition-opacity duration-300'}`}
    >
      {/* Top spacer */}
      <div className="w-full h-8" />

      {/* Conteúdo Central */}
      <div className="flex flex-col items-center text-center max-w-sm px-4">
        {/* Ícone da Lua com degradê creme/dourado e check verde */}
        <div
          className={`relative ${
            reducedMotion
              ? 'opacity-100 scale-100'
              : animarEntrada
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-90'
          } ${
            reducedMotion ? '' : 'transition-all duration-700 ease-out'
          }`}
        >
          <img
            src="/icon.svg"
            alt="Em Dia - Ícone"
            className="w-[120px] h-[120px] rounded-3xl shadow-2xl drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)]"
            width="120"
            height="120"
          />
        </div>

        {/* Título e Subtítulo */}
        <div
          className={`mt-6 space-y-1.5 ${
            reducedMotion
              ? 'opacity-100 translate-y-0'
              : animarEntrada
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          } ${
            reducedMotion ? '' : 'transition-all duration-700 delay-150 ease-out'
          }`}
        >
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Em Dia
          </h1>
          <p className="text-sm font-medium text-sky-200 tracking-wide">
            Suas contas sob controle
          </p>
        </div>

        {/* Mensagem de Erro com botão Tentar Novamente */}
        {erro && (
          <div className="mt-8 p-4 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs text-center space-y-3 animate-in fade-in">
            <div className="flex items-center justify-center gap-2 font-semibold text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-300" />
              <span>{erro}</span>
            </div>
            <button
              onClick={() => inicializarBanco()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-blue-950 font-bold text-xs shadow-md hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}
      </div>

      {/* Indicador de Carregamento Discreto (3 pontinhos pulsando ou barra fina) */}
      <div className="flex flex-col items-center gap-2 pb-6 min-h-[40px]">
        {carregando && !erro && (
          <div className="flex items-center gap-2" aria-label="Carregando...">
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
