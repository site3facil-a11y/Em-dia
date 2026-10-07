/**
 * Gerenciador do Banco de Dados SQLite em WebAssembly (sql.js)
 * com persistência automática no IndexedDB, migrações versionadas,
 * suporte a centavos (INTEGER) e integridade relacional com transações
 */
import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { getHojeIso } from '../utils/dates';

export const DB_NAME = 'contas_a_pagar_db';
export const IDB_STORE = 'sqlite_store';
export const IDB_KEY = 'sqlite_binary';
export const IDB_BACKUP_KEY = 'em_dia_backup_pre_migracao';
export const SCHEMA_VERSAO_ATUAL = 6;

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

export function colunaExiste(db: Database, tabela: string, coluna: string): boolean {
  try {
    const res = db.exec(`PRAGMA table_info(${tabela});`);
    if (!res[0] || !res[0].values) return false;
    return res[0].values.some((row) => row[1] === coluna);
  } catch {
    return false;
  }
}

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
 * Retorna a versão atual do schema através da tabela meta ou PRAGMA user_version
 */
export function obterVersaoSchema(db: Database): number {
  try {
    const resMeta = db.exec("SELECT valor FROM meta WHERE chave = 'schema_version';");
    if (resMeta[0]?.values[0]?.[0]) {
      return parseInt(String(resMeta[0].values[0][0]), 10) || 0;
    }
  } catch {}

  try {
    const resVer = db.exec('PRAGMA user_version;');
    return (resVer[0]?.values[0]?.[0] as number) || 0;
  } catch {
    return 0;
  }
}

/**
 * Atualiza a versão do schema na tabela meta e no PRAGMA user_version
 */
export function definirVersaoSchema(db: Database, versao: number): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);
  db.run("INSERT OR REPLACE INTO meta (chave, valor) VALUES ('schema_version', ?);", [String(versao)]);
  db.run(`PRAGMA user_version = ${versao};`);
}

/**
 * Cria a estrutura base do schema com foreign keys ativas
 */
export function criarSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

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
      valor_total INTEGER NOT NULL, -- em centavos
      tipo TEXT NOT NULL CHECK(tipo IN ('unica', 'recorrente', 'parcelada')),
      forma_pagamento TEXT NOT NULL DEFAULT 'Geral',
      observacoes TEXT,
      data_criacao TEXT NOT NULL,
      frequencia_recorrencia TEXT,
      dia_base INTEGER,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parcelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conta_id INTEGER NOT NULL,
      numero_parcela INTEGER NOT NULL,
      total_parcelas INTEGER NOT NULL,
      valor INTEGER NOT NULL, -- em centavos
      data_vencimento TEXT NOT NULL,
      data_pagamento TEXT,
      status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago')),
      valor_pago INTEGER, -- em centavos
      FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cofrinhos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      valor_meta INTEGER NOT NULL, -- em centavos
      total_parcelas INTEGER NOT NULL DEFAULT 1,
      valor_parcela INTEGER NOT NULL DEFAULT 0, -- em centavos
      data_inicio TEXT NOT NULL,
      concluido INTEGER NOT NULL DEFAULT 0,
      data_criacao TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cofrinho_depositos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cofrinho_id INTEGER NOT NULL,
      valor INTEGER NOT NULL, -- em centavos (positivo = depósito, negativo = retirada)
      data_deposito TEXT NOT NULL,
      observacao TEXT,
      conta_vinculada_id INTEGER,
      FOREIGN KEY (cofrinho_id) REFERENCES cofrinhos(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
      chave TEXT PRIMARY KEY,
      parcela_id INTEGER,
      data_vencimento TEXT,
      enviada_em TEXT
    );
  `);

  // Índices para otimização de consultas críticas
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON parcelas(data_vencimento);
    CREATE INDEX IF NOT EXISTS idx_parcelas_status ON parcelas(status);
    CREATE INDEX IF NOT EXISTS idx_parcelas_conta ON parcelas(conta_id);
    CREATE INDEX IF NOT EXISTS idx_parcelas_venc_status ON parcelas(data_vencimento, status);
    CREATE INDEX IF NOT EXISTS idx_contas_tipo ON contas(tipo);
    CREATE INDEX IF NOT EXISTS idx_contas_categoria ON contas(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_cofrinho_depositos_cid ON cofrinho_depositos(cofrinho_id);
  `);
}

/**
 * Executa as migrações numeradas sequencialmente sem perder dados
 */
