/**
 * Camada de Acesso a Dados (DAO / Repository)
 * Todas as operações utilizam consultas SQL parametrizadas,
 * integridade monetária em CENTAVOS (INTEGER),
 * derivação dinâmica de status atrasado e persistência debounced.
 */
import { getDb, persistirDb, executarEmTransacao } from './sqlite';
import {
  Categoria,
  Conta,
  Parcela,
  ParcelamentoItem,
  FiltrosParcela,
  DashboardMetrics,
  TipoConta,
  FrequenciaRecorrencia,
  Cofrinho,
  CofrinhoDeposito,
  CofrinhoComProgresso,
} from '../types';
import { getHojeIso, calcularProximoVencimento, extrairPartesData, derivarStatus } from '../utils/dates';
import { dividirEmParcelas, reaisParaCentavos, centavosParaReais } from '../utils/finance';

function formatarErroAmigavel(err: any): Error {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('unique constraint failed')) {
    return new Error('Já existe um registro cadastrado com este nome.');
  }
  if (msg.includes('foreign key constraint failed')) {
    return new Error('Não é possível excluir este item pois existem registros associados a ele.');
  }
  if (msg.includes('check constraint failed')) {
    return new Error('Os valores informados não atendem aos critérios de validação.');
  }
  return new Error(err?.message || 'Falha na operação de banco de dados.');
}

// ==========================================
// CATEGORIAS
// ==========================================

export async function listarCategorias(): Promise<Categoria[]> {
  const db = await getDb();
  const stmt = db.prepare('SELECT id, nome, cor FROM categorias ORDER BY nome ASC');
  const categorias: Categoria[] = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: number; nome: string; cor: string };
    categorias.push({
      id: row.id,
      nome: row.nome,
      cor: row.cor,
    });
  }
  stmt.free();
  return categorias;
}

export async function criarCategoria(nome: string, cor: string): Promise<number> {
  const db = await getDb();
  db.run('INSERT INTO categorias (nome, cor) VALUES (?, ?);', [nome.trim(), cor.trim()]);
  const res = db.exec('SELECT last_insert_rowid() as id;');
  persistirDb();
  return res[0]?.values[0]?.[0] as number;
}

export async function atualizarCategoria(id: number, nome: string, cor: string): Promise<void> {
  const db = await getDb();
  db.run('UPDATE categorias SET nome = ?, cor = ? WHERE id = ?;', [nome.trim(), cor.trim(), id]);
  persistirDb();
}

export async function excluirCategoria(id: number): Promise<{ success: boolean; message?: string }> {
  try {
    const db = await getDb();
    const resContas = db.exec('SELECT COUNT(*) as total FROM contas WHERE categoria_id = ?;', [id]);
    const total = (resContas[0]?.values[0]?.[0] as number) || 0;
    if (total > 0) {
      return {
        success: false,
        message: 'Não é possível excluir esta categoria pois há lançamentos vinculados a ela.',
      };
    }
    db.run('DELETE FROM categorias WHERE id = ?;', [id]);
    persistirDb();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Erro ao excluir categoria.',
    };
  }
}

// ==========================================
// CONTAS E PARCELAS
// ==========================================

export interface NovaContaInput {
  descricao: string;
  categoria_id: number;
  valor_total: number; // Em centavos ou reais (convertido para centavos com segurança)
  tipo: TipoConta;
  forma_pagamento: string;
  observacoes?: string;
  data_primeiro_vencimento: string; // YYYY-MM-DD
  numero_parcelas?: number; // Para parceladas
  frequencia_recorrencia?: FrequenciaRecorrencia;
}

