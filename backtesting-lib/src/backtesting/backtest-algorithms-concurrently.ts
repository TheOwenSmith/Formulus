import {
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import type { DescriptionMetrics } from '@/algorithms/plot';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@/fetch/fetch';
import type { SimplePlot } from '@/lib/nodeplotlib';
import { type SelectionOption } from '@/utils/cli';
import {
  dayToString,
  timespanToDays,
  timestampToDay,
  yearsBetween,
  type Day,
} from '@/utils/date-utils';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { groupBy } from '@/utils/groupBy';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import { SharpeRatioCalculator } from '@/utils/sharpe-ratio-calculator';
import cliProgress, { Presets } from 'cli-progress';
import { closeAllPositions, getPortfolioValue, updatePosition } from './position-utils';
import { type AggregateDataIterator, type Bar } from './read-data';
import {
  countLinesToProcess,
  createIndexByTicker,
  getDistinctTickersByAggregate,
  getTickerDataByAggregateByTicker,
  getTickerIteratorsByTicker,
  matchAggregateDataIterators,
  tickersToString,
  type IndexedByAggregateByTicker,
} from './ticker-utils';

export type TickerData =
  | {
      ticker: Ticker;
      aggregate: Timestamp;
      slippage: number;
      filename?: string;
    }
  | {
      ticker: Ticker;
      aggregate: Timestamp;
      slippage?: number;
      filename: string;
    };

type SelectionOptionWithPerformance<T> = SelectionOption<T> & { performance: number };

export type AlgorithmData = {
  algorithmYs: number[];
  balance: number;
  changeInBalanceByTickerPosition: Record<Ticker, number>;
  cumulativeProfitLoss: [number, number];
  positions: Record<Ticker, number>;
  positionsClosed: number;
  sharpeRatioCalculator: SharpeRatioCalculator;
  trades: number;
  winsLosses: [number, number];
};

const MAX_POINTS_PER_PLOT = 1_000;
const PROGRESS_UPDATE_INTERVAL = 1_000;

export async function backtestAlgorithmsConcurrently({
  algorithms,
  tickerData = [],
  timespan,
  trackProgress,
  verboseLogging,
}: {
  algorithms: Algorithm[];
  tickerData?: TickerData[];
  timespan?: [string | undefined, string | undefined];
  trackProgress?: boolean;
  verboseLogging?: boolean;
}): Promise<
  [
    algorithmGraphSelectionOptions: SelectionOption<{
      name: string;
      aggregate: Timestamp;
      descriptionMetrics: DescriptionMetrics;
      algorithmPlot: SimplePlot;
    }>[],
    tickerGraphSelectionOptionsByAggregate: Record<Timestamp, SelectionOption<SimplePlot>[]>,
  ]
> {
  trackProgress ??= !verboseLogging;
  verboseLogging ??= !trackProgress;

  if (verboseLogging && trackProgress) {
    throw new Error('Verbose logging and tracking progress cannot be used together');
  }

  const timespanDays: [Day | undefined, Day | undefined] = timespanToDays(timespan);

  // Verify no algorithm max holding proportion is greater than the limit
  for (const algorithm of algorithms) {
    const { algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } = algorithm;
    if (algorithmMaxHoldingProportion > ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT) {
      throw new Error(
        `Algorithm max holding proportion ${algorithmMaxHoldingProportion} is greater than the limit ${ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT}`,
      );
    }
  }

  const algorithmsByAggregatePartial: Partial<Record<Timestamp, Algorithm[]>> = groupBy(
    algorithms,
    (algorithm) => algorithm.aggregate,
  );
  const algorithmsByAggregate: Record<Timestamp, Algorithm[]> = aggregateTimestamps.reduce(
    (acc, aggregate) => {
      acc[aggregate] = algorithmsByAggregatePartial[aggregate] ?? [];
      return acc;
    },
    {} as Record<Timestamp, Algorithm[]>,
  );

  const distinctTickersByAggregate: Record<Timestamp, Ticker[]> =
    getDistinctTickersByAggregate(algorithmsByAggregate);

  const tickerDataByAggregateByTicker: IndexedByAggregateByTicker<
    [filename: string, slippage: number]
  > = getTickerDataByAggregateByTicker(tickerData, distinctTickersByAggregate, verboseLogging);

  // Output variables
  const algorithmGraphSelectionOptionsWithPerformance: SelectionOptionWithPerformance<{
    name: string;
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }>[] = [];
  const tickerGraphSelectionOptionsByAggregate: Record<Timestamp, SelectionOption<SimplePlot>[]> =
    aggregateTimestamps.reduce(
      (acc, aggregate) => {
        acc[aggregate] = [];
        return acc;
      },
      {} as Record<Timestamp, SelectionOption<SimplePlot>[]>,
    );

  // Count number of lines that need to be processed
  console.log('Counting number of lines to process...');
  const startCountLinesToProcessTimestamp = Date.now();
  const [startDay, linesToProcess] = await countLinesToProcess({
    distinctTickersByAggregate,
    tickerDataByAggregateByTicker,
    timespanDays,
    verboseLogging,
  });
  console.log(
    `Lines to process: ${withCommas(linesToProcess)} (took ${withCommas(Date.now() - startCountLinesToProcessTimestamp)}ms)`,
  );

  // Initialize progress bar
  const progressBar = new cliProgress.SingleBar({}, Presets.shades_grey);
  const progressStartTimestamp = Date.now();
  if (trackProgress) {
    progressBar.start(linesToProcess, 0);
  }

  if (verboseLogging) {
    console.log(`Starting on day ${dayToString(startDay)}`);
  }

  // Backtest algorithms
  let linesProcessed = 0;
  for (const aggregate of aggregateTimestamps) {
    if (verboseLogging) {
      console.log(`Processing ${aggregate} aggregate data...`);
    }

    // Skip if no tickers
    if (Object.keys(distinctTickersByAggregate[aggregate]).length === 0) {
      continue;
    }

    // Fetch ticker iterators for all tickers
    const gettickerIteratorByTickerResponse = trySync(() =>
      getTickerIteratorsByTicker({
        distinctTickers: distinctTickersByAggregate[aggregate],
        tickerDataByTicker: tickerDataByAggregateByTicker[aggregate],
        verboseLogging,
      }),
    );
    if (!gettickerIteratorByTickerResponse.ok) {
      throw gettickerIteratorByTickerResponse.error;
    }
    const tickerIteratorByTicker: Record<Ticker, AggregateDataIterator> =
      gettickerIteratorByTickerResponse.data;

    // Match all iterators buffer one bar ahead to determine market state efficiently
    const matchIteratorResponse = await tryAsync(() =>
      matchAggregateDataIterators({ [aggregate]: tickerIteratorByTicker }, startDay),
    );
    if (!matchIteratorResponse.ok) throw matchIteratorResponse.error;
    const [_startDay, firstBarByAggregateByTicker] = matchIteratorResponse.data;

    // Calculate maximum context length for all algorithms
    const maxContextLengthByTicker = {} as Record<Ticker, number>;
    for (const algorithm of algorithmsByAggregate[aggregate]) {
      for (const ticker of algorithm.tickers) {
        maxContextLengthByTicker[ticker] = Math.max(
          maxContextLengthByTicker[ticker] ?? 1,
          algorithm.contextLength,
        );
      }
    }

    // Algorithm tracking variables
    const statisticsByAlgorithm: AlgorithmData[] = Array.from(
      { length: algorithmsByAggregate[aggregate].length },
      (_, algorithmIndex) => ({
        algorithmYs: [],
        balance: 100,
        changeInBalanceByTickerPosition: createIndexByTicker(
          algorithmsByAggregate[aggregate][algorithmIndex].tickers,
          (_ticker) => 0,
        ),
        cumulativeProfitLoss: [0, 0],
        positions: createIndexByTicker(
          algorithmsByAggregate[aggregate][algorithmIndex].tickers,
          (_ticker) => 0,
        ),
        positionsClosed: 0,
        sharpeRatioCalculator: new SharpeRatioCalculator(),
        trades: 0,
        winsLosses: [0, 0],
      }),
    );

    // Tracking variables
    const contextByTicker: Record<Ticker, Bar[]> = createIndexByTicker(
      distinctTickersByAggregate[aggregate],
      () => [],
    );
    const firstPriceByTicker: Record<Ticker, number> = createIndexByTicker(
      distinctTickersByAggregate[aggregate],
      (ticker) => firstBarByAggregateByTicker[aggregate][ticker][1],
    );
    const lastPriceByTicker: Record<Ticker, number> = createIndexByTicker(
      distinctTickersByAggregate[aggregate],
      (ticker) => firstBarByAggregateByTicker[aggregate][ticker][4],
    );

    // Plotting variables
    let ticks = 0;
    let plotSpacing = 1;
    let updatePlotSpacing = false;
    const tickerYsByTicker: Record<Ticker, number[]> = distinctTickersByAggregate[aggregate].reduce(
      (acc, ticker) => {
        acc[ticker] = [];
        return acc;
      },
      {} as Record<Ticker, number[]>,
    );

    let hasNextBar = true;
    let endDay: Day | null = null;
    const nextBarByTicker: Record<Ticker, Bar> = firstBarByAggregateByTicker[aggregate];
    while (hasNextBar) {
      // Get next bars
      let nextBarTimestamp = '';
      const currentBarByTicker: Record<Ticker, Bar> = nextBarByTicker;
      for (const ticker in tickerIteratorByTicker) {
        const nextBarIteratorResult = await tickerIteratorByTicker[ticker].next();
        if (nextBarIteratorResult.done) {
          hasNextBar = false;
          break;
        }

        const nextBar = nextBarIteratorResult.value;
        nextBarByTicker[ticker] = nextBar;
        if (nextBarTimestamp === '') nextBarTimestamp = nextBar[0];
        else if (nextBar[0] !== nextBarTimestamp) {
          throw new Error(
            `Iterator timestamp mismatch for ticker '${ticker}' (${aggregate}); expected '${nextBarTimestamp}' but got '${nextBar[0]}'`,
          );
        }
      }

      // Update plotting variables
      for (const ticker in tickerIteratorByTicker) {
        // Update progress bar
        if (trackProgress && ++linesProcessed % PROGRESS_UPDATE_INTERVAL === 0) {
          progressBar.update(linesProcessed);
        }

        // Update tracking variable
        lastPriceByTicker[ticker] = currentBarByTicker[ticker][4];

        // Update context
        if (contextByTicker[ticker].length < maxContextLengthByTicker[ticker]) {
          contextByTicker[ticker].push(currentBarByTicker[ticker]);
        } else {
          contextByTicker[ticker].shift();
          contextByTicker[ticker].push(currentBarByTicker[ticker]);
        }

        // Update plotting variables
        const tickerYs = tickerYsByTicker[ticker];
        if (ticks % plotSpacing === 0) {
          tickerYs.push((currentBarByTicker[ticker][4] / firstPriceByTicker[ticker]) * 100);

          if (tickerYs.length > MAX_POINTS_PER_PLOT) {
            // Reduce the number of points in the plot by half
            const reducedTickerPlot: number[] = [];
            for (let j = 0; j < tickerYs.length; j += 2) {
              reducedTickerPlot.push(tickerYs[j]);
            }
            tickerYsByTicker[ticker] = reducedTickerPlot;
            updatePlotSpacing = true;
          }
        }
      }

      // Execute algorithm trades
      const currentAlgorithms = algorithmsByAggregate[aggregate];
      const tickerDataByTicker = tickerDataByAggregateByTicker[aggregate];
      for (let algorithmIndex = 0; algorithmIndex < currentAlgorithms.length; algorithmIndex++) {
        const algorithm = currentAlgorithms[algorithmIndex];
        const {
          tickers,
          contextLength,
          algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
        } = algorithm;

        const positions = statisticsByAlgorithm[algorithmIndex].positions;
        const priceByTicker: Record<Ticker, number> = tickers.reduce(
          (acc, ticker) => {
            acc[ticker] = contextByTicker[ticker].at(-1)![4];
            return acc;
          },
          {} as Record<Ticker, number>,
        );

        // Ensure enough context to execute algorithm
        if (hasNextBar && ticks + 1 >= contextLength) {
          const context = algorithm.tickers.reduce(
            (acc, ticker) => {
              acc[ticker] = contextByTicker[ticker].slice(-contextLength);
              return acc;
            },
            {} as Record<Ticker, Bar[]>,
          );

          // Get actions from implementation
          const actions = algorithm.implementation(context, positions);

          updatePosition({
            actions,
            algorithmData: statisticsByAlgorithm[algorithmIndex],
            algorithmMaxHoldingProportion,
            algorithmTickers: tickers,
            priceByTicker,
            tickerDataByTicker,
          });
        } else if (!hasNextBar) {
          closeAllPositions({
            algorithmData: statisticsByAlgorithm[algorithmIndex],
            priceByTicker,
            tickerDataByTicker,
          });
        }

        const portfolioValue = getPortfolioValue({
          priceByTicker,
          algorithmData: statisticsByAlgorithm[algorithmIndex],
        });
        statisticsByAlgorithm[algorithmIndex].sharpeRatioCalculator.addPrice(portfolioValue);

        // Update plotting variables
        const algorithmYs = statisticsByAlgorithm[algorithmIndex].algorithmYs;
        if (ticks % plotSpacing === 0) {
          algorithmYs.push(portfolioValue);

          if (algorithmYs.length > MAX_POINTS_PER_PLOT) {
            // Reduce the number of points in the plot by half
            const reducedAlgorithmPlot: number[] = [];
            for (let j = 0; j < algorithmYs.length; j += 2) {
              reducedAlgorithmPlot.push(algorithmYs[j]);
            }
            statisticsByAlgorithm[algorithmIndex].algorithmYs = reducedAlgorithmPlot;
            updatePlotSpacing = true;
          }
        }

        if (!hasNextBar) {
          const endTimestamp = Object.values(currentBarByTicker)[0][0];
          endDay = timestampToDay(endTimestamp);
        }
      }

      // Update plotting variables
      ticks++;
      if (updatePlotSpacing) {
        plotSpacing *= 2;
        updatePlotSpacing = false;
      }
    }

    for (const ticker in tickerIteratorByTicker) {
      tickerIteratorByTicker[ticker].close();
    }
    if (verboseLogging) {
      console.log(`Finished processing ${aggregate} aggregate data`);
    }

    // Compile ticker plots
    const pointsPlotted = statisticsByAlgorithm[0].algorithmYs.length;
    const xs = Array.from({ length: pointsPlotted }, (_, i) => i);

    for (const ticker in tickerYsByTicker) {
      const tickerYs = tickerYsByTicker[ticker];
      const tickerPlot: SimplePlot = {
        name: ticker,
        x: xs,
        y: tickerYs,
        type: 'scatter',
      };
      tickerGraphSelectionOptionsByAggregate[aggregate].push({
        name: `${ticker} (${aggregate})`,
        value: tickerPlot,
      });
    }

    // Compile algorithm plots
    const yearsBetweenStartAndEnd = yearsBetween(endDay!, startDay);
    for (
      let algorithmIndex = 0;
      algorithmIndex < algorithmsByAggregate[aggregate].length;
      algorithmIndex++
    ) {
      const algorithm = algorithmsByAggregate[aggregate][algorithmIndex];
      const {
        contextLength,
        name,
        tickers,
        algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
      } = algorithm;

      const algorithmYs = statisticsByAlgorithm[algorithmIndex].algorithmYs;
      const algorithmPlot: SimplePlot = {
        name: 'Algorithm',
        x: xs,
        y: algorithmYs,
        type: 'scatter',
      };

      const balance = statisticsByAlgorithm[algorithmIndex].balance;
      const returnPercentage = balance - 100;
      const growthRatePercentage = (Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1) * 100;
      const trades = statisticsByAlgorithm[algorithmIndex].trades;
      const sharpRatio =
        statisticsByAlgorithm[algorithmIndex].sharpeRatioCalculator.sharpe(yearsBetweenStartAndEnd);
      const winPercentage =
        (statisticsByAlgorithm[algorithmIndex].winsLosses[0] /
          (statisticsByAlgorithm[algorithmIndex].winsLosses[0] +
            statisticsByAlgorithm[algorithmIndex].winsLosses[1])) *
        100;
      const profitLossRatio =
        statisticsByAlgorithm[algorithmIndex].cumulativeProfitLoss[0] /
        statisticsByAlgorithm[algorithmIndex].cumulativeProfitLoss[1];
      const profitLossRatioString =
        profitLossRatio !== Infinity ? `${withCommasRounded(profitLossRatio)}:1` : '1:0';
      const positionsClosed = statisticsByAlgorithm[algorithmIndex].positionsClosed;

      const descriptionMetrics: DescriptionMetrics = {
        aggregate: `Aggregate: ${aggregate}`,
        algorithmReturn: `Algorithm return: ${withCommasRounded(returnPercentage)}%`,
        contextLength: `Context length: ${withCommas(contextLength)}`,
        growthRate: `Growth rate: ${withCommasRounded(growthRatePercentage)}%`,
        maxHoldingPercentage: `Max holding percentage: ${algorithmMaxHoldingProportion * 100}%`,
        positionsClosed: `Positions closed: ${withCommas(positionsClosed)}`,
        profitLossRatio: `Profit/loss ratio: ${profitLossRatioString}`,
        sharpeRatio: `Sharpe ratio: ${withCommasRounded(sharpRatio)}`,
        tickers: `Tickers: ${tickersToString(tickers)}`,
        timespan: `Timespan: ${dayToString(startDay)} to ${dayToString(endDay!)}`,
        tradesMade: `Trades made: ${withCommas(trades)}`,
        winRate: `Win rate: ${withCommasRounded(winPercentage)}%`,
      };

      algorithmGraphSelectionOptionsWithPerformance.push({
        name: `${name}; Return: ${withCommasRounded(returnPercentage)}% (${withCommasRounded(growthRatePercentage)}% APY) - ${aggregate}`,
        value: {
          name,
          aggregate,
          descriptionMetrics,
          algorithmPlot,
        },
        performance: growthRatePercentage,
      });
    }
  }

  // Sort algorithms by performance
  algorithmGraphSelectionOptionsWithPerformance.sort((a, b) => b.performance - a.performance);

  if (trackProgress) {
    progressBar.update(linesToProcess);
    progressBar.stop();
    console.log(`Time taken: ${withCommas(Date.now() - progressStartTimestamp)}ms`);
  }
  return [algorithmGraphSelectionOptionsWithPerformance, tickerGraphSelectionOptionsByAggregate];
}
