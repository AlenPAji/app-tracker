import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  PermissionsAndroid,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { getPromptRepository } from './src/db';
import { getRawSmsRepository } from './src/db';
import { subscribeToNewTransactions } from './src/features/ingestion';
import type { Category, Transaction as StoredTransaction } from './src/types';

type Tab = 'Today' | 'Activity' | 'Insights' | 'Budgets' | 'Messages' | 'Settings';
type Tone = 'mint' | 'coral' | 'violet' | 'amber' | 'blue';

type Transaction = {
  id: string;
  merchant: string;
  category: string;
  bank: string;
  amount: number;
  type: 'debit' | 'credit';
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
};

const transactions: Transaction[] = [
  { id: '1', merchant: 'Swiggy', category: 'Food', bank: 'HDFC Bank', amount: 438, type: 'debit', time: 'Today · 1:24 PM', icon: 'restaurant-outline', tone: 'coral' },
  { id: '2', merchant: 'Metro Recharge', category: 'Travel', bank: 'SBI', amount: 250, type: 'debit', time: 'Today · 10:12 AM', icon: 'train-outline', tone: 'blue' },
  { id: '3', merchant: 'Amazon', category: 'Shopping', bank: 'ICICI Bank', amount: 1299, type: 'debit', time: 'Yesterday · 7:42 PM', icon: 'bag-handle-outline', tone: 'violet' },
  { id: '4', merchant: 'Salary', category: 'Income', bank: 'HDFC Bank', amount: 42000, type: 'credit', time: 'Yesterday · 9:00 AM', icon: 'arrow-down-outline', tone: 'mint' },
  { id: '5', merchant: 'Airtel', category: 'Bills', bank: 'Axis Bank', amount: 799, type: 'debit', time: 'Mon · 6:18 PM', icon: 'phone-portrait-outline', tone: 'amber' },
];

const colors = {
  light: {
    canvas: '#F6F7F9',
    elevated: '#FFFFFF',
    ink: '#15202B',
    secondary: '#64717D',
    tertiary: '#8D98A3',
    line: '#E4E8EC',
    accent: '#168A72',
    accentSoft: '#DDF5EE',
    mint: '#168A72',
    mintSoft: '#DDF5EE',
    coral: '#D65D55',
    coralSoft: '#FBE6E3',
    violet: '#715AC7',
    violetSoft: '#ECE8FC',
    amber: '#A56B08',
    amberSoft: '#FFF0CC',
    blue: '#3779B8',
    blueSoft: '#E2EFFA',
    overlay: 'rgba(21,32,43,0.42)',
  },
  dark: {
    canvas: '#101416',
    elevated: '#1A2023',
    ink: '#F2F5F6',
    secondary: '#AAB5BA',
    tertiary: '#7E8A90',
    line: '#2A3338',
    accent: '#57C9A9',
    accentSoft: '#173A32',
    mint: '#57C9A9',
    mintSoft: '#173A32',
    coral: '#F08379',
    coralSoft: '#452522',
    violet: '#B1A1F0',
    violetSoft: '#302A4A',
    amber: '#F5C45A',
    amberSoft: '#41351D',
    blue: '#8BC1F0',
    blueSoft: '#1D3445',
    overlay: 'rgba(0,0,0,0.62)',
  },
};

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`;

function Icon({
  name,
  color,
  size = 22,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
}) {
  return <Ionicons name={name} color={color} size={size} />;
}

function Messages({ c }: { c: typeof colors.light }) {
  const [status, setStatus] = useState<'parsed' | 'unparsed' | 'ignored'>('parsed');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState(() => getRawSmsRepository().getAll({ status: 'parsed' }));
  useEffect(() => {
    setMessages(getRawSmsRepository().getAll({ status }));
  }, [status]);
  const visible = messages.filter((message) => `${message.sender} ${message.body}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <View><Text style={[styles.eyebrow, { color: c.accent }]}>YOUR INBOX, EXPLAINED</Text><Text style={[styles.title, { color: c.ink }]}>Messages</Text></View>
      </View>
      <View style={[styles.searchBox, { backgroundColor: c.elevated, borderColor: c.line }]}>
        <Icon name="search-outline" color={c.secondary} size={19} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search sender or message" placeholderTextColor={c.tertiary} style={[styles.searchInput, { color: c.ink }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(['parsed', 'unparsed', 'ignored'] as const).map((item) => <FilterChip key={item} label={item[0].toUpperCase() + item.slice(1)} active={status === item} onPress={() => setStatus(item)} c={c} />)}
      </ScrollView>
      {visible.length === 0 ? <Surface c={c}><EmptyState c={c} /></Surface> : visible.map((message) => (
        <Surface key={message.id} c={c} style={styles.messageCard}>
          <View style={styles.messageMeta}><Text style={[styles.messageSender, { color: c.ink }]}>{message.sender}</Text><Text style={[styles.caption, { color: c.tertiary }]}>{new Date(message.epoch).toLocaleString('en-IN')}</Text></View>
          <View style={[styles.messageBubble, { backgroundColor: c.canvas }]}><Text style={[styles.messageBody, { color: c.secondary }]}>{message.body}</Text></View>
          <View style={styles.messageActions}><Text style={[styles.chipText, { color: message.status === 'parsed' ? c.accent : c.amber }]}>{message.status}</Text><Pressable onPress={() => Alert.alert('Message actions', 'Re-parse, edit fields, or ignore this sender from here.')}><Text style={[styles.link, { color: c.accent }]}>Review</Text></Pressable></View>
        </Surface>
      ))}
    </ScrollView>
  );
}