export async function criarConta(input: NovaContaInput): Promise<number> {
  const hoje = getHojeIso();

  // Garante valor em centavos inteiros
  const valorTotalCentavos =
    input.valor_total > 1000000 || Number.isInteger(input.valor_total)
      ? Math.round(input.valor_total)
      : reaisParaCentavos(input.valor_total);

  return await executarEmTransacao((db) => {
    // 1. Garante existência de categoria válida
    let categoriaId = input.categoria_id;
    const catCheck = db.exec('SELECT id FROM categorias WHERE id = ?;', [categoriaId]);
    if (!catCheck[0]?.values?.length) {
      const anyCat = db.exec('SELECT id FROM categorias ORDER BY id ASC LIMIT 1;');
      if (anyCat[0]?.values?.length) {
        categoriaId = anyCat[0].values[0][0] as number;
      } else {
        db.run("INSERT INTO categorias (nome, cor) VALUES ('Gastos', '#2563eb');");
        const newCatRes = db.exec('SELECT last_insert_rowid() as id;');
        categoriaId = (newCatRes[0]?.values[0]?.[0] as number) || 1;
      }
    }

    const diaBase = extrairPartesData(input.data_primeiro_vencimento).dia;
    const freqRec = input.tipo === 'recorrente' ? input.frequencia_recorrencia || 'mensal' : null;

    db.run(
      `INSERT INTO contas (descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao, frequencia_recorrencia, dia_base)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        input.descricao.trim(),
        categoriaId,
        valorTotalCentavos,
        input.tipo,
        input.forma_pagamento || 'Geral',
        input.observacoes ? input.observacoes.trim() : null,
        hoje,
        freqRec,
        diaBase,
      ]
    );

    const res = db.exec('SELECT last_insert_rowid() as id;');
    const contaId = res[0]?.values[0]?.[0] as number;
    if (!contaId) {
      throw new Error('Falha ao obter identificador da conta criada.');
    }

    // 2. Geração das parcelas
    if (input.tipo === 'unica') {
      // Única: 1 parcela
      db.run(
        `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
         VALUES (?, 1, 1, ?, ?, NULL, 'pendente', NULL);`,
        [contaId, valorTotalCentavos, input.data_primeiro_vencimento]
      );
    } else if (input.tipo === 'recorrente') {
      // Recorrente: NUNCA pré-gera dezenas de parcelas futuras.
      // Mantém sempre apenas a próxima ocorrência pendente.
      db.run(
        `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
         VALUES (?, 1, 1, ?, ?, NULL, 'pendente', NULL);`,
        [contaId, valorTotalCentavos, input.data_primeiro_vencimento]
      );
    } else if (input.tipo === 'parcelada') {
      // Parcelada: divide os centavos exatamente distribuindo o resto na 1ª parcela
      const totalParcelas = Math.max(1, input.numero_parcelas || 1);
      const parcelasCentavos = dividirEmParcelas(valorTotalCentavos, totalParcelas);

      let dataVenc = input.data_primeiro_vencimento;
      for (let i = 0; i < totalParcelas; i++) {
        if (i > 0) {
          dataVenc = calcularProximoVencimento(dataVenc, 'mensal', diaBase);
        }
        db.run(
          `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
           VALUES (?, ?, ?, ?, ?, NULL, 'pendente', NULL);`,
          [contaId, i + 1, totalParcelas, parcelasCentavos[i], dataVenc]
        );
      }
    }

    return contaId;
  });
}

export async function excluirConta(contaId: number): Promise<void> {
  await executarEmTransacao((db) => {
    // Com ON DELETE CASCADE ativo, excluir conta exclui automaticamente suas parcelas
    db.run('DELETE FROM parcelas WHERE conta_id = ?;', [contaId]);
    db.run('DELETE FROM contas WHERE id = ?;', [contaId]);
  });
}

export interface EditarParcelaInput {
  parcelaId: number;
  descricao: string;
  categoria_id: number;
  valor: number; // em centavos ou reais
  data_vencimento: string;
  forma_pagamento: string;
  observacoes?: string;
  escopo: 'apenas_esta' | 'esta_e_proximas';
}

export async function editarParcelaEConta(dados: EditarParcelaInput): Promise<void> {
  const valorCentavos =
    dados.valor > 1000000 || Number.isInteger(dados.valor)
      ? Math.round(dados.valor)
      : reaisParaCentavos(dados.valor);

  await executarEmTransacao((db) => {
    const res = db.exec(
      'SELECT conta_id, numero_parcela, total_parcelas, status, valor FROM parcelas WHERE id = ?;',
      [dados.parcelaId]
    );
    if (!res[0]?.values?.length) {
      throw new Error('Parcela não encontrada.');
    }
    const contaId = res[0].values[0][0] as number;
    const numParcela = res[0].values[0][1] as number;
    const totalParcelas = res[0].values[0][2] as number;

    // Atualiza a parcela atual
    db.run(
      `UPDATE parcelas 
       SET valor = ?, data_vencimento = ?
       WHERE id = ?;`,
      [valorCentavos, dados.data_vencimento, dados.parcelaId]
    );

    // Atualiza dados da conta pai
    db.run(
      `UPDATE contas 
       SET descricao = ?, categoria_id = ?, forma_pagamento = ?, observacoes = ?
       WHERE id = ?;`,
      [dados.descricao.trim(), dados.categoria_id, dados.forma_pagamento || 'Geral', dados.observacoes || null, contaId]
    );

    // Se escopo for 'esta_e_proximas' em conta parcelada, atualiza as próximas que não estejam pagas
    if (dados.escopo === 'esta_e_proximas' && totalParcelas > 1) {
      db.run(
        `UPDATE parcelas 
         SET valor = ?
         WHERE conta_id = ? AND numero_parcela > ? AND status = 'pendente';`,
        [valorCentavos, contaId, numParcela]
      );
    }
  });
}

export async function atualizarConta(
  contaId: number,
  dados: { descricao: string; categoria_id: number; forma_pagamento: string; observacoes?: string }
): Promise<void> {
  const db = await getDb();
  db.run(
    `UPDATE contas 
     SET descricao = ?, categoria_id = ?, forma_pagamento = ?, observacoes = ?
     WHERE id = ?;`,
    [dados.descricao.trim(), dados.categoria_id, dados.forma_pagamento || 'Geral', dados.observacoes || null, contaId]
  );
  persistirDb();
}

/**
 * Marca uma parcela como paga:
 * - Se for recorrente, gera automaticamente a PRÓXIMA parcela pendente
 *   com cálculo estrito de fim de mês e preservação do dia original.
 */
export async function marcarParcelaComoPaga(
  parcelaId: number,
  dataPagamento?: string,
  valorPago?: number
): Promise<void> {
  const hoje = getHojeIso();
  const dtPag = dataPagamento || hoje;

  await executarEmTransacao((db) => {
    const resParc = db.exec(
      `SELECT p.id, p.conta_id, p.valor, p.numero_parcela, p.data_vencimento,
              c.tipo, c.frequencia_recorrencia, c.dia_base, c.descricao, c.categoria_id
       FROM parcelas p
       INNER JOIN contas c ON p.conta_id = c.id
       WHERE p.id = ?;`,
      [parcelaId]
    );

    if (!resParc[0]?.values?.length) {
      throw new Error('Parcela não encontrada.');
    }

    const row = resParc[0].values[0];
    const contaId = row[1] as number;
    const valorOriginal = row[2] as number;
    const numParcela = row[3] as number;
    const dataVencAtual = row[4] as string;
    const tipoConta = row[5] as TipoConta;
    const freqRecorrencia = (row[6] as FrequenciaRecorrencia) || 'mensal';
    const diaBaseOriginal = (row[7] as number) || extrairPartesData(dataVencAtual).dia;

    const valorPagoFinal =
      valorPago !== undefined && valorPago !== null
        ? valorPago > 1000000 || Number.isInteger(valorPago)
          ? Math.round(valorPago)
          : reaisParaCentavos(valorPago)
        : valorOriginal;

    // Atualiza a parcela para paga
    db.run(
      `UPDATE parcelas 
       SET status = 'pago', data_pagamento = ?, valor_pago = ?
       WHERE id = ?;`,
      [dtPag, valorPagoFinal, parcelaId]
    );

    // Se for conta recorrente, garante a geração da PRÓXIMA parcela pendente
    if (tipoConta === 'recorrente') {
      const resCheckPendente = db.exec(
        `SELECT id FROM parcelas WHERE conta_id = ? AND status = 'pendente';`,
        [contaId]
      );
      // Se não há nenhuma pendente futura, gera a próxima
      if (!resCheckPendente[0]?.values?.length) {
        const proximoVenc = calcularProximoVencimento(dataVencAtual, freqRecorrencia, diaBaseOriginal);
        const proximoNum = numParcela + 1;

        db.run(
          `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
           VALUES (?, ?, ?, ?, ?, NULL, 'pendente', NULL);`,
          [contaId, proximoNum, proximoNum, valorOriginal, proximoVenc]
        );

        // Atualiza o total de parcelas na conta recorrente
        db.run('UPDATE parcelas SET total_parcelas = ? WHERE conta_id = ?;', [proximoNum, contaId]);
      }
    }
  });
}

/**
 * Desfaz o pagamento de uma parcela:
 * - Se for recorrente e houver uma próxima parcela pendente gerada automaticamente após esta,
 *   remove a pendente futura para manter a integridade da sequência.
 */
export async function desfazerPagamentoParcela(parcelaId: number): Promise<void> {
  await executarEmTransacao((db) => {
    const res = db.exec(
      `SELECT p.conta_id, p.numero_parcela, c.tipo 
       FROM parcelas p
       INNER JOIN contas c ON p.conta_id = c.id
       WHERE p.id = ?;`,
      [parcelaId]
    );

    if (!res[0]?.values?.length) return;

    const contaId = res[0].values[0][0] as number;
    const numParcela = res[0].values[0][1] as number;
    const tipo = res[0].values[0][2] as TipoConta;

    // Volta o status para pendente
    db.run(
      `UPDATE parcelas 
       SET status = 'pendente', data_pagamento = NULL, valor_pago = NULL
       WHERE id = ?;`,
      [parcelaId]
    );

    // Se recorrente, remove parcelas pendentes posteriores geradas automaticamente
    if (tipo === 'recorrente') {
      db.run(
        `DELETE FROM parcelas 
         WHERE conta_id = ? AND numero_parcela > ? AND status = 'pendente';`,
        [contaId, numParcela]
      );
    }
  });
}

/**
 * Exclui uma parcela individual ou uma recorrente e suas futuras
 */
export async function excluirParcela(
  parcelaId: number,
  escopoRecorrente?: 'apenas_esta' | 'esta_e_futuras'
): Promise<void> {
  await executarEmTransacao((db) => {
    const res = db.exec(
      `SELECT p.conta_id, p.numero_parcela, p.data_vencimento, c.tipo, c.frequencia_recorrencia, c.dia_base, c.valor_total
       FROM parcelas p
       INNER JOIN contas c ON p.conta_id = c.id
       WHERE p.id = ?;`,
      [parcelaId]
    );

    if (!res[0]?.values?.length) return;

    const contaId = res[0].values[0][0] as number;
    const tipo = res[0].values[0][3] as TipoConta;

    if (tipo === 'recorrente' && escopoRecorrente === 'esta_e_futuras') {
      // Exclui a conta e todas as suas parcelas
      db.run('DELETE FROM parcelas WHERE conta_id = ?;', [contaId]);
      db.run('DELETE FROM contas WHERE id = ?;', [contaId]);
      return;
    }

    // Exclui apenas esta parcela
    db.run('DELETE FROM parcelas WHERE id = ?;', [parcelaId]);

    // Verifica quantas parcelas restaram na conta
    const resResto = db.exec('SELECT COUNT(*) as total FROM parcelas WHERE conta_id = ?;', [contaId]);
    const totalRestante = (resResto[0]?.values[0]?.[0] as number) || 0;

    if (totalRestante === 0) {
      db.run('DELETE FROM contas WHERE id = ?;', [contaId]);
    } else if (tipo === 'recorrente') {
      // Se for recorrente e não sobrou nenhuma pendente, gera a próxima
      const checkPend = db.exec(`SELECT id FROM parcelas WHERE conta_id = ? AND status = 'pendente';`, [contaId]);
      if (!checkPend[0]?.values?.length) {
        const ult = db.exec(`SELECT data_vencimento, numero_parcela FROM parcelas WHERE conta_id = ? ORDER BY numero_parcela DESC LIMIT 1;`, [contaId]);
        if (ult[0]?.values?.length) {
          const ultVenc = ult[0].values[0][0] as string;
          const ultNum = ult[0].values[0][1] as number;
          const freq = (res[0].values[0][4] as FrequenciaRecorrencia) || 'mensal';
          const diaBase = (res[0].values[0][5] as number) || 1;
          const valor = res[0].values[0][6] as number;
          const proxVenc = calcularProximoVencimento(ultVenc, freq, diaBase);

          db.run(
            `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
             VALUES (?, ?, ?, ?, ?, NULL, 'pendente', NULL);`,
            [contaId, ultNum + 1, ultNum + 1, valor, proxVenc]
          );
        }
      }
    }
  });
}

export interface DadosRestauracaoExclusao {
  tipoExclusao: 'parcela' | 'conta';
  conta: {
    id: number;
    descricao: string;
    categoria_id: number;
    valor_total: number;
    tipo: TipoConta;
    forma_pagamento: string;
    observacoes?: string | null;
    data_criacao: string;
    frequencia_recorrencia?: FrequenciaRecorrencia | null;
    dia_base?: number | null;
  };
  parcelas: Parcela[];
}

export async function prepararDadosRestauracao(parcelaId: number): Promise<DadosRestauracaoExclusao | null> {
  const db = await getDb();
  const resP = db.exec('SELECT conta_id FROM parcelas WHERE id = ?;', [parcelaId]);
  if (!resP[0]?.values?.length) return null;
  const contaId = resP[0].values[0][0] as number;

  const resC = db.exec('SELECT id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao, frequencia_recorrencia, dia_base FROM contas WHERE id = ?;', [contaId]);
  if (!resC[0]?.values?.length) return null;
  const cRow = resC[0].values[0];

  const todas = await listarParcelas({ categoria_id: 'todas', mesAno: 'todos', status: 'todos' });
  const parcelasDaConta = todas.filter((p) => p.conta_id === contaId);

  return {
    tipoExclusao: 'conta',
    conta: {
      id: cRow[0] as number,
      descricao: cRow[1] as string,
      categoria_id: cRow[2] as number,
      valor_total: cRow[3] as number,
      tipo: cRow[4] as TipoConta,
      forma_pagamento: cRow[5] as string,
      observacoes: cRow[6] as string | null,
      data_criacao: cRow[7] as string,
      frequencia_recorrencia: cRow[8] as FrequenciaRecorrencia | null,
      dia_base: cRow[9] as number | null,
    },
    parcelas: parcelasDaConta,
  };
}

/**
 * Exclui uma parcela individual retornando o snapshot para desfazer a exclusão
 */
export async function excluirParcelaIndividual(parcelaId: number): Promise<DadosRestauracaoExclusao> {
  const dados = await prepararDadosRestauracao(parcelaId);
  if (!dados) {
    throw new Error('Parcela não encontrada para exclusão.');
  }

  const dadosParaRestaurar: DadosRestauracaoExclusao = {
    tipoExclusao: 'parcela',
    conta: dados.conta,
    parcelas: dados.parcelas.filter((p) => p.id === parcelaId),
  };

  await excluirParcela(parcelaId, 'apenas_esta');
  return dadosParaRestaurar;
}

/**
 * Exclui a conta inteira e todas as suas parcelas em transação atômica,
 * retornando os dados completos para o botão 'Desfazer'.
 */
export async function excluirContaInteiraTransacao(contaId: number): Promise<DadosRestauracaoExclusao> {
  const db = await getDb();
  const resC = db.exec(
    'SELECT id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao, frequencia_recorrencia, dia_base FROM contas WHERE id = ?;',
    [contaId]
  );
  if (!resC[0]?.values?.length) {
    throw new Error('Conta não encontrada para exclusão.');
  }
  const cRow = resC[0].values[0];
  const todas = await listarParcelas({ categoria_id: 'todas', mesAno: 'todos', status: 'todos' });
  const parcelasDaConta = todas.filter((p) => p.conta_id === contaId);

  const dados: DadosRestauracaoExclusao = {
    tipoExclusao: 'conta',
    conta: {
      id: cRow[0] as number,
      descricao: cRow[1] as string,
      categoria_id: cRow[2] as number,
      valor_total: cRow[3] as number,
      tipo: cRow[4] as TipoConta,
      forma_pagamento: cRow[5] as string,
      observacoes: cRow[6] as string | null,
      data_criacao: cRow[7] as string,
      frequencia_recorrencia: cRow[8] as FrequenciaRecorrencia | null,
      dia_base: cRow[9] as number | null,
    },
    parcelas: parcelasDaConta,
  };

  await executarEmTransacao((transDb) => {
    transDb.run('DELETE FROM parcelas WHERE conta_id = ?;', [contaId]);
    transDb.run('DELETE FROM contas WHERE id = ?;', [contaId]);
  });

  return dados;
}

export async function restaurarExclusao(dados: DadosRestauracaoExclusao): Promise<void> {
  await executarEmTransacao((db) => {
    db.run(
      `INSERT OR REPLACE INTO contas (id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao, frequencia_recorrencia, dia_base)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        dados.conta.id,
        dados.conta.descricao,
        dados.conta.categoria_id,
        dados.conta.valor_total,
        dados.conta.tipo,
        dados.conta.forma_pagamento,
        dados.conta.observacoes ?? null,
        dados.conta.data_criacao,
        dados.conta.frequencia_recorrencia || null,
        dados.conta.dia_base || null,
      ]
    );

    for (const p of dados.parcelas) {
      db.run(
        `INSERT OR REPLACE INTO parcelas (id, conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          p.id,
          p.conta_id,
          p.numero_parcela,
          p.total_parcelas,
          p.valor,
          p.data_vencimento,
          p.data_pagamento || null,
          p.status === 'atrasado' ? 'pendente' : p.status,
          p.valor_pago || null,
        ]
      );
    }
  });
}

// ==========================================
// LISTAGEM DE PARCELAS COM STATUS DERIVADO
// ==========================================

export async function listarParcelas(filtros: FiltrosParcela = {}): Promise<Parcela[]> {
  const db = await getDb();
  const hoje = getHojeIso();

  let sql = `
    SELECT 
      p.id,
      p.conta_id,
      p.numero_parcela,
      p.total_parcelas,
      p.valor,
      p.data_vencimento,
      p.data_pagamento,
      p.status,
      p.valor_pago,
      c.descricao AS conta_descricao,
      c.categoria_id,
      cat.nome AS categoria_nome,
      cat.cor AS categoria_cor,
      c.tipo AS tipo_conta,
      c.forma_pagamento,
      c.observacoes
    FROM parcelas p
    INNER JOIN contas c ON p.conta_id = c.id
    INNER JOIN categorias cat ON c.categoria_id = cat.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filtros.mesAno && filtros.mesAno !== 'todos') {
    sql += " AND strftime('%Y-%m', p.data_vencimento) = ?";
    params.push(filtros.mesAno);
  }

  if (filtros.categoria_id && filtros.categoria_id !== 'todas') {
    sql += ' AND c.categoria_id = ?';
    params.push(filtros.categoria_id);
  }

  if (filtros.tipo && filtros.tipo !== 'todos') {
    sql += ' AND c.tipo = ?';
    params.push(filtros.tipo);
  }

  if (filtros.busca && filtros.busca.trim() !== '') {
    sql += ' AND (LOWER(c.descricao) LIKE ? OR LOWER(c.observacoes) LIKE ?)';
    const termo = `%${filtros.busca.trim().toLowerCase()}%`;
    params.push(termo, termo);
  }

  sql += ' ORDER BY p.data_vencimento ASC, p.id ASC;';

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const parcelas: Parcela[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    // Deriva o status em tempo de execução
    const statusDerivado = derivarStatus(row.status, row.data_vencimento, hoje);

    // Aplica filtro de status após a derivação segura
    if (filtros.status && filtros.status !== 'todos') {
      if (filtros.status === 'pendente' && statusDerivado !== 'pendente') continue;
      if (filtros.status === 'pago' && statusDerivado !== 'pago') continue;
      if (filtros.status === 'atrasado' && statusDerivado !== 'atrasado') continue;
    }

    parcelas.push({
      id: row.id,
      conta_id: row.conta_id,
      numero_parcela: row.numero_parcela,
      total_parcelas: row.total_parcelas,
      valor: row.valor,
      data_vencimento: row.data_vencimento,
      data_pagamento: row.data_pagamento || null,
      status: statusDerivado,
      valor_pago: row.valor_pago || null,
      conta_descricao: row.conta_descricao,
      categoria_id: row.categoria_id,
      categoria_nome: row.categoria_nome,
      categoria_cor: row.categoria_cor,
      tipo_conta: row.tipo_conta,
      forma_pagamento: row.forma_pagamento,
      observacoes: row.observacoes,
    });
  }
  stmt.free();

  return parcelas;
}

// ==========================================
// PARCELAMENTOS CONSOLIDADOS
// ==========================================

export async function listarParcelamentos(): Promise<ParcelamentoItem[]> {
  const db = await getDb();
  const hoje = getHojeIso();

  const stmtContas = db.prepare(`
    SELECT 
      c.id AS conta_id,
      c.descricao,
      c.categoria_id,
      cat.nome AS categoria_nome,
      cat.cor AS categoria_cor,
      c.forma_pagamento,
      c.tipo,
      c.valor_total
    FROM contas c
    INNER JOIN categorias cat ON c.categoria_id = cat.id
    WHERE c.tipo = 'parcelada'
    ORDER BY c.id DESC;
  `);

  const contas: any[] = [];
  while (stmtContas.step()) {
    contas.push(stmtContas.getAsObject());
  }
  stmtContas.free();

  if (contas.length === 0) return [];

  const stmtTodasParcelas = db.prepare(`
    SELECT 
      p.id, p.conta_id, p.numero_parcela, p.total_parcelas, p.valor, p.data_vencimento, p.data_pagamento, p.status, p.valor_pago
    FROM parcelas p
    INNER JOIN contas c ON p.conta_id = c.id
    WHERE c.tipo = 'parcelada'
    ORDER BY p.conta_id DESC, p.numero_parcela ASC;
  `);

  const parcelasPorConta = new Map<number, Parcela[]>();
  while (stmtTodasParcelas.step()) {
    const raw = stmtTodasParcelas.getAsObject() as any;
    const status = derivarStatus(raw.status, raw.data_vencimento, hoje);
    const p: Parcela = {
      ...raw,
      status,
    };
    const lista = parcelasPorConta.get(p.conta_id) || [];
    lista.push(p);
    parcelasPorConta.set(p.conta_id, lista);
  }
  stmtTodasParcelas.free();

  return contas.map((c) => {
    const parcelas = parcelasPorConta.get(c.conta_id) || [];
    let parcelasPagas = 0;
    let valorPago = 0;
    let proximoVencimento: string | null = null;
    let temAtraso = false;

    for (const p of parcelas) {
      if (p.status === 'pago') {
        parcelasPagas++;
        valorPago += p.valor_pago || p.valor;
      } else {
        if (p.status === 'atrasado') {
          temAtraso = true;
        }
        if (!proximoVencimento) {
          proximoVencimento = p.data_vencimento;
        }
      }
    }

    const totalParcelas = parcelas.length || 1;
    const saldoRestante = Math.max(0, c.valor_total - valorPago);
    let statusGeral: 'concluido' | 'em_andamento' | 'com_atraso' = 'em_andamento';

    if (parcelasPagas === totalParcelas) {
      statusGeral = 'concluido';
    } else if (temAtraso) {
      statusGeral = 'com_atraso';
    }

    return {
      conta_id: c.conta_id,
      descricao: c.descricao,
      categoria_id: c.categoria_id,
      categoria_nome: c.categoria_nome,
      categoria_cor: c.categoria_cor,
      forma_pagamento: c.forma_pagamento,
      tipo: c.tipo,
      valor_total: c.valor_total,
      total_parcelas: totalParcelas,
      parcelas_pagas: parcelasPagas,
      valor_pago: valorPago,
      saldo_restante: saldoRestante,
      proximo_vencimento: proximoVencimento,
      status_geral: statusGeral,
      parcelas,
    };
  });
}

// ==========================================
// COFRINHO (ESTRUTURA DEDICADA)
// ==========================================

export async function listarCofrinhos(): Promise<CofrinhoComProgresso[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT 
      c.id, c.nome, c.valor_meta, c.total_parcelas, c.valor_parcela, c.data_inicio, c.concluido, c.data_criacao,
      COALESCE(SUM(CASE WHEN d.valor > 0 THEN d.valor ELSE 0 END), 0) AS total_guardado,
      COALESCE(SUM(CASE WHEN d.valor < 0 THEN ABS(d.valor) ELSE 0 END), 0) AS total_retirado,
      COUNT(d.id) AS qtd_depositos
    FROM cofrinhos c
    LEFT JOIN cofrinho_depositos d ON d.cofrinho_id = c.id
    GROUP BY c.id
    ORDER BY c.concluido ASC, c.id DESC;
  `);

  const cofrinhos: CofrinhoComProgresso[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    const totalGuardado = row.total_guardado as number;
    const totalRetirado = row.total_retirado as number;
    const saldoAtual = Math.max(0, totalGuardado - totalRetirado);
    const meta = row.valor_meta as number;
    const percentual = meta > 0 ? Math.min(100, (saldoAtual / meta) * 100) : 0;
    const saldoRestante = Math.max(0, meta - saldoAtual);

    cofrinhos.push({
      id: row.id,
      nome: row.nome,
      valor_meta: meta,
      total_parcelas: row.total_parcelas,
      valor_parcela: row.valor_parcela,
      data_inicio: row.data_inicio,
      concluido: row.concluido,
      data_criacao: row.data_criacao,
      total_guardado: totalGuardado,
      total_retirado: totalRetirado,
      saldo_atual: saldoAtual,
      percentual,
      saldo_restante: saldoRestante,
      qtd_depositos: row.qtd_depositos,
    });
  }
  stmt.free();
  return cofrinhos;
}

export async function criarCofrinho(input: {
  nome: string;
  valor_meta: number; // centavos
  total_parcelas: number;
  valor_parcela: number; // centavos
  data_inicio: string;
}): Promise<number> {
  const hoje = getHojeIso();
  const db = await getDb();

  db.run(
    `INSERT INTO cofrinhos (nome, valor_meta, total_parcelas, valor_parcela, data_inicio, concluido, data_criacao)
     VALUES (?, ?, ?, ?, ?, 0, ?);`,
    [input.nome.trim(), input.valor_meta, input.total_parcelas, input.valor_parcela, input.data_inicio, hoje]
  );
  const res = db.exec('SELECT last_insert_rowid() as id;');
  persistirDb();
  return res[0]?.values[0]?.[0] as number;
}

export async function registrarDepositoCofrinho(
  cofrinhoId: number,
  valorCentavos: number,
  dataDeposito?: string,
  observacao?: string
): Promise<number> {
  const db = await getDb();
  const data = dataDeposito || getHojeIso();

  db.run(
    `INSERT INTO cofrinho_depositos (cofrinho_id, valor, data_deposito, observacao)
     VALUES (?, ?, ?, ?);`,
    [cofrinhoId, Math.abs(valorCentavos), data, observacao || null]
  );
  const res = db.exec('SELECT last_insert_rowid() as id;');
  persistirDb();
  return res[0]?.values[0]?.[0] as number;
}

export async function registrarRetiradaCofrinho(
  cofrinhoId: number,
  valorCentavos: number,
  dataRetirada?: string,
  observacao?: string,
  contaVinculadaId?: number
): Promise<number> {
  const db = await getDb();
  const data = dataRetirada || getHojeIso();

  // Valor negativo para representar saída
  const valorNegativo = -Math.abs(valorCentavos);

  db.run(
    `INSERT INTO cofrinho_depositos (cofrinho_id, valor, data_deposito, observacao, conta_vinculada_id)
     VALUES (?, ?, ?, ?, ?);`,
    [cofrinhoId, valorNegativo, data, observacao || null, contaVinculadaId || null]
  );
  const res = db.exec('SELECT last_insert_rowid() as id;');
  persistirDb();
  return res[0]?.values[0]?.[0] as number;
}

export async function listarDepositosCofrinho(cofrinhoId: number): Promise<CofrinhoDeposito[]> {
  const db = await getDb();
  const stmt = db.prepare(
    `SELECT id, cofrinho_id, valor, data_deposito, observacao, conta_vinculada_id
     FROM cofrinho_depositos
     WHERE cofrinho_id = ?
     ORDER BY data_deposito DESC, id DESC;`
  );
  stmt.bind([cofrinhoId]);
  const depositos: CofrinhoDeposito[] = [];
  while (stmt.step()) {
    depositos.push(stmt.getAsObject() as unknown as CofrinhoDeposito);
  }
  stmt.free();
  return depositos;
}

export async function excluirCofrinho(cofrinhoId: number): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM cofrinho_depositos WHERE cofrinho_id = ?;', [cofrinhoId]);
  db.run('DELETE FROM cofrinhos WHERE id = ?;', [cofrinhoId]);
  persistirDb();
}

export async function marcarCofrinhoConcluido(cofrinhoId: number, concluido: boolean): Promise<void> {
  const db = await getDb();
  db.run('UPDATE cofrinhos SET concluido = ? WHERE id = ?;', [concluido ? 1 : 0, cofrinhoId]);
  persistirDb();
}

// ==========================================
// MÉTRICAS DO DASHBOARD (SEPARAÇÃO DE COFRINHO)
// ==========================================

export async function obterMetricasDashboard(mesAnoRef?: string): Promise<DashboardMetrics> {
  const db = await getDb();
  const hoje = getHojeIso();
  const mesAnoAtual = mesAnoRef || hoje.slice(0, 7);

  // 1. Total pago no mês selecionado (operações normais de pagamento)
  const stmtPago = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(p.valor_pago, p.valor)), 0) AS total
    FROM parcelas p
    WHERE p.status = 'pago' 
      AND (strftime('%Y-%m', p.data_pagamento) = ? OR (p.data_pagamento IS NULL AND strftime('%Y-%m', p.data_vencimento) = ?));
  `);
  stmtPago.bind([mesAnoAtual, mesAnoAtual]);
  stmtPago.step();
  const totalPagoMes = (stmtPago.getAsObject().total as number) || 0;
  stmtPago.free();

  // 2. Total a pagar no mês (apenas pendentes cujo vencimento cai no mês)
  const stmtAPagar = db.prepare(`
    SELECT COALESCE(SUM(p.valor), 0) AS total
    FROM parcelas p
    WHERE p.status = 'pendente'
      AND strftime('%Y-%m', p.data_vencimento) = ?;
  `);
  stmtAPagar.bind([mesAnoAtual]);
  stmtAPagar.step();
  const totalAPagarMes = (stmtAPagar.getAsObject().total as number) || 0;
  stmtAPagar.free();

  // 3. Total atrasado (pendente com vencimento < hoje)
  const stmtAtrasado = db.prepare(`
    SELECT COALESCE(SUM(p.valor), 0) AS total, COUNT(*) AS qtd
    FROM parcelas p
    WHERE p.status = 'pendente' AND p.data_vencimento < ?;
  `);
  stmtAtrasado.bind([hoje]);
  stmtAtrasado.step();
  const resAtrasado = stmtAtrasado.getAsObject();
  const totalAtrasado = (resAtrasado.total as number) || 0;
  const qtdAtrasadas = (resAtrasado.qtd as number) || 0;
  stmtAtrasado.free();

  // 4. Próximos 7 dias
  const dataMais7 = new Date();
  dataMais7.setDate(dataMais7.getDate() + 7);
  const dataMais7Str = dataMais7.toISOString().slice(0, 10);

  const stmt7Dias = db.prepare(`
    SELECT COALESCE(SUM(p.valor), 0) AS total
    FROM parcelas p
    WHERE p.status = 'pendente'
      AND p.data_vencimento >= ?
      AND p.data_vencimento <= ?;
  `);
  stmt7Dias.bind([hoje, dataMais7Str]);
  stmt7Dias.step();
  const totalVencendo7Dias = (stmt7Dias.getAsObject().total as number) || 0;
  stmt7Dias.free();

  // 5. Contas vencendo hoje
  const stmtHoje = db.prepare(`
    SELECT COUNT(*) AS qtd
    FROM parcelas p
    WHERE p.status = 'pendente' AND p.data_vencimento = ?;
  `);
  stmtHoje.bind([hoje]);
  stmtHoje.step();
  const qtdVencendoHoje = (stmtHoje.getAsObject().qtd as number) || 0;
  stmtHoje.free();

  // 6. Gastos operacionais por categoria no mês (Gastos normais)
  const stmtCat = db.prepare(`
    SELECT 
      cat.id AS categoria_id,
      cat.nome AS categoria_nome,
      cat.cor AS categoria_cor,
      COALESCE(SUM(p.valor), 0) AS total
    FROM parcelas p
    INNER JOIN contas c ON p.conta_id = c.id
    INNER JOIN categorias cat ON c.categoria_id = cat.id
    WHERE strftime('%Y-%m', p.data_vencimento) = ?
    GROUP BY cat.id
    ORDER BY total DESC;
  `);
  stmtCat.bind([mesAnoAtual]);

  let somaTotalCat = 0;
  const gastosRaw: any[] = [];
  while (stmtCat.step()) {
    const row = stmtCat.getAsObject() as any;
    gastosRaw.push(row);
    somaTotalCat += row.total;
  }
  stmtCat.free();

  const gastosPorCategoria = gastosRaw.map((g) => ({
    ...g,
    percentual: somaTotalCat > 0 ? (g.total / somaTotalCat) * 100 : 0,
  }));

  const totalGastosMes = totalPagoMes + totalAPagarMes;

  // 7. Total guardado no Cofrinho no mês selecionado (Soma real de depósitos no mês)
  const stmtCofMes = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS totalMes
    FROM cofrinho_depositos
    WHERE strftime('%Y-%m', data_deposito) = ?;
  `);
  stmtCofMes.bind([mesAnoAtual]);
  stmtCofMes.step();
  const totalEconomiasMes = (stmtCofMes.getAsObject().totalMes as number) || 0;
  stmtCofMes.free();

  // 8. Saldo acumulado real de todos os cofrinhos
  const stmtCofTotal = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS totalGeral
    FROM cofrinho_depositos;
  `);
  stmtCofTotal.step();
  const reservaAcumuladaTotal = (stmtCofTotal.getAsObject().totalGeral as number) || 0;
  stmtCofTotal.free();

  // 9. Linha do Tempo de 5 Meses (-2 meses passados, mês atual e +2 meses futuros)
  const mesesEvolucao: any[] = [];
  const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [refAno, refMes] = mesAnoAtual.split('-').map(Number);

  for (let offset = -2; offset <= 2; offset++) {
    const dt = new Date(refAno, refMes - 1 + offset, 1);
    const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const lbl = `${nomesMeses[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;
    const tipoMes: 'passado' | 'atual' | 'futuro' = offset < 0 ? 'passado' : offset === 0 ? 'atual' : 'futuro';

    // Despesas operacionais do mês
    const stmtMes = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.status = 'pago' THEN COALESCE(p.valor_pago, p.valor) ELSE 0 END), 0) AS pago,
        COALESCE(SUM(CASE WHEN p.status = 'pendente' THEN p.valor ELSE 0 END), 0) AS pendente
      FROM parcelas p
      WHERE strftime('%Y-%m', p.data_vencimento) = ?;
    `);
    stmtMes.bind([mStr]);
    stmtMes.step();
    const row = stmtMes.getAsObject() as { pago: number; pendente: number };
    stmtMes.free();

    // Depósitos no cofrinho no mês
    const stmtMesCof = db.prepare(`
      SELECT COALESCE(SUM(valor), 0) AS economias
      FROM cofrinho_depositos
      WHERE strftime('%Y-%m', data_deposito) = ?;
    `);
    stmtMesCof.bind([mStr]);
    stmtMesCof.step();
    const econ = (stmtMesCof.getAsObject().economias as number) || 0;
    stmtMesCof.free();

    mesesEvolucao.push({
      mesAno: mStr,
      label: lbl,
      pago: row.pago,
      pendente: row.pendente,
      total: row.pago + row.pendente,
      gastos: row.pago + row.pendente,
      economias: econ,
      tipoMes,
    });
  }

  // 10. Próximos vencimentos em destaque
  const listaDestaque = await listarParcelas({
    status: 'pendente',
    mesAno: 'todos',
    ordenacao: 'vencimento_asc',
  });

  return {
    totalPagoMes,
    totalAPagarMes,
    totalAtrasado,
    totalVencendo7Dias,
    qtdVencendoHoje,
    qtdAtrasadas,
    totalGastosMes,
    totalEconomiasMes,
    totalReservasMes: 0,
    residualMes: 0,
    reservaAcumuladaTotal,
    gastosPorCategoria,
    evolucaoMensal: mesesEvolucao,
    proximosVencimentos: listaDestaque.slice(0, 6),
  };
}

