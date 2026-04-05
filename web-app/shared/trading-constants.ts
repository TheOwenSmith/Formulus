/**
 * Central source for tickers, timeframes, languages, and algorithm types.
 * Add new stocks or options here so API, worker, and client stay in sync.
 */

export const tickers = [
  'SPY',
  'SSO',
  'SPXL',
  'SH',
  'SDS',
  'SPXU',
  'QQQ',
  'NVDA',
  'TSLA',
  'AMD',
  'META',
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOG',
  'PLTR',
  'SNAP',
  'PFE',
] as const;

export type TickerValue = (typeof tickers)[number];

export const TICKER_COMPANY_NAMES: Record<TickerValue, string> = {
  AAPL: 'Apple',
  AMD: 'Advanced Micro Devices',
  AMZN: 'Amazon',
  GOOG: 'Alphabet (Google)',
  META: 'Meta Platforms',
  MSFT: 'Microsoft',
  NVDA: 'NVIDIA',
  PFE: 'Pfizer',
  PLTR: 'Palantir',
  QQQ: 'Invesco QQQ Trust',
  SDS: 'ProShares UltraShort S&P 500',
  SH: 'ProShares Short S&P 500',
  SNAP: 'Snap',
  SPXL: 'Direxion Daily S&P 500 Bull 3X',
  SPXU: 'ProShares UltraPro Short S&P 500',
  SPY: 'SPDR S&P 500 ETF',
  SSO: 'ProShares Ultra S&P 500',
  TSLA: 'Tesla',
};

// ─── Timestamps / timeframes ─────────────────────────────────────────────────

export const aggregateTimestamps = ['1min', '5min', '15min', '30min', '60min'] as const;
export type Timestamp = (typeof aggregateTimestamps)[number];

/** For UI: value + label (e.g. "60 min") */
export const TIMEFRAMES_WITH_LABELS: { value: Timestamp; label: string }[] = [
  { value: '1min', label: '1 min' },
  { value: '5min', label: '5 min' },
  { value: '15min', label: '15 min' },
  { value: '30min', label: '30 min' },
  { value: '60min', label: '60 min' },
];

// ─── Languages ───────────────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGE_VALUES = ['javascript', 'typescript', 'python', 'cpp'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE_VALUES)[number];

/** For UI and runner: value + display label + file extension */
export const LANGUAGES: { value: SupportedLanguage; label: string; ext: string }[] = [
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'typescript', label: 'TypeScript', ext: '.ts' },
  { value: 'python', label: 'Python', ext: '.py' },
  { value: 'cpp', label: 'C++', ext: '.cpp' },
];

// ─── Algorithm type ─────────────────────────────────────────────────────────

/** Numeric algorithm type (matches Prisma enum and worker AlgorithmType enum). */
export const AlgorithmType = {
  NORMAL: 0,
  SIMPLE: 1,
  TOP_K: 2,
} as const;
export type AlgorithmTypeValue = (typeof AlgorithmType)[keyof typeof AlgorithmType];