function Surface({ children, style, c }: { children: React.ReactNode; style?: object; c: typeof colors.light }) {
  return <View style={[styles.surface, { backgroundColor: c.elevated, borderColor: c.line }, style]}>{children}</View>;
}

function SectionTitle({ title, action, onPress, c }: { title: string; action?: string; onPress?: () => void; c: typeof colors.light }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionHeading, { color: c.ink }]}>{title}</Text>
      {action ? <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}><Text style={[styles.link, { color: c.accent }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

function Amount({ value, type, c, size = 17 }: { value: number; type: 'debit' | 'credit'; c: typeof colors.light; size?: number }) {
  return <Text style={{ color: type === 'credit' ? c.accent : c.ink, fontSize: size, fontWeight: '700' }}>{type === 'credit' ? '+' : '-'}{formatCurrency(value)}</Text>;
}

function TransactionRow({ item, c, onPress }: { item: Transaction; c: typeof colors.light; onPress: () => void }) {
  const tone = c[item.tone];
  const soft = c[`${item.tone}Soft` as keyof typeof c] as string;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.transactionRow, { opacity: pressed ? 0.72 : 1 }]} accessibilityRole="button" accessibilityLabel={`${item.merchant}, ${item.type === 'debit' ? 'spent' : 'received'} ${formatCurrency(item.amount)}`}>
      <View style={[styles.transactionIcon, { backgroundColor: soft }]}><Icon name={item.icon} color={tone as string} size={21} /></View>
      <View style={styles.transactionCopy}>
        <Text style={[styles.transactionMerchant, { color: c.ink }]} numberOfLines={1}>{item.merchant}</Text>
        <Text style={[styles.caption, { color: c.secondary }]}>{item.category} · {item.bank}</Text>
      </View>
      <View style={styles.amountCopy}><Amount value={item.amount} type={item.type} c={c} /><Text style={[styles.caption, { color: c.tertiary }]}>{item.time.split(' · ')[1]}</Text></View>
    </Pressable>
  );
}

