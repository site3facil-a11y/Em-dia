/**
 * Funções puras para manipulação e integridade monetária em CENTAVOS (INTEGER).
 * Evita qualquer imprecisão de ponto flutuante do JavaScript (ex: 0.1 + 0.2 !== 0.3).
 */

/**
 * Parser rigoroso de valores monetários para centavos inteiros (INTEGER).
 * Garante conversão sem imprecisão de ponto flutuante:
 * "215" -> 21500
 * "215,5" -> 21550
 * "215.5" -> 21550
 * "1.234,56" -> 123456
 * 215 -> 21500
 * 215.5 -> 21550
 * 1234.56 -> 123456
 */
export function parseMoedaParaCentavos(valor: number | string | undefined | null): number {
  if (valor === undefined || valor === null) return 0;

  if (typeof valor === 'number') {
    if (isNaN(valor) || !isFinite(valor)) return 0;
    return Math.round(valor * 100);
  }

  if (typeof valor !== 'string') return 0;

  let limpo = valor.trim();
  if (!limpo) return 0;

  // Remove símbolos monetários e espaços, preservando dígitos, vírgula, ponto e hífen
  limpo = limpo.replace(/[^\d,.-]/g, '');
  if (!limpo) return 0;

  // Caso 1: Contém vírgula (formato brasileiro padrão, ex: 1.234,56 ou 215,50 ou 100,00)
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes('.')) {
    // Caso 2: Não contém vírgula, mas contém ponto(s)
    const partes = limpo.split('.');
    if (partes.length > 2) {
      // Múltiplos pontos (ex: 1.000.000): todos são separadores de milhar
      limpo = limpo.replace(/\./g, '');
    } else if (partes.length === 2) {
      // Exatamente um ponto.
      // Se a parte após o ponto tiver exatamente 3 dígitos (ex: "1.000", "1.200", "12.000"),
      // na notação financeira brasileira isto representa milhar (R$ 1.000, R$ 1.200).
      if (partes[1].length === 3) {
        limpo = limpo.replace(/\./g, '');
      }
      // Se tiver 1 ou 2 dígitos (ex: "215.5", "10.50"), é tratado como decimal padrão
    }
  }

  const num = parseFloat(limpo);
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converte valor em Reais (número ou string formatada) para centavos inteiros.
 */
export const reaisParaCentavos = parseMoedaParaCentavos;

/**
 * Converte centavos inteiros para valor em Reais (float de exibição).
 * Exemplo: 10050 -> 100.5
 */
export function centavosParaReais(centavos: number): number {
  if (typeof centavos !== 'number' || isNaN(centavos)) return 0;
  return centavos / 100;
}

/**
 * Formata um valor em centavos diretamente para moeda brasileira (R$).
 * Exemplo: 125050 -> "R$ 1.250,50"
 */
export function formatarCentavos(centavos: number): string {
  const reais = centavosParaReais(centavos);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
}

/**
 * Divide um valor total em centavos pelo número de parcelas,
 * distribuindo o resto dos centavos na primeira parcela.
 * Garante que a soma das parcelas seja rigorosamente igual ao valor total.
 *
 * Exemplo:
 * dividirEmParcelas(10000, 3) -> [3334, 3333, 3333]
 * Soma: 3334 + 3333 + 3333 = 10000 centavos (R$ 100,00 exatos)
 */
export function dividirEmParcelas(totalCentavos: number, qtdParcelas: number): number[] {
  const qtd = Math.max(1, Math.floor(qtdParcelas));
  if (qtd === 1) return [totalCentavos];

  const valorBase = Math.floor(totalCentavos / qtd);
  const resto = totalCentavos - valorBase * qtd;

  const parcelas: number[] = [];
  for (let i = 0; i < qtd; i++) {
    // Adiciona o resto na primeira parcela (ou nas primeiras se o resto fosse distribuído 1 a 1)
    if (i === 0) {
      parcelas.push(valorBase + resto);
    } else {
      parcelas.push(valorBase);
    }
  }

  return parcelas;
}

/**
 * Calcula os centavos das parcelas e a meta total para Porquinho / Poupança parcelada.
 * - Modo 'total': parcela = meta total ÷ número de parcelas (divisão exata em centavos, com o resto na primeira parcela).
 * - Modo 'parcela': meta = parcela × número de parcelas.
 */
export function calcularPorquinhoCentavos(
  modo: 'total' | 'parcela',
  valorInformado: number | string,
  numeroParcelas: number
): { metaTotalCentavos: number; parcelasCentavos: number[]; valorParcelaBaseCentavos: number } {
  const qtd = Math.max(1, Math.floor(numeroParcelas));
  const valorCentavos = parseMoedaParaCentavos(valorInformado);

  if (modo === 'total') {
    const metaTotalCentavos = valorCentavos;
    const parcelasCentavos = dividirEmParcelas(metaTotalCentavos, qtd);
    const valorParcelaBaseCentavos = parcelasCentavos[0] || 0;
    return {
      metaTotalCentavos,
      parcelasCentavos,
      valorParcelaBaseCentavos,
    };
  } else {
    const valorParcelaBaseCentavos = valorCentavos;
    const parcelasCentavos = Array(qtd).fill(valorParcelaBaseCentavos);
    const metaTotalCentavos = valorParcelaBaseCentavos * qtd;
    return {
      metaTotalCentavos,
      parcelasCentavos,
      valorParcelaBaseCentavos,
    };
  }
}