export function executarMigracoes(db: Database) {
  // Desativa temporariamente foreign_keys para alterar schemas
  db.run('PRAGMA foreign_keys = OFF;');

  let versao = obterVersaoSchema(db);

  // Se o banco existe mas meta/user_version estava zerado
  if (versao === 0) {
    const checkTabelas = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contas', 'parcelas', 'categorias');"
    );
    if ((checkTabelas[0]?.values?.length || 0) > 0) {
      versao = 1;
    }
  }

  // Cria estrutura base
  criarSchema(db);

  // Migração 1: Adição de colunas essenciais
  if (versao < 1) {
    adicionarColunaSeNaoExistir(db, 'contas', 'forma_pagamento', "TEXT NOT NULL DEFAULT 'Geral'");
    adicionarColunaSeNaoExistir(db, 'contas', 'observacoes', 'TEXT');
    adicionarColunaSeNaoExistir(db, 'contas', 'data_criacao', `TEXT NOT NULL DEFAULT '${getHojeIso()}'`);
    adicionarColunaSeNaoExistir(db, 'contas', 'frequencia_recorrencia', 'TEXT');
    adicionarColunaSeNaoExistir(db, 'contas', 'dia_base', 'INTEGER');
    adicionarColunaSeNaoExistir(db, 'parcelas', 'valor_pago', 'INTEGER');
    versao = 1;
    definirVersaoSchema(db, 1);
  }

  // Migração 2: Conversão de valores monetários float para centavos (INTEGER)
  if (versao < 2) {
    try {
      // Verifica se existem valores reais que precisem ser multiplicados por 100
      db.run(`
        UPDATE parcelas 
        SET valor = CAST(ROUND(valor * 100) AS INTEGER),
            valor_pago = CASE WHEN valor_pago IS NOT NULL THEN CAST(ROUND(valor_pago * 100) AS INTEGER) ELSE NULL END
        WHERE typeof(valor) = 'real' OR (valor < 500000 AND typeof(valor) = 'integer' AND valor % 1 != 0);
      `);

      db.run(`
        UPDATE contas 
        SET valor_total = CAST(ROUND(valor_total * 100) AS INTEGER)
        WHERE typeof(valor_total) = 'real';
      `);
    } catch (err) {
      console.warn('Aviso durante migração de centavos:', err);
    }
    versao = 2;
    definirVersaoSchema(db, 2);
  }

  // Migração 3: Elimina status 'atrasado' gravado (status no banco é estritamente 'pendente' ou 'pago')
  if (versao < 3) {
    try {
      db.run("UPDATE parcelas SET status = 'pendente' WHERE status = 'atrasado';");
    } catch (err) {
      console.warn('Aviso durante migração de status atrasado:', err);
    }
    versao = 3;
    definirVersaoSchema(db, 3);
  }

  // Migração 4: Garantia de colunas de recorrência
  if (versao < 4) {
    adicionarColunaSeNaoExistir(db, 'contas', 'frequencia_recorrencia', 'TEXT');
    adicionarColunaSeNaoExistir(db, 'contas', 'dia_base', 'INTEGER');
    versao = 4;
    definirVersaoSchema(db, 4);
  }

  // Migração 5: Estrutura dedicada do Cofrinho e migração de registros legados
  if (versao < 5) {
    try {
      // Se houver contas de economia/porquinho antigas, migra para a tabela cofrinhos
      const resEcon = db.exec(`
        SELECT c.id, c.descricao, c.valor_total, c.data_criacao,
               COUNT(p.id) as total_p, MIN(p.data_vencimento) as prim_venc
        FROM contas c
        LEFT JOIN parcelas p ON p.conta_id = c.id
        WHERE c.categoria_id IN (SELECT id FROM categorias WHERE LOWER(nome) LIKE '%econ%' OR LOWER(nome) LIKE '%poup%')
           OR c.observacoes LIKE '%Porquinho%'
        GROUP BY c.id;
      `);

      if (resEcon[0]?.values) {
        for (const row of resEcon[0].values) {
          const contaId = row[0] as number;
          const nome = (row[1] as string) || 'Meu Cofrinho';
          const valorMeta = (row[2] as number) || 0;
          const dataCriacao = (row[3] as string) || getHojeIso();
          const totalP = (row[4] as number) || 1;
          const valorParcela = totalP > 0 ? Math.floor(valorMeta / totalP) : valorMeta;
          const dataInicio = (row[5] as string) || dataCriacao;

          db.run(
            `INSERT INTO cofrinhos (nome, valor_meta, total_parcelas, valor_parcela, data_inicio, concluido, data_criacao)
             VALUES (?, ?, ?, ?, ?, 0, ?);`,
            [nome, valorMeta, totalP, valorParcela, dataInicio, dataCriacao]
          );

          const cofIdRes = db.exec('SELECT last_insert_rowid();');
          const novoCofId = cofIdRes[0]?.values[0]?.[0] as number;

          if (novoCofId) {
            // Migra parcelas pagas como depósitos reais
            const resParcPagas = db.exec(
              `SELECT valor, data_pagamento FROM parcelas WHERE conta_id = ? AND status = 'pago';`,
              [contaId]
            );
            if (resParcPagas[0]?.values) {
              for (const pRow of resParcPagas[0].values) {
                const valPago = (pRow[0] as number) || valorParcela;
                const dtPag = (pRow[1] as string) || dataInicio;
                db.run(
                  `INSERT INTO cofrinho_depositos (cofrinho_id, valor, data_deposito, observacao)
                   VALUES (?, ?, ?, 'Depósito migrado do plano anterior');`,
                  [novoCofId, valPago, dtPag]
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Aviso durante migração de cofrinhos legados:', err);
    }
    versao = 5;
    definirVersaoSchema(db, 5);
  }

  // Migração 6: Criação da tabela de notificações enviadas e índices finais
  if (versao < 6) {
    db.run(`
      CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
        chave TEXT PRIMARY KEY,
        parcela_id INTEGER,
        data_vencimento TEXT,
        enviada_em TEXT
      );
    `);
    versao = 6;
    definirVersaoSchema(db, 6);
  }

  // Reativa PRAGMA foreign_keys = ON
  db.run('PRAGMA foreign_keys = ON;');
}

export function recriarCategoriasPadrao(db: Database) {
  db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Gastos', '#2563eb');");
  db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Economias', '#10b981');");
  db.run("INSERT OR IGNORE INTO categorias (nome, cor) VALUES ('Reservas', '#f59e0b');");
}

/**
 * Obtém a instância do banco SQLite com tratamentos de erro isolados por etapa
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
            // Tenta servir o arquivo estático da pasta public ou URL empacotada
            return '/sql-wasm.wasm';
          }
          return file;
        },
      });
    } catch {
      // Fallback para URL empacotada do Vite
      try {
        SQL = await initSqlJs({
          locateFile: (file: string) => {
            if (file.endsWith('.wasm') && typeof sqlWasmUrl === 'string') {
              return sqlWasmUrl;
            }
            return file;
          },
        });
      } catch (err: any) {
        throw new DatabaseInitError('carregar o WASM do sql.js', err);
      }
    }

    // ETAPA 2: Abrir o arquivo salvo no IndexedDB
    let savedData: Uint8Array | null = null;
    try {
      savedData = await carregarDoIndexedDB();
    } catch (err: any) {
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
      throw new DatabaseInitError('abrir o arquivo salvo (instanciação SQLite)', err);
    }

    // ETAPA 3: Backup pré-migração
    if (savedData && savedData.length > 0) {
      try {
        await salvarBackupPreMigracao(savedData);
      } catch (err) {
        console.warn('Aviso: falha ao salvar backup pré-migração:', err);
      }
    }

    // ETAPA 4: Migrações seguras
    try {
      executarMigracoes(db);
      recriarCategoriasPadrao(db);
    } catch (err: any) {
      throw new DatabaseInitError('migração do schema', err);
    }

    // ETAPA 5: Ativar PRAGMA foreign_keys = ON
    try {
      db.run('PRAGMA foreign_keys = ON;');
    } catch (err: any) {
      throw new DatabaseInitError('PRAGMA foreign_keys', err);
    }

    // ETAPA 6: Seed se banco completamente vazio
    try {
      const res = db.exec('SELECT COUNT(*) as total FROM contas;');
      const count = (res[0]?.values[0]?.[0] as number) ?? 0;

      if (count === 0) {
        const resCof = db.exec('SELECT COUNT(*) as total FROM cofrinhos;');
        const countCof = (resCof[0]?.values[0]?.[0] as number) ?? 0;
        if (countCof === 0) {
          await popularDadosIniciais(db);
        }
      }
    } catch (err: any) {
      console.warn('Aviso ao conferir seed de dados iniciais:', err);
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
    initPromise = null;
    throw err;
  });

  return initPromise;
}

export function resetDbPromise() {
  initPromise = null;
}

// Debounce de persistência de 500ms
let persistTimer: any = null;
let pendingPersistResolve: (() => void)[] = [];

/**
 * Persiste o banco atual no IndexedDB com debounce de 500 ms
 */
export async function persistirDb(): Promise<void> {
  if (!dbInstance) return;
  return new Promise<void>((resolve) => {
    pendingPersistResolve.push(resolve);
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(async () => {
      persistTimer = null;
      const callbacks = pendingPersistResolve;
      pendingPersistResolve = [];
      try {
        if (dbInstance) {
          const data = dbInstance.export();
          await salvarNoIndexedDB(data);
        }
      } catch (err) {
        console.warn('Aviso: erro ao persistir banco no IndexedDB:', err);
      } finally {
        callbacks.forEach((cb) => cb());
      }
    }, 500);
  });
}

/**
 * Força a gravação imediata sem esperar o timer (usado em visibilitychange e pagehide)
 */
export async function persistirDbImediato(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const callbacks = pendingPersistResolve;
  pendingPersistResolve = [];
  try {
    if (dbInstance) {
      const data = dbInstance.export();
      await salvarNoIndexedDB(data);
    }
  } catch (err) {
    console.warn('Aviso: erro ao persistir banco imediatamente:', err);
  } finally {
    callbacks.forEach((cb) => cb());
  }
}

// Listeners globais para gravação imediata ao fechar o app ou trocar de aba
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistirDbImediato();
    }
  });
  window.addEventListener('pagehide', () => {
    persistirDbImediato();
  });
  window.addEventListener('beforeunload', () => {
    persistirDbImediato();
  });
}

/**
 * Executa uma operação em transação atômica (BEGIN TRANSACTION ... COMMIT / ROLLBACK)
 */
export async function executarEmTransacao<T>(
  callback: (db: Database) => Promise<T> | T
): Promise<T> {
  const db = await getDb();
  db.run('BEGIN TRANSACTION;');
  try {
    const result = await callback(db);
    db.run('COMMIT;');
    persistirDb();
    return result;
  } catch (error) {
    try {
      db.run('ROLLBACK;');
    } catch (rbError) {
      console.warn('Aviso ao efetuar ROLLBACK:', rbError);
    }
    throw error;
  }
}

/**
 * Solicita persistência durável no navegador via navigator.storage.persist()
 */
export async function solicitarPersistenciaStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export async function verificarPersistenciaStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Exporta o arquivo binário .sqlite real nomeado com a data local: em-dia-YYYY-MM-DD.sqlite
 */
export async function exportarArquivoSqlite(): Promise<void> {
  await persistirDbImediato();
  const db = await getDb();
  const binaryArray = db.export();
  const blob = new Blob([binaryArray.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });

  const hoje = getHojeIso();
  const fileName = `em-dia-${hoje}.sqlite`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  // Registra a data do último backup para lembretes de 30 dias
  try {
    localStorage.setItem('em_dia_ultimo_backup_sqlite', hoje);
  } catch {}
}

/**
 * Exporta os bytes SQLite armazenados para recuperação de emergência (mesmo com erro)
 */
export async function exportarBytesRecuperacao(): Promise<void> {
  let bytes: Uint8Array | null = null;
  if (dbInstance) {
    try {
      bytes = dbInstance.export();
    } catch {}
  }
  if (!bytes) {
    bytes = await carregarDoIndexedDB();
  }
  if (!bytes) {
    bytes = await carregarBackupPreMigracao();
  }

  if (!bytes || bytes.length === 0) {
    throw new Error('Nenhum dado encontrado para exportação de emergência.');
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
  const hoje = getHojeIso();
  const fileName = `em-dia-recuperacao-${hoje}.sqlite`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Limpa o IndexedDB e recria o banco de dados do zero com schema limpo e categorias padrão
 */
export async function recriarBancoDoZero(): Promise<Database> {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  resetDbPromise();

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
    console.warn('Aviso ao limpar IndexedDB:', err);
  }

  return await getDb();
}

/**
 * Valida o cabeçalho "SQLite format 3"
 */
export function validarCabecalhoSqlite(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 16) return false;
  const headerBytes = new Uint8Array(buffer, 0, 16);
  const expected = 'SQLite format 3\0';
  for (let i = 0; i < expected.length; i++) {
    if (headerBytes[i] !== expected.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

/**
 * Restaura o banco de dados a partir de um arquivo .sqlite fornecido pelo usuário,
 * validando o cabeçalho e executando migrações caso o arquivo seja de uma versão anterior
 */
export async function restaurarArquivoSqlite(fileBuffer: ArrayBuffer): Promise<void> {
  if (!validarCabecalhoSqlite(fileBuffer)) {
    throw new Error('Arquivo inválido: o arquivo selecionado não é um banco de dados SQLite válido (cabeçalho SQLite format 3 ausente).');
  }

  const SQL = await initSqlJs({
    locateFile: (file) => (file.endsWith('.wasm') ? '/sql-wasm.wasm' : file),
  });

  const uint8 = new Uint8Array(fileBuffer);
  let novoDb: Database;
  try {
    novoDb = new SQL.Database(uint8);
  } catch (err: any) {
    throw new Error('Falha ao abrir arquivo SQLite: ' + (err?.message || 'Arquivo corrompido'));
  }

  const tables = novoDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('contas', 'parcelas', 'categorias')"
  );

  if (!tables[0] || tables[0].values.length < 3) {
    throw new Error('Arquivo SQLite inválido: tabelas essenciais (contas, parcelas, categorias) não foram encontradas.');
  }

  // Executa migrações caso o arquivo importado seja de uma versão antiga
  try {
    executarMigracoes(novoDb);
  } catch (err: any) {
    console.warn('Aviso ao rodar migrações no banco importado:', err);
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
  }

  dbInstance = novoDb;
  await persistirDbImediato();
}

/**
 * Limpa todos os dados do banco e recria as categorias padrão
 */
export async function limparBancoDeDados(): Promise<void> {
  const db = await getDb();
  db.run('PRAGMA foreign_keys = OFF;');
  db.run('DELETE FROM parcelas;');
  db.run('DELETE FROM contas;');
  db.run('DELETE FROM cofrinho_depositos;');
  db.run('DELETE FROM cofrinhos;');
  db.run('DELETE FROM categorias;');
  db.run('DELETE FROM notificacoes_enviadas;');
  db.run('DELETE FROM sqlite_sequence;');

  recriarCategoriasPadrao(db);
  db.run('PRAGMA foreign_keys = ON;');

  await persistirDbImediato();
}

/**
 * Popula dados de exemplo realistas em CENTAVOS (INTEGER)
 */
export async function popularDadosIniciais(db?: Database): Promise<void> {
  const targetDb = db || (await getDb());

  targetDb.run('PRAGMA foreign_keys = OFF;');
  targetDb.run('DELETE FROM parcelas;');
  targetDb.run('DELETE FROM contas;');
  targetDb.run('DELETE FROM cofrinho_depositos;');
  targetDb.run('DELETE FROM cofrinhos;');
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
  const y = now.getFullYear();
  const m = now.getMonth();

  const formatDateStr = (year: number, month: number, day: number): string => {
    const d = new Date(year, month, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // 1. Despesa única: Supermercado R$ 650,00 (65000 centavos)
  targetDb.run(
    `INSERT INTO contas (id, descricao, categoria_id, valor_total, tipo, forma_pagamento, observacoes, data_criacao)
     VALUES (1, 'Supermercado Mensal', 1, 65000, 'unica', 'Geral', 'Compras para despensa', ?);`,
    [formatDateStr(y, m, 1)]
  );
  targetDb.run(
    `INSERT INTO parcelas (conta_id, numero_parcela, total_parcelas, valor, data_vencimento, data_pagamento, status, valor_pago)
     VALUES (1, 1, 1, 65000, ?, ?, 'pago', 65000);`,
    [formatDateStr(y, m, 5), formatDateStr(y, m, 5)]
  );

  // 2. Cofrinho dedicado: Viagem de Férias (R$ 2.400,00 em 12x de R$ 200,00)
  targetDb.run(
    `INSERT INTO cofrinhos (id, nome, valor_meta, total_parcelas, valor_parcela, data_inicio, concluido, data_criacao)
     VALUES (1, 'Férias de Verão', 240000, 12, 20000, ?, 0, ?);`,
    [formatDateStr(y, m, 1), formatDateStr(y, m, 1)]
  );
  // Primeiro depósito realizado de R$ 200,00
  targetDb.run(
    `INSERT INTO cofrinho_depositos (cofrinho_id, valor, data_deposito, observacao)
     VALUES (1, 20000, ?, 'Primeiro depósito mensal');`,
    [formatDateStr(y, m, 2)]
  );

  targetDb.run('PRAGMA foreign_keys = ON;');
}

