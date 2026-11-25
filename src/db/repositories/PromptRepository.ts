import type { Category, Transaction } from '../../types';
import { BaseRepository } from './BaseRepository';

export type PromptDecision = 'save' | 'prompt' | 'defer';

export class PromptRepository extends BaseRepository {
  getSetting(key: string, fallback: string): string {
    return this.getFirst<{ value: string }>(
      `SELECT value FROM prompt_settings WHERE key = ?`,
      [key],
    )?.value ?? fallback;
  }

  shouldPrompt(transaction: Transaction): boolean {
    if (transaction.type === 'credit' && this.getSetting('prompt_credits', '0') !== '1') return false;
    if (transaction.amount < Number(this.getSetting('minimum_amount', '50'))) return false;
    const merchant = transaction.merchant.trim();
    const stat = this.getFirst<{ times_confirmed: number; never_ask: number }>(
      `SELECT times_confirmed, never_ask FROM merchant_stats WHERE merchant = ? COLLATE NOCASE`,
      [merchant],
    );
    return !stat?.never_ask && (stat?.times_confirmed ?? 0) < 2;
  }

  markAsked(transactionId: string): void {
    this.run(`UPDATE transactions SET prompt_state = 'asked', updated_at = datetime('now') WHERE id = ?`, [transactionId]);
  }

  recordCategory(transaction: Transaction, category: Category, merchant = transaction.merchant): void {
    this.write((db) => {
      db.run(
        `INSERT INTO merchant_stats (merchant, category, times_confirmed, never_ask, updated_at)
         VALUES (?, ?, 1, 0, datetime('now'))
         ON CONFLICT(merchant) DO UPDATE SET category = excluded.category,
           times_confirmed = merchant_stats.times_confirmed + 1,
           updated_at = excluded.updated_at`,
        [merchant, category],
      );
      db.run(
        `UPDATE transactions SET category = ?, category_source = 'user',
         prompt_state = 'answered', updated_at = datetime('now') WHERE id = ?`,
        [category, transaction.id],
      );
    });
  }

  markSkipped(transactionId: string): void {
    this.run(`UPDATE transactions SET prompt_state = 'skipped', updated_at = datetime('now') WHERE id = ?`, [transactionId]);
  }

  markSnoozed(transactionId: string): void {
    this.run(`UPDATE transactions SET prompt_state = 'snoozed', updated_at = datetime('now') WHERE id = ?`, [transactionId]);
  }

  neverAskForMerchant(transaction: Transaction): void {
    this.write((db) => {
      db.run(
        `INSERT INTO merchant_stats (merchant, category, times_confirmed, never_ask, updated_at)
         VALUES (?, ?, 0, 1, datetime('now'))
         ON CONFLICT(merchant) DO UPDATE SET never_ask = 1, updated_at = excluded.updated_at`,
        [transaction.merchant, transaction.category],
      );
      db.run(
        `UPDATE transactions SET prompt_state = 'skipped', updated_at = datetime('now') WHERE id = ?`,
        [transaction.id],
      );
    });
  }
}