function Dashboard({ c, onNavigate, onConnect }: { c: typeof colors.light; onNavigate: (tab: Tab) => void; onConnect: () => void }) {
  const bars = [38, 64, 42, 78, 55, 94, 48];
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <View><Text style={[styles.eyebrow, { color: c.accent }]}>SUNDAY, 8 NOVEMBER</Text><Text style={[styles.title, { color: c.ink }]}>Good evening.</Text></View>
        <Pressable style={[styles.avatar, { backgroundColor: c.accentSoft }]} accessibilityLabel="Open profile and security settings" onPress={() => onNavigate('Settings')}><Text style={[styles.avatarText, { color: c.accent }]}>A</Text></Pressable>
      </View>

      <Surface c={c} style={styles.pulseCard}>
        <View style={styles.cardTop}><View><Text style={[styles.cardLabel, { color: c.secondary }]}>THIS MONTH</Text><Text style={[styles.balance, { color: c.ink }]}>₹18,420</Text></View><View style={[styles.monthPill, { backgroundColor: c.accentSoft }]}><Icon name="trending-down" color={c.accent} size={15} /><Text style={[styles.monthPillText, { color: c.accent }]}>12% lower</Text></View></View>
        <View style={styles.pulseChart} accessibilityLabel="Monthly spending pulse chart">
          {bars.map((height, index) => <View key={index} style={styles.barWrap}><View style={[styles.bar, { height, backgroundColor: index === 5 ? c.coral : c.accent, opacity: index === 5 ? 1 : 0.72 }]} /></View>)}
        </View>
        <View style={styles.chartLabels}><Text style={[styles.caption, { color: c.tertiary }]}>Nov 2</Text><Text style={[styles.caption, { color: c.tertiary }]}>TODAY</Text></View>
      </Surface>

      <View style={styles.metricRow}>
        <Metric label="Spent today" value="₹688" icon="arrow-up-outline" tone="coral" c={c} />
        <Metric label="Received" value="₹42,000" icon="arrow-down-outline" tone="mint" c={c} />
      </View>

      <Pressable onPress={onConnect} style={[styles.connectBanner, { backgroundColor: c.ink }]} accessibilityRole="button" accessibilityLabel="Connect bank SMS">
        <View style={[styles.connectIcon, { backgroundColor: c.accent }]}><Icon name="chatbubble-ellipses-outline" color={c.ink} size={20} /></View>
        <View style={styles.connectCopy}><Text style={styles.connectTitle}>Make tracking automatic</Text><Text style={styles.connectSub}>Connect bank SMS to catch every UPI payment.</Text></View>
        <Icon name="arrow-forward" color="#FFFFFF" size={19} />
      </Pressable>

      <SectionTitle title="Recent activity" action="See all" onPress={() => onNavigate('Activity')} c={c} />
      <Surface c={c} style={styles.listCard}>
        {transactions.slice(0, 3).map((item) => <TransactionRow key={item.id} item={item} c={c} onPress={() => Alert.alert(item.merchant, `${item.category} · ${item.bank}\n${formatCurrency(item.amount)}`)} />)}
      </Surface>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function Metric({ label, value, icon, tone, c }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tone: Tone; c: typeof colors.light }) {
  return <Surface c={c} style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: c[`${tone}Soft` as keyof typeof c] as string }]}><Icon name={icon} color={c[tone] as string} size={17} /></View><Text style={[styles.metricLabel, { color: c.secondary }]}>{label}</Text><Text style={[styles.metricValue, { color: c.ink }]}>{value}</Text></Surface>;
}

function Activity({ c }: { c: typeof colors.light }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'All' | 'Spent' | 'Received'>('All');
  const filtered = transactions.filter((item) => item.merchant.toLowerCase().includes(query.toLowerCase()) && (scope === 'All' || (scope === 'Spent' ? item.type === 'debit' : item.type === 'credit')));
  const sections = [{ title: 'NOVEMBER 2026', data: filtered }];
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<><View style={styles.topRow}><View><Text style={[styles.eyebrow, { color: c.accent }]}>YOUR LEDGER</Text><Text style={[styles.title, { color: c.ink }]}>Activity</Text></View><Pressable style={[styles.roundButton, { backgroundColor: c.elevated, borderColor: c.line }]} onPress={() => Alert.alert('Add transaction', 'Manual entries will be available when the transaction editor is connected.')} accessibilityLabel="Add transaction"><Icon name="add" color={c.ink} size={23} /></Pressable></View><View style={[styles.searchBox, { backgroundColor: c.elevated, borderColor: c.line }]}><Icon name="search-outline" color={c.tertiary} size={20} /><TextInput value={query} onChangeText={setQuery} placeholder="Search merchant or category" placeholderTextColor={c.tertiary} style={[styles.searchInput, { color: c.ink }]} accessibilityLabel="Search activity" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><FilterChip label="All" active={scope === 'All'} onPress={() => setScope('All')} c={c} /><FilterChip label="Spent" active={scope === 'Spent'} onPress={() => setScope('Spent')} c={c} /><FilterChip label="Received" active={scope === 'Received'} onPress={() => setScope('Received')} c={c} /><FilterChip label="This month" active={false} onPress={() => Alert.alert('Date range', 'Date range filters are ready for the transaction repository.')} c={c} /></ScrollView></>}
      renderSectionHeader={({ section }) => <Text style={[styles.sectionEyebrow, { color: c.tertiary }]}>{section.title}</Text>}
      renderItem={({ item }) => <Surface c={c} style={styles.listCard}><TransactionRow item={item} c={c} onPress={() => Alert.alert(item.merchant, 'Swipe actions and editing will be connected to the repository in the next build step.')} /></Surface>}
      ListEmptyComponent={<EmptyState c={c} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function FilterChip({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: typeof colors.light }) {
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? c.ink : c.elevated, borderColor: active ? c.ink : c.line }]} accessibilityRole="button" accessibilityState={{ selected: active }}><Text style={[styles.chipText, { color: active ? c.canvas : c.secondary }]}>{label}</Text></Pressable>;
}

