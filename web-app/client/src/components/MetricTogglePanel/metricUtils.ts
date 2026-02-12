import { withCommas, withCommasRounded } from '@client/utils/numberUtils';
import { exhaustiveArray } from '@client/utils/types';
import type { DescriptionMetrics, ProfitLossRatio, Ticker, Timestamp } from '@shared/worker';

export type MetricKey = keyof DescriptionMetrics;

export const DESCRIPTION_METRICS_ORDER = exhaustiveArray<DescriptionMetrics>()([
  'aggregate',
  'timespan',
  'algorithmReturn',
  'growthRate',
  'sharpeRatio',
  'winRate',
  'profitLossRatio',
  'expectancyPerTrade',
  'averageHoldingDuration',
  'tickers',
  'maxHoldingPorportion',
  'volatility',
  'contextLength',
  'positionsClosed',
  'tradesMade',
]);

export type DescriptionMetricVisbility = Record<MetricKey, boolean>;
export const DEFAULT_DESCRIPTION_METRIC_VISBILITY: DescriptionMetricVisbility = {
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

export const ALL_DESCRIPTION_METRIC_VISIBILITY: DescriptionMetricVisbility = Object.keys(
  DEFAULT_DESCRIPTION_METRIC_VISBILITY,
).reduce((acc, metric) => {
  acc[metric as MetricKey] = DEFAULT_DESCRIPTION_METRIC_VISBILITY[metric as MetricKey];
  return acc;
}, {} as DescriptionMetricVisbility);

export const DESCRIPTION_METRIC_LABELS: Record<MetricKey, string> = {
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

export const DESCRIPTION_METRIC_TO_STRING: {
  [K in MetricKey]: (descriptionMetric: DescriptionMetrics[K]) => string;
} = {
  aggregate: (aggregate: Timestamp) => aggregate,
  algorithmReturn: (algorithmReturn: number) => withCommasRounded(algorithmReturn * 100) + '%',
  averageHoldingDuration: (averageHoldingDuration: number | null) =>
    `${averageHoldingDuration != null ? withCommasRounded(averageHoldingDuration) + ' ticks' : 'unknown'}`,
  contextLength: (contextLength: number) => withCommas(contextLength),
  expectancyPerTrade: (expectancyPerTrade: number | null) =>
    `${expectancyPerTrade != null ? withCommasRounded(expectancyPerTrade * 100) + '%' : 'unknown'}`,
  growthRate: (growthRate: number) => withCommasRounded(growthRate * 100) + '%',
  maxHoldingPorportion: (maxHoldingPorportion: number) =>
    withCommasRounded(maxHoldingPorportion * 100) + '%',
  positionsClosed: (positionsClosed: number) => withCommas(positionsClosed),
  profitLossRatio: (profitLossRatio: ProfitLossRatio) => {
    switch (profitLossRatio.type) {
      case 'VALUE':
        return withCommasRounded(profitLossRatio.value) + ':1';
      case 'NO_LOSSES':
        return '1:0';
      case 'UNKNOWN':
        return 'unknown';
      default: {
        const _exhaustiveCheck: never = profitLossRatio;
        return _exhaustiveCheck;
      }
    }
  },
  sharpeRatio: (sharpeRatio: number | null) =>
    sharpeRatio != null ? withCommasRounded(sharpeRatio) : 'unknown',
  tickers: (tickers: Ticker[]) => tickersToString(tickers),
  timespan: (timespan: [string, string]) => timespan[0] + ' to ' + timespan[1],
  tradesMade: (tradesMade: number) => withCommas(tradesMade),
  volatility: (volatility: number | null) =>
    volatility != null ? withCommasRounded(volatility * 100) + '%' : 'unknown',
  winRate: (winRate: number | null) =>
    winRate != null ? withCommasRounded(winRate * 100) + '%' : 'unknown',
};

const MAX_TICKERS_TO_SHOW = 3;
export function tickersToString(tickers: Ticker[]): string {
  return (
    tickers.slice(0, MAX_TICKERS_TO_SHOW).join(',') +
    (tickers.length > MAX_TICKERS_TO_SHOW ? `,...${tickers.length - MAX_TICKERS_TO_SHOW} more` : '')
  );
}