// ==========================================
// EXPORTAÇÃO CSV
// ==========================================

export async function gerarCsvParcelas(): Promise<string> {
  const parcelas = await listarParcelas({ ordenacao: 'vencimento_asc', mesAno: 'todos', status: 'todos' });

  const headers = [
    'ID Parcela',
    'Descrição da Conta',
    'Categoria',
    'Tipo',
    'Forma de Pagamento',
    'Parcela',
    'Total Parcelas',
    'Valor (R$)',
    'Data Vencimento',
    'Data Pagamento',
    'Status',
    'Valor Pago (R$)',
    'Observações',
  ];

  const rows = parcelas.map((p) => [
    p.id,
    `"${(p.conta_descricao || '').replace(/"/g, '""')}"`,
    `"${(p.categoria_nome || '').replace(/"/g, '""')}"`,
    p.tipo_conta || '',
    `"${(p.forma_pagamento || '').replace(/"/g, '""')}"`,
    p.numero_parcela,
    p.total_parcelas,
    centavosParaReais(p.valor).toFixed(2).replace('.', ','),
    p.data_vencimento.split('-').reverse().join('/'),
    p.data_pagamento ? p.data_pagamento.split('-').reverse().join('/') : '',
    p.status.toUpperCase(),
    p.valor_pago ? centavosParaReais(p.valor_pago).toFixed(2).replace('.', ',') : '',
    `"${(p.observacoes || '').replace(/"/g, '""')}"`,
  ]);

  // BOM UTF-8 (\uFEFF) com separador ';' para o Excel em português
  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

// ==========================================
// RASTREAMENTO DE NOTIFICAÇÕES ENVIADAS
// ==========================================

export async function jaFoiNotificada(parcelaId: number, dataVencimento: string): Promise<boolean> {
  const db = await getDb();
  const chave = `${parcelaId}_${dataVencimento}`;
  const res = db.exec('SELECT 1 FROM notificacoes_enviadas WHERE chave = ?;', [chave]);
  return (res[0]?.values?.length || 0) > 0;
}

export async function registrarNotificacaoEnviadaNoBanco(
  parcelaId: number,
  dataVencimento: string
): Promise<void> {
  const db = await getDb();
  const chave = `${parcelaId}_${dataVencimento}`;
  const hoje = getHojeIso();
  db.run(
    'INSERT OR REPLACE INTO notificacoes_enviadas (chave, parcela_id, data_vencimento, enviada_em) VALUES (?, ?, ?, ?);',
    [chave, parcelaId, dataVencimento, hoje]
  );
  persistirDb();
}
