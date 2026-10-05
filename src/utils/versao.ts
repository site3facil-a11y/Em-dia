/**
 * Utilitários para controle de versão semântica e atualizações do GitHub
 */

/**
 * Compara duas versões semânticas (ex: "v1.0.2" com "1.0.1").
 * Retorna:
 *  1 se v1 > v2 (v1 é mais recente)
 * -1 se v1 < v2 (v1 é anterior)
 *  0 se v1 === v2
 */
export function compararVersoes(v1: string, v2: string): number {
  const normalizar = (v: string): number[] => {
    return v
      .replace(/^[^\d]*/, '') // remove prefixos como 'v'
      .split('.')
      .map((parte) => parseInt(parte, 10) || 0);
  };

  const p1 = normalizar(v1);
  const p2 = normalizar(v2);
  const len = Math.max(p1.length, p2.length);

  for (let i = 0; i < len; i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }

  return 0;
}
