import { BaseRepository } from './BaseRepository';

export interface BankSender {
  header: string;
  bank: string;
  category: string;
  enabled: number;
}

export class BankSenderRepository extends BaseRepository {
  list(search = ''): BankSender[] {
    const query = `%${search}%`;
    return this.read<BankSender>(
      `SELECT header, bank, category, enabled FROM bank_senders
       WHERE bank LIKE ? OR header LIKE ? ORDER BY category, bank, header`,
      [query, query],
    );
  }

  setEnabled(header: string, enabled: boolean): void {
    this.run(`UPDATE bank_senders SET enabled = ? WHERE header = ?`, [enabled ? 1 : 0, header]);
  }

  isEnabled(header: string): boolean {
    return !!this.getFirst<{ enabled: number }>(
      `SELECT enabled FROM bank_senders WHERE header = ? AND enabled = 1`,
      [header],
    );
  }
}
