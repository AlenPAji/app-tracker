/**
 * Pure utility functions for the parser. ZERO dependencies.
 */

import type { BankRule } from '../types';
import { BANK_RULES } from './rules';

export const normalizeSender = (sender: string): string => {
  // Preserve the parser's sender identity; registry matching uses normalizeSenderHeader.
  return sender
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
};

export const findBankForSender = (normalizedSender: string): BankRule | null => {
  const prefixes: Record<string, BankRule> = {};
  for (const rule of BANK_RULES) {
    if (/[A-Z0-9]{4,}/.test(rule.debit?.source ?? '') || /[A-Z0-9]{3,}/.test(rule.credit?.source ?? '')) {
      // extract bank identifiers from the rule
      const matches = (rule.debit?.source ?? rule.credit?.source ?? '').match(/[A-Z0-9]{4,}/g);
      for (const m of matches ?? []) {
        prefixes[m] = rule;
      }
    }
  }
  for (const key of Object.keys(prefixes)) {
    if (normalizedSender.includes(key) || key.includes(normalizedSender)) {
      return prefixes[key];
    }
  }
  return null;
};

export const extractAmount = (groups: RegExpMatchArray | null): number | null => {
  if (!groups) return null;
  // Find first non-empty numeric group
  for (const g of groups.slice(1)) {
    if (typeof g === 'string' && g.trim() !== '') {
      return parseAmount(g);
    }
  }
  return null;
};

export const parseAmount = (amountStr: string): number | null => {
  const numericPart = amountStr.match(/\d[\d,.]*/)?.[0];
  if (!numericPart) return null;
  const cleaned = numericPart.trim();
  if (!cleaned) return null;
  const commaParts = cleaned.split(',');
  const normalized = cleaned.includes('.')
    ? cleaned.replace(/,/g, '')
    : commaParts.length === 2 && commaParts[1].length <= 2
      ? commaParts.join('.')
      : cleaned.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeDateTime = (dateTimeStr: string): number => {
  // Try ISO first, then common formats
  let date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) {
    // Try formats like "08 Nov 2024, 14:32" or "08-11-2024 14:32:10"
    date = new Date(dateTimeStr.replace(/(\d{2})\s+([A-Za-z]{3})\s+(\d{4})/, '$2 $1 $3'));
  }
  return date.getTime();
};

export const isIgnored = (body: string): boolean => {
  const ignoredPatterns = [
    /otp|one time password|verification code|auth code|login attempt/i,
    /promo|promotion|congratulations|winner|claim now|limited offer/i,
    /loan|home loan|personal loan|balance transfer/i,
    /investment|mutual fund|sip|portfolio/i,
    /^Your OTP/i,
    /payment request has been cancelled|payment request expired/i,
    /balance alert|nominee/i,
  ];
  return ignoredPatterns.some((p) => p.test(body));
};

export const formatCurrency = (amount: number, currency = 'INR'): string => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
};