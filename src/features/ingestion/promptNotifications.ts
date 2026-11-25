import notifee, { AndroidImportance, Event, EventType } from '@notifee/react-native';
import { getPromptRepository, getTransactionRepository } from '../../db';
import type { Category, Transaction } from '../../types';

export const CATEGORIZE_CHANNEL = 'categorize-spends';
export const SAVED_CHANNEL = 'saved-confirmations';
export const DIGEST_CHANNEL = 'daily-digest';

const suggestedCategories = (transaction: Transaction): Category[] => {
  const preferred = transaction.category === 'Other' ? ['Food', 'Groceries'] : [transaction.category];
  return [...new Set([...preferred, 'Shopping', 'Bills'])].slice(0, 2) as Category[];
};

export const createPromptChannels = async (): Promise<void> => {
  await notifee.createChannels([
    { id: CATEGORIZE_CHANNEL, name: 'Categorize spends', importance: AndroidImportance.HIGH },
    { id: SAVED_CHANNEL, name: 'Saved confirmations', importance: AndroidImportance.LOW },
    { id: DIGEST_CHANNEL, name: 'Daily digest', importance: AndroidImportance.DEFAULT },
  ]);
};

export const showCategorizePrompt = async (transaction: Transaction): Promise<void> => {
  await createPromptChannels();
  const categories = suggestedCategories(transaction);
  await notifee.displayNotification({
    id: `categorize-${transaction.id}`,
    title: `${transaction.amount.toLocaleString('en-IN')} rupees to ${transaction.merchant}`,
    body: 'What was this for?',
    data: { transactionId: transaction.id },
    android: {
      channelId: CATEGORIZE_CHANNEL,
      pressAction: { id: 'default' },
      actions: [
        { title: categories[0], pressAction: { id: `category:${categories[0]}` } },
        { title: 'More…', pressAction: { id: 'more', launchActivity: 'default' } },
        { title: 'Not now', pressAction: { id: 'not-now' } },
      ],
    },
  });
};

export const handlePromptEvent = async ({ type, detail }: Event): Promise<void> => {
  if (type !== EventType.ACTION_PRESS) return;
  const rawTransactionId = detail.notification?.data?.transactionId;
  const transactionId = typeof rawTransactionId === 'string' ? rawTransactionId : undefined;
  const actionId = detail.pressAction?.id;
  if (!transactionId || !actionId) return;
  const transaction = getTransactionRepository().getById(transactionId);
  if (!transaction) return;
  if (actionId.startsWith('category:')) {
    const category = actionId.slice('category:'.length) as Category;
    getPromptRepository().recordCategory(transaction, category);
    await notifee.displayNotification({
      id: `saved-${transaction.id}`,
      title: 'Saved to your ledger',
      body: `${transaction.merchant} · ${category}`,
      android: { channelId: SAVED_CHANNEL, autoCancel: true },
    });
    await notifee.cancelNotification(`categorize-${transaction.id}`);
  } else if (actionId === 'not-now') {
    getPromptRepository().markSnoozed(transaction.id);
  }
};
