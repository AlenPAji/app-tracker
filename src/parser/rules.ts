import type { BankRule } from '../types';

const amount = String.raw`(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)`;

export const BANK_RULES: BankRule[] = [
  {
    priority: 100,
    debit: new RegExp(String.raw`(?:debited|debit|deducted|spent|paid).*?${amount}|${amount}.*?(?:debited|debit|deducted|spent|paid)`, 'i'),
    credit: new RegExp(String.raw`(?:credited|credit|received|refunded|refund|reversed|cashback).*?${amount}|${amount}.*?(?:credited|credit|received|refunded|refund|reversed|cashback)`, 'i'),
    merchant: /(?:to|at|from|vpa|merchant)[:\s-]+([A-Za-z0-9][A-Za-z0-9 .&'/_-]{1,60}?)(?:\s+(?:on|ref|upi|txn|avl|a\/c|for)\b|[.;]|$)/i,
    transactionRef: /(?:upi\s*(?:ref(?:erence)?|txn)|transaction\s*(?:id|ref)|ref(?:erence)?|rrn)\s*(?:no\.?|id)?[:\s-]*([A-Z0-9-]{6,30})/i,
    accountLast4: /(?:a\/c|account|acct)(?:\s*(?:no\.?|ending|x+))*\s*[xX* -]*(\d{4})\b/i,
    balanceAfter: /(?:avl(?:ailable)?\.?\s*(?:bal(?:ance)?|limit)?|bal(?:ance)?)\s*[:=]?\s*(?:₹|INR|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  },
  { priority: 90, debit: /HDFCBK|HDFC\s+BANK/i, credit: /HDFCBK|HDFC\s+BANK/i, category: 'SMS (UPI)', bankId: 'hdfc' },
  { priority: 90, debit: /SBIINB|SBINB|STATE\s+BANK/i, credit: /SBIINB|SBINB|STATE\s+BANK/i, bankId: 'sbi' },
  { priority: 90, debit: /ICICIB|ICICI\s+BANK/i, credit: /ICICIB|ICICI\s+BANK/i, bankId: 'icici' },
  { priority: 90, debit: /AXISBK|AXIS\s+BANK/i, credit: /AXISBK|AXIS\s+BANK/i, bankId: 'axis' },
  { priority: 90, debit: /KOTAK|KMBK/i, credit: /KOTAK|KMBK/i, bankId: 'kotak' },
  { priority: 90, debit: /YESBK|YES\s+BANK/i, credit: /YESBK|YES\s+BANK/i, bankId: 'yes' },
  { priority: 90, debit: /PNB|PUNJAB\s+NATIONAL/i, credit: /PNB|PUNJAB\s+NATIONAL/i, bankId: 'pnb' },
];
