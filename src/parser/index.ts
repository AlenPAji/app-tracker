import type { Category, ParsedSmsTransaction, TransactionType } from '../types';
import { BANK_RULES } from './rules';
import { isIgnored, normalizeSender, parseAmount } from './utils';

const AMOUNT_PATTERN = /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi;
const REF_PATTERN = /(?:upi\s*(?:ref(?:erence)?|txn)|transaction\s*(?:id|ref)|ref(?:erence)?|rrn)\s*(?:no\.?|id)?[:\s-]*([A-Z0-9-]{6,30})/i;
const MERCHANT_PATTERN = /\b(?:to|at|from|by|vpa|merchant)[:\s-]+([A-Za-z0-9][A-Za-z0-9 .&'/_-]{1,60}?)(?=\s+(?:on|ref|upi|txn|avl|a\/c|for|was|is|with|to|at|from|by)\b|[.;,]|$)/gi;
const BALANCE_PATTERN = /(?:avl(?:ailable)?\.?\s*(?:bal(?:ance)?|limit)?|bal(?:ance)?)\s*[:=]?\s*(?:₹|INR|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i;
const ACCOUNT_PATTERN = /(?:a\/c|account|acct)(?:\s*(?:no\.?|ending|x+))*\s*[xX* -]*(\d{4})\b/i;
const DATE_PATTERN = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})(?:[ ,]+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?))?\b/i;

const categoryKeywords: Array<[Category, RegExp]> = [
  ['Food', /zomato|swiggy|domino|pizza|kfc|restaurant|cafe|biryani/i],
  ['Travel', /uber|ola|rapido|irctc|makemytrip|ixigo|redbus|flight|metro/i],
  ['Bills', /recharge|airtel|jio|vi\b|vodafone|bsnl|broadband|bill payment/i],
  ['Shopping', /amazon|flipkart|myntra|ajio|croma|reliance|shopping/i],
  ['Groceries', /bigbasket|blinkit|zepto|dmart|grocery|instamart/i],
  ['Entertainment', /netflix|spotify|hotstar|prime video|bookmyshow|pvr/i],
  ['Health', /apollo|pharmeasy|medplus|netmeds|hospital|clinic|pharmacy/i],
];

export interface ParseOptions {
  receivedAt?: number;
  sender?: string;
}

export const categorizeMerchant = (merchant: string): Category =>
  categoryKeywords.find(([, pattern]) => pattern.test(merchant))?.[0] ?? 'Other';

const extractFirstAmount = (body: string): number | null => {
  const amounts: number[] = [];
  for (const match of body.matchAll(AMOUNT_PATTERN)) {
    const value = parseAmount(match[1]);
    if (value !== null) amounts.push(value);
  }
  return amounts[0] ?? null;
};

const parseTimestamp = (body: string, receivedAt?: number): number | undefined => {
  const match = body.match(DATE_PATTERN);
  if (!match) return receivedAt;
  const [day, month, year] = match[1].split(/[-/]/).map(Number);
  const date = new Date(year < 100 ? 2000 + year : year, month - 1, day);
  if (match[2]) {
    const time = match[2].match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (time) {
      let hour = Number(time[1]);
      if (time[3]?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (time[3]?.toUpperCase() === 'AM' && hour === 12) hour = 0;
      date.setHours(hour, Number(time[2]), 0, 0);
    }
  }
  return date.getTime();
};

const hasDebitLanguage = (body: string): boolean => /\b(debit(?:ed)?|deducted|spent|paid|purchase|sent|withdrawn)\b/i.test(body);
const hasCreditLanguage = (body: string): boolean => /\b(credit(?:ed)?|received|refund(?:ed)?|reversed|cashback|collect(?:ed)?)\b/i.test(body);

export const parseSms = (body: string, options: ParseOptions = {}): ParsedSmsTransaction | null => {
  const cleanBody = body.replace(/\s+/g, ' ').trim();
  if (!cleanBody || isIgnored(cleanBody) || /balance\s+(?:is|enquiry|inquiry)|avl(?:ailable)?\.?\s*bal(?:ance)?\s*(?:is|:)/i.test(cleanBody) && !hasDebitLanguage(cleanBody) && !hasCreditLanguage(cleanBody)) {
    return null;
  }

  const amount = extractFirstAmount(cleanBody);
  if (amount === null) return null;
  const type: TransactionType | null = hasDebitLanguage(cleanBody)
    ? 'debit'
    : hasCreditLanguage(cleanBody)
      ? 'credit'
      : null;
  if (!type) return null;

  const normalizedSender = normalizeSender(options.sender ?? '');
  const bankRule = BANK_RULES
    .filter((rule) => rule.bankId && (normalizedSender.includes(rule.bankId.toUpperCase()) || rule.debit?.test(cleanBody) || rule.credit?.test(cleanBody)))
    .sort((a, b) => b.priority - a.priority)[0];
  const merchantMatches = [...cleanBody.matchAll(MERCHANT_PATTERN)]
    .map((match) => match[1].split(/\s+(?:on|ref|upi|txn|avl|a\/c|for|was|is|with)\b|[.;,]/i)[0].trim())
    .filter((value) => !/^(?:your account|your a\/c|the account|a\/c|upi|payment|rs|inr|₹)$/i.test(value));
  const providerMerchant = cleanBody.match(/(?:UPI|GPay|PhonePe|Paytm)[:\s-]+([A-Za-z0-9._-]{2,40})/i)?.[1];
  const merchant = merchantMatches.at(-1)
    ?? (providerMerchant && !/^(?:reversal|payment|transaction)$/i.test(providerMerchant) ? providerMerchant : undefined)
    ?? 'Unknown merchant';
  const balanceAfter = cleanBody.match(BALANCE_PATTERN)?.[1];
  const accountLast4 = cleanBody.match(ACCOUNT_PATTERN)?.[1];
  const parsedBalance = balanceAfter ? parseAmount(balanceAfter) : null;

  return {
    amount,
    type,
    merchant,
    transactionRef: cleanBody.match(REF_PATTERN)?.[1],
    accountLast4,
    balanceAfter: parsedBalance ?? undefined,
    timestamp: parseTimestamp(cleanBody, options.receivedAt),
    category: bankRule?.category ?? categorizeMerchant(merchant),
    bankId: bankRule?.bankId,
  };
};

export { isIgnored, normalizeSender, parseAmount };