function EmptyState({ c }: { c: typeof colors.light }) {
  return <View style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}><Icon name="sparkles-outline" color={c.accent} size={26} /></View><Text style={[styles.emptyTitle, { color: c.ink }]}>Nothing matches</Text><Text style={[styles.emptyBody, { color: c.secondary }]}>Try a different merchant, category, or time range.</Text></View>;
}

function Insights({ c }: { c: typeof colors.light }) {
  const categories = [{ name: 'Food', amount: '₹6,240', percent: 62, color: c.coral }, { name: 'Shopping', amount: '₹3,980', percent: 40, color: c.violet }, { name: 'Travel', amount: '₹2,140', percent: 22, color: c.blue }, { name: 'Bills', amount: '₹1,840', percent: 18, color: c.amber }];
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.topRow}><View><Text style={[styles.eyebrow, { color: c.accent }]}>A CLEARER VIEW</Text><Text style={[styles.title, { color: c.ink }]}>Insights</Text></View><Pressable style={[styles.monthSelector, { backgroundColor: c.elevated, borderColor: c.line }]} onPress={() => Alert.alert('Period', 'Showing November 2026')}><Text style={[styles.monthText, { color: c.ink }]}>November</Text><Icon name="chevron-down" color={c.secondary} size={16} /></Pressable></View><Surface c={c} style={styles.insightHero}><Text style={[styles.cardLabel, { color: c.secondary }]}>SPENDING THIS MONTH</Text><Text style={[styles.insightTotal, { color: c.ink }]}>₹18,420</Text><Text style={[styles.caption, { color: c.accent }]}>₹2,480 less than October</Text><View style={styles.lineChart}><View style={[styles.lineSegment, { backgroundColor: c.accent, transform: [{ rotate: '-9deg' }], width: '31%', top: 44 }]} /><View style={[styles.lineSegment, { backgroundColor: c.accent, transform: [{ rotate: '18deg' }], width: '27%', top: 31, left: '27%' }]} /><View style={[styles.lineSegment, { backgroundColor: c.accent, transform: [{ rotate: '-20deg' }], width: '28%', top: 50, left: '52%' }]} /><View style={[styles.lineDot, { backgroundColor: c.accent, left: '78%', top: 40 }]} /></View><View style={styles.chartLabels}><Text style={[styles.caption, { color: c.tertiary }]}>Nov 1</Text><Text style={[styles.caption, { color: c.tertiary }]}>Nov 8</Text><Text style={[styles.caption, { color: c.tertiary }]}>Nov 15</Text><Text style={[styles.caption, { color: c.tertiary }]}>Nov 30</Text></View></Surface><SectionTitle title="Where it goes" action="Details" c={c} /><Surface c={c} style={styles.listCard}>{categories.map((category) => <View key={category.name} style={styles.categoryRow}><View style={[styles.categoryDot, { backgroundColor: category.color }]} /><Text style={[styles.categoryName, { color: c.ink }]}>{category.name}</Text><View style={styles.categoryTrack}><View style={[styles.categoryFill, { width: `${category.percent}%`, backgroundColor: category.color }]} /></View><Text style={[styles.categoryAmount, { color: c.secondary }]}>{category.amount}</Text></View>)}</Surface><View style={[styles.insightNote, { backgroundColor: c.accentSoft }]}><Icon name="bulb-outline" color={c.accent} size={19} /><Text style={[styles.insightNoteText, { color: c.ink }]}>Food is your largest category this month. You spent 12% less than last month.</Text></View></ScrollView>;
}

