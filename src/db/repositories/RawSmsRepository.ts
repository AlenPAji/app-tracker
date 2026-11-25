/**
 * RawSmsRepository — data access layer for raw SMS messages.
 */

import type { RawSms, RawSmsInsert } from '../../types';
import { BaseRepository } from './BaseRepository';

export class RawSmsRepository extends BaseRepository {
  readonly TABLE = 'raw_sms';

  // --------------------------------------------------------------------------
  // Create / update
  // --------------------------------------------------------------------------

  create(input: RawSmsInsert): RawSms {
    return this.write((db) => {
      const id = this.uuid();
      const now = this.nowISO();
      const row: RawSms = {
        id,
        sender: input.sender,
        body: input.body,
        timestamp: input.timestamp,
        epoch: input.epoch,
        status: 'unparsed',
        parsedTransactionId: null,
        normalizedSender: input.normalizedSender ?? null,
        bankId: input.bankId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      db.run(
        `INSERT INTO ${this.TABLE} (
          id, sender, body, timestamp, epoch, status, parsed_transaction_id,
          normalized_sender, bank_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.sender,
          row.body,
          row.timestamp,
          row.epoch,
          row.status,
          row.parsedTransactionId,
          row.normalizedSender,
          row.bankId,
          row.createdAt,
          row.updatedAt,
        ]
      );
      return row;
    });
  }

  updateStatus(id: string, status: RawSms['status'], parsedTransactionId: string | null = null): void {
    this.write((db) => {
      db.run(
        `UPDATE ${this.TABLE} SET status = ?, parsed_transaction_id = ?, updated_at = ? WHERE id = ?`,
        [status, parsedTransactionId, this.nowISO(), id]
      );
    });
  }

  // --------------------------------------------------------------------------
  // Read
  // --------------------------------------------------------------------------

  getById(id: string): RawSms | null {
    const row = this.getFirst<RawSms>(`SELECT * FROM ${this.TABLE} WHERE id = ?`, [id]);
    return row ?? null;
  }

  getAll(filter?: {
    status?: RawSms['status'];
    bankId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): RawSms[] {
    const parts: string[] = [];
    const params: any[] = [];
    if (filter?.status) {
      parts.push(`status = ?`);
      params.push(filter.status);
    }
    if (filter?.bankId) {
      parts.push(`bank_id = ?`);
      params.push(filter.bankId);
    }
    if (filter?.dateFrom) {
      parts.push(`epoch >= ?`);
      params.push(new Date(filter.dateFrom).getTime());
    }
    if (filter?.dateTo) {
      parts.push(`epoch <= ?`);
      params.push(new Date(filter.dateTo).getTime());
    }
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    return this.read<RawSms>(`SELECT * FROM ${this.TABLE} ${where} ORDER BY epoch DESC`, params);
  }

  getUnparsed(limit: number = 1000): RawSms[] {
    return this.read<RawSms>(
      `SELECT * FROM ${this.TABLE} WHERE status = 'unparsed' ORDER BY epoch DESC LIMIT ?`,
      [limit]
    );
  }

  getForBank(bankId: string, sinceEpoch: number): RawSms[] {
    return this.read<RawSms>(
      `SELECT * FROM ${this.TABLE} WHERE bank_id = ? AND epoch > ? ORDER BY epoch ASC`,
      [bankId, sinceEpoch]
    );
  }

  getDistinctSenders(limit: number = 100): RawSms[] {
    return this.read<RawSms>(
      `SELECT * FROM ${this.TABLE} WHERE sender NOT LIKE '%(%' AND sender != '' AND sender NOT LIKE '%notification%' GROUP BY sender ORDER BY epoch DESC LIMIT ?`,
      [limit]
    );
  }

  getTopSenders(limit: number = 20): RawSms[] {
    return this.read<RawSms>(
      `SELECT sender, COUNT(*) as cnt FROM ${this.TABLE} GROUP BY sender ORDER BY cnt DESC LIMIT ?`,
      [limit]
    );
  }

  // --------------------------------------------------------------------------
  // Deduplication & safety net
  // --------------------------------------------------------------------------

  existsHash(sender: string, body: string, windowMs: number = 60000): boolean {
    const parts = sender.trim().toUpperCase().split(/\s/).join('');
    const hash = btoa(`${parts}|${body}`);
    const now = Date.now();
    const row = this.getFirst<{ id: string }>(
      `SELECT id FROM ${this.TABLE} WHERE normalized_sender = ? AND epoch > ? LIMIT 1`,
      [hash, now - windowMs]
    );
    return !!row;
  }

  getLastProcessedEpoch(): number {
    const row = this.getFirst<{ max_epoch: number }>(
      `SELECT MAX(epoch) as max_epoch FROM ${this.TABLE}`,
      []
    );
    return row?.max_epoch ?? 0;
  }

  setLastProcessedEpoch(epoch: number): void {
    this.write((db) => {
      db.run(`UPDATE settings SET value = ? WHERE key = 'last_sms_scan'`, [epoch.toString()]);
    });
  }

  // --------------------------------------------------------------------------
  // Bulk insert (inbox scan)
  // --------------------------------------------------------------------------

  createMany(items: RawSmsInsert[]): number {
    return this.write((db) => {
      let inserted = 0;
      for (const item of items) {
        try {
          this.create(item);
          inserted++;
        } catch (e) {
          // dedup by primary key — ignore duplicates
        }
      }
      return inserted;
    });
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  deleteOlderThan(days: number): number {
    return this.write((db) => {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      db.run(`DELETE FROM ${this.TABLE} WHERE epoch < ?`, [daysAgo.getTime()]);
      return db.changes ?? 0;
    });
  }
}