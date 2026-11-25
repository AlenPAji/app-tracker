/**
 * Base repository providing common SQL operations on top of expo-sqlite.
 * expo-sqlite API (v14):
 *   - create(options) -> Database
 *   - db.write(callback) -> T
 *   - db.read<T>(sql, params) -> T[]
 *   - db.getFirst<T>(sql, params) -> T | undefined
 *   - db.run(sql, params) -> { changes, lastId }
 *   - db.exec(sql) -> void
 *   - db.getAll<T>(sql, params) -> T[]
 */

import { runMigrations } from '../migrations';

export abstract class BaseRepository {
  protected db: any; // expo-sqlite Database instance

  constructor(db: any) {
    this.db = db;
    runMigrations(db);
  }

  // --------------------------------------------------------------------------
  // Core wrappers
  // --------------------------------------------------------------------------

  protected write<T>(fn: (db: any) => T): T {
    return this.db.write(fn);
  }

  protected read<T>(sql: string, params?: any[]): T[] {
    return this.db.read(sql, params ?? []) as T[];
  }

  protected getFirst<T>(sql: string, params?: any[]): T | undefined {
    return this.db.getFirst(sql, params ?? []) as T | undefined;
  }

  protected run(sql: string, params?: any[]): { changes: number; lastId: number } {
    return this.db.run(sql, params ?? []);
  }

  protected exec(sql: string): void {
    this.db.exec(sql);
  }

  // --------------------------------------------------------------------------
  // Generic helpers
  // --------------------------------------------------------------------------

  protected uuid(): string {
    // Simple UUIDv4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  protected nowISO(): string {
    return new Date().toISOString();
  }

  protected dateOnly(isoOrTimestamp: string | number): string {
    const d = new Date(isoOrTimestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns ISO 8601 date string in the local device timezone (YYYY-MM-DDTHH:mm:ss).
   */
  protected localDateTime(epochMs: number): string {
    return new Date(epochMs).toISOString().slice(0, 19);
  }

  protected epochFromISO(iso: string): number {
    return new Date(iso).getTime();
  }

  protected epochFromDateOnly(dateOnlyStr: string): number {
    return new Date(dateOnlyStr + 'T00:00:00').getTime();
  }

  // --------------------------------------------------------------------------
  // Common WHERE clauses
  // --------------------------------------------------------------------------

  protected transactionsWhere(filter?: {
    type?: 'debit' | 'credit';
    category?: string;
    sender?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): string {
    const parts: string[] = [];
    if (filter?.type) {
      parts.push(`t.type = '${filter.type}'`);
    }
    if (filter?.category) {
      parts.push(`t.category = '${filter.category}'`);
    }
    if (filter?.sender) {
      parts.push(`t.matched_sender = '${filter.sender}'`);
    }
    if (filter?.dateFrom) {
      parts.push(`t.date >= '${filter.dateFrom}'`);
    }
    if (filter?.dateTo) {
      parts.push(`t.date <= '${filter.dateTo}'`);
    }
    if (filter?.search) {
      const q = filter.search.replace(/'/g, "''");
      parts.push(`(t.merchant LIKE '%${q}%' OR t.description LIKE '%${q}%' OR t.payee LIKE '%${q}%')`);
    }
    return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  }
}