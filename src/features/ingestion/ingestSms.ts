import { getPromptRepository, getRawSmsRepository, getTransactionRepository } from '../../db';
import { parseSms } from '../../parser';
import type { Transaction } from '../../types';
import { publishNewTransaction } from './transactionEvents';
import { showCategorizePrompt } from './promptNotifications';

export interface IncomingSms {
  sender: string;
  body: string;
  epoch: number;
}

/**
 * Persists the raw message before parsing so an unsupported bank format can
 * be repaired later without losing the original SMS.
 */
export const ingestSmsMessage = (message: IncomingSms): Transaction | null => {
  const rawRepository = getRawSmsRepository();
  const raw = rawRepository.create({
    sender: message.sender,
    body: message.body,
    timestamp: new Date(message.epoch).toISOString(),
    epoch: message.epoch,
  });
  const parsed = parseSms(message.body, {
    sender: message.sender,
    receivedAt: message.epoch,
  });

  if (!parsed) {
    rawRepository.updateStatus(raw.id, 'unparsed');
    return null;
  }

  const transactionRepository = getTransactionRepository();
  const transaction = transactionRepository.create({
    smsId: raw.id,
    amount: parsed.amount,
    currency: 'INR',
    type: parsed.type,
    category: parsed.category,
    merchant: parsed.merchant,
    transactionRef: parsed.transactionRef,
    accountLast4: parsed.accountLast4,
    balanceAfter: parsed.balanceAfter,
    date: new Date(parsed.timestamp ?? message.epoch).toISOString(),
    timestamp: parsed.timestamp ?? message.epoch,
    source: 'sms',
    matchedSender: parsed.bankId,
  });
  const shouldPrompt = getPromptRepository().shouldPrompt(transaction);
  if (shouldPrompt) getPromptRepository().markAsked(transaction.id);
  rawRepository.updateStatus(raw.id, 'parsed', transaction.id);
  if (shouldPrompt) {
    publishNewTransaction(transaction);
    void showCategorizePrompt(transaction);
  }
  return transaction;
};
