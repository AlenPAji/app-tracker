/**
 * Shared type definitions for the SMS Expense Tracker.
 * All types here are framework-agnostic (no React Native imports).
 */

// ============================================================================
// Transaction types
// ============================================================================

export type TransactionType = 'debit' | 'credit';

export type Category =
  | 'Food'
  | 'Travel'
  | 'Bills'
  | 'Shopping'
  | 'Groceries'
  | 'Entertainment'
  | 'Health'
  | 'Education'
  | 'Transport'
  | 'Utilities'
  | 'SMS (UPI)'
  | 'Other';

export interface Transaction {
  id: string;
  smsId: string | null; // foreign key to raw SMS, or null for manual
  amount: number;
  currency: string;
  type: TransactionType;
  category: Category;
  merchant: string;
  payee?: string;
  description?: string;
  transactionRef?: string; // UPI ref no. / transaction id
  accountLast4?: string;
  balanceAfter?: number;
  balanceBefore?: number;
  date: string; // ISO 8601 (stored in local time)
  timestamp: number; // epoch ms
  source: 'sms' | 'manual';
  matchedSender?: string; // the normalized sender ID that matched
  createdAt: string;
  updatedAt: string;
  categorySource?: 'rule' | 'user' | 'pending';
  promptState?: 'not_asked' | 'asked' | 'answered' | 'snoozed' | 'skipped';
}

export interface UpsertTransactionInput extends Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}

// ============================================================================
// SMS types
// ============================================================================

export type SmsStatus = 'parsed' | 'unparsed' | 'ignored';

export interface RawSms {
  id: string;
  sender: string;
  body: string;
  timestamp: string; // ISO 8601 from SMS provider
  epoch: number;
  status: SmsStatus;
  parsedTransactionId: string | null;
  normalizedSender: string | null;
  bankId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RawSmsInsert {
  sender: string;
  body: string;
  timestamp: string;
  epoch: number;
  normalizedSender?: string | null;
  bankId?: string | null;
}

// ============================================================================
// Bank / sender types
// ============================================================================

export interface BankConfig {
  id: string;
  name: string;
  senderPattern: RegExp; // normalized match of sender
  displayName: string;
  isDefault?: boolean; // generic fallback rules
}

export interface BankRule {
  /** Priority: higher = tried first */
  priority: number;
  /** Regex to match a UPI debit line */
  debit?: RegExp;
  debitLabel?: (groups: RegExpMatchArray) => string;
  /** Regex to match a UPI credit line (refunds / UPI collect) */
  credit?: RegExp;
  creditLabel?: (groups: RegExpMatchArray) => string;
  /** Capture account last-4 from this pattern */
  accountLast4?: RegExp;
  /** Capture balance-after */
  balanceAfter?: RegExp;
  /** Capture balance-before */
  balanceBefore?: RegExp;
  /** Capture UPI ref no. */
  transactionRef?: RegExp;
  /** Capture merchant/payee name */
  merchant?: RegExp;
  /** Fixed category if matched */
  category?: Category;
  /** Fixed merchant if matched (overrides group) */
  merchantOverride?: string;
  bankId?: string;
}

export interface ParsedSmsTransaction {
  amount: number;
  type: TransactionType;
  merchant: string;
  payee?: string;
  transactionRef?: string;
  accountLast4?: string;
  balanceAfter?: number;
  timestamp?: number;
  category: Category;
  bankId?: string;
}

// ============================================================================
// Notification / budget types
// ============================================================================

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';

export interface Budget {
  id: string;
  amount: number;
  period: BudgetPeriod;
  category: Category | null; // null = all categories
  label?: string;
  notificationsEnabled: boolean;
  warningThreshold: number; // e.g. 0.8 = 80%
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSnapshot {
  id: string;
  budgetId: string;
  periodStart: string;
  periodEnd: string;
  spent: number;
  notified: boolean;
  warningNotified: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  warningAt: number; // fraction, default 0.8
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}

// ============================================================================
// App settings / onboarding types
// ============================================================================

export interface AppSettings {
  pinEnabled: boolean;
  biometricEnabled: boolean;
  darkMode: 'system' | 'light' | 'dark';
  weekStart: 'monday' | 'sunday';
  currency: string;
  language: string;
  smsPermissionsGranted: boolean;
  firstLaunchedAt: string | null;
  lastSmsScanAt: string | null;
  selectedBanks: string[]; // bank ids
  customCategoryRules: CategoryRule[];
  batteryOptimizationDisabled: boolean;
  autostartEnabled: boolean;
  notificationsEnabled: boolean;
  dataRetentionDays: number;
}

export interface CategoryRule {
  pattern: string;
  category: Category;
  createdAt: string;
}

export interface OnboardingState {
  step: number;
  permissionsGranted: boolean;
  banksSelected: string[];
  completed: boolean;
}

// ============================================================================
// Native queue (headless task bridge)
// ============================================================================

export interface NativeSmsQueueItem {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
}

// ============================================================================
// Analytics helpers
// ============================================================================

export interface DailySpend {
  date: string; // YYYY-MM-DD in device local tz
  spent: number;
  received: number;
  net: number;
}

export interface CategorySpend {
  category: Category;
  spent: number;
  percent: number;
}

export interface PeriodTotals {
  spent: number;
  received: number;
  net: number;
  count: number;
  dateRangeStart: string;
  dateRangeEnd: string;
}

// ============================================================================
// Navigation params
// ============================================================================

export interface ScreenParams {
  Transactions: { filter?: string; dateFrom?: string; dateTo?: string };
  TransactionDetails: { transactionId: string };
  AddTransaction: { prefillBank?: string };
  EditTransaction: { transactionId: string };
  Analytics: { view?: 'daily' | 'category' | 'trend' };
  BudgetDetail: { budgetId: string };
  Export: { type: 'csv' | 'json' };
  About: undefined;
}

export type ScreenName =
  | 'Dashboard'
  | 'Transactions'
  | 'TransactionDetails'
  | 'AddTransaction'
  | 'EditTransaction'
  | 'Analytics'
  | 'Budgets'
  | 'BudgetDetail'
  | 'Settings'
  | 'CategoryRules'
  | 'Export'
  | 'About';