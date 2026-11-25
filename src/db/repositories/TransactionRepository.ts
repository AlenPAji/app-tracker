/**
 * TransactionRepository — data access layer for transactions.
 */

import type { Transaction, UpsertTransactionInput, Category } from '../../types';
import { BaseRepository } from './BaseRepository';

export class TransactionRepository extends BaseRepository {
  readonly TABLE = 'transactions';

  // --------------------------------------------------------------------------
  // Create / update
  // --------------------------------------------------------------------------

  create(input: UpsertTransactionInput): Transaction {
    return this.write((db) => {
      const id = input.id ?? this.uuid();
      const now = this.nowISO();
      const row: Transaction = {
        ...input,
        id,
        createdAt: now,
        updatedAt: now,
      };

      db.run(
        `INSERT INTO ${this.TABLE} (
          id, sms_id, amount, currency, type, category, merchant, payee, description,
          transaction_ref, account_last4, balance_after, balance_before, date,
          timestamp, source, matched_sender, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.smsId,
          row.amount,
          row.currency,
          row.type,
          row.category,
          row.merchant,
          row.payee ?? null,
          row.description ?? null,
          row.transactionRef ?? null,
          row.accountLast4 ?? null,
          row.balanceAfter ?? null,
          row.balanceBefore ?? null,
          row.date,
          row.timestamp,
          row.source,
          row.matchedSender ?? null,
          row.createdAt,
          row.updatedAt,
        ]
      );
      return row;
    });
  }

  update(id: string, input: Partial<UpsertTransactionInput>): Transaction | null {
    return this.write((db) => {
      const fields: string[] = [];
      const values: any[] = [];
      for (const [key, value] of Object.entries(input)) {
        if (value === undefined || value === null) continue;
        fields.push(`${key} = ?`);
        values.push(value);
      }

      fields.push(`updated_at = ?`);
      values.push(this.nowISO());
      values.push(id);

      db.run(`UPDATE ${this.TABLE} SET ${fields.join(', ')} WHERE id = ?`, values);

      return this.getById(id);
    });
  }

  updateAnnotation(id: string, annotation: { merchant: string; category: Category }): Transaction | null {
    return this.write((db) => {
      db.run(
        `UPDATE ${this.TABLE}
         SET merchant = ?, category = ?, updated_at = ?
         WHERE id = ?`,
        [annotation.merchant, annotation.category, this.nowISO(), id]
      );
      return this.getById(id);
    });
  }

  delete(id: string): void {
    this.write((db) => {
      db.run(`DELETE FROM ${this.TABLE} WHERE id = ?`, [id]);
    });
  }

  // --------------------------------------------------------------------------
  // Read
  // --------------------------------------------------------------------------

  getById(id: string): Transaction | null {
    const row = this.getFirst<Transaction>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
    return row ?? null;
  }

  getAll(filter?: {
    type?: 'debit' | 'credit';
    category?: string;
    sender?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Transaction[] {
    const where = this.transactionsWhere(filter);
    const sql = `
      SELECT * FROM ${this.TABLE} t
      ${where}
      ORDER BY t.timestamp DESC
      ${filter?.limit ? `LIMIT ${filter.limit}` : ''}
      ${filter?.offset ? `OFFSET ${filter.offset}` : ''}
    `;
    return this.read<Transaction>(sql, filter ? [filter.type, filter.category, filter.sender] : []);
  }

  getForDateRange(start: string, end: string): Transaction[] {
    return this.read<Transaction>(
      `SELECT * FROM ${this.TABLE} WHERE date >= ? AND date <= ? ORDER BY timestamp DESC`,
      [start, end]
    );
  }

  getBySmsId(smsId: string): Transaction | null {
    return this.getFirst<Transaction>(`SELECT * FROM ${this.TABLE} WHERE sms_id = ?`, [smsId]) ?? null;
  }

  getUnparsedCount(): number {
    const row = this.getFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.TABLE} WHERE source = 'manual' OR category = 'Other'`,
      []
    );
    return row?.count ?? 0;
  }

  // --------------------------------------------------------------------------
  // Aggregations
  // --------------------------------------------------------------------------

  getTotalByPeriod(periodStart: string, periodEnd: string, type?: 'debit' | 'credit' | null): number {
    let sql = `SELECT COALESCE(SUM(amount), 0) as total FROM ${this.TABLE} WHERE date >= ? AND date <= ?`;
    const params: any[] = [periodStart, periodEnd];
    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }
    const row = this.getFirst<{ total: number }>(sql, params);
    return row?.total ?? 0;
  }

  getTotalsByCategory(periodStart: string, periodEnd: string): Array<{ category: string; total: number }> {
    return this.read<{ category: string; total: number }>(
      `SELECT category, SUM(amount) as total FROM ${this.TABLE} WHERE date >= ? AND date <= ? AND type = 'debit' GROUP BY category ORDER BY total DESC`,
      [periodStart, periodEnd]
    );
  }

  getTotalsByDay(periodStart: string, periodEnd: string): Array<{ date: string; spent: number; received: number }> {
    return this.read<{ date: string; spent: number; received: number }>(
      `SELECT date,
               COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as spent,
               COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as received
        FROM ${this.TABLE}
        WHERE date >= ? AND date <= ?
        GROUP BY date
        ORDER BY date ASC`,
      [periodStart, periodEnd]
    );
  }

  getRecentCount(days: number): number {
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sql = `SELECT COUNT(*) as count FROM ${this.TABLE} WHERE timestamp >= ?`;
    const row = this.getFirst<{ count: number }>(sql, [daysAgo.getTime()]);
    return row?.count ?? 0;
  }
}