/**
 * Database initialization — single shared SQLite instance.
 */

import * as SQLite from 'expo-sqlite';
import { getDatabasePath, SCHEMA_VERSION, runMigrations } from './migrations';
import { TransactionRepository } from './repositories/TransactionRepository';
import { RawSmsRepository } from './repositories/RawSmsRepository';
import { PromptRepository } from './repositories/PromptRepository';
import { BankSenderRepository } from './repositories/BankSenderRepository';

type Database = ReturnType<typeof SQLite.openDatabaseSync>;
let instance: Database | null = null;

export const openDatabase = (): Database => {
  if (instance) {
    return instance;
  }
  instance = SQLite.openDatabaseSync(getDatabasePath(), { enableChangeListener: true });
  runMigrations(instance);
  console.log(`[DB] Opened database: ${getDatabasePath()}`);
  return instance;
};

export const getTransactionRepository = () => new TransactionRepository(openDatabase());
export const getRawSmsRepository = () => new RawSmsRepository(openDatabase());
export const getPromptRepository = () => new PromptRepository(openDatabase());
export const getBankSenderRepository = () => new BankSenderRepository(openDatabase());

export const closeDatabase = (): void => {
  if (instance) {
    instance.closeSync();
    instance = null;
    console.log('[DB] Database closed');
  }
};

export { SCHEMA_VERSION };