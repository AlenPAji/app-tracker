import banks from './banks.json';

export type BankRegistryEntry = (typeof banks)[number];

export const normalizeSenderHeader = (sender: string): string => {
  const compact = sender.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compact.replace(/^[A-Z]{2}/, '').replace(/(?:S|T)$/, '');
};

export const findRegisteredBank = (sender: string): BankRegistryEntry | null => {
  const header = normalizeSenderHeader(sender);
  return banks.find((bank) => bank.headers.some((candidate) => candidate === header)) ?? null;
};

export const registeredBanks = banks;
