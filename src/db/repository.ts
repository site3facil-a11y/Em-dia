/**
 * Camada de Acesso a Dados (DAO / Repository)
 * Todas as operações utilizam consultas SQL parametrizadas para máxima segurança e integridade.
 */
import { getDb, persistirDb, atualizarStatusAtrasados } from './sqlite';
import {
  Categoria,
  Conta,
  Parcela,
  ParcelamentoItem,
  FiltrosParcela,
  DashboardMetrics,
  TipoConta,
} from '../types';

/**
 * Função utilitária para avançar meses mantendo o dia original com segurança
 */
function calcularDataVencimento(dataBaseStr: string, mesesAAvancar: number): string {
  const [anoStr, mesStr, diaStr] = dataBaseStr.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10) - 1; // 0-index
  const diaDesejado = parseInt(diaStr, 10);

  // Criar data base no primeiro dia do mês alvo para não transbordar
  const dataAlvo = new Date(ano, mes + mesesAAvancar, 1);
  const anoAlvo = dataAlvo.getFullYear();
  const mesAlvo = dataAlvo.getMonth();

  // Quantidade de dias no mês alvo
  const ultimoDiaMesAlvo = new Date(anoAlvo, mesAlvo + 1, 0).getDate();
  const diaFinal = Math.min(diaDesejado, ultimoDiaMesAlvo);

  const d = new Date(anoAlvo, mesAlvo, diaFinal);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calcula vencimentos futuros de acordo com a periodicidade escolhida
 */
function calcularDataComFrequencia(
  dataBaseStr: string,
  indice: number,
  frequencia: 'mensal' | 'anual' | 'semanal' | 'quinzenal' = 'mensal'
): string {
  if (frequencia === 'mensal') {
    return calcularDataVencimento(dataBaseStr, indice);
  }
  if (frequencia === 'anual') {
    return calcularDataVencimento(dataBaseStr, indice * 12);
  }
  const [anoStr, mesStr, diaStr] = dataBaseStr.split('-');
  const base = new Date(parseInt(anoStr, 10), parseInt(mesStr, 10) - 1, parseInt(diaStr, 10));
  if (frequencia === 'semanal') {
    base.setDate(base.getDate() + indice * 7);
  } else if (frequencia === 'quinzenal') {
    base.setDate(base.getDate() + indice * 14);
  }
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  await persistirDb();
  return res[0]?.values[0]?.[0] as number;
}

export async function atualizarCategoria(id: number, nome: string, cor: string): Promise<void> {
  const db = await getDb();
  db.run('UPDATE categorias SET nome = ?, cor = ? WHERE id = ?;', [nome.trim(), cor.trim(), id]);
  await persistirDb();
}

export async function excluirCategoria(id: number): Promise<{ success: boolean; message?: string }> {
  const db = await getDb();
  // Verificar se há contas vinculadas
  const stmt = db.prepare('SELECT COUNT(*) as total FROM contas WHERE categoria_id = ?;');
  stmt.bind([id]);
  stmt.step();
  const total = (stmt.getAsObject().total as number) || 0;
  stmt.free();

  if (total > 0) {
    return {
      success: false,
      message: `Não é possível excluir esta categoria porque existem ${total} conta(s) vinculadas a ela.`,
    };
  }

  db.run('DELETE FROM categorias WHERE id = ?;', [id]);
  await persistirDb();
  return { success: true };
}

// ==========================================
// CONTAS & PARCELAS
// ==========================================

/**
 * Converte erros técnicos do SQLite em mensagens claras em português
 */
export function formatarErroAmigavel(err: any): Error {
  const msg = (err?.message || String(err || '')).toLowerCase();
  if (msg.includes('foreign key constraint failed')) {
    return new Error('A categoria selecionada não foi encontrada ou não é válida. Por favor, selecione uma categoria válida.');
  }
  if (msg.includes('unique constraint failed')) {
    return new Error('Já existe um registro cadastrado com estes dados.');
  }
  if (msg.includes('check constraint failed')) {
    return new Error('Os valores informados não atendem aos critérios de validação (ex: tipo de conta ou parcelas inválidas).');
  }
  if (msg.includes('not null constraint failed')) {
    return new Error('Por favor, preencha todos os campos obrigatórios.');
  }
  return new Error(err?.message || 'Não foi possível salvar o pagamento. Tente novamente.');
}