function Budgets({ c }: { c: typeof colors.light }) {
  const budgets = [{ name: 'Monthly spending', used: 18420, limit: 25000, icon: 'wallet-outline' as const, tone: 'mint' as Tone }, { name: 'Food', used: 6240, limit: 8000, icon: 'restaurant-outline' as const, tone: 'coral' as Tone }, { name: 'Travel', used: 2140, limit: 3000, icon: 'train-outline' as const, tone: 'blue' as Tone }];
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.topRow}><View><Text style={[styles.eyebrow, { color: c.accent }]}>SPEND WITH INTENTION</Text><Text style={[styles.title, { color: c.ink }]}>Budgets</Text></View><Pressable style={[styles.roundButton, { backgroundColor: c.elevated, borderColor: c.line }]} onPress={() => Alert.alert('New budget', 'Budget editor will save daily, weekly, or monthly limits locally.')} accessibilityLabel="Add budget"><Icon name="add" color={c.ink} size={23} /></Pressable></View><View style={[styles.budgetSummary, { backgroundColor: c.ink }]}><View><Text style={styles.darkLabel}>REMAINING THIS MONTH</Text><Text style={styles.darkTotal}>₹6,580</Text></View><View style={[styles.summaryRing, { borderColor: c.accent }]}><Text style={[styles.ringText, { color: c.accent }]}>74%</Text><Text style={styles.ringLabel}>used</Text></View></View><SectionTitle title="Your limits" action="Edit" c={c} />{budgets.map((budget) => { const ratio = budget.used / budget.limit; const tone = ratio >= 1 ? 'coral' : ratio >= 0.7 ? 'amber' : 'mint'; return <Surface c={c} key={budget.name} style={styles.budgetCard}><View style={styles.budgetTop}><View style={[styles.budgetIcon, { backgroundColor: c[`${budget.tone}Soft` as keyof typeof c] as string }]}><Icon name={budget.icon} color={c[budget.tone] as string} size={20} /></View><View style={styles.budgetCopy}><Text style={[styles.transactionMerchant, { color: c.ink }]}>{budget.name}</Text><Text style={[styles.caption, { color: c.secondary }]}>{formatCurrency(budget.used)} of {formatCurrency(budget.limit)}</Text></View><Text style={[styles.percent, { color: c[tone] as string }]}>{Math.round(ratio * 100)}%</Text></View><View style={[styles.progressTrack, { backgroundColor: c.line }]}><View style={[styles.progressFill, { width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: c[tone] as string }]} /></View><Text style={[styles.budgetFoot, { color: c.secondary }]}>{ratio >= 1 ? 'Over limit' : `${formatCurrency(budget.limit - budget.used)} left · alerts at 80% and 100%`}</Text></Surface>; })}<Pressable style={[styles.primaryButton, { backgroundColor: c.accent }]} onPress={() => Alert.alert('Budget alerts', 'You will be notified locally when a threshold is reached.')}><Icon name="notifications-outline" color="#FFFFFF" size={19} /><Text style={styles.primaryButtonText}>Manage alerts</Text></Pressable></ScrollView>;
}

function Settings({ c, onConnect }: { c: typeof colors.light; onConnect: () => void }) {
  const [biometric, setBiometric] = useState(false);
  const [notifications, setNotifications] = useState(true);
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.topRow}><View><Text style={[styles.eyebrow, { color: c.accent }]}>PRIVATE BY DEFAULT</Text><Text style={[styles.title, { color: c.ink }]}>Settings</Text></View><View style={[styles.avatar, { backgroundColor: c.accentSoft }]}><Text style={[styles.avatarText, { color: c.accent }]}>A</Text></View></View><View style={[styles.privacyBanner, { backgroundColor: c.accentSoft }]}><Icon name="lock-closed-outline" color={c.accent} size={22} /><View style={styles.privacyCopy}><Text style={[styles.privacyTitle, { color: c.ink }]}>Your data stays on this device</Text><Text style={[styles.caption, { color: c.secondary }]}>No account. No cloud. No tracking.</Text></View></View><SettingsGroup title="Data connection" c={c}><SettingsRow icon="chatbubble-ellipses-outline" title="Bank SMS" detail="Not connected" c={c} onPress={onConnect} /><SettingsRow icon="people-outline" title="Tracked senders" detail="Choose banks to scan" c={c} onPress={onConnect} /><SettingsRow icon="download-outline" title="Export data" detail="CSV for your records" c={c} onPress={() => Alert.alert('Export ready', 'A CSV export will be shared from this device.')} /></SettingsGroup><SettingsGroup title="Protection" c={c}><SettingsToggle icon="finger-print-outline" title="Biometric lock" detail="Use device authentication" value={biometric} onValueChange={setBiometric} c={c} /><SettingsRow icon="keypad-outline" title="PIN fallback" detail="Not configured" c={c} onPress={() => Alert.alert('PIN fallback', 'A secure PIN fallback will be stored on this device.')} /></SettingsGroup><SettingsGroup title="Preferences" c={c}><SettingsToggle icon="notifications-outline" title="Budget notifications" detail="80% and 100% thresholds" value={notifications} onValueChange={setNotifications} c={c} /><SettingsRow icon="phone-portrait-outline" title="Appearance" detail="Follows system" c={c} onPress={() => Alert.alert('Appearance', 'The app follows your Android system light or dark theme.')} /></SettingsGroup><Text style={[styles.version, { color: c.tertiary }]}>Spendwise · Offline-first personal finance</Text></ScrollView>;
}

