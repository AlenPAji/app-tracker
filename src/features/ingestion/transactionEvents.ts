import type { Transaction } from '../../types';

export type NewTransactionListener = (transaction: Transaction) => void;

const listeners = new Set<NewTransactionListener>();

export const subscribeToNewTransactions = (listener: NewTransactionListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const publishNewTransaction = (transaction: Transaction): void => {
  listeners.forEach((listener) => listener(transaction));
};
