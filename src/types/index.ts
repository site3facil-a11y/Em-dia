export type TipoConta = 'unica' | 'recorrente' | 'parcelada';

export type StatusParcela = 'pendente' | 'pago' | 'atrasado';

export interface Categoria {
  id: number;
  nome: string;
  cor: string;
}

export interface Conta {
  id: number;
  descricao: string;
  categoria_id: number;
  categoria_nome?: string;
  categoria_cor?: string;
  valor_total: number;
  tipo: TipoConta;
  forma_pagamento: string;
  observacoes?: string | null;
  data_criacao: string;
  // Campos agregados opcionais
  total_parcelas?: number;
  parcelas_pagas?: number;
  saldo_restante?: number;
}

export interface Parcela {
  id: number;
  conta_id: number;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  data_pagamento?: string | null; // YYYY-MM-DD
  status: StatusParcela;
  valor_pago?: number | null;
  
  // Joins com contas e categorias
  conta_descricao?: string;
  categoria_id?: number;
  categoria_nome?: string;
  categoria_cor?: string;
  tipo_conta?: TipoConta;
  forma_pagamento?: string;
  observacoes?: string | null;
}

export interface ParcelamentoItem {
  conta_id: number;
  descricao: string;
  categoria_id: number;
  categoria_nome: string;
  categoria_cor: string;
  forma_pagamento: string;
  tipo: TipoConta;
  valor_total: number;
  total_parcelas: number;
  parcelas_pagas: number;
  valor_pago: number;
  saldo_restante: number;
  proximo_vencimento: string | null;
  status_geral: 'concluido' | 'em_andamento' | 'com_atraso';
  parcelas: Parcela[];
}

export interface FiltrosParcela {
  status?: string; // 'todos' | 'pendente' | 'pago' | 'atrasado'
  mesAno?: string; // 'YYYY-MM' ou 'todos'
  categoria_id?: number | 'todas';
  tipo?: string; // 'todos' | 'unica' | 'recorrente' | 'parcelada'
  busca?: string;
  ordenacao?: 'vencimento_asc' | 'vencimento_desc' | 'valor_asc' | 'valor_desc' | 'descricao_asc';
}

export interface DashboardMetrics {
  totalPagoMes: number;
  totalAPagarMes: number;
  totalAtrasado: number;
  totalVencendo7Dias: number;
  qtdVencendoHoje: number;
  qtdAtrasadas: number;

  // Os 3 Pilares Fundamentais
  totalGastosMes: number;
  totalEconomiasMes: number;
  totalReservasMes: number;
  residualMes: number; // Diferença entre valor previsto e valor pago das contas pagas do mês (+ sobra/desconto, - juros/acréscimo)
  reservaAcumuladaTotal: number; // Soma acumulada de economias + resíduos líquidos

  gastosPorCategoria: {
    categoria_id: number;
    categoria_nome: string;
    categoria_cor: string;
    total: number;
    percentual: number;
  }[];
  evolucaoMensal: {
    mesAno: string;
    label: string;
    pago: number;
    pendente: number;
    total: number;
    gastos: number;
    economias: number;
    tipoMes: 'passado' | 'atual' | 'futuro';
  }[];
  proximosVencimentos: Parcela[];
}
