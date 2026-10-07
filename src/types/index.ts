export type TipoConta = 'unica' | 'recorrente' | 'parcelada';
export type FrequenciaRecorrencia = 'semanal' | 'quinzenal' | 'mensal' | 'semestral' | 'anual';

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
  valor_total: number; // Em centavos (INTEGER)
  tipo: TipoConta;
  forma_pagamento: string;
  observacoes?: string | null;
  data_criacao: string;
  frequencia_recorrencia?: FrequenciaRecorrencia | null;
  dia_base?: number | null; // Dia original do mês para não perder dia 31
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
  valor: number; // Em centavos (INTEGER)
  data_vencimento: string; // YYYY-MM-DD
  data_pagamento?: string | null; // YYYY-MM-DD
  status: StatusParcela; // 'pendente' | 'pago' (atrasado é derivado na UI)
  valor_pago?: number | null; // Em centavos (INTEGER)
  
  // Joins com contas e categorias
  conta_descricao?: string;
  categoria_id?: number;
  categoria_nome?: string;
  categoria_cor?: string;
  tipo_conta?: TipoConta;
  forma_pagamento?: string;
  observacoes?: string | null;
}

export interface Cofrinho {
  id: number;
  nome: string;
  valor_meta: number; // Em centavos (INTEGER)
  total_parcelas: number;
  valor_parcela: number; // Em centavos (INTEGER)
  data_inicio: string; // YYYY-MM-DD
  concluido: number; // 0 ou 1
  data_criacao: string;
}

export interface CofrinhoDeposito {
  id: number;
  cofrinho_id: number;
  valor: number; // Em centavos (positivo = depósito, negativo = retirada)
  data_deposito: string; // YYYY-MM-DD
  observacao?: string | null;
  conta_vinculada_id?: number | null;
}

export interface CofrinhoComProgresso extends Cofrinho {
  total_guardado: number; // Soma de depósitos reais em centavos
  total_retirado: number; // Soma de retiradas em centavos
  saldo_atual: number; // total_guardado - total_retirado
  percentual: number; // 0 a 100
  saldo_restante: number;
  qtd_depositos: number;
  estimativa_conclusao?: string | null;
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
