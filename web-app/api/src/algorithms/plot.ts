import type { DescriptionMetrics, ProfitLossRatio } from '@api/backtesting/statistics';
import { tickersToString } from '@api/backtesting/ticker-utils';
import type { Ticker, Timestamp } from '@api/fetch/types';
import { plotAlgorithm, type SimplePlot } from '@api/lib/nodeplotlib';
import { getUserSelectionInput, UserExitEarlyError, type SelectionOption } from '@api/utils/cli';
import { tryAsync } from '@api/utils/errorHandling';
import { withCommas, withCommasRounded } from '@api/utils/number-utils';
import { exhaustiveArray } from '@api/utils/types';

const DESCRIPTION_METRICS_ORDER = exhaustiveArray<DescriptionMetrics>()([
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

const DESCRIPTION_METRIC_TO_STRING: {
  [K in keyof DescriptionMetrics]: (descriptionMetric: DescriptionMetrics[K]) => string;
} = {
  aggregate: (aggregate: Timestamp) => `Aggregate: ${aggregate}`,
  algorithmReturn: (algorithmReturn: number) =>
    `Algorithm return: ${withCommasRounded(algorithmReturn * 100)}%`,
  averageHoldingDuration: (averageHoldingDuration: number | null) =>
    `Average holding duration: ${averageHoldingDuration != null ? withCommasRounded(averageHoldingDuration) + ' ticks' : 'unknown'}`,
  contextLength: (contextLength: number) => `Context length: ${withCommas(contextLength)}`,
  expectancyPerTrade: (expectancyPerTrade: number | null) =>
    `Expectancy per trade: ${expectancyPerTrade != null ? withCommasRounded(expectancyPerTrade * 100) + '%' : 'unknown'}`,
  growthRate: (growthRate: number) => `Growth rate: ${withCommasRounded(growthRate * 100)}%`,
  maxHoldingPorportion: (maxHoldingPorportion: number) =>
    `Max holding percentage: ${withCommasRounded(maxHoldingPorportion * 100)}%`,
  positionsClosed: (positionsClosed: number) => `Positions closed: ${withCommas(positionsClosed)}`,
  profitLossRatio: (profitLossRatio: ProfitLossRatio) => {
    switch (profitLossRatio.type) {
      case 'VALUE':
        return `Profit/loss ratio: ${withCommasRounded(profitLossRatio.value)}:1`;
      case 'NO_LOSSES':
        return 'Profit/loss ratio: 1:0';
      case 'UNKNOWN':
        return 'Profit/loss ratio: unknown';
      default: {
        const _exhaustiveCheck: never = profitLossRatio;
        return _exhaustiveCheck;
      }
    }
  },
  sharpeRatio: (sharpeRatio: number | null) =>
    `Sharpe ratio: ${sharpeRatio != null ? withCommasRounded(sharpeRatio) : 'unknown'}`,
  tickers: (tickers: Ticker[]) => `Tickers: ${tickersToString(tickers)}`,
  timespan: (timespan: [string, string]) => `Timespan: ${timespan[0]} to ${timespan[1]}`,
  tradesMade: (tradesMade: number) => `Trades made: ${withCommas(tradesMade)}`,
  volatility: (volatility: number | null) =>
    `Volatility: ${volatility != null ? withCommasRounded(volatility * 100) + '%' : 'unknown'}`,
  winRate: (winRate: number | null) =>
    `Win rate: ${winRate != null ? withCommasRounded(winRate * 100) + '%' : 'unknown'}`,
};

type DescriptionMetricOptions = {
  [K in keyof DescriptionMetrics]: boolean;
};
const DEFAULT_DESCRIPTION_METRIC_OPTIONS: DescriptionMetricOptions = {
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
export const ALL_DESCRIPTION_METRIC_OPTIONS: DescriptionMetricOptions =
  DESCRIPTION_METRICS_ORDER.reduce((acc, metric) => {
    acc[metric] = true;
    return acc;
  }, {} as DescriptionMetricOptions);

let serverIsUp = false;
export async function chooseToPlot(
  algorithmGraphSelectionOptions: SelectionOption<{
    name: string;
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }>[],
  tickerGraphSelectionOptionsByAggregate: Record<Timestamp, SelectionOption<SimplePlot>[]>,
  descriptionMetricOptions: Partial<DescriptionMetricOptions> = DEFAULT_DESCRIPTION_METRIC_OPTIONS,
) {
  while (algorithmGraphSelectionOptions.length > 0) {
    const algorithmSelectionResponse = await tryAsync(() =>
      getUserSelectionInput({
        options: algorithmGraphSelectionOptions,
        message: 'Select an algorithm to view backtesting results for:',
        quitMessage: 'Quit (do not view any backtesting results)',
      }),
    );
    if (!algorithmSelectionResponse.ok) {
      if (algorithmSelectionResponse.error instanceof UserExitEarlyError) {
        console.error('User did not select an algorithm');
        return;
      }
      throw algorithmSelectionResponse.error;
    }
    const selectedAlgorithm = algorithmSelectionResponse.data;

    if (selectedAlgorithm == null) {
      // User chose to not view backtesting results for an algorithm, so return early
      return;
    }

    const { name, algorithmPlot, descriptionMetrics, aggregate } = selectedAlgorithm;

    const tickerSelectionResponse = await tryAsync(() =>
      getUserSelectionInput({
        allMessage: 'All (display all plots)',
        header: `Viewing backtesting results for algorithm '${selectedAlgorithm.name}'`,
        message: 'Select a ticker to plot against the algorithm:',
        options: tickerGraphSelectionOptionsByAggregate[aggregate],
        quitMessage: 'Quit (do not display any plot)',
      }),
    );
    if (!tickerSelectionResponse.ok) {
      if (tickerSelectionResponse.error instanceof UserExitEarlyError) {
        console.error('User did not select a ticker to plot against the algorithm');
        return;
      }
      throw tickerSelectionResponse.error;
    }
    const selectedTicker = tickerSelectionResponse.data;

    if (selectedTicker == null) {
      // User chose to not display any tickers, so reprompt for an algorithm
      continue;
    }

    // Create description
    const description: string[] = [];
    for (const metric of DESCRIPTION_METRICS_ORDER) {
      const showMetric =
        descriptionMetricOptions[metric] ?? DEFAULT_DESCRIPTION_METRIC_OPTIONS[metric];
      if (showMetric) {
        const toStringFn = DESCRIPTION_METRIC_TO_STRING[metric] as (
          descriptionMetric: DescriptionMetrics[typeof metric],
        ) => string;

        const strigifiedMetric = toStringFn(descriptionMetrics[metric]);
        description.push(strigifiedMetric);
      }
    }

    if (selectedTicker === 'all') {
      for (const tickerPlotSelectionOption of tickerGraphSelectionOptionsByAggregate[aggregate]) {
        await plotAlgorithm({
          tickerPlot: tickerPlotSelectionOption.value,
          algorithmPlot,
          algorithmName: name,
          description,
        });
      }
    } else {
      await plotAlgorithm({
        tickerPlot: selectedTicker,
        algorithmPlot,
        algorithmName: name,
        description,
      });
    }

    // Add flag to indicate that the algorithm has been viewed
    const selectionOption = algorithmGraphSelectionOptions.find(
      (option) => option.value === selectedAlgorithm,
    )!;
    if (!selectionOption.name.endsWith('(viewed)')) {
      selectionOption.name = `${selectionOption.name} (viewed)`;
    }

    // Wait for the server to be up
    if (!serverIsUp) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      serverIsUp = true;
    }
  }
}
