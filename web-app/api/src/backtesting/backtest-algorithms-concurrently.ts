import {
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@api/algorithms/algorithm';
import {
  indicatorsToIndicatorResultsFunction,
  type IndicatorResultByIndicator,
} from '@api/algorithms/indicators/indicator';
import type { IndicatorMetadata } from '@api/algorithms/indicators/indicator-metadata';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@api/fetch/types';
import type { SimplePlot } from '@api/lib/nodeplotlib';
import { type SelectionOption } from '@api/utils/cli';
import { yearsBetween } from '@api/utils/date-utils';
import { trySync } from '@api/utils/errorHandling';
import { groupBy } from '@api/utils/groupBy';
import { withCommas } from '@api/utils/number-utils';
import { SharpeRatioCalculator } from '@api/utils/sharpe-ratio-calculator';
import type { AtLeastOne } from '@api/utils/types';
import cliProgress, { Presets } from 'cli-progress';
import {
  countBytesToProcess,
  getIteratorBounds,
  getTickerIteratorsByTicker,
} from './iterator-utils';
import { closeAllPositions, getPortfolioValue, updatePosition } from './position-utils';
import { type AggregateDataIterator, type Bar } from './read-data';
import {
  getAlgorithmSelectionOptionWithPerformance,
  getTickerSelectionOption,
  updateGraph,
  type DescriptionMetrics,
} from './statistics';
import {
  createIndexByTicker,
  getAllTickers,
  getDistinctTickersByAggregate,
  getFilenameAndIndexByAggregateByTicker,
  getMarketSlippageByTicker,
} from './ticker-utils';

export type TickerData = {
  ticker: Ticker;
  aggregate: Timestamp;
} & AtLeastOne<{
  filename: string;
  index: string;
}>;

export type SelectionOptionWithPerformance<T> = SelectionOption<T> & { performance: number };

export type AlgorithmData = {
  algorithmYs: number[];
  balance: number;
  cumulativeHoldingTime: number;
  cumulativeProfitLoss: [profit: number, loss: number];
  entracePriceExitPriceByTickerPosition: Record<Ticker, [entryPrice: number, exitPrice: number]>;
  entraceTimeByTickerPosition: Record<Ticker, number>;
  indicatorResultsFunction: (
    bars: Bar[],
    metadata: IndicatorMetadata,
  ) => Partial<IndicatorResultByIndicator>;
  positions: Record<Ticker, number>;
  positionsClosed: number;
  sharpeRatioCalculator: SharpeRatioCalculator;
  trades: number;
  winsLosses: [wins: number, losses: number];
};

export const MAX_POINTS_PER_PLOT = 1_000;
const BYTES_PROGRESS_UPDATE_INTERVAL = 10_000;

export type BacktestingAlgorithmsConcurrentlyOptions = {
  iteratorStrictParsing?: boolean;
  performanceFn?: (descriptionMetrics: DescriptionMetrics) => number | Promise<number>;
  slippageByTicker?: Partial<Record<Ticker, number>>;
  tickerData?: TickerData[];
  timespan?: [string | null, string | null];
  trackProgress?: boolean;
  verboseLogging?: boolean;
};

export async function backtestAlgorithmsConcurrently({
  algorithms,
  timespan: userInputtedTimespan,
  slippageMapFn,
  options = {},
}: {
  algorithms: Algorithm[];
  timespan?: [string | null, string | null];
  slippageMapFn?: (marketSlippage: number, price: number) => number;
  options?: BacktestingAlgorithmsConcurrentlyOptions;
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
  const {
    iteratorStrictParsing = false,
    performanceFn,
    slippageByTicker: userInuttedSlippageByTicker,
    tickerData = [],
    verboseLogging = false,
  } = options;
  const trackProgress = options.trackProgress ?? !verboseLogging;

  if (verboseLogging && trackProgress) {
    throw new Error('Verbose logging and tracking progress cannot be used together');
  }

  if (algorithms.length === 0) {
    throw new Error('No algorithms provided to backtest');
  }

  const startPrepareDataTimestamp = Date.now();
  console.log('Preparing data...');

  // Verify no algorithm max holding proportion is greater than the limit
  for (const algorithm of algorithms) {
    const { algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } = algorithm;
    if (algorithmMaxHoldingProportion > ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT) {
      throw new Error(
        `Algorithm max holding proportion '${algorithmMaxHoldingProportion}' is greater than the limit ${ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT}`,
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
  const allTickers: Ticker[] = getAllTickers(distinctTickersByAggregate);

  // Get filename and index by aggregate by ticker and slippage by ticker
  const { filenameByAggregateByTicker, indexByAggregateByTicker } =
    getFilenameAndIndexByAggregateByTicker(tickerData, distinctTickersByAggregate, verboseLogging);
  const marketSlippageByTicker = getMarketSlippageByTicker(allTickers, userInuttedSlippageByTicker);

  // Get ticker iterator bounds
  const { timespan, iteratorBoundsByAggregateByTicker } = await getIteratorBounds(
    indexByAggregateByTicker,
    userInputtedTimespan,
  );
  console.log(`Testing timespan: ${timespan[0]} to ${timespan[1]}`);
  const bytesToProcess = countBytesToProcess(iteratorBoundsByAggregateByTicker);
  console.log(`Bytes to process: ${withCommas(bytesToProcess)}`);

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

  // Initialize progress bar
  console.log(
    `Data successfully prepared (took ${withCommas(Date.now() - startPrepareDataTimestamp)}ms)`,
  );
  const progressBar = new cliProgress.SingleBar({}, Presets.shades_grey);
  const progressStartTimestamp = Date.now();
  if (trackProgress) {
    progressBar.start(bytesToProcess, 0);
  }

  // Backtest algorithms
  let bytesProcessed = 0;
  for (const aggregate of aggregateTimestamps) {
    if (verboseLogging) {
      console.log(`Processing ${aggregate} aggregate data...`);
    }

    // Skip if no tickers
    if (Object.keys(distinctTickersByAggregate[aggregate]).length === 0) {
      continue;
    }

    // Fetch ticker iterators for all tickers
    const getTickerIteratorByTickerResponse = trySync(() =>
      getTickerIteratorsByTicker({
        distinctTickers: distinctTickersByAggregate[aggregate],
        filenameByTicker: filenameByAggregateByTicker[aggregate],
        iteratorBoundsByTicker: iteratorBoundsByAggregateByTicker[aggregate],
        parseStrictly: iteratorStrictParsing,
        verboseLogging,
      }),
    );
    if (!getTickerIteratorByTickerResponse.ok) {
      throw getTickerIteratorByTickerResponse.error;
    }
    const tickerIteratorByTicker: Record<Ticker, AggregateDataIterator> =
      getTickerIteratorByTickerResponse.data;

    // Algorithm tracking variables
    const currentAlgorithms = algorithmsByAggregate[aggregate];
    const algorithmDataByAlgorithm: AlgorithmData[] = Array.from(
      { length: currentAlgorithms.length },
      (_, algorithmIndex) =>
        ({
          algorithmYs: [],
          balance: 100,
          cumulativeHoldingTime: 0,
          cumulativeProfitLoss: [0, 0],
          entracePriceExitPriceByTickerPosition: createIndexByTicker(
            currentAlgorithms[algorithmIndex].tickers,
            (_ticker) => [0, 0],
          ),
          entraceTimeByTickerPosition: createIndexByTicker(
            currentAlgorithms[algorithmIndex].tickers,
            (_ticker) => 0,
          ),
          indicatorResultsFunction: indicatorsToIndicatorResultsFunction(
            currentAlgorithms[algorithmIndex].indicators ?? [],
          ),
          positions: createIndexByTicker(currentAlgorithms[algorithmIndex].tickers, (_ticker) => 0),
          positionsClosed: 0,
          sharpeRatioCalculator: new SharpeRatioCalculator(),
          trades: 0,
          winsLosses: [0, 0],
        }) satisfies AlgorithmData,
    );

    // Calculate maximum context length for all algorithms
    const maxContextLengthByTicker = {} as Record<Ticker, number>;
    for (const algorithm of currentAlgorithms) {
      for (const ticker of algorithm.tickers) {
        maxContextLengthByTicker[ticker] = Math.max(
          maxContextLengthByTicker[ticker] ?? 1,
          algorithm.contextLength,
        );
      }
    }

    // Initialize indicator metadata
    const distinctTickers = distinctTickersByAggregate[aggregate];
    const indicatorMetadataByTicker: Record<Ticker, IndicatorMetadata> = createIndexByTicker(
      distinctTickers,
      (_ticker) => ({}),
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

    // Tracking variables
    const contextByTicker: Record<Ticker, Bar[]> = createIndexByTicker(
      distinctTickers,
      (_ticker) => [],
    );
    const firstPriceByTicker: Record<Ticker, number | null> = createIndexByTicker(
      distinctTickers,
      (_ticker) => null,
    );
    const lastPriceByTicker: Record<Ticker, number | null> = createIndexByTicker(
      distinctTickers,
      (_ticker) => null,
    );

    let hasNextBar = true;
    let nextBarByTicker: Record<Ticker, Bar> | null = null;
    while (hasNextBar) {
      const currentBarByTicker: Record<Ticker, Bar> | null =
        nextBarByTicker != null ? { ...nextBarByTicker } : null;

      // Get next bars from iterators
      nextBarByTicker = {} as Record<Ticker, Bar>;
      let aggregateNextTimestamp: string | null = null;
      let deltaBytesProcessed = 0;
      for (const ticker in tickerIteratorByTicker) {
        const iteratorResult = await tickerIteratorByTicker[ticker].next();
        if (iteratorResult.done) {
          // Iterator is finished; end of timespan reached
          hasNextBar = false;
          break;
        }

        deltaBytesProcessed += iteratorResult.value.bytesProcessed;
        const nextBar = iteratorResult.value.bar;

        if (aggregateNextTimestamp == null) {
          aggregateNextTimestamp = nextBar[0];
        } else if (nextBar[0] !== aggregateNextTimestamp) {
          throw new Error(
            `Iterator timestamp mismatch for ticker '${ticker}' (${aggregate}); expected '${aggregateNextTimestamp}' but got '${nextBar[0]}'`,
          );
        }

        nextBarByTicker[ticker] = nextBar;
      }

      const shouldUpdateProgress =
        Math.floor((bytesProcessed + deltaBytesProcessed) / BYTES_PROGRESS_UPDATE_INTERVAL) >
        Math.floor(bytesProcessed / BYTES_PROGRESS_UPDATE_INTERVAL);
      bytesProcessed += deltaBytesProcessed;
      if (shouldUpdateProgress) {
        progressBar.update(bytesProcessed);
      }

      if (currentBarByTicker == null) {
        for (const ticker in tickerIteratorByTicker) {
          firstPriceByTicker[ticker] = nextBarByTicker[ticker][4];
        }
        continue;
      }

      for (const ticker in tickerIteratorByTicker) {
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
        if (ticks % plotSpacing === 0) {
          updatePlotSpacing = updateGraph({
            graphByIndex: tickerYsByTicker,
            graphIndex: ticker,
            pointY: (currentBarByTicker[ticker][4] / firstPriceByTicker[ticker]!) * 100,
          });
        }
      }

      // Get latest prices and ticker
      const priceByTicker: Record<Ticker, number> = distinctTickers.reduce(
        (acc, ticker) => {
          acc[ticker] = contextByTicker[ticker].at(-1)![4];
          return acc;
        },
        {} as Record<Ticker, number>,
      );

      const slippageByTicker: Record<Ticker, number> = distinctTickers.reduce(
        (acc, ticker) => {
          const price = priceByTicker[ticker];
          const marketSlippage = marketSlippageByTicker[ticker];
          acc[ticker] = slippageMapFn?.(marketSlippage, price) ?? marketSlippage;
          return acc;
        },
        {} as Record<Ticker, number>,
      );

      // Execute algorithm trades
      for (let algorithmIndex = 0; algorithmIndex < currentAlgorithms.length; algorithmIndex++) {
        const algorithm = currentAlgorithms[algorithmIndex];
        const {
          tickers,
          contextLength,
          algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
        } = algorithm;
        const algorithmData = algorithmDataByAlgorithm[algorithmIndex];

        const positions = algorithmDataByAlgorithm[algorithmIndex].positions;

        // Ensure enough context to execute algorithm
        if (hasNextBar && ticks + 1 >= contextLength) {
          const context = algorithm.tickers.reduce(
            (acc, ticker) => {
              acc[ticker] = contextByTicker[ticker].slice(-contextLength);
              return acc;
            },
            {} as Record<Ticker, Bar[]>,
          );

          // Calculate indicators
          const indicators = createIndexByTicker(algorithm.tickers, (ticker) => {
            const indicatorResults = algorithmData.indicatorResultsFunction(
              context[ticker],
              indicatorMetadataByTicker[ticker],
            );
            return indicatorResults;
          });

          // Get actions from implementation
          const actions = algorithm.implementation(context, positions, indicators);

          updatePosition({
            actions,
            algorithmData,
            algorithmMaxHoldingProportion,
            algorithmTickers: tickers,
            priceByTicker,
            slippageByTicker,
            ticks,
          });
        } else if (!hasNextBar) {
          closeAllPositions({
            algorithmData,
            priceByTicker,
            slippageByTicker,
            ticks,
          });
        }

        const portfolioValue = getPortfolioValue({
          priceByTicker,
          algorithmData: algorithmDataByAlgorithm[algorithmIndex],
        });
        algorithmDataByAlgorithm[algorithmIndex].sharpeRatioCalculator.addPrice(portfolioValue);

        // Update plotting variables
        if (ticks % plotSpacing === 0) {
          updatePlotSpacing = updateGraph({
            graphByIndex: algorithmDataByAlgorithm[algorithmIndex],
            graphIndex: 'algorithmYs',
            pointY: portfolioValue,
          });
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
    const pointsPlotted = algorithmDataByAlgorithm[0].algorithmYs.length;
    const xs = Array.from({ length: pointsPlotted }, (_, i) => i);

    for (const ticker in tickerYsByTicker) {
      const tickerSelectionOption = getTickerSelectionOption({
        aggregate,
        ticker,
        tickerYs: tickerYsByTicker[ticker],
        xs,
      });
      tickerGraphSelectionOptionsByAggregate[aggregate].push(tickerSelectionOption);
    }

    // Compile algorithm plots
    const yearsBetweenStartAndEnd = yearsBetween(timespan[1], timespan[0]);
    for (let algorithmIndex = 0; algorithmIndex < currentAlgorithms.length; algorithmIndex++) {
      const algorithmSelectionOptionWithPerformance =
        await getAlgorithmSelectionOptionWithPerformance({
          aggregate,
          algorithm: currentAlgorithms[algorithmIndex],
          algorithmData: algorithmDataByAlgorithm[algorithmIndex],
          performanceFn,
          timespan,
          xs,
          yearsBetweenStartAndEnd,
        });
      algorithmGraphSelectionOptionsWithPerformance.push(algorithmSelectionOptionWithPerformance);
    }
  }

  // Sort algorithms by performance
  algorithmGraphSelectionOptionsWithPerformance.sort((a, b) => b.performance - a.performance);

  if (trackProgress) {
    progressBar.update(bytesToProcess);
    progressBar.stop();
    console.log(`Time taken: ${withCommas(Date.now() - progressStartTimestamp)}ms`);
  }
  return [algorithmGraphSelectionOptionsWithPerformance, tickerGraphSelectionOptionsByAggregate];
}
