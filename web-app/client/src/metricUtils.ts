// Utility to identify and manage metrics from description strings
// Based on the API's DESCRIPTION_METRIC_TO_STRING mapping

export type MetricKey =
  | 'aggregate'
  | 'algorithmReturn'
  | 'averageHoldingDuration'
  | 'contextLength'
  | 'expectancyPerTrade'
  | 'growthRate'
  | 'maxHoldingPorportion'
  | 'positionsClosed'
  | 'profitLossRatio'
  | 'sharpeRatio'
  | 'tickers'
  | 'timespan'
  | 'tradesMade'
  | 'volatility'
  | 'winRate';

export type MetricInfo = {
  key: MetricKey;
  label: string;
  description: string;
};

// Default enabled metrics (matching API defaults)
export const DEFAULT_METRIC_OPTIONS: Record<MetricKey, boolean> = {
  aggregate: true,
  algorithmReturn: true,
  averageHoldingDuration: false,
  contextLength: false,
  expectancyPerTrade: false,
  growthRate: true,
  maxHoldingPorportion: false,
  positionsClosed: true,
  profitLossRatio: false,
  sharpeRatio: true,
  tickers: true,
  timespan: true,
  tradesMade: false,
  volatility: false,
  winRate: true,
};

// Human-readable labels for each metric
export const METRIC_LABELS: Record<MetricKey, string> = {
  aggregate: 'Aggregate',
  algorithmReturn: 'Algorithm Return',
  averageHoldingDuration: 'Average Holding Duration',
  contextLength: 'Context Length',
  expectancyPerTrade: 'Expectancy Per Trade',
  growthRate: 'Growth Rate',
  maxHoldingPorportion: 'Max Holding Percentage',
  positionsClosed: 'Positions Closed',
  profitLossRatio: 'Profit/Loss Ratio',
  sharpeRatio: 'Sharpe Ratio',
  tickers: 'Tickers',
  timespan: 'Timespan',
  tradesMade: 'Trades Made',
  volatility: 'Volatility',
  winRate: 'Win Rate',
};

/**
 * Identifies which metric a description string represents
 * by matching against known patterns from the API
 */
export function identifyMetric(description: string): MetricKey | null {
  // Match patterns based on DESCRIPTION_METRIC_TO_STRING from API
  if (description.startsWith('Aggregate:')) return 'aggregate';
  if (description.startsWith('Algorithm return:')) return 'algorithmReturn';
  if (description.startsWith('Average holding duration:')) return 'averageHoldingDuration';
  if (description.startsWith('Context length:')) return 'contextLength';
  if (description.startsWith('Expectancy per trade:')) return 'expectancyPerTrade';
  if (description.startsWith('Growth rate:')) return 'growthRate';
  if (description.startsWith('Max holding percentage:')) return 'maxHoldingPorportion';
  if (description.startsWith('Positions closed:')) return 'positionsClosed';
  if (description.startsWith('Profit/loss ratio:')) return 'profitLossRatio';
  if (description.startsWith('Sharpe ratio:')) return 'sharpeRatio';
  if (description.startsWith('Tickers:')) return 'tickers';
  if (description.startsWith('Timespan:')) return 'timespan';
  if (description.startsWith('Trades made:')) return 'tradesMade';
  if (description.startsWith('Volatility:')) return 'volatility';
  if (description.startsWith('Win rate:')) return 'winRate';

  return null;
}

/**
 * Creates a map of metrics from description strings
 */
export function createMetricMap(descriptions: string[]): Map<MetricKey, string> {
  const metricMap = new Map<MetricKey, string>();
  for (const desc of descriptions) {
    const metric = identifyMetric(desc);
    if (metric) {
      metricMap.set(metric, desc);
    }
  }
  return metricMap;
}

