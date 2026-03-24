import * as SQLite from 'expo-sqlite'

let _db: SQLite.SQLiteDatabase | null = null

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db
  _db = await SQLite.openDatabaseAsync('tunda.db')
  await initSchema(_db)
  return _db
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      sell_price REAL NOT NULL DEFAULT 0,
      buy_price REAL NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      credit_balance REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      issue_date TEXT NOT NULL,
      due_date TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      current_balance REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT
    );
  `)
}

// ─── Products ─────────────────────────────────────────────
export async function upsertProducts(products: object[]) {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const p of products as any[]) {
      await db.runAsync(
        `INSERT OR REPLACE INTO products
          (id, business_id, name, category, sell_price, buy_price, stock_qty, low_stock_threshold, is_active, synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [p.id, p.business_id, p.name, p.category ?? null, p.sell_price, p.buy_price,
         p.stock_qty, p.low_stock_threshold, p.is_active ? 1 : 0, now]
      )
    }
  })
}

export async function getProducts(businessId: string): Promise<any[]> {
  const db = await getDb()
  return db.getAllAsync(
    'SELECT * FROM products WHERE business_id = ? AND is_active = 1 AND stock_qty > 0 ORDER BY name',
    [businessId]
  )
}

export async function deductProductStock(productId: string, qty: number) {
  const db = await getDb()
  await db.runAsync(
    'UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?',
    [qty, productId]
  )
}

// ─── Customers ────────────────────────────────────────────
export async function upsertCustomers(customers: object[]) {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const c of customers as any[]) {
      await db.runAsync(
        `INSERT OR REPLACE INTO customers
          (id, business_id, name, phone, credit_balance, is_active, synced_at)
         VALUES (?,?,?,?,?,?,?)`,
        [c.id, c.business_id, c.name, c.phone, c.credit_balance, c.is_active ? 1 : 0, now]
      )
    }
  })
}

export async function getCustomers(businessId: string): Promise<any[]> {
  const db = await getDb()
  return db.getAllAsync(
    'SELECT * FROM customers WHERE business_id = ? AND is_active = 1 ORDER BY name',
    [businessId]
  )
}

// ─── Invoices ─────────────────────────────────────────────
export async function upsertInvoices(invoices: object[]) {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const inv of invoices as any[]) {
      await db.runAsync(
        `INSERT OR REPLACE INTO invoices
          (id, business_id, invoice_number, customer_id, customer_name, status,
           issue_date, due_date, total_amount, amount_paid, payment_method, note, created_at, synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [inv.id, inv.business_id, inv.invoice_number, inv.customer_id ?? null,
         inv.customers?.name ?? null, inv.status, inv.issue_date, inv.due_date ?? null,
         inv.total_amount, inv.amount_paid, inv.payment_method ?? null, inv.note ?? null,
         inv.created_at, now]
      )
    }
  })
}

export async function getInvoices(businessId: string): Promise<any[]> {
  const db = await getDb()
  return db.getAllAsync(
    `SELECT * FROM invoices WHERE business_id = ? AND status != 'void' ORDER BY created_at DESC`,
    [businessId]
  )
}

// ─── Bank Accounts ────────────────────────────────────────
export async function upsertBankAccounts(accounts: object[]) {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.withTransactionAsync(async () => {
    for (const a of accounts as any[]) {
      await db.runAsync(
        `INSERT OR REPLACE INTO bank_accounts
          (id, business_id, name, account_type, current_balance, is_active, synced_at)
         VALUES (?,?,?,?,?,?,?)`,
        [a.id, a.business_id, a.name, a.account_type, a.current_balance, a.is_active ? 1 : 0, now]
      )
    }
  })
}

export async function getBankAccounts(businessId: string): Promise<any[]> {
  const db = await getDb()
  return db.getAllAsync(
    'SELECT * FROM bank_accounts WHERE business_id = ? AND is_active = 1 ORDER BY account_type',
    [businessId]
  )
}

// ─── Offline Queue ────────────────────────────────────────
export async function enqueueItem(type: string, payload: object): Promise<string> {
  const db = await getDb()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await db.runAsync(
    'INSERT INTO offline_queue (id, type, payload, created_at, status) VALUES (?,?,?,?,?)',
    [id, type, JSON.stringify(payload), new Date().toISOString(), 'pending']
  )
  return id
}

export async function getPendingQueue(): Promise<any[]> {
  const db = await getDb()
  return db.getAllAsync(
    "SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY created_at ASC"
  )
}

export async function markQueueItem(id: string, status: 'synced' | 'failed', error?: string) {
  const db = await getDb()
  await db.runAsync(
    'UPDATE offline_queue SET status = ?, error = ? WHERE id = ?',
    [status, error ?? null, id]
  )
}
