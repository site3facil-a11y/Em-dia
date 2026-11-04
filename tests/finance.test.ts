import { describe, it, expect } from 'vitest';
import {
  parseMoedaParaCentavos,
  reaisParaCentavos,
  centavosParaReais,
  formatarCentavos,
  dividirEmParcelas,
  calcularPorquinhoCentavos,
} from '../src/utils/finance';

describe('Integridade Financeira em Centavos', () => {
  it('garante que o parser de dinheiro grava os centavos com exatidão conforme requisitos', () => {
    // 215 vira 21500 centavos
    expect(parseMoedaParaCentavos('215')).toBe(21500);
    expect(parseMoedaParaCentavos(215)).toBe(21500);
    expect(parseMoedaParaCentavos('215,00')).toBe(21500);

    // 215,5 vira 21550 centavos
    expect(parseMoedaParaCentavos('215,5')).toBe(21550);
    expect(parseMoedaParaCentavos('215.5')).toBe(21550);
    expect(parseMoedaParaCentavos(215.5)).toBe(21550);

    // 1.234,56 vira 123456 centavos
    expect(parseMoedaParaCentavos('1.234,56')).toBe(123456);
    expect(parseMoedaParaCentavos('1234.56')).toBe(123456);
    expect(parseMoedaParaCentavos(1234.56)).toBe(123456);

    // Casos adicionais com formatação e espaços
    expect(parseMoedaParaCentavos('R$ 215,00')).toBe(21500);
    expect(parseMoedaParaCentavos(' R$ 1.234,56 ')).toBe(123456);
    expect(parseMoedaParaCentavos('')).toBe(0);
    expect(parseMoedaParaCentavos('0')).toBe(0);
  });

  it('converte reais para centavos com precisão', () => {
    expect(reaisParaCentavos(100.5)).toBe(10050);
    expect(reaisParaCentavos(0.01)).toBe(1);
    expect(reaisParaCentavos('1.250,90')).toBe(125090);
    expect(reaisParaCentavos('33,33')).toBe(3333);
    expect(reaisParaCentavos('0,00')).toBe(0);
    expect(reaisParaCentavos('')).toBe(0);
  });

  it('converte centavos para reais', () => {
    expect(centavosParaReais(10050)).toBe(100.5);
    expect(centavosParaReais(3333)).toBe(33.33);
    expect(centavosParaReais(0)).toBe(0);
  });

  it('formata centavos em BRL', () => {
    const formatado = formatarCentavos(125050);
    // Deve conter 1.250,50
    expect(formatado).toContain('1.250,50');
  });

  it('divide parcelas distribuindo o resto dos centavos na primeira parcela (soma 100% exata)', () => {
    // R$ 100,00 em 3x: 33,34 + 33,33 + 33,33 = 100,00
    const parcelas3x = dividirEmParcelas(10000, 3);
    expect(parcelas3x).toEqual([3334, 3333, 3333]);
    expect(parcelas3x.reduce((a, b) => a + b, 0)).toBe(10000);

    // R$ 100,00 em 6x: 10000 / 6 = 1666, resto = 4 -> 1670 + 1666*5 = 10000
    const parcelas6x = dividirEmParcelas(10000, 6);
    expect(parcelas6x.reduce((a, b) => a + b, 0)).toBe(10000);

    // R$ 100,00 em 1x: exatamente 10000
    const parcelas1x = dividirEmParcelas(10000, 1);
    expect(parcelas1x).toEqual([10000]);

    // R$ 1.200,00 em 12x: 120000 / 12 = 10000 centavos (R$ 100,00 cada parcela)
    const parcelas1200 = dividirEmParcelas(120000, 12);
    expect(parcelas1200).toEqual(Array(12).fill(10000));
    expect(parcelas1200.reduce((a, b) => a + b, 0)).toBe(120000);
  });

  describe('Cálculo do Porquinho (Metas de Economia Parcelada)', () => {
    it('meta total 1.000 em 10 vezes gera 10 parcelas de 10000 centavos', () => {
      // Entrada com '1.000' (ou 1000)
      const res = calcularPorquinhoCentavos('total', '1.000', 10);
      expect(res.metaTotalCentavos).toBe(100000);
      expect(res.parcelasCentavos).toHaveLength(10);
      expect(res.parcelasCentavos).toEqual(Array(10).fill(10000));
      expect(res.valorParcelaBaseCentavos).toBe(10000);
    });

    it('valor por parcela 100 em 10 vezes gera meta de 100000 centavos', () => {
      // Entrada com '100' (ou 100,00)
      const res = calcularPorquinhoCentavos('parcela', '100', 10);
      expect(res.metaTotalCentavos).toBe(100000);
      expect(res.parcelasCentavos).toHaveLength(10);
      expect(res.parcelasCentavos).toEqual(Array(10).fill(10000));
      expect(res.valorParcelaBaseCentavos).toBe(10000);
    });

    it('1.000 em 3 vezes gera 33334, 33333 e 33333 centavos', () => {
      const res = calcularPorquinhoCentavos('total', '1.000', 3);
      expect(res.metaTotalCentavos).toBe(100000);
      expect(res.parcelasCentavos).toEqual([33334, 33333, 33333]);
      expect(res.parcelasCentavos.reduce((a, b) => a + b, 0)).toBe(100000);
    });

    it('faz parser correto de separadores de milhar brasileiros sem vírgula (ex: 1.000 e 1.200)', () => {
      expect(parseMoedaParaCentavos('1.000')).toBe(100000);
      expect(parseMoedaParaCentavos('1.200')).toBe(120000);
      expect(parseMoedaParaCentavos('10.000')).toBe(1000000);
      expect(parseMoedaParaCentavos('1.000.000')).toBe(100000000);
    });
  });
});
