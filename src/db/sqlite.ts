/**
 * Gerenciador do Banco de Dados SQLite em WebAssembly (sql.js)
 * com persistência automática no IndexedDB, backup de segurança e migrações resilientes
 */
import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export const DB_NAME = 'contas_a_pagar_db';
export const IDB_STORE = 'sqlite_store';
export const IDB_KEY = 'sqlite_binary';
export const IDB_BACKUP_KEY = 'em_dia_backup_pre_migracao';

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

export class DatabaseInitError extends Error {
  etapa: string;
  detalheStack?: string;

  constructor(etapa: string, originalError: any) {
    const msg = originalError?.message || String(originalError || '');
    super(`Falha na etapa: ${etapa} - ${msg}`);
    this.name = 'DatabaseInitError';
    this.etapa = etapa;
    this.detalheStack = originalError?.stack || this.stack;
  }
}

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
 * Guarda uma cópia de segurança dos bytes antes de qualquer migração
 */
export async function salvarBackupPreMigracao(bytes: Uint8Array): Promise<void> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(bytes, IDB_BACKUP_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso ao registrar backup de segurança pré-migração:', err);
  }
}

export async function carregarBackupPreMigracao(): Promise<Uint8Array | null> {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_BACKUP_KEY);
      req.onsuccess = () => {
        const result = req.result;
        if (result && result instanceof Uint8Array) resolve(result);
        else if (result && result.buffer) resolve(new Uint8Array(result));
        else resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Verifica com PRAGMA table_info se uma coluna existe na tabela
 */
export function colunaExiste(db: Database, tabela: string, coluna: string): boolean {
  try {
    const res = db.exec(`PRAGMA table_info(${tabela});`);
    if (!res[0] || !res[0].values) return false;
    return res[0].values.some((row) => row[1] === coluna);
  } catch {
    return false;
  }
}

/**
 * Só executa ALTER TABLE ADD COLUMN após verificar que a coluna não existe
 */
export function adicionarColunaSeNaoExistir(
  db: Database,
  tabela: string,
  coluna: string,
  tipoDef: string
) {
  if (!colunaExiste(db, tabela, coluna)) {
    db.run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipoDef};`);
  }
}

/**
 * Migra com segurança para as 3 categorias padrão (Gastos, Economias, Reservas)
 * NUNCA faz DROP TABLE e NUNCA faz DELETE em categorias que tenham contas vinculadas
 */
export function migrarCategoriasSeguro(db: Database) {
  // 1. Garante existência das 3 categorias essenciais
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
    // 2. Transfere contas com segurança
    db.run(
      `UPDATE contas 
       SET categoria_id = ? 
       WHERE categoria_id IN (
         SELECT id FROM categorias 
         WHERE (LOWER(nome) LIKE '%poup%' OR LOWER(nome) LIKE '%econ%') AND id != ?
       );`,
      [economiasId, economiasId]
    );

    db.run(
      `UPDATE contas 
       SET categoria_id = ? 
       WHERE categoria_id IN (
         SELECT id FROM categorias 
         WHERE LOWER(nome) LIKE '%reser%' AND id != ?
       );`,
      [reservasId, reservasId]
    );

    db.run(
      `UPDATE contas 
       SET categoria_id = ? 
       WHERE categoria_id NOT IN (?, ?, ?);`,
      [gastosId, gastosId, economiasId, reservasId]
    );

    // 3. NUNCA apaga categorias que possuam contas vinculadas (subquery protetora)
    db.run(
      `DELETE FROM categorias 
       WHERE id NOT IN (?, ?, ?) 
         AND id NOT IN (SELECT DISTINCT categoria_id FROM contas);`,
      [gastosId, economiasId, reservasId]
    );
  }
}

/**
 * Cria a estrutura base do schema com CREATE TABLE IF NOT EXISTS
 */
export function criarSchema(db: Database) {
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
}

/**
 * Recria as categorias padrão caso não existam
 */
export function recriarCategoriasPadrao(db: Database) {
  db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Gastos', '#2563eb');");
  db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Economias', '#10b981');");
  db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Reservas', '#f59e0b');");
}

/**
 * Atualiza o status de parcelas vencidas para 'atrasado'
 */
export function atualizarStatusAtrasados(db: Database) {
  const hoje = new Date().toISOString().slice(0, 10);
  
  db.run(
    `UPDATE parcelas 
     SET status = 'atrasado' 
     WHERE (status = 'pendente' OR status IS NULL) 
       AND data_pagamento IS NULL 
       AND data_vencimento < ?;`,
    [hoje]
  );

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
 * Obtém a instância do banco SQLite com tratamentos de erro isolados por etapa,
 * migrações com rollback-safe e resolução relativa do WASM para Capacitor
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // ETAPA 1: Carregar o WASM do sql.js
    let SQL: any;
    try {
      SQL = await initSqlJs({
        locateFile: (file: string) => {
          if (file.endsWith('.wasm')) {
            if (typeof sqlWasmUrl === 'string' && sqlWasmUrl) {
              // Garante caminho relativo seguro tanto no Capacitor (https://localhost) quanto em bundles OTA
              const relativePath = sqlWasmUrl.replace(/^\/+/, '');
              try {
                const base =
                  typeof document !== 'undefined' && document.baseURI
                    ? document.baseURI
                    : typeof window !== 'undefined'
                    ? window.location.href
                    : 'https://localhost/';
                return new URL(relativePath, base).href;
              } catch {
                return relativePath;
              }
            }
            return file;
          }
          return file;
        },
      });
    } catch (err: any) {
      console.error('Falha na etapa: carregar o WASM do sql.js:', err);
      throw new DatabaseInitError('carregar o WASM do sql.js', err);
    }

    // ETAPA 2: Abrir o arquivo salvo no IndexedDB
    let savedData: Uint8Array | null = null;
    try {
      savedData = await carregarDoIndexedDB();
    } catch (err: any) {
      console.error('Falha na etapa: abrir o arquivo salvo (leitura IndexedDB):', err);
      throw new DatabaseInitError('abrir o arquivo salvo (leitura)', err);
    }

    let db: Database;
    try {
      if (savedData && savedData.length > 0) {
        db = new SQL.Database(savedData);
      } else {
        db = new SQL.Database();
      }
    } catch (err: any) {
      console.error('Falha na etapa: abrir o arquivo salvo (instanciação do SQLite):', err);
      throw new DatabaseInitError('abrir o arquivo salvo (instanciação SQLite)', err);
    }

    // ETAPA 3: Backup pré-migração (guarda cópia dos bytes originais para segurança)
    if (savedData && savedData.length > 0) {
      try {
        await salvarBackupPreMigracao(savedData);
      } catch (err) {
        console.warn('Aviso: falha ao salvar backup pré-migração:', err);
      }
    }

    // ETAPA 4: Migrações seguras
    try {
      // Desativa foreign_keys durante o processo de migração
      db.run('PRAGMA foreign_keys = OFF;');

      // Verifica versão atual do schema
      const resVer = db.exec('PRAGMA user_version;');
      let versaoAtual = (resVer[0]?.values[0]?.[0] as number) || 0;

      // Se o banco existente tiver PRAGMA user_version = 0 mas já tiver as tabelas, trate como versão 1 e migre a partir dela
      const checkTabelas = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contas', 'parcelas', 'categorias');"
      );
      const qtdTabelas = checkTabelas[0]?.values?.length || 0;

      if (versaoAtual === 0 && qtdTabelas > 0) {
        versaoAtual = 1;
        db.run('PRAGMA user_version = 1;');
      }

      // Cria tabelas que ainda não existam com CREATE TABLE IF NOT EXISTS
      criarSchema(db);

      // Adiciona colunas que possam faltar em versões antigas após conferir com PRAGMA table_info
      adicionarColunaSeNaoExistir(db, 'contas', 'forma_pagamento', "TEXT NOT NULL DEFAULT 'Geral'");
      adicionarColunaSeNaoExistir(db, 'contas', 'observacoes', 'TEXT');
      adicionarColunaSeNaoExistir(
        db,
        'contas',
        'data_criacao',
        `TEXT NOT NULL DEFAULT '${new Date().toISOString().slice(0, 10)}'`
      );
      adicionarColunaSeNaoExistir(db, 'parcelas', 'valor_pago', 'REAL');

      // Migração v2: padronização das 3 categorias únicas sem apagar dados vinculados
      if (versaoAtual < 2) {
        migrarCategoriasSeguro(db);
        db.run('PRAGMA user_version = 2;');
      }
    } catch (err: any) {
      console.error('Falha na etapa: migrações de schema:', err);
      throw new DatabaseInitError('migração do schema', err);
    }

    // ETAPA 5: Ativar PRAGMA foreign_keys = ON (estritamente após migrações)
    try {
      db.run('PRAGMA foreign_keys = ON;');
    } catch (err: any) {
      console.error('Falha na etapa: PRAGMA foreign_keys:', err);
      throw new DatabaseInitError('PRAGMA foreign_keys', err);
    }

    // ETAPA 6: Seed ou atualização de status
    try {
      const res = db.exec('SELECT COUNT(*) as total FROM contas;');
      const count = (res[0]?.values[0]?.[0] as number) ?? 0;

      if (count === 0) {
        await popularDadosIniciais(db);
      } else {
        atualizarStatusAtrasados(db);
      }
    } catch (err: any) {
      console.error('Falha na etapa: seed de dados ou status:', err);
      throw new DatabaseInitError('seed de dados', err);
    }

    // ETAPA 7: Persistência inicial
    try {
      const exported = db.export();
      await salvarNoIndexedDB(exported);
    } catch (err) {
      console.warn('Aviso: falha na persistência inicial no IndexedDB:', err);
    }

    dbInstance = db;
    return db;
  })().catch((err) => {
    // Reseta a promise para permitir que uma nova tentativa realmente reexecute o fluxo
    initPromise = null;
    throw err;
  });

  return initPromise;
}

/**
 * Reseta as instâncias em memória para permitir nova tentativa limpa
 */
export function resetDbPromise() {
  initPromise = null;
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
 * Exporta os bytes salvos para recuperação emergencial (mesmo quando getDb() falha)
 */
export async function exportarBytesRecuperacao(): Promise<void> {
  let bytes = dbInstance ? dbInstance.export() : null;
  if (!bytes || bytes.length === 0) {
    bytes = await carregarDoIndexedDB();
  }
  if (!bytes || bytes.length === 0) {
    bytes = await carregarBackupPreMigracao();
  }

  if (!bytes || bytes.length === 0) {
    throw new Error('Nenhum dado salvo foi encontrado neste aparelho para exportação.');
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
  const dataStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `em_dia_recuperacao_${dataStr}.sqlite`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Recria o banco de dados do zero (remove o banco atual e inicia um novo)
 */
export async function recriarBancoDoZero(): Promise<Database> {
  try {
    const idb = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso ao apagar chave no IndexedDB:', err);
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  initPromise = null;

  return await getDb();
}

/**
 * Restaura o banco de dados a partir de um arquivo .sqlite fornecido pelo usuário
 */
export async function restaurarArquivoSqlite(fileBuffer: ArrayBuffer): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) => (file.endsWith('.wasm') ? sqlWasmUrl.replace(/^\/+/, '') : file),
  });

  const uint8 = new Uint8Array(fileBuffer);
  const novoDb = new SQL.Database(uint8);

  const tables = novoDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contas', 'parcelas', 'categorias')"
  );
  
  if (!tables[0] || tables[0].values.length < 3) {
    throw new Error('Arquivo SQLite inválido: tabelas essenciais (contas, parcelas, categorias) não foram encontradas.');
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
  }

  novoDb.run('PRAGMA foreign_keys = OFF;');
  criarSchema(novoDb);
  migrarCategoriasSeguro(novoDb);
  novoDb.run('PRAGMA foreign_keys = ON;');

  dbInstance = novoDb;
  atualizarStatusAtrasados(dbInstance);
  await persistirDb();
}

/**
 * Limpa todos os dados do banco e recria as categorias padrão
 */
export async function limparBancoDeDados(): Promise<void> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = OFF;');
  db.run('DELETE FROM parcelas;');
  db.run('DELETE FROM contas;');
  db.run('DELETE FROM categorias;');
  db.run('DELETE FROM sqlite_sequence;');

  recriarCategoriasPadrao(db);
  db.run('PRAGMA foreign_keys = ON;');

  await persistirDb();
}

/**
 * Popula dados de exemplo realistas com 3 categorias fundamentais
 */
export async function popularDadosIniciais(db?: Database): Promise<void> {
  const targetDb = db || (await getDb());

  targetDb.run('DELETE FROM parcelas;');
  targetDb.run('DELETE FROM contas;');
  targetDb.run('DELETE FROM categorias;');
  targetDb.run('DELETE FROM sqlite_sequence;');

  const categorias = [
    { nome: 'Gastos', cor: '#2563eb' },
    { nome: 'Economias', cor: '#10b981' },
    { nome: 'Reservas', cor: '#f59e0b' },
  ];

  for (const cat of categorias) {
    targetDb.run('INSERT INTO categorias (nome, cor) VALUES (?, ?);', [cat.nome, cat.cor]);
  }

  const now = new Date();
  const formatDateStr = (year: number, month: number, day: number): string => {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const y = now.getFullYear();
  const m = now.getMonth();

  // Seed de exemplos iniciais
  targetDb.run(
    `INSERT INTO contas (id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao)
     VALUES (1, 'Supermercado Mensal', 1, 650.00, 'unica', 'Geral', 'Compras para despensa', ?);`,
    [formatDateStr(y, m, 1)]
  );
  targetDb.run(
    `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
     VALUES (1, 1, 1, 650.00, ?, ?, 'pago', 650.00);`,
    [formatDateStr(y, m, 5), formatDateStr(y, m, 5)]
  );

  targetDb.run(
    `INSERT INTO contas (id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao)
     VALUES (2, 'Poupança 2026', 2, 1200.00, 'parcelada', 'Geral', 'Meta de economia mensal', ?);`,
    [formatDateStr(y, m, 1)]
  );
  for (let i = 0; i < 12; i++) {
    const status = i === 0 ? 'pago' : 'pendente';
    const dataPag = i === 0 ? formatDateStr(y, m, 10) : null;
    const valorPago = i === 0 ? 100.00 : null;
    targetDb.run(
      `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
       VALUES (2, ?, 12, 100.00, ?, ?, ?, ?);`,
      [i + 1, formatDateStr(y, m + i, 10), dataPag, status, valorPago]
    );
  }
}
