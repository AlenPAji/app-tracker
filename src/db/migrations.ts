import { Platform } from 'react-native';
import { registeredBanks } from '../data/banks';

export const getDatabasePath = (): string => Platform.OS === 'ios'
  ? 'Documents/expense-tracker.db'
  : 'expense-tracker.db';

export const SCHEMA_VERSION = 3;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  sms_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  category TEXT NOT NULL,
  merchant TEXT NOT NULL,
  payee TEXT,
  description TEXT,
  transaction_ref TEXT UNIQUE,
  account_last4 TEXT,
  balance_after REAL,
  balance_before REAL,
  date TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('sms', 'manual')),
  matched_sender TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (sms_id) REFERENCES raw_sms (id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS raw_sms (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('parsed', 'unparsed', 'ignored')),
  parsed_transaction_id TEXT,
  normalized_sender TEXT,
  bank_id TEXT,
  body_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  sender_pattern TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_selected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL,
  period TEXT NOT NULL,
  category TEXT,
  label TEXT,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  warning_threshold REAL NOT NULL DEFAULT 0.8,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS budget_snapshots (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  spent REAL NOT NULL DEFAULT 0,
  notified INTEGER NOT NULL DEFAULT 0,
  warning_notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_sms_epoch ON raw_sms(epoch DESC);
CREATE INDEX IF NOT EXISTS idx_raw_sms_dedupe ON raw_sms(sender, epoch);
`;

export type Migration = { toVersion: number; up: (db: any) => void };

const defaultBanks = [
  ['hdfc', 'HDFC Bank', 'HDFC Bank', 'HDFCBK'],
  ['sbi', 'State Bank of India', 'SBI', 'SBIINB|SBINB'],
  ['icici', 'ICICI Bank', 'ICICI Bank', 'ICICIB'],
  ['axis', 'Axis Bank', 'Axis Bank', 'AXISBK'],
  ['kotak', 'Kotak Mahindra Bank', 'Kotak Mahindra Bank', 'KOTAK|KMBK'],
  ['yes', 'Yes Bank', 'Yes Bank', 'YESBK'],
  ['pnb', 'Punjab National Bank', 'PNB', 'PNB'],
  ['upi-generic', 'UPI', 'Any UPI payment', 'UPI'],
];

export const migrations: Migration[] = [
  {
    toVersion: 1,
    up: (db) => {
      db.exec(CREATE_TABLES_SQL);
      db.run(`INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`, ['app_version', '1']);
    },
  },
  {
    toVersion: 2,
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.getAll(`PRAGMA table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
      if (!columns('raw_sms').includes('body_hash')) db.run(`ALTER TABLE raw_sms ADD COLUMN body_hash TEXT`);
      if (!columns('bank_configs').includes('sender_pattern')) db.run(`ALTER TABLE bank_configs ADD COLUMN sender_pattern TEXT`);
      if (!columns('bank_configs').includes('is_selected')) db.run(`ALTER TABLE bank_configs ADD COLUMN is_selected INTEGER NOT NULL DEFAULT 0`);
      db.run(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'app_version'`, ['2']);
    },
  },
  {
    toVersion: 3,
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.getAll(`PRAGMA table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
      const addColumn = (table: string, name: string, definition: string): void => {
        if (!columns(table).includes(name)) db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      };

      addColumn('transactions', 'category_source', `TEXT NOT NULL DEFAULT 'pending'`);
      addColumn('transactions', 'prompt_state', `TEXT NOT NULL DEFAULT 'not_asked'`);
      db.exec(`
        CREATE TABLE IF NOT EXISTS bank_senders (
          header TEXT PRIMARY KEY,
          bank TEXT NOT NULL,
          category TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS merchant_stats (
          merchant TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          times_confirmed INTEGER NOT NULL DEFAULT 0,
          never_ask INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS prompt_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS prompt_log (
          id TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
        );
      `);
      const defaults: Array<[string, string]> = [
        ['minimum_amount', '50'],
        ['quiet_start', '23:00'],
        ['quiet_end', '07:00'],
        ['daily_cap', '20'],
        ['prompt_credits', '0'],
        ['digest_time', '09:00'],
      ];
      for (const [key, value] of defaults) {
        db.run(
          `INSERT OR IGNORE INTO prompt_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
          [key, value],
        );
      }
      db.run(`UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'app_version'`, ['3']);
    },
  },
];

export const runMigrations = (db: any, currentVersionKey = 'app_version'): void => {
  let currentVersion = 0;
  try {
    const row = db.getFirst('SELECT value FROM settings WHERE key = ?', [currentVersionKey]) as { value: string } | undefined;
    currentVersion = Number(row?.value ?? 0);
  } catch {
    currentVersion = 0;
  }

  for (const migration of migrations) {
    if (migration.toVersion <= currentVersion) continue;
    migration.up(db);
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [currentVersionKey, String(migration.toVersion)]
    );
  }

  for (const [id, name, displayName, senderPattern] of defaultBanks) {
    db.run(
      `INSERT OR IGNORE INTO bank_configs (id, name, display_name, sender_pattern, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, name, displayName, senderPattern, id === 'upi-generic' ? 1 : 0]
    );
  }
  for (const bank of registeredBanks) {
    for (const header of bank.headers) {
      db.run(
        `INSERT OR IGNORE INTO bank_senders (header, bank, category, enabled, created_at)
         VALUES (?, ?, ?, 0, datetime('now'))`,
        [header, bank.bank, bank.category],
      );
    }
  }
  const categoryRules: Array<[string, string, string]> = [
    ['food', 'zomato|swiggy|domino|pizza|kfc|restaurant|cafe', 'Food'],
    ['travel', 'uber|ola|rapido|irctc|makemytrip|ixigo|redbus|flight|metro', 'Travel'],
    ['bills', 'recharge|airtel|jio|vodafone|bsnl|broadband|bill', 'Bills'],
    ['shopping', 'amazon|flipkart|myntra|ajio|croma|reliance', 'Shopping'],
    ['groceries', 'bigbasket|blinkit|zepto|dmart|grocery|instamart', 'Groceries'],
    ['entertainment', 'netflix|spotify|hotstar|prime video|bookmyshow|pvr', 'Entertainment'],
  ];
  for (const [id, pattern, category] of categoryRules) {
    db.run(
      `INSERT OR IGNORE INTO category_rules (id, pattern, category, created_at) VALUES (?, ?, ?, datetime('now'))`,
      [`rule-${id}`, pattern, category]
    );
  }
};
