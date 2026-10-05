/**
 * Gerenciador do Banco de Dados SQLite em WebAssembly (sql.js)
 * com persistência automática no IndexedDB e exportação/importação de arquivos .sqlite
 */
import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_NAME = 'contas_a_pagar_db';
const IDB_STORE = 'sqlite_store';
const IDB_KEY = 'sqlite_binary';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

// Helper para IndexedDB nativo (persistência local offline)
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarNoIndexedDB(data: Uint8Array): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Erro ao salvar SQLite no IndexedDB:', err);
  }
}

export async function carregarDoIndexedDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        const result = req.result;
        if (result && result instanceof Uint8Array) {
          resolve(result);
        } else if (result && result.buffer) {
          resolve(new Uint8Array(result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Nenhum dado prévio no IndexedDB:', err);
    return null;
  }
}

/**
 * Cria a estrutura inicial das tabelas no SQLite
 */
export function criarSchema(db: Database) {
  // Habilita chaves estrangeiras
  db.run('PRAGMA foreign_keys = ON;');

  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      cor TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      valor_total REAL NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('unica', 'recorrente', 'parcelada')),
      forma_pagamento TEXT NOT NULL,
      observacoes TEXT,
      data_criacao TEXT NOT NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parcelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conta_id INTEGER NOT NULL,
      numero_parcela INTEGER NOT NULL,
      total_parcelas INTEGER NOT NULL,
      valor REAL NOT NULL,
      data_vencimento TEXT NOT NULL,
      data_pagamento TEXT,
      status TEXT NOT NULL CHECK(status IN ('pendente', 'pago', 'atrasado')),
      valor_pago REAL,
      FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas(data_vencimento);
    CREATE INDEX IF NOT EXISTS idx_parcelas_status ON parcelas(status);
    CREATE INDEX IF NOT EXISTS idx_parcelas_conta ON parcelas(conta_id);
  `);

  // Garante a existência exclusiva das 3 categorias essenciais
  migrarParaTresCategorias(db);
}

/**
 * Migra qualquer banco existente (incluindo IndexedDB) para as 3 categorias únicas: Gastos, Economias, Reservas
 */
export function migrarParaTresCategorias(db: Database) {
  try {
    db.run('PRAGMA foreign_keys = OFF;');

    db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Gastos', '#2563eb');");
    db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Economias', '#10b981');");
    db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Reservas', '#f59e0b');");

    const gastosRes = db.exec("SELECT id FROM categorias WHERE nome = 'Gastos';");
    const gastosId = gastosRes[0]?.values[0]?.[0] as number;

    const economiasRes = db.exec("SELECT id FROM categorias WHERE nome = 'Economias';");
    const economiasId = economiasRes[0]?.values[0]?.[0] as number;

    const reservasRes = db.exec("SELECT id FROM categorias WHERE nome = 'Reservas';");
    const reservasId = reservasRes[0]?.values[0]?.[0] as number;

    if (gastosId && economiasId && reservasId) {
      // 1. Contas de Poupança/Economia para Economias
      db.run(
        `UPDATE contas 
         SET categoria_id = ? 
         WHERE categoria_id IN (
           SELECT id FROM categorias 
           WHERE (LOWER(nome) LIKE '%poup%' OR LOWER(nome) LIKE '%econ%') AND id != ?
         );`,
        [economiasId, economiasId]
      );

      // 2. Contas de Reserva para Reservas
      db.run(
        `UPDATE contas 
         SET categoria_id = ? 
         WHERE categoria_id IN (
           SELECT id FROM categorias 
           WHERE LOWER(nome) LIKE '%reser%' AND id != ?
         );`,
        [reservasId, reservasId]
      );

      // 3. Qualquer outra categoria antiga (Alimentação, Moradia, Transporte, Saúde, Lazer, Educação) para Gastos
      db.run(
        `UPDATE contas 
         SET categoria_id = ? 
         WHERE categoria_id NOT IN (?, ?, ?);`,
        [gastosId, gastosId, economiasId, reservasId]
      );

      // 4. Deletar permanentemente todas as categorias antigas
      db.run("DELETE FROM categorias WHERE id NOT IN (?, ?, ?);", [gastosId, economiasId, reservasId]);
    }

    db.run('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.error('Erro na migração para 3 categorias:', err);
  }
}

/**
 * Atualiza o status de parcelas vencidas para 'atrasado'
 */
export function atualizarStatusAtrasados(db: Database) {
  // Obter data de hoje no formato YYYY-MM-DD
  const hoje = new Date().toISOString().slice(0, 10);
  
  // Parcela não paga cujo vencimento é anterior a hoje
  db.run(
    `UPDATE parcelas 
     SET status = 'atrasado' 
     WHERE (status = 'pendente' OR status IS NULL) 
       AND data_pagamento IS NULL 
       AND data_vencimento < ?;`,
    [hoje]
  );

  // Caso tenha sido marcada como atrasada mas o vencimento seja futuro
  db.run(
    `UPDATE parcelas 
     SET status = 'pendente' 
     WHERE status = 'atrasado' 
       AND data_pagamento IS NULL 
       AND data_vencimento >= ?;`,
    [hoje]
  );
}

/**
 * Obtém a instância do banco SQLite, inicializando se necessário
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const SQL = await initSqlJs({
        locateFile: (file) => {
          if (file.endsWith('.wasm')) {
            return sqlWasmUrl || `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`;
          }
          return file;
        },
      });

      // Tenta carregar do IndexedDB
      const savedData = await carregarDoIndexedDB();
      let db: Database;

      if (savedData && savedData.length > 0) {
        try {
          db = new SQL.Database(savedData);
        } catch (e) {
          console.error('Falha ao restaurar banco existente, criando novo:', e);
          db = new SQL.Database();
        }
      } else {
        db = new SQL.Database();
      }

      criarSchema(db);
      migrarParaTresCategorias(db);

      // Verifica se o banco está vazio para gerar o seed inicial
      const res = db.exec('SELECT COUNT(*) as total FROM contas');
      const count = res[0]?.values[0]?.[0] as number ?? 0;

      if (count === 0) {
        await popularDadosIniciais(db);
      } else {
        atualizarStatusAtrasados(db);
      }

      // Persiste o banco migrado no IndexedDB
      const exported = db.export();
      await salvarNoIndexedDB(exported);

      dbInstance = db;
      return db;
    } catch (error) {
      console.error('Erro fatal ao inicializar SQLite WASM:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Persiste o banco atual no IndexedDB
 */
export async function persistirDb(): Promise<void> {
  if (!dbInstance) return;
  const data = dbInstance.export();
  await salvarNoIndexedDB(data);
}

/**
 * Exporta o arquivo binário .sqlite para download no navegador
 */
export async function exportarArquivoSqlite(): Promise<void> {
  const db = await getDb();
  const binaryArray = db.export();
  const blob = new Blob([binaryArray.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
  
  const hoje = new Date().toISOString().slice(0, 10);
  const fileName = `contas_a_pagar_${hoje}.sqlite`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Restaura o banco de dados a partir de um arquivo .sqlite fornecido pelo usuário
 */
export async function restaurarArquivoSqlite(fileBuffer: ArrayBuffer): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) => (file.endsWith('.wasm') ? sqlWasmUrl : file),
  });

  const uint8 = new Uint8Array(fileBuffer);
  const novoDb = new SQL.Database(uint8);

  // Validação simples de integridade das tabelas
  const tables = novoDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contas', 'parcelas', 'categorias')"
  );
  
  if (!tables[0] || tables[0].values.length < 3) {
    throw new Error('Arquivo SQLite inválido: tabelas essenciais (contas, parcelas, categorias) não foram encontradas.');
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignora erro no fechamento
    }
  }

  dbInstance = novoDb;
  atualizarStatusAtrasados(dbInstance);
  await persistirDb();
}

/**
 * Limpa todos os dados do banco
 */
export async function limparBancoDeDados(): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM parcelas;');
  db.run('DELETE FROM contas;');
  db.run('DELETE FROM categorias;');
  db.run('DELETE FROM sqlite_sequence;');
  await persistirDb();
}

/**
 * Popula dados de exemplo realistas com 6 categorias e 12 contas distribuídas
 */
export async function popularDadosIniciais(db?: Database): Promise<void> {
  const targetDb = db || (await getDb());

  // Limpa antes de popular se chamado manualmente
  targetDb.run('DELETE FROM parcelas;');
  targetDb.run('DELETE FROM contas;');
  targetDb.run('DELETE FROM categorias;');
  targetDb.run('DELETE FROM sqlite_sequence;');

  // Inserção das 3 Categorias Fundamentais
  const categorias = [
    { nome: 'Gastos', cor: '#2563eb' },      // Azul
    { nome: 'Economias', cor: '#10b981' },   // Verde Esmeralda
    { nome: 'Reservas', cor: '#f59e0b' },    // Âmbar
  ];

  for (const cat of categorias) {
    targetDb.run('INSERT INTO categorias (nome, cor) VALUES (?, ?);', [cat.nome, cat.cor]);
  }

  // Mapa de IDs das categorias (1 Gastos, 2 Economias, 3 Reservas)
  
  // Data base atual para referência nos cálculos relativos
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.getMonth(); // 0 a 11
  
  const formatDateStr = (year: number, month: number, day: number): string => {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  interface SeedConta {
    descricao: string;
    categoria_id: number;
    valor_total: number;
    tipo: 'unica' | 'recorrente' | 'parcelada';
    forma_pagamento: string;
    observacoes: string;
    parcelas: {
      num: number;
      total: number;
      valor: number;
      vencimento: string;
      pagamento?: string | null;
      status: 'pendente' | 'pago' | 'atrasado';
      valor_pago?: number | null;
    }[];
  }

  const contasSeed: SeedConta[] = [
    // 1. Aluguel e Condomínio (Moradia - Recorrente)
    {
      descricao: 'Aluguel do Apartamento',
      categoria_id: 1,
      valor_total: 2200.0,
      tipo: 'recorrente',
      forma_pagamento: 'Boleto Bancário',
      observacoes: 'Vencimento todo dia 10',
      parcelas: [
        {
          num: 1,
          total: 12,
          valor: 2200.0,
          vencimento: formatDateStr(anoAtual, mesAtual - 1, 10),
          pagamento: formatDateStr(anoAtual, mesAtual - 1, 9),
          status: 'pago',
          valor_pago: 2200.0,
        },
        {
          num: 2,
          total: 12,
          valor: 2200.0,
          vencimento: formatDateStr(anoAtual, mesAtual, 10),
          pagamento: null,
          status: 'pendente',
        },
        {
          num: 3,
          total: 12,
          valor: 2200.0,
          vencimento: formatDateStr(anoAtual, mesAtual + 1, 10),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 2. Energia Elétrica - Enel (Moradia - Recorrente)
    {
      descricao: 'Conta de Energia (Enel)',
      categoria_id: 1,
      valor_total: 245.5,
      tipo: 'recorrente',
      forma_pagamento: 'Débito Automático',
      observacoes: 'Consumo referente ao ciclo mensal',
      parcelas: [
        {
          num: 1,
          total: 12,
          valor: 238.1,
          vencimento: formatDateStr(anoAtual, mesAtual - 1, 15),
          pagamento: formatDateStr(anoAtual, mesAtual - 1, 14),
          status: 'pago',
          valor_pago: 238.1,
        },
        {
          num: 2,
          total: 12,
          valor: 245.5,
          vencimento: formatDateStr(anoAtual, mesAtual, 15),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 3. Conta de Água - Sabesp (Moradia - Recorrente)
    {
      descricao: 'Conta de Água e Esgoto',
      categoria_id: 1,
      valor_total: 98.7,
      tipo: 'recorrente',
      forma_pagamento: 'Pix',
      observacoes: 'Vencimento dia 18',
      parcelas: [
        {
          num: 1,
          total: 12,
          valor: 92.4,
          vencimento: formatDateStr(anoAtual, mesAtual - 1, 18),
          pagamento: formatDateStr(anoAtual, mesAtual - 1, 17),
          status: 'pago',
          valor_pago: 92.4,
        },
        {
          num: 2,
          total: 12,
          valor: 98.7,
          vencimento: formatDateStr(anoAtual, mesAtual, 18),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 4. Internet Fibra Óptica (Moradia - Recorrente)
    {
      descricao: 'Internet Fibra 600 Mega',
      categoria_id: 1,
      valor_total: 129.9,
      tipo: 'recorrente',
      forma_pagamento: 'Cartão de Crédito',
      observacoes: 'Plano familiar com streaming incluso',
      parcelas: [
        {
          num: 1,
          total: 12,
          valor: 129.9,
          vencimento: formatDateStr(anoAtual, mesAtual - 1, 5),
          pagamento: formatDateStr(anoAtual, mesAtual - 1, 5),
          status: 'pago',
          valor_pago: 129.9,
        },
        {
          num: 2,
          total: 12,
          valor: 129.9,
          vencimento: formatDateStr(anoAtual, mesAtual, 5),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 5. Financiamento Veicular - 24x (Transporte - Parcelada)
    {
      descricao: 'Financiamento do Carro (24x)',
      categoria_id: 3,
      valor_total: 21576.0,
      tipo: 'parcelada',
      forma_pagamento: 'Boleto Bancário',
      observacoes: 'Parcela 899,00 mensal Banco Santander',
      parcelas: Array.from({ length: 24 }).map((_, idx) => {
        const num = idx + 1;
        const diffMonth = idx - 6; // Começou 6 meses atrás
        const venc = formatDateStr(anoAtual, mesAtual + diffMonth, 20);
        let status: 'pendente' | 'pago' | 'atrasado' = 'pendente';
        let pagamento: string | null = null;
        let valor_pago: number | null = null;

        if (num <= 6) {
          status = 'pago';
          pagamento = formatDateStr(anoAtual, mesAtual + diffMonth, 19);
          valor_pago = 899.0;
        } else if (num === 7) {
          // Parcela do mês atual
          status = 'pendente';
        }

        return {
          num,
          total: 24,
          valor: 899.0,
          vencimento: venc,
          pagamento,
          status,
          valor_pago,
        };
      }),
    },
    // 6. Celular Smartphone em 10x (Lazer - Parcelada)
    {
      descricao: 'Smartphone Galaxy S24 (10x)',
      categoria_id: 5,
      valor_total: 4299.9,
      tipo: 'parcelada',
      forma_pagamento: 'Cartão de Crédito',
      observacoes: 'Compra parcelada Magazine Luiza',
      parcelas: Array.from({ length: 10 }).map((_, idx) => {
        const num = idx + 1;
        const diffMonth = idx - 3; // 3 parcelas já pagas
        const venc = formatDateStr(anoAtual, mesAtual + diffMonth, 12);
        let status: 'pendente' | 'pago' | 'atrasado' = 'pendente';
        let pagamento: string | null = null;
        let valor_pago: number | null = null;

        if (num <= 3) {
          status = 'pago';
          pagamento = formatDateStr(anoAtual, mesAtual + diffMonth, 12);
          valor_pago = 429.99;
        } else {
          status = 'pendente';
        }

        return {
          num,
          total: 10,
          valor: 429.99,
          vencimento: venc,
          pagamento,
          status,
          valor_pago,
        };
      }),
    },
    // 7. Pós-Graduação / Curso de Especialização em 6x (Educação - Parcelada)
    {
      descricao: 'Pós-Graduação MBA Gestão (6x)',
      categoria_id: 6,
      valor_total: 3900.0,
      tipo: 'parcelada',
      forma_pagamento: 'Boleto Bancário',
      observacoes: 'Mensalidade da faculdade',
      parcelas: Array.from({ length: 6 }).map((_, idx) => {
        const num = idx + 1;
        const diffMonth = idx - 1;
        const venc = formatDateStr(anoAtual, mesAtual + diffMonth, 8);
        let status: 'pendente' | 'pago' | 'atrasado' = 'pendente';
        let pagamento: string | null = null;
        let valor_pago: number | null = null;

        if (num === 1) {
          status = 'pago';
          pagamento = formatDateStr(anoAtual, mesAtual - 1, 7);
          valor_pago = 650.0;
        }

        return {
          num,
          total: 6,
          valor: 650.0,
          vencimento: venc,
          pagamento,
          status,
          valor_pago,
        };
      }),
    },
    // 8. Plano de Saúde Familiar (Saúde - Recorrente)
    {
      descricao: 'Plano de Saúde Unimed',
      categoria_id: 4,
      valor_total: 890.0,
      tipo: 'recorrente',
      forma_pagamento: 'Boleto Bancário',
      observacoes: 'Cobertura nacional enfermaria',
      parcelas: [
        {
          num: 1,
          total: 12,
          valor: 890.0,
          vencimento: formatDateStr(anoAtual, mesAtual - 1, 25),
          pagamento: formatDateStr(anoAtual, mesAtual - 1, 24),
          status: 'pago',
          valor_pago: 890.0,
        },
        {
          num: 2,
          total: 12,
          valor: 890.0,
          vencimento: formatDateStr(anoAtual, mesAtual, 25),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 9. Fatura Cartão de Crédito Nubank (Alimentação / Variados - Única com atraso proposital para demonstração)
    {
      descricao: 'Fatura Cartão de Crédito Nubank',
      categoria_id: 2,
      valor_total: 1684.3,
      tipo: 'unica',
      forma_pagamento: 'Pix',
      observacoes: 'Compras de supermercado e farmácia',
      parcelas: [
        {
          num: 1,
          total: 1,
          valor: 1684.3,
          // Vencimento há 5 dias atrás (atrasado propositalmente)
          vencimento: formatDateStr(anoAtual, mesAtual, Math.max(1, now.getDate() - 5)),
          pagamento: null,
          status: 'atrasado',
        },
      ],
    },
    // 10. Consulta Médica e Exames (Saúde - Única)
    {
      descricao: 'Exames de Sangue e Cardiológicos',
      categoria_id: 4,
      valor_total: 350.0,
      tipo: 'unica',
      forma_pagamento: 'Pix',
      observacoes: 'Clínica Dr. Consulta',
      parcelas: [
        {
          num: 1,
          total: 1,
          valor: 350.0,
          vencimento: formatDateStr(anoAtual, mesAtual, Math.min(28, now.getDate() + 4)),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 11. IPVA e Licenciamento (Transporte - Única)
    {
      descricao: 'Licenciamento e DPVAT 2026',
      categoria_id: 3,
      valor_total: 185.0,
      tipo: 'unica',
      forma_pagamento: 'Pix',
      observacoes: 'Detran SP via internet banking',
      parcelas: [
        {
          num: 1,
          total: 1,
          valor: 185.0,
          vencimento: formatDateStr(anoAtual, mesAtual, Math.min(28, now.getDate() + 2)),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
    // 12. Seguro Residencial (Moradia - Parcelada em 4x)
    {
      descricao: 'Seguro Residencial Porto Seguro (4x)',
      categoria_id: 1,
      valor_total: 640.0,
      tipo: 'parcelada',
      forma_pagamento: 'Cartão de Crédito',
      observacoes: 'Apólice residencial anual',
      parcelas: [
        {
          num: 1,
          total: 4,
          valor: 160.0,
          vencimento: formatDateStr(anoAtual, mesAtual - 1, 14),
          pagamento: formatDateStr(anoAtual, mesAtual - 1, 14),
          status: 'pago',
          valor_pago: 160.0,
        },
        {
          num: 2,
          total: 4,
          valor: 160.0,
          vencimento: formatDateStr(anoAtual, mesAtual, 14),
          pagamento: null,
          status: 'pendente',
        },
        {
          num: 3,
          total: 4,
          valor: 160.0,
          vencimento: formatDateStr(anoAtual, mesAtual + 1, 14),
          pagamento: null,
          status: 'pendente',
        },
        {
          num: 4,
          total: 4,
          valor: 160.0,
          vencimento: formatDateStr(anoAtual, mesAtual + 2, 14),
          pagamento: null,
          status: 'pendente',
        },
      ],
    },
  ];

  const dataHojeStr = now.toISOString().slice(0, 10);

  for (const c of contasSeed) {
    targetDb.run(
      `INSERT INTO contas (descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [c.descricao, c.categoria_id, c.valor_total, c.tipo, c.forma_pagamento, c.observacoes, dataHojeStr]
    );

    const contaIdRes = targetDb.exec('SELECT last_insert_rowid() as id;');
    const contaId = contaIdRes[0]?.values[0]?.[0] as number;

    for (const p of c.parcelas) {
      // Se não foi paga e data de vencimento < hoje, força atrasado
      let statusReal = p.status;
      if (!p.pagamento && p.vencimento < dataHojeStr) {
        statusReal = 'atrasado';
      }

      targetDb.run(
        `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          contaId,
          p.num,
          p.total,
          p.valor,
          p.vencimento,
          p.pagamento || null,
          statusReal,
          p.valor_pago || null,
        ]
      );
    }
  }

  atualizarStatusAtrasados(targetDb);
  await persistirDb();
}