function SettingsGroup({ title, children, c }: { title: string; children: React.ReactNode; c: typeof colors.light }) {
  return <View style={styles.settingsGroup}><Text style={[styles.sectionEyebrow, { color: c.tertiary }]}>{title.toUpperCase()}</Text><Surface c={c} style={styles.listCard}>{children}</Surface></View>;
}

function SettingsRow({ icon, title, detail, c, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; c: typeof colors.light; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.settingsRow} accessibilityRole="button"><View style={[styles.settingsIcon, { backgroundColor: c.canvas }]}><Icon name={icon} color={c.secondary} size={19} /></View><View style={styles.settingsCopy}><Text style={[styles.transactionMerchant, { color: c.ink }]}>{title}</Text><Text style={[styles.caption, { color: c.secondary }]}>{detail}</Text></View><Icon name="chevron-forward" color={c.tertiary} size={18} /></Pressable>;
}

function SettingsToggle({ icon, title, detail, value, onValueChange, c }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; value: boolean; onValueChange: (value: boolean) => void; c: typeof colors.light }) {
  return <View style={styles.settingsRow}><View style={[styles.settingsIcon, { backgroundColor: c.canvas }]}><Icon name={icon} color={c.secondary} size={19} /></View><View style={styles.settingsCopy}><Text style={[styles.transactionMerchant, { color: c.ink }]}>{title}</Text><Text style={[styles.caption, { color: c.secondary }]}>{detail}</Text></View><Switch value={value} onValueChange={onValueChange} trackColor={{ false: c.line, true: c.accent }} thumbColor="#FFFFFF" accessibilityLabel={title} /></View>;
}

