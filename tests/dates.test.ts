import { describe, it, expect } from 'vitest';
import {
  derivarStatus,
  calcularProximoVencimento,
  getUltimoDiaDoMes,
  formatarDataBr,
} from '../src/utils/dates';

describe('Manipulação e Regras de Datas', () => {
  it('deriva o status corretamente sem gravar "atrasado" no banco', () => {
    const hoje = '2026-10-07';

    // Se estiver pago, sempre permanece 'pago' independente da data
    expect(derivarStatus('pago', '2026-10-01', hoje)).toBe('pago');
    expect(derivarStatus('pago', '2026-10-10', hoje)).toBe('pago');

    // Se pendente e vencimento < hoje: atrasado
    expect(derivarStatus('pendente', '2026-10-06', hoje)).toBe('atrasado');
    expect(derivarStatus('pendente', '2026-09-30', hoje)).toBe('atrasado');

    // Se pendente e vencimento == hoje: pendente (vence hoje)
    expect(derivarStatus('pendente', '2026-10-07', hoje)).toBe('pendente');

    // Se pendente e vencimento > hoje: pendente (a vencer)
    expect(derivarStatus('pendente', '2026-10-08', hoje)).toBe('pendente');
    expect(derivarStatus('pendente', '2026-11-01', hoje)).toBe('pendente');
  });

  it('calcula o último dia de meses com 28, 29, 30 e 31 dias', () => {
    expect(getUltimoDiaDoMes(2026, 1)).toBe(31); // Janeiro
    expect(getUltimoDiaDoMes(2026, 2)).toBe(28); // Fevereiro 2026 (não bissexto)
    expect(getUltimoDiaDoMes(2024, 2)).toBe(29); // Fevereiro 2024 (bissexto)
    expect(getUltimoDiaDoMes(2026, 4)).toBe(30); // Abril
  });

  it('recorrência mensal respeita fim de mês para contas no dia 31', () => {
    // Conta criada em 31/01/2026
    const proxFev = calcularProximoVencimento('2026-01-31', 'mensal', 31);
    expect(proxFev).toBe('2026-02-28'); // Fevereiro para no dia 28

    // De Fevereiro avançando para Março, mantendo o dia 31 pretendido
    const proxMar = calcularProximoVencimento('2026-02-28', 'mensal', 31);
    expect(proxMar).toBe('2026-03-31'); // Março tem 31 dias

    // De Março para Abril
    const proxAbr = calcularProximoVencimento('2026-03-31', 'mensal', 31);
    expect(proxAbr).toBe('2026-04-30'); // Abril tem 30 dias

    // De Abril para Maio
    const proxMai = calcularProximoVencimento('2026-04-30', 'mensal', 31);
    expect(proxMai).toBe('2026-05-31'); // Maio volta para 31
  });

  it('lida com virada de ano em recorrência mensal e anual', () => {
    // Dezembro 2026 para Janeiro 2027
    const proxJan = calcularProximoVencimento('2026-12-15', 'mensal', 15);
    expect(proxJan).toBe('2027-01-15');

    // Anual
    const proxAno = calcularProximoVencimento('2026-10-07', 'anual', 7);
    expect(proxAno).toBe('2027-10-07');
  });

  it('calcula recorrência semanal e quinzenal', () => {
    expect(calcularProximoVencimento('2026-10-01', 'semanal')).toBe('2026-10-08');
    expect(calcularProximoVencimento('2026-10-01', 'quinzenal')).toBe('2026-10-15');
  });

  it('formata data brasileira corretamente', () => {
    expect(formatarDataBr('2026-10-07')).toBe('07/10/2026');
  });
});