export interface NovaContaInput {
  descricao: string;
  categoria_id: number;
  valor_total: number;
  tipo: TipoConta;
  forma_pagamento: string;
  observacoes?: string;
  data_primeiro_vencimento: string; // YYYY-MM-DD
  numero_parcelas?: number; // Para parceladas
  frequencia_recorrencia?: 'mensal' | 'anual' | 'semanal' | 'quinzenal';
}

export async function criarConta(input: NovaContaInput): Promise<number> {
  const db = await getDb();
  // Garante que PRAGMA foreign_keys está ativo
  db.run('PRAGMA foreign_keys = ON;');
  const hoje = new Date().toISOString().slice(0, 10);

  // 1. Valida se a categoria existe. Se não existir nenhuma categoria, cria "Outros"
  let categoriaId = input.categoria_id;
  const catCheck = db.exec('SELECT id FROM categorias WHERE id = ?;', [categoriaId]);
  if (!catCheck[0]?.values?.length) {
    const anyCat = db.exec('SELECT id FROM categorias ORDER BY id ASC LIMIT 1;');
    if (anyCat[0]?.values?.length) {
      categoriaId = anyCat[0].values[0][0] as number;
    } else {
      // Cria a categoria "Outros" caso a tabela esteja vazia
      db.run("INSERT INTO categorias (nome, cor) VALUES ('Outros', '#64748b');");
      const newCatRes = db.exec('SELECT last_insert_rowid() as id;');
      categoriaId = (newCatRes[0]?.values[0]?.[0] as number) || 1;
    }
  }

  // 2. Grava a conta e todas as parcelas dentro de uma única transação atômica
  db.run('BEGIN TRANSACTION;');

  try {
    db.run(
      `INSERT INTO contas (descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        input.descricao.trim(),
        categoriaId,
        input.valor_total,
        input.tipo,
        input.forma_pagamento || 'Geral',
        input.observacoes ? input.observacoes.trim() : null,
        hoje,
      ]
    );

    // Obtém o id da conta com "SELECT last_insert_rowid()" logo após o INSERT na mesma transação
    const res = db.exec('SELECT last_insert_rowid() as id;');
    const contaId = res[0]?.values[0]?.[0] as number;

    if (!contaId) {
      throw new Error('Falha ao obter o identificador da conta criada.');
    }

    // Geração de Parcelas com base no tipo usando o contaId obtido
    if (input.tipo === 'unica') {
      const status = input.data_primeiro_vencimento < hoje ? 'atrasado' : 'pendente';
      db.run(
        `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
         VALUES (?, 1, 1, ?, ?, NULL, ?, NULL);`,
        [contaId, input.valor_total, input.data_primeiro_vencimento, status]
      );
    } else if (input.tipo === 'recorrente') {
      const freq = input.frequencia_recorrencia || 'mensal';
      const qtdParcelas = freq === 'anual' ? 5 : (freq === 'semanal' ? 12 : (freq === 'quinzenal' ? 12 : 12));
      for (let i = 0; i < qtdParcelas; i++) {
        const dataVenc = calcularDataComFrequencia(input.data_primeiro_vencimento, i, freq);
        const status = dataVenc < hoje ? 'atrasado' : 'pendente';
        db.run(
          `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL);`,
          [contaId, i + 1, qtdParcelas, input.valor_total, dataVenc, status]
        );
      }
    } else if (input.tipo === 'parcelada') {
      const totalParcelas = Math.max(1, input.numero_parcelas || 1);
      const valorParcelaBase = Math.floor((input.valor_total / totalParcelas) * 100) / 100;
      const residuo = Math.round((input.valor_total - valorParcelaBase * totalParcelas) * 100) / 100;

      for (let i = 0; i < totalParcelas; i++) {
        const valor = i === 0 ? Number((valorParcelaBase + residuo).toFixed(2)) : valorParcelaBase;
        const dataVenc = calcularDataVencimento(input.data_primeiro_vencimento, i);
        const status = dataVenc < hoje ? 'atrasado' : 'pendente';

        db.run(
          `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
           VALUES (?, ?, ?, ?, ?, NULL, ?, NULL);`,
          [contaId, i + 1, totalParcelas, valor, dataVenc, status]
        );
      }
    }

    db.run('COMMIT;');

    atualizarStatusAtrasados(db);
    await persistirDb();
    return contaId;
  } catch (err: any) {
    try {
      db.run('ROLLBACK;');
    } catch {
      // Ignora erro de rollback se não houver transação ativa
    }
    throw formatarErroAmigavel(err);
  }
}

export async function excluirConta(contaId: number): Promise<void> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = ON;');
  db.run('BEGIN TRANSACTION;');
  try {
    // Exclui parcelas antes da conta dentro da transação para não violar foreign key
    db.run('DELETE FROM parcelas WHERE conta_id = ?;', [contaId]);
    db.run('DELETE FROM contas WHERE id = ?;', [contaId]);
    db.run('COMMIT;');
    await persistirDb();
  } catch (err: any) {
    try { db.run('ROLLBACK;'); } catch {}
    throw formatarErroAmigavel(err);
  }
}

export interface EditarParcelaInput {
  parcelaId: number;
  descricao: string;
  categoria_id: number;
  valor: number;
  data_vencimento: string;
  forma_pagamento: string;
  observacoes?: string;
  escopo: 'apenas_esta' | 'esta_e_proximas';
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
  };
  parcelas: Parcela[];
}

/**
 * Atualiza os dados de uma parcela e sua conta dentro de uma transação segura.
 * Se a parcela estiver paga, o valor não pode ser alterado sem desfazer o pagamento.
 */
export async function editarParcelaEConta(input: EditarParcelaInput): Promise<void> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = ON;');

  const res = db.exec(`
    SELECT p.id, p.conta_id, p.numero_parcela, p.total_parcelas, p.valor, p.data_vencimento, p.status, c.tipo
    FROM parcelas p
    JOIN contas c ON p.conta_id = c.id
    WHERE p.id = ?;
  `, [input.parcelaId]);

  if (!res[0]?.values?.length) {
    throw new Error('A parcela selecionada não foi encontrada no banco SQLite.');
  }

  const [id, contaId, numeroParcela, totalParcelas, valorAtual, dataVencAtual, status, tipoConta] = res[0].values[0];

  // Não permite editar o valor de uma parcela paga sem antes desfazer o pagamento
  if (status === 'pago' && Math.abs(Number(valorAtual) - input.valor) > 0.001) {
    throw new Error('Não é permitido alterar o valor de uma parcela já paga. Desfaça o pagamento primeiro.');
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const novoStatus = status === 'pago' ? 'pago' : (input.data_vencimento < hoje ? 'atrasado' : 'pendente');

  db.run('BEGIN TRANSACTION;');
  try {
    // 1. Atualiza dados gerais da conta
    db.run(
      `UPDATE contas 
       SET descricao = ?, categoria_id = ?, forma_pagamento = ?, observacoes = ?
       WHERE id = ?;`,
      [input.descricao.trim(), input.categoria_id, input.forma_pagamento, input.observacoes?.trim() || null, contaId]
    );

    // 2. Atualiza a parcela selecionada
    if (status !== 'pago') {
      db.run(
        `UPDATE parcelas 
         SET valor = ?, data_vencimento = ?, status = ?
         WHERE id = ?;`,
        [input.valor, input.data_vencimento, novoStatus, input.parcelaId]
      );
    } else {
      // Mantém valor e valor_pago intactos se estiver paga
      db.run(
        `UPDATE parcelas 
         SET data_vencimento = ?
         WHERE id = ?;`,
        [input.data_vencimento, input.parcelaId]
      );
    }

    // 3. Se for 'esta_e_proximas' em parcelada/recorrente: aplica o valor apenas às próximas parcelas NÃO PAGAS
    if (input.escopo === 'esta_e_proximas' && (tipoConta === 'parcelada' || tipoConta === 'recorrente')) {
      db.run(
        `UPDATE parcelas 
         SET valor = ?
         WHERE conta_id = ? AND numero_parcela > ? AND status != 'pago';`,
        [input.valor, contaId, numeroParcela]
      );
    }

    // 4. Recalcula o valor_total da conta no SQLite
    db.run(
      `UPDATE contas 
       SET valor_total = (SELECT COALESCE(SUM(valor), 0) FROM parcelas WHERE conta_id = ?)
       WHERE id = ?;`,
      [contaId, contaId]
    );

    db.run('COMMIT;');
    atualizarStatusAtrasados(db);
    await persistirDb();
  } catch (err: any) {
    try { db.run('ROLLBACK;'); } catch {}
    throw formatarErroAmigavel(err);
  }
}

/**
 * Exclui uma parcela individual de uma conta parcelada ou recorrente.
 * Se for a única parcela restante, remove a conta inteira.
 */
export async function excluirParcelaIndividual(parcelaId: number): Promise<DadosRestauracaoExclusao> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = ON;');

  const resParcela = db.exec(`
    SELECT p.id, p.conta_id, p.numero_parcela, p.total_parcelas, p.valor, p.data_vencimento, p.data_pagamento, p.status, p.valor_pago,
           c.descricao, c.categoria_id, c.valor_total, c.tipo, c.forma_pagamento, c.observacoes, c.data_criacao
    FROM parcelas p
    JOIN contas c ON p.conta_id = c.id
    WHERE p.id = ?;
  `, [parcelaId]);

  if (!resParcela[0]?.values?.length) {
    throw new Error('A parcela selecionada para exclusão não foi encontrada.');
  }

  const row = resParcela[0].values[0];
  const contaId = row[1] as number;
  const parcelaObj: Parcela = {
    id: row[0] as number,
    conta_id: contaId,
    numero_parcela: row[2] as number,
    total_parcelas: row[3] as number,
    valor: row[4] as number,
    data_vencimento: row[5] as string,
    data_pagamento: row[6] as string | null,
    status: row[7] as any,
    valor_pago: row[8] as number | null,
    conta_descricao: row[9] as string,
  };

  const contaObj = {
    id: contaId,
    descricao: row[9] as string,
    categoria_id: row[10] as number,
    valor_total: row[11] as number,
    tipo: row[12] as TipoConta,
    forma_pagamento: row[13] as string,
    observacoes: row[14] as string | null,
    data_criacao: row[15] as string,
  };

  const resCount = db.exec('SELECT COUNT(*) FROM parcelas WHERE conta_id = ?;', [contaId]);
  const qtdParcelas = (resCount[0]?.values[0]?.[0] as number) || 0;

  db.run('BEGIN TRANSACTION;');
  try {
    if (qtdParcelas <= 1) {
      // Exclui a parcela e a conta dentro da transação
      db.run('DELETE FROM parcelas WHERE id = ?;', [parcelaId]);
      db.run('DELETE FROM contas WHERE id = ?;', [contaId]);
      db.run('COMMIT;');
      await persistirDb();
      return {
        tipoExclusao: 'conta',
        conta: contaObj,
        parcelas: [parcelaObj],
      };
    } else {
      // Exclui apenas esta parcela e atualiza o total da conta
      db.run('DELETE FROM parcelas WHERE id = ?;', [parcelaId]);
      db.run(
        `UPDATE contas 
         SET valor_total = (SELECT COALESCE(SUM(valor), 0) FROM parcelas WHERE conta_id = ?)
         WHERE id = ?;`,
        [contaId, contaId]
      );
      db.run('COMMIT;');
      await persistirDb();
      return {
        tipoExclusao: 'parcela',
        conta: contaObj,
        parcelas: [parcelaObj],
      };
    }
  } catch (err: any) {
    try { db.run('ROLLBACK;'); } catch {}
    throw formatarErroAmigavel(err);
  }
}

/**
 * Exclui a conta inteira e todas as suas parcelas dentro de uma única transação,
 * apagando as parcelas antes da conta para manter a integridade referencial.
 */
export async function excluirContaInteiraTransacao(contaId: number): Promise<DadosRestauracaoExclusao> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = ON;');

  const resConta = db.exec('SELECT id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao FROM contas WHERE id = ?;', [contaId]);
  if (!resConta[0]?.values?.length) {
    throw new Error('A conta selecionada para exclusão não foi encontrada.');
  }
  const r = resConta[0].values[0];
  const contaObj = {
    id: r[0] as number,
    descricao: r[1] as string,
    categoria_id: r[2] as number,
    valor_total: r[3] as number,
    tipo: r[4] as TipoConta,
    forma_pagamento: r[5] as string,
    observacoes: r[6] as string | null,
    data_criacao: r[7] as string,
  };

  const resParc = db.exec(`
    SELECT id, conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago
    FROM parcelas
    WHERE conta_id = ?;
  `, [contaId]);

  const parcelasObj: Parcela[] = (resParc[0]?.values || []).map((row) => ({
    id: row[0] as number,
    conta_id: row[1] as number,
    numero_parcela: row[2] as number,
    total_parcelas: row[3] as number,
    valor: row[4] as number,
    data_vencimento: row[5] as string,
    data_pagamento: row[6] as string | null,
    status: row[7] as any,
    valor_pago: row[8] as number | null,
    conta_descricao: contaObj.descricao,
  }));

  db.run('BEGIN TRANSACTION;');
  try {
    // Exclui as parcelas antes da conta para não violar a chave estrangeira
    db.run('DELETE FROM parcelas WHERE conta_id = ?;', [contaId]);
    db.run('DELETE FROM contas WHERE id = ?;', [contaId]);
    db.run('COMMIT;');
    await persistirDb();

    return {
      tipoExclusao: 'conta',
      conta: contaObj,
      parcelas: parcelasObj,
    };
  } catch (err: any) {
    try { db.run('ROLLBACK;'); } catch {}
    throw formatarErroAmigavel(err);
  }
}

/**
 * Restaura uma exclusão (desfazer) re-inserindo a conta e suas parcelas originais
 */
export async function restaurarExclusao(dados: DadosRestauracaoExclusao): Promise<void> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = OFF;');

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(`
      INSERT OR REPLACE INTO contas (id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      dados.conta.id,
      dados.conta.descricao,
      dados.conta.categoria_id,
      dados.conta.valor_total,
      dados.conta.tipo,
      dados.conta.forma_pagamento,
      dados.conta.observacoes || null,
      dados.conta.data_criacao,
    ]);

    for (const p of dados.parcelas) {
      db.run(`
        INSERT OR REPLACE INTO parcelas (id, conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `, [
        p.id,
        p.conta_id,
        p.numero_parcela,
        p.total_parcelas,
        p.valor,
        p.data_vencimento,
        p.data_pagamento || null,
        p.status,
        p.valor_pago || null,
      ]);
    }

    db.run('COMMIT;');
    db.run('PRAGMA foreign_keys = ON;');
    atualizarStatusAtrasados(db);
    await persistirDb();
  } catch (err: any) {
    try { db.run('ROLLBACK;'); } catch {}
    db.run('PRAGMA foreign_keys = ON;');
    throw formatarErroAmigavel(err);
  }
}

