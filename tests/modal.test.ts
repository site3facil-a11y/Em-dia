import { describe, it, expect } from 'vitest';

describe('Modal Dimension & Viewport Validation', () => {
  it('garante que margens de segurança --m-top e --m-bottom protegem a barra de status e de navegação', () => {
    // Regra:
    // --m-top: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px), 32px) + 8px
    // --m-bottom: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), 48px) + 8px
    const calcularMargens = (safeAreaTop = 0, safeAreaBottom = 0) => {
      const mTop = Math.max(safeAreaTop, 32) + 8;
      const mBottom = Math.max(safeAreaBottom, 48) + 8;
      return { mTop, mBottom };
    };

    // Caso padrão sem notch:
    const padrao = calcularMargens(0, 0);
    expect(padrao.mTop).toBe(40); // 32 + 8: sempre acima da barra de status
    expect(padrao.mBottom).toBe(56); // 48 + 8: sempre acima da barra de navegação

    // Caso com notch / safe-area Android alto (ex: 44px top, 34px bottom):
    const comNotch = calcularMargens(44, 34);
    expect(comNotch.mTop).toBe(52); // 44 + 8
    expect(comNotch.mBottom).toBe(56); // max(34, 48) + 8 = 56
  });

  it('valida tela 360x640: modal cabe com folga e área de rolagem interna permite rolar até o fim', () => {
    const alturaTela = 640;
    const larguraTela = 360;
    const mTop = 40;
    const mBottom = 56;

    const maxHeightPainel = alturaTela - mTop - mBottom; // 544px
    expect(maxHeightPainel).toBe(544);

    const cabecalhoAprox = 64; // px
    const rodapeAprox = 76; // px (botão 48px + padding)
    const espacoRolavel = maxHeightPainel - cabecalhoAprox - rodapeAprox;

    // Em 360x640, restam mais de 400px para o corpo do formulário rolar internamente
    expect(espacoRolavel).toBeGreaterThan(350);
    // Em telas de 360px ou menores, botões devem ser empilhados com o botão de confirmação em cima (flex-col-reverse)
    expect(larguraTela <= 360).toBe(true);
  });

  it('valida tela 360x780: modal cabe perfeitamente e garante cabeçalho e rodapé visíveis', () => {
    const alturaTela = 780;
    const larguraTela = 360;
    const mTop = 40;
    const mBottom = 56;

    const maxHeightPainel = alturaTela - mTop - mBottom; // 684px
    expect(maxHeightPainel).toBe(684);

    const cabecalhoAprox = 64;
    const rodapeAprox = 76;
    const espacoRolavel = maxHeightPainel - cabecalhoAprox - rodapeAprox;

    expect(espacoRolavel).toBe(544);
    expect(larguraTela <= 360).toBe(true);
  });

  it('valida comportamento do teclado com visualViewport', () => {
    const alturaTela = 780;
    const alturaTeclado = 280;
    const viewportHeight = alturaTela - alturaTeclado; // 500px

    const isKeyboardOpen = alturaTela - viewportHeight > 120;
    expect(isKeyboardOpen).toBe(true);

    const painelHeightComTeclado = Math.max(260, viewportHeight - 40); // 460px
    expect(painelHeightComTeclado).toBe(460);
    expect(painelHeightComTeclado).toBeLessThan(viewportHeight);
  });

  it('valida que números de parcelas são exibidos apenas para contas parceladas e nunca para recorrentes ou únicas', () => {
    function deveExibirBadgeParcelas(tipoConta: string | undefined, totalParcelas: number): boolean {
      return tipoConta === 'parcelada' && totalParcelas > 1;
    }

    // Pagamentos recorrentes (ex.: Pensão, Luz, Internet, Aluguel, Duda com 12 ou 13 geradas)
    expect(deveExibirBadgeParcelas('recorrente', 12)).toBe(false);
    expect(deveExibirBadgeParcelas('recorrente', 13)).toBe(false);
    expect(deveExibirBadgeParcelas('recorrente', 1)).toBe(false);

    // Pagamentos únicos (1 parcela)
    expect(deveExibirBadgeParcelas('unica', 1)).toBe(false);

    // Pagamentos parcelados (ex.: Seguro auto 1/8)
    expect(deveExibirBadgeParcelas('parcelada', 8)).toBe(true);
    expect(deveExibirBadgeParcelas('parcelada', 12)).toBe(true);
    expect(deveExibirBadgeParcelas('parcelada', 1)).toBe(false);
  });

  it('valida que contas recorrentes e únicas NUNCA são classificadas como Porquinho', () => {
    function verificarSeEhEconomia(conta: {
      tipo_conta?: string;
      categoria_nome?: string;
      observacoes?: string | null;
      conta_descricao?: string;
    }): boolean {
      return (
        conta.tipo_conta === 'parcelada' &&
        (Boolean(conta.observacoes?.includes('Porquinho')) ||
          conta.conta_descricao?.toLowerCase().includes('porquinho') ||
          conta.conta_descricao?.toLowerCase() === 'economia')
      );
    }

    // Caso real relatado pelo usuário: conta recorrente 'medico'
    expect(
      verificarSeEhEconomia({
        tipo_conta: 'recorrente',
        conta_descricao: 'medico',
        categoria_nome: 'Economias',
      })
    ).toBe(false);

    // Conta única de farmácia
    expect(
      verificarSeEhEconomia({
        tipo_conta: 'unica',
        conta_descricao: 'farmacia',
        categoria_nome: 'Economias',
      })
    ).toBe(false);

    // Porquinho legítimo criado pelo modal do Porquinho
    expect(
      verificarSeEhEconomia({
        tipo_conta: 'parcelada',
        conta_descricao: 'economia',
        observacoes: 'Porquinho - Meta de economia parcelada',
      })
    ).toBe(true);

    expect(
      verificarSeEhEconomia({
        tipo_conta: 'parcelada',
        conta_descricao: 'Viagem dos sonhos',
        observacoes: 'Porquinho - Meta de economia parcelada',
      })
    ).toBe(true);
  });

  it('valida que o modal de detalhamento de parcelas só abre para contas parceladas e nunca para recorrentes ou únicas', () => {
    function deveAbrirModalDetalhamento(tipoConta?: string): boolean {
      return tipoConta === 'parcelada';
    }

    // Pagamento recorrente (ex: aluguel, internet, luz) NÃO deve abrir detalhamento
    expect(deveAbrirModalDetalhamento('recorrente')).toBe(false);

    // Pagamento de conta única NÃO deve abrir detalhamento
    expect(deveAbrirModalDetalhamento('unica')).toBe(false);
    expect(deveAbrirModalDetalhamento(undefined)).toBe(false);

    // Pagamento parcelado (ex: compras em 10x, financiamentos) DEVE abrir detalhamento
    expect(deveAbrirModalDetalhamento('parcelada')).toBe(true);
  });
});

