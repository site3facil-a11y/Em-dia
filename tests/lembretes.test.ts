import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatarDataLocalIso,
  montarNotificacoesAgendadas,
  filtrarIdsParaCancelarNoReagendamento,
  obterParcelasLembreteHoje,
  identificarParcelaCatchUpHoje,
  NOTIFICACAO_TESTE_ID,
  NOTIFICACAO_ATRASADAS_ID,
  ConfiguracaoLembretes,
} from '../src/utils/lembretes';
import { Parcela } from '../src/types';

function criarParcelaFake(overrides: Partial<Parcela> = {}): Parcela {
  return {
    id: 1,
    conta_id: 10,
    numero_parcela: 1,
    total_parcelas: 1,
    valor: 15000, // R$ 150,00
    data_vencimento: '2026-11-15',
    status: 'pendente',
    conta_descricao: 'Internet Fibra',
    tipo_conta: 'recorrente',
    ...overrides,
  };
}

const configBase: ConfiguracaoLembretes = {
  habilitado: true,
  horario: '09:00',
  antecedencia: {
    noDia: true,
    umDiaAntes: true,
    tresDiasAntes: false,
  },
};

describe('Notificações e Lembretes Android', () => {
  const originalLocalStorage = (globalThis as any).localStorage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };
  });

  afterEach(() => {
    (globalThis as any).localStorage = originalLocalStorage;
  });

  it('formata datas no fuso local sem deslocamento UTC após 21h', () => {
    const noiteLocal = new Date(2026, 10, 13, 23, 55, 0); // 13/11/2026 23:55 hora local
    expect(formatarDataLocalIso(noiteLocal)).toBe('2026-11-13');
  });

  it('monta notificações com canal vencimentos, foreground, e alarme exato configurável', () => {
    const agora = new Date(2026, 10, 13, 8, 0, 0); // 13/11/2026 08:00
    const parcelas: Parcela[] = [
      criarParcelaFake({ id: 5, conta_id: 10, data_vencimento: '2026-11-15', conta_descricao: 'Luz' }),
      criarParcelaFake({ id: 6, conta_id: 11, data_vencimento: '2026-11-14', status: 'pago', conta_descricao: 'Água' }),
    ];

    const agendadas = montarNotificacoesAgendadas({
      parcelas,
      config: configBase,
      contasComSininho: [],
      agora,
      usarAlarmeExato: true,
    });

    expect(agendadas).toHaveLength(2);
    // Ordenadas cronologicamente: 1 dia antes (14/11) depois no dia (15/11)
    expect(agendadas[0].id).toBe(51); // 5 * 10 + 1
    expect(agendadas[0].body).toContain('Vence amanhã: Luz');
    expect(agendadas[0].channelId).toBe('vencimentos');
    expect(agendadas[0].isExactNotification).toBe(true);
    expect(agendadas[0].foreground).toBe(true);
    expect(agendadas[0].autoCancel).toBe(true);

    expect(agendadas[1].id).toBe(50); // 5 * 10 + 0
    expect(agendadas[1].body).toContain('Vence hoje: Luz');
  });

  it('respeita sininho individual e limite máximo de 60 notificações', () => {
    const agora = new Date(2026, 10, 13, 8, 0, 0);
    const parcelas: Parcela[] = [];
    for (let i = 1; i <= 50; i++) {
      parcelas.push(
        criarParcelaFake({
          id: i,
          conta_id: i <= 40 ? 100 : 200,
          data_vencimento: '2026-11-20',
          conta_descricao: `Conta ${i}`,
        })
      );
    }

    const apenasSininho = montarNotificacoesAgendadas({
      parcelas,
      config: {
        ...configBase,
        antecedencia: { noDia: true, umDiaAntes: true, tresDiasAntes: true },
      },
      contasComSininho: [100],
      agora,
      usarAlarmeExato: false,
      limite: 60,
    });

    expect(apenasSininho).toHaveLength(60);
    expect(apenasSininho.every((n) => n.isExactNotification === false)).toBe(true);
    expect(apenasSininho.every((n) => (n.extra?.parcelaId || 0) <= 40)).toBe(true);
  });

  it('retorna lista vazia quando lembretes globais estão desativados', () => {
    const agora = new Date(2026, 10, 13, 8, 0, 0);
    const resultado = montarNotificacoesAgendadas({
      parcelas: [criarParcelaFake()],
      config: { ...configBase, habilitado: false },
      contasComSininho: [],
      agora,
    });
    expect(resultado).toEqual([]);
  });

  it('preserva notificações reservadas (teste 999999 e atrasadas 888888) ao limpar pendentes', () => {
    const ids = [10, 11, NOTIFICACAO_ATRASADAS_ID, 20, NOTIFICACAO_TESTE_ID, 31];
    const idsParaCancelar = filtrarIdsParaCancelarNoReagendamento(ids);
    expect(idsParaCancelar).toEqual([10, 11, 20, 31]);
    expect(idsParaCancelar).not.toContain(NOTIFICACAO_TESTE_ID);
    expect(idsParaCancelar).not.toContain(NOTIFICACAO_ATRASADAS_ID);
  });

  it('inclui parcelas atrasadas e pendentes de hoje em obterParcelasLembreteHoje', () => {
    const parcelas: Parcela[] = [
      criarParcelaFake({ id: 1, conta_id: 10, data_vencimento: '2026-11-10', status: 'atrasado' }),
      criarParcelaFake({ id: 2, conta_id: 11, data_vencimento: '2026-11-13', status: 'pendente' }),
      criarParcelaFake({ id: 3, conta_id: 12, data_vencimento: '2026-11-13', status: 'pago' }),
      criarParcelaFake({ id: 4, conta_id: 13, data_vencimento: '2026-11-20', status: 'pendente' }),
    ];

    const hoje = obterParcelasLembreteHoje(parcelas, '2026-11-13');
    expect(hoje.map((p) => p.id)).toEqual([1, 2]);
  });

  it('identifica catch-up para conta que vence hoje ou amanhã após o horário configurado', () => {
    const depoisDas9 = new Date(2026, 10, 13, 13, 30, 0); // 13/11 13:30
    const antesDas9 = new Date(2026, 10, 13, 8, 15, 0); // 13/11 08:15

    const parcelaHoje = criarParcelaFake({
      id: 7,
      conta_id: 20,
      data_vencimento: '2026-11-13',
      conta_descricao: 'Aluguel',
    });
    const parcelaAmanha = criarParcelaFake({
      id: 8,
      conta_id: 21,
      data_vencimento: '2026-11-14',
      conta_descricao: 'Cartão',
    });

    // Antes do horário (08:15 < 09:00), o alarme normal ainda vai tocar -> sem catch-up
    expect(
      identificarParcelaCatchUpHoje({
        parcelasConta: [parcelaHoje],
        config: configBase,
        agora: antesDas9,
      })
    ).toBeNull();

    // Após 09:00 para conta que vence hoje -> dispara catch-up "Vence hoje"
    const resHoje = identificarParcelaCatchUpHoje({
      parcelasConta: [parcelaHoje],
      config: configBase,
      agora: depoisDas9,
    });
    expect(resHoje).not.toBeNull();
    expect(resHoje?.diasAntes).toBe(0);
    expect(resHoje?.mensagem).toContain('Vence hoje: Aluguel');

    // Se já enviou hoje, não repete
    expect(
      identificarParcelaCatchUpHoje({
        parcelasConta: [parcelaHoje],
        config: configBase,
        agora: depoisDas9,
        avisosJaEnviadosHoje: [resHoje!.chaveUnica],
      })
    ).toBeNull();

    // Após 09:00 para conta que vence amanhã -> dispara catch-up "Vence amanhã"
    const resAmanha = identificarParcelaCatchUpHoje({
      parcelasConta: [parcelaAmanha],
      config: configBase,
      agora: depoisDas9,
    });
    expect(resAmanha).not.toBeNull();
    expect(resAmanha?.diasAntes).toBe(1);
    expect(resAmanha?.mensagem).toContain('Vence amanhã: Cartão');
  });
});
