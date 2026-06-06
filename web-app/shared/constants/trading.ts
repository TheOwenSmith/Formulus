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
export type Ticker = (typeof tickers)[number] | (string & {});
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

export type Bar = [t: string, o: number, h: number, l: number, c: number, v: number];

export const aggregateTimestamps = ['1min', '5min', '15min', '30min', '60min'] as const;
export type Timestamp = (typeof aggregateTimestamps)[number];

export const TIMEFRAMES_WITH_LABELS: { value: Timestamp; label: string }[] = [
  { value: '1min', label: '1 min' },
  { value: '5min', label: '5 min' },
  { value: '15min', label: '15 min' },
  { value: '30min', label: '30 min' },
  { value: '60min', label: '60 min' },
];

export const SUPPORTED_LANGUAGE_VALUES = ['javascript', 'typescript', 'python', 'cpp'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGE_VALUES)[number];

export const LANGUAGES: { value: SupportedLanguage; label: string; ext: string }[] = [
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'typescript', label: 'TypeScript', ext: '.ts' },
  { value: 'python', label: 'Python', ext: '.py' },
  { value: 'cpp', label: 'C++', ext: '.cpp' },
];

export enum AlgorithmType {
  NORMAL,
  SIMPLE,
  TOP_K,
}

export const MAX_ALGORITHMS_TO_COMPARE = 25;
export const MAX_INDICATORS_COUNT = 40;
export const MAX_INDICATOR_MULTIPLIER = 20;

export const DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION = 0.95;
export const ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT = 0.99;

export type ProfitLossRatio =
  | { type: 'VALUE'; value: number }
  | { type: 'NO_LOSSES' }
  | { type: 'UNKNOWN' };

export type DescriptionMetrics = {
  aggregate: Timestamp;
  algorithmReturn: number;
  averageHoldingDuration: number | null;
  contextLength: number;
  expectancyPerTrade: number | null;
  growthRate: number;
  maxDrawdown: number;
  maxHoldingPorportion: number;
  positionsClosed: number;
  profitLossRatio: ProfitLossRatio;
  sharpeRatio: number | null;
  tickers: Ticker[];
  timespan: [string, string];
  tradesMade: number;
  volatility: number | null;
  winRate: number | null;
};

export type SimplePlot = {
  name: string;
  y: number[];
};

export type BacktestAlgorithmsResult = {
  algorithmGraphs: {
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }[];
  tickerPlotByAggregateByTicker: Record<Timestamp, Record<Ticker, SimplePlot>>;
  timestampsByAggregate: Record<Timestamp, string[]>;
};