export async function atualizarConta(
  contaId: number,
  dados: {
    descricao: string;
    categoria_id: number;
    forma_pagamento: string;
    observacoes?: string;
  }
): Promise<void> {
  const db = await getDb();
  db.run(
    `UPDATE contas 
     SET descricao = ?, categoria_id = ?, forma_pagamento = ?, observacoes = ?
     WHERE id = ?;`,
    [dados.descricao.trim(), dados.categoria_id, dados.forma_pagamento, dados.observacoes?.trim() || null, contaId]
  );
  await persistirDb();
}

// ==========================================
// CONSULTA DE PARCELAS COM FILTROS
// ==========================================

export async function listarParcelas(filtros?: FiltrosParcela): Promise<Parcela[]> {
  const db = await getDb();
  atualizarStatusAtrasados(db);

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
      c.forma_pagamento,
      c.tipo AS tipo_conta,
      c.observacoes,
      cat.id AS categoria_id,
      cat.nome AS categoria_nome,
      cat.cor AS categoria_cor
    FROM parcelas p
    INNER JOIN contas c ON p.conta_id = c.id
    INNER JOIN categorias cat ON c.categoria_id = cat.id
    WHERE 1=1
  `;

  const params: (string | number)[] = [];

  if (filtros?.status && filtros.status !== 'todos') {
    sql += ' AND p.status = ?';
    params.push(filtros.status);
  }

  if (filtros?.mesAno && filtros.mesAno !== 'todos') {
    sql += " AND strftime('%Y-%m', p.data_vencimento) = ?";
    params.push(filtros.mesAno);
  }

  if (filtros?.categoria_id && filtros.categoria_id !== 'todas') {
    sql += ' AND cat.id = ?';
    params.push(Number(filtros.categoria_id));
  }

  if (filtros?.tipo && filtros.tipo !== 'todos') {
    sql += ' AND c.tipo = ?';
    params.push(filtros.tipo);
  }

  if (filtros?.busca && filtros.busca.trim() !== '') {
    sql += ' AND (c.descricao LIKE ? OR cat.nome LIKE ? OR c.forma_pagamento LIKE ?)';
    const searchPattern = `%${filtros.busca.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  // Ordenação
  switch (filtros?.ordenacao) {
    case 'vencimento_desc':
      sql += ' ORDER BY p.data_vencimento DESC, p.id DESC';
      break;
    case 'valor_asc':
      sql += ' ORDER BY p.valor ASC, p.data_vencimento ASC';
      break;
    case 'valor_desc':
      sql += ' ORDER BY p.valor DESC, p.data_vencimento ASC';
      break;
    case 'descricao_asc':
      sql += ' ORDER BY c.descricao ASC, p.data_vencimento ASC';
      break;
    case 'vencimento_asc':
    default:
      sql += ' ORDER BY p.data_vencimento ASC, p.id ASC';
      break;
  }

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const parcelas: Parcela[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as Parcela;
    parcelas.push(row);
  }
  stmt.free();

  return parcelas;
}

export async function marcarParcelaComoPaga(
  parcelaId: number,
  dataPagamento?: string,
  valorPago?: number
): Promise<void> {
  const db = await getDb();
  const hoje = new Date().toISOString().slice(0, 10);
  const dataFinal = dataPagamento || hoje;

  // Obter valor original se não informado
  let valorFinal = valorPago;
  if (valorFinal === undefined || valorFinal === null) {
    const stmt = db.prepare('SELECT valor FROM parcelas WHERE id = ?;');
    stmt.bind([parcelaId]);
    if (stmt.step()) {
      valorFinal = stmt.getAsObject().valor as number;
    }
    stmt.free();
  }

  db.run(
    `UPDATE parcelas 
     SET status = 'pago', data_pagamento = ?, valor_pago = ?
     WHERE id = ?;`,
    [dataFinal, valorFinal ?? 0, parcelaId]
  );

  await persistirDb();
}

export async function desfazerPagamentoParcela(parcelaId: number): Promise<void> {
  const db = await getDb();
  const hoje = new Date().toISOString().slice(0, 10);

  // Descobre a data de vencimento para calcular se fica atrasado ou pendente
  const stmt = db.prepare('SELECT data_vencimento FROM parcelas WHERE id = ?;');
  stmt.bind([parcelaId]);
  let dataVenc = hoje;
  if (stmt.step()) {
    dataVenc = stmt.getAsObject().data_vencimento as string;
  }
  stmt.free();

  const novoStatus = dataVenc < hoje ? 'atrasado' : 'pendente';

  db.run(
    `UPDATE parcelas 
     SET status = ?, data_pagamento = NULL, valor_pago = NULL
     WHERE id = ?;`,
    [novoStatus, parcelaId]
  );

  await persistirDb();
}

// ==========================================
// VISÃO DE PARCELAMENTOS
// ==========================================

export async function listarParcelamentos(): Promise<ParcelamentoItem[]> {
  const db = await getDb();
  atualizarStatusAtrasados(db);

  // 1. Busca todas as contas do tipo 'parcelada'
  const sqlContas = `
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
  `;

  const stmtContas = db.prepare(sqlContas);
  const contas: {
    conta_id: number;
    descricao: string;
    categoria_id: number;
    categoria_nome: string;
    categoria_cor: string;
    forma_pagamento: string;
    tipo: TipoConta;
    valor_total: number;
  }[] = [];

  while (stmtContas.step()) {
    contas.push(stmtContas.getAsObject() as any);
  }
  stmtContas.free();

  if (contas.length === 0) {
    return [];
  }

  // 2. Busca todas as parcelas dessas contas em UMA ÚNICA consulta consolidada (Elimina o problema N+1)
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
    const p = stmtTodasParcelas.getAsObject() as unknown as Parcela;
    const lista = parcelasPorConta.get(p.conta_id) || [];
    lista.push(p);
    parcelasPorConta.set(p.conta_id, lista);
  }
  stmtTodasParcelas.free();

  // 3. Monta os itens consolidados em memória O(N)
  const parcelamentos: ParcelamentoItem[] = contas.map((c) => {
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

  return parcelamentos;
}

// ==========================================
// MÉTRICAS DO DASHBOARD
// ==========================================

export async function obterMetricasDashboard(mesAnoRef?: string): Promise<DashboardMetrics> {
  const db = await getDb();
  atualizarStatusAtrasados(db);

  const hoje = new Date().toISOString().slice(0, 10);
  const mesAnoAtual = mesAnoRef || hoje.slice(0, 7);

  // 1. Total pago no mês selecionado
  const stmtPago = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(valor_pago, valor)), 0) AS total
    FROM parcelas
    WHERE status = 'pago' 
      AND (strftime('%Y-%m', data_pagamento) = ? OR (data_pagamento IS NULL AND strftime('%Y-%m', data_vencimento) = ?));
  `);
  stmtPago.bind([mesAnoAtual, mesAnoAtual]);
  stmtPago.step();
  const totalPagoMes = (stmtPago.getAsObject().total as number) || 0;
  stmtPago.free();

  // 2. Total a pagar no mês (pendente e atrasado com vencimento no mês)
  const stmtAPagar = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS total
    FROM parcelas
    WHERE status IN ('pendente', 'atrasado')
      AND strftime('%Y-%m', data_vencimento) = ?;
  `);
  stmtAPagar.bind([mesAnoAtual]);
  stmtAPagar.step();
  const totalAPagarMes = (stmtAPagar.getAsObject().total as number) || 0;
  stmtAPagar.free();

  // 3. Total geral em atraso (qualquer mês não pago com vencimento < hoje)
  const stmtAtrasado = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS qtd
    FROM parcelas
    WHERE status = 'atrasado' OR (status = 'pendente' AND data_vencimento < ?);
  `);
  stmtAtrasado.bind([hoje]);
  stmtAtrasado.step();
  const resAtrasado = stmtAtrasado.getAsObject();
  const totalAtrasado = (resAtrasado.total as number) || 0;
  const qtdAtrasadas = (resAtrasado.qtd as number) || 0;
  stmtAtrasado.free();

  // 4. Próximos 7 dias (a partir de hoje)
  const dataMais7 = new Date();
  dataMais7.setDate(dataMais7.getDate() + 7);
  const dataMais7Str = dataMais7.toISOString().slice(0, 10);

  const stmt7Dias = db.prepare(`
    SELECT COALESCE(SUM(valor), 0) AS total
    FROM parcelas
    WHERE status IN ('pendente', 'atrasado')
      AND data_vencimento >= ?
      AND data_vencimento <= ?;
  `);
  stmt7Dias.bind([hoje, dataMais7Str]);
  stmt7Dias.step();
  const totalVencendo7Dias = (stmt7Dias.getAsObject().total as number) || 0;
  stmt7Dias.free();

  // 5. Contas vencendo hoje
  const stmtHoje = db.prepare(`
    SELECT COUNT(*) AS qtd
    FROM parcelas
    WHERE status IN ('pendente', 'atrasado')
      AND data_vencimento = ?;
  `);
  stmtHoje.bind([hoje]);
  stmtHoje.step();
  const qtdVencendoHoje = (stmtHoje.getAsObject().qtd as number) || 0;
  stmtHoje.free();

  // 6. Gastos por Categoria no mês selecionado
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
  let totalGastosMes = 0;
  let totalEconomiasMes = 0;
  let totalReservasMes = 0;

  const gastosRaw: {
    categoria_id: number;
    categoria_nome: string;
    categoria_cor: string;
    total: number;
  }[] = [];

  while (stmtCat.step()) {
    const row = stmtCat.getAsObject() as {
      categoria_id: number;
      categoria_nome: string;
      categoria_cor: string;
      total: number;
    };
    gastosRaw.push(row);
    somaTotalCat += row.total;

    const nomeLower = (row.categoria_nome || '').toLowerCase();
    if (nomeLower.includes('economia') || nomeLower.includes('poupança')) {
      totalEconomiasMes += row.total;
    } else {
      totalGastosMes += row.total;
    }
  }
  stmtCat.free();

  const gastosPorCategoria = gastosRaw.map((g) => ({
    ...g,
    percentual: somaTotalCat > 0 ? (g.total / somaTotalCat) * 100 : 0,
  }));

  // Sem cálculo de residual fictício (app não cadastra salário nem receitas)
  const residualMes = 0;

  // Total acumulado guardado no Porquinho (apenas depósitos já marcados como pagos/guardados no Porquinho)
  // 100% real: não inclui resíduos artificiais de contas normais
  const stmtReservaTotal = db.prepare(`
    SELECT 
      COALESCE(SUM(COALESCE(p.valor_pago, p.valor)), 0) AS totalAcumulado
    FROM parcelas p
    INNER JOIN contas c ON p.conta_id = c.id
    INNER JOIN categorias cat ON c.categoria_id = cat.id
    WHERE (LOWER(cat.nome) LIKE '%econ%' OR LOWER(cat.nome) LIKE '%poup%') 
      AND p.status = 'pago';
  `);
  stmtReservaTotal.step();
  const reservaAcumuladaTotal = (stmtReservaTotal.getAsObject().totalAcumulado as number) || 0;
  stmtReservaTotal.free();

  // 7. Linha do Tempo Exata de 5 Meses (-2 meses passados, mês atual e +2 meses futuros)
  const mesesEvolucao: {
    mesAno: string;
    label: string;
    pago: number;
    pendente: number;
    total: number;
    gastos: number;
    economias: number;
    tipoMes: 'passado' | 'atual' | 'futuro';
  }[] = [];
  const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const [refAno, refMes] = mesAnoAtual.split('-').map(Number);
  for (let offset = -2; offset <= 2; offset++) {
    const dt = new Date(refAno, refMes - 1 + offset, 1);
    const mStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const lbl = `${nomesMeses[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;
    const tipoMes: 'passado' | 'atual' | 'futuro' = offset < 0 ? 'passado' : offset === 0 ? 'atual' : 'futuro';

    const stmtMes = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.status = 'pago' THEN COALESCE(p.valor_pago, p.valor) ELSE 0 END), 0) AS pago,
        COALESCE(SUM(CASE WHEN p.status IN ('pendente', 'atrasado') THEN p.valor ELSE 0 END), 0) AS pendente,
        COALESCE(SUM(CASE WHEN LOWER(cat.nome) NOT LIKE '%econ%' AND LOWER(cat.nome) NOT LIKE '%poup%' THEN p.valor ELSE 0 END), 0) AS gastos,
        COALESCE(SUM(CASE WHEN LOWER(cat.nome) LIKE '%econ%' OR LOWER(cat.nome) LIKE '%poup%' THEN p.valor ELSE 0 END), 0) AS economias
      FROM parcelas p
      INNER JOIN contas c ON p.conta_id = c.id
      INNER JOIN categorias cat ON c.categoria_id = cat.id
      WHERE strftime('%Y-%m', p.data_vencimento) = ?;
    `);
    stmtMes.bind([mStr]);
    stmtMes.step();
    const row = stmtMes.getAsObject() as { pago: number; pendente: number; gastos: number; economias: number };
    stmtMes.free();

    mesesEvolucao.push({
      mesAno: mStr,
      label: lbl,
      pago: row.pago,
      pendente: row.pendente,
      total: row.pago + row.pendente,
      gastos: row.gastos,
      economias: row.economias,
      tipoMes,
    });
  }

  // 8. Lista dos próximos vencimentos (LIMIT 6 direto no SQLite para máxima performance)
  const stmtDestaque = db.prepare(`
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
    WHERE p.status IN ('atrasado', 'pendente')
    ORDER BY 
      CASE WHEN p.status = 'atrasado' THEN 0 ELSE 1 END,
      p.data_vencimento ASC
    LIMIT 6;
  `);

  const listaDestaque: Parcela[] = [];
  while (stmtDestaque.step()) {
    listaDestaque.push(stmtDestaque.getAsObject() as unknown as Parcela);
  }
  stmtDestaque.free();

  return {
    totalPagoMes,
    totalAPagarMes,
    totalAtrasado,
    totalVencendo7Dias,
    qtdVencendoHoje,
    qtdAtrasadas,
    totalGastosMes,
    totalEconomiasMes,
    totalReservasMes,
    residualMes,
    reservaAcumuladaTotal,
    gastosPorCategoria,
    evolucaoMensal: mesesEvolucao,
    proximosVencimentos: listaDestaque,
  };
}

// ==========================================
// EXPORTAÇÃO CSV
// ==========================================

export async function gerarCsvParcelas(): Promise<string> {
  const parcelas = await listarParcelas({ ordenacao: 'vencimento_asc' });

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
    p.valor.toFixed(2).replace('.', ','),
    p.data_vencimento.split('-').reverse().join('/'),
    p.data_pagamento ? p.data_pagamento.split('-').reverse().join('/') : '',
    p.status.toUpperCase(),
    p.valor_pago ? p.valor_pago.toFixed(2).replace('.', ',') : '',
    `"${(p.observacoes || '').replace(/"/g, '""')}"`,
  ]);

  // BOM UTF-8 (\uFEFF) para abrir com acentuação correta no Microsoft Excel
  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}