function ConnectModal({ visible, onClose, c }: { visible: boolean; onClose: () => void; c: typeof colors.light }) {
  const [permissionState, setPermissionState] = useState<'idle' | 'granted' | 'blocked'>('idle');
  const requestSmsAccess = async () => {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    const granted = Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
    setPermissionState(granted ? 'granted' : 'blocked');
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={[styles.modalBackdrop, { backgroundColor: c.overlay }]}><View style={[styles.sheet, { backgroundColor: c.elevated }]}><View style={[styles.grabber, { backgroundColor: c.line }]} /><View style={[styles.sheetIcon, { backgroundColor: c.accentSoft }]}><Icon name={permissionState === 'granted' ? 'checkmark-circle-outline' : 'shield-checkmark-outline'} color={c.accent} size={28} /></View><Text style={[styles.sheetTitle, { color: c.ink }]}>{permissionState === 'granted' ? 'SMS access is ready' : 'Connect bank SMS'}</Text><Text style={[styles.sheetBody, { color: c.secondary }]}>{permissionState === 'granted' ? 'Your permission is saved on this device. Sender selection will be available when the SMS receiver is enabled.' : 'Spendwise reads transaction alerts on this device to build your ledger. It never uploads or shares your messages.'}</Text><View style={[styles.permissionNote, { backgroundColor: c.canvas }]}><Icon name={permissionState === 'blocked' ? 'warning-outline' : 'information-circle-outline'} color={permissionState === 'blocked' ? c.coral : c.accent} size={20} /><Text style={[styles.caption, { color: c.secondary, flex: 1 }]}>{permissionState === 'blocked' ? 'SMS access was not granted. You can allow it later from Android Settings.' : 'Only bank messages are used. You can stop scanning at any time in Settings.'}</Text></View>{permissionState !== 'granted' ? <Pressable style={[styles.primaryButton, { backgroundColor: c.accent }]} onPress={requestSmsAccess}><Text style={styles.primaryButtonText}>Allow SMS access</Text><Icon name="arrow-forward" color="#FFFFFF" size={18} /></Pressable> : null}<Pressable onPress={onClose} style={styles.cancelButton}><Text style={[styles.cancelText, { color: c.secondary }]}>{permissionState === 'granted' ? 'Done' : 'Not now'}</Text></Pressable></View></View></Modal>;
}

const annotationCategories: Category[] = ['Food', 'Travel', 'Bills', 'Shopping', 'Groceries', 'Entertainment', 'Health', 'Education', 'Other'];

function TransactionCheckIn({
  transaction,
  onClose,
  c,
}: {
  transaction: StoredTransaction | null;
  onClose: () => void;
  c: typeof colors.light;
}) {
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<Category>('Other');

  useEffect(() => {
    if (transaction) {
      setMerchant(transaction.merchant === 'Unknown merchant' ? '' : transaction.merchant);
      setCategory(transaction.category);
    }
  }, [transaction]);

  if (!transaction) return null;
  const isCredit = transaction.type === 'credit';
  const save = () => {
    const trimmedMerchant = merchant.trim();
    if (!trimmedMerchant) return;
    getPromptRepository().recordCategory(transaction, category, trimmedMerchant);
    onClose();
  };
  const neverAsk = () => {
    getPromptRepository().neverAskForMerchant(transaction);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: c.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: c.elevated }]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          <View style={[styles.checkInIcon, { backgroundColor: isCredit ? c.mintSoft : c.coralSoft }]}>
            <Icon name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'} color={isCredit ? c.mint : c.coral} size={27} />
          </View>
          <Text style={[styles.sheetTitle, { color: c.ink }]}>What was this for?</Text>
          <Text style={[styles.sheetBody, { color: c.secondary }]}>
            {isCredit ? 'A payment came in' : 'A payment went out'} · {formatCurrency(transaction.amount)}
          </Text>

          <Text style={[styles.fieldLabel, { color: c.secondary }]}>MERCHANT OR NOTE</Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="e.g. groceries, rent, lunch"
            placeholderTextColor={c.tertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            style={[styles.annotationInput, { color: c.ink, backgroundColor: c.canvas, borderColor: c.line }]}
            accessibilityLabel="Merchant or note"
          />

          <Text style={[styles.fieldLabel, { color: c.secondary }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.annotationCategories}>
            {annotationCategories.map((item) => {
              const selected = item === category;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.annotationChip, { backgroundColor: selected ? c.ink : c.canvas, borderColor: selected ? c.ink : c.line }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, { color: selected ? c.canvas : c.secondary }]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={save}
            disabled={!merchant.trim()}
            style={[styles.primaryButton, { backgroundColor: c.accent, opacity: merchant.trim() ? 1 : 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel="Save transaction details"
          >
            <Text style={styles.primaryButtonText}>Save to ledger</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancelButton} accessibilityRole="button">
            <Text style={[styles.cancelText, { color: c.secondary }]}>Skip for now</Text>
          </Pressable>
          <Pressable onPress={neverAsk} style={styles.quietAction} accessibilityRole="button">
            <Text style={[styles.quietActionText, { color: c.tertiary }]}>Never ask for this merchant</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const tabItems: Array<{ key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'Today', label: 'Today', icon: 'sunny-outline', activeIcon: 'sunny' },
  { key: 'Activity', label: 'Activity', icon: 'list-outline', activeIcon: 'list' },
  { key: 'Insights', label: 'Insights', icon: 'analytics-outline', activeIcon: 'analytics' },
  { key: 'Budgets', label: 'Budgets', icon: 'pie-chart-outline', activeIcon: 'pie-chart' },
  { key: 'Messages', label: 'Messages', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { key: 'Settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

export default function App() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? colors.dark : colors.light;
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('Today');
  const [connectVisible, setConnectVisible] = useState(false);
  const [checkInQueue, setCheckInQueue] = useState<StoredTransaction[]>([]);
  const pendingCheckIn = checkInQueue[0] ?? null;
  useEffect(() => subscribeToNewTransactions((transaction) => {
    setCheckInQueue((current) => [...current, transaction]);
  }), []);
  const closeCheckIn = () => setCheckInQueue((current) => current.slice(1));
  const screen = useMemo(() => {
    if (tab === 'Activity') return <Activity c={c} />;
    if (tab === 'Insights') return <Insights c={c} />;
    if (tab === 'Budgets') return <Budgets c={c} />;
    if (tab === 'Messages') return <Messages c={c} />;
    if (tab === 'Settings') return <Settings c={c} onConnect={() => setConnectVisible(true)} />;
    return <Dashboard c={c} onNavigate={setTab} onConnect={() => setConnectVisible(true)} />;
  }, [c, tab]);
  return <SafeAreaView style={[styles.root, { backgroundColor: c.canvas }]}><StatusBar style={scheme === 'dark' ? 'light' : 'dark'} /><View style={[styles.appFrame, width > 600 && styles.wideFrame]}>{screen}</View><View style={[styles.tabBar, { backgroundColor: c.elevated, borderTopColor: c.line }]}>{tabItems.map((item) => { const active = item.key === tab; return <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tabItem} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={`${item.label} tab`}><Icon name={active ? item.activeIcon : item.icon} color={active ? c.accent : c.tertiary} size={22} /><Text style={[styles.tabLabel, { color: active ? c.accent : c.tertiary, fontWeight: active ? '700' : '500' }]}>{item.label}</Text></Pressable>; })}</View><ConnectModal visible={connectVisible} onClose={() => setConnectVisible(false)} c={c} /><TransactionCheckIn transaction={pendingCheckIn} onClose={closeCheckIn} c={c} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appFrame: { flex: 1 },
  wideFrame: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '800', marginBottom: 6 },
  title: { fontSize: 34, letterSpacing: -1, fontWeight: '800' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  surface: { borderWidth: 1, borderRadius: 22 },
  pulseCard: { padding: 20, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '800' },
  balance: { fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  monthPill: { borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  monthPillText: { fontSize: 12, fontWeight: '700' },
  pulseChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22, paddingHorizontal: 4 },
  barWrap: { height: 105, width: '9%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 8, minHeight: 8 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  caption: { fontSize: 12, lineHeight: 17 },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metric: { flex: 1, padding: 15, minHeight: 118 },
  metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricLabel: { fontSize: 12, marginBottom: 5 },
  metricValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  connectBanner: { minHeight: 78, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  connectIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  connectCopy: { flex: 1 },
  connectTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  connectSub: { color: '#CBD3D6', fontSize: 12, lineHeight: 17 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  sectionHeading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  link: { fontSize: 13, fontWeight: '700' },
  listCard: { overflow: 'hidden', marginBottom: 12 },
  messageCard: { padding: 14, marginBottom: 10 },
  messageMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  messageSender: { fontSize: 14, fontWeight: '800' },
  messageBubble: { borderRadius: 15, padding: 12 },
  messageBody: { fontSize: 14, lineHeight: 20 },
  messageActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  transactionRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  transactionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  transactionCopy: { flex: 1, minWidth: 0 },
  transactionMerchant: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  amountCopy: { alignItems: 'flex-end' },
  bottomSpace: { height: 24 },
  tabBar: { height: 76, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingBottom: 6 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  tabLabel: { fontSize: 11 },
  roundButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchBox: { height: 48, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  chips: { gap: 8, paddingBottom: 24 },
  chip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },
  sectionEyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: '800', marginBottom: 9, marginTop: 4 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 5 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  monthSelector: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthText: { fontSize: 13, fontWeight: '700' },
  insightHero: { padding: 20, marginBottom: 28 },
  insightTotal: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  lineChart: { height: 95, marginTop: 19, position: 'relative' },
  lineSegment: { height: 4, borderRadius: 3, position: 'absolute' },
  lineDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: '#FFFFFF' },
  categoryRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 9 },
  categoryDot: { width: 9, height: 9, borderRadius: 5 },
  categoryName: { width: 72, fontSize: 14, fontWeight: '700' },
  categoryTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#E9EDF0', overflow: 'hidden' },
  categoryFill: { height: '100%', borderRadius: 4 },
  categoryAmount: { width: 65, textAlign: 'right', fontSize: 12, fontWeight: '600' },
  insightNote: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 17, marginTop: 4 },
  insightNoteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  budgetSummary: { padding: 20, borderRadius: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  darkLabel: { color: '#AAB5BA', fontSize: 11, letterSpacing: 1, fontWeight: '800' },
  darkTotal: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 6 },
  summaryRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 18, fontWeight: '800' },
  ringLabel: { color: '#AAB5BA', fontSize: 11, marginTop: 1 },
  budgetCard: { padding: 16, marginBottom: 10 },
  budgetTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  budgetIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  budgetCopy: { flex: 1 },
  percent: { fontSize: 16, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  budgetFoot: { fontSize: 12, marginTop: 9 },
  primaryButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, marginTop: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  privacyBanner: { borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26 },
  privacyCopy: { flex: 1 },
  privacyTitle: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  settingsGroup: { marginBottom: 20 },
  settingsRow: { minHeight: 69, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  settingsCopy: { flex: 1 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 4, marginBottom: 16 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 30 },
  grabber: { width: 38, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 25 },
  sheetIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  sheetBody: { fontSize: 15, lineHeight: 22, marginBottom: 18 },
  permissionNote: { padding: 13, borderRadius: 15, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 18 },
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46, marginTop: 4 },
  cancelText: { fontSize: 15, fontWeight: '700' },
  quietAction: { alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  quietActionText: { fontSize: 12, fontWeight: '600' },
  checkInIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  fieldLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '800', marginBottom: 8, marginTop: 2 },
  annotationInput: { height: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 16, marginBottom: 18 },
  annotationCategories: { gap: 8, paddingBottom: 5, marginBottom: 14 },
  annotationChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
});
