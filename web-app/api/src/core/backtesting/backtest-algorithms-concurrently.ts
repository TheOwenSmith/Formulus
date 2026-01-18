import {
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@api/core/algorithms/algorithm';
import {
  indicatorsToIndicatorResultsFunction,
  type Indicator,
  type IndicatorResultByIndicator,
} from '@api/core/algorithms/indicators/indicator';
import type { IndicatorMetadata } from '@api/core/algorithms/indicators/indicator-metadata';
import type { AnyUserAlgorithmType } from '@api/core/algorithms/user-algorithm';
import { aggregateTimestamps, type Bar, type Ticker, type Timestamp } from '@api/fetch/types';
import { yearsBetween } from '@api/utils/date-utils';
import { ErrorWithCode, tryAsync, trySync } from '@api/utils/error-handling';
import { groupBy } from '@api/utils/group-by';
import { roundToDecimal, withCommas } from '@api/utils/number-utils';
import { SharpeRatioCalculator } from '@api/utils/sharpe-ratio-calculator';
import type { AtLeastOne } from '@api/utils/types';
import cliProgress, { Presets } from 'cli-progress';
import { BYTES_PROGRESS_UPDATE_INTERVAL } from './constants';
import {
  countBytesToProcess,
  getIteratorBounds,
  getTickerIteratorsByTicker,
} from './iterator-utils';
import { closeAllPositions, getPortfolioValue, updatePosition } from './position-utils';
import { type AggregateDataIterator } from './read-data';
import {
  getBatchAlgorithmImplementationsDefaultFunction,
  getBatchAlgorithmImplementationsRpcFunction,
  type BatchAlgorithmImplementationsFn,
  type ImplementationArgumentsByAlgorithmIndex,
} from './rpc/get-batch-algorithm-implementations';
import { type SupportedLanguage } from './rpc/languages';
import { getAlgorithmGraph, updateGraph, type DescriptionMetrics } from './statistics';
import {
  createIndexByTicker,
  emptyIndexByAggregateByTicker,
  getAllTickers,
  getDistinctTickersByAggregate,
  getFilenameAndIndexByAggregateByTicker,
  getMarketSlippageByTicker,
  getTickers,
} from './ticker-utils';

export type TickerData = {
  ticker: Ticker;
  aggregate: Timestamp;
} & AtLeastOne<{
  filename: string;
  index: string;
}>;

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

export type BacktestingAlgorithmsConcurrentlyOptions = {
  iteratorStrictParsing?: boolean;
  slippageByTicker?: Partial<Record<Ticker, number>>;
  tickerData?: TickerData[];
  timespan?: [string | null, string | null];
  trackProgress?: boolean;
  verboseLogging?: boolean;
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

export async function backtestAlgorithmsConcurrently(inp: {
  algorithms: Algorithm[];
  options?: BacktestingAlgorithmsConcurrentlyOptions;
  slippageMapFn?: (marketSlippage: number, price: number) => number;
  timespan?: [string | null, string | null];
}): Promise<BacktestAlgorithmsResult>;
export async function backtestAlgorithmsConcurrently(inp: {
  algorithms: AnyUserAlgorithmType[];
  options?: BacktestingAlgorithmsConcurrentlyOptions;
  slippageMapFn?: (marketSlippage: number, price: number) => number;
  timespan?: [string | null, string | null];
}): Promise<BacktestAlgorithmsResult>;

export async function backtestAlgorithmsConcurrently({
  algorithms,
  options = {},
  slippageMapFn,
  timespan: userInputtedTimespan,
}: {
  algorithms: Algorithm[] | AnyUserAlgorithmType[];
  options?: BacktestingAlgorithmsConcurrentlyOptions;
  slippageMapFn?: (marketSlippage: number, price: number) => number;
  timespan?: [string | null, string | null];
}): Promise<BacktestAlgorithmsResult> {
  const {
    iteratorStrictParsing = false,
    slippageByTicker: userInuttedSlippageByTicker,
    tickerData = [],
    verboseLogging = false,
  } = options;
  const trackProgress = options.trackProgress ?? !verboseLogging;

  if (verboseLogging && trackProgress) {
    throw new ErrorWithCode(
      'Verbose logging and tracking progress cannot be used together',
      'BAD_REQUEST',
    );
  }

  if (algorithms.length === 0) {
    throw new ErrorWithCode('No algorithms provided to backtest', 'BAD_REQUEST');
  }

  const language: SupportedLanguage | null =
    'language' in algorithms[0] ? algorithms[0].language : null;
  if (language != null) {
    for (let i = 1; i < algorithms.length; i++) {
      if ((algorithms[i] as AnyUserAlgorithmType).language !== language) {
        throw new ErrorWithCode(
          `All user algorithms must be the same language; expected '${language}' but got '${(algorithms[i] as AnyUserAlgorithmType).language}'`,
          'BAD_REQUEST',
        );
      }
    }
  }

  // Verify no algorithm max holding proportion is greater than the limit
  for (const algorithm of algorithms) {
    const { algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } = algorithm;
    if (algorithmMaxHoldingProportion > ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT) {
      throw new ErrorWithCode(
        `Algorithm max holding proportion '${algorithmMaxHoldingProportion}' is greater than the limit ${ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT}`,
        'BAD_REQUEST',
      );
    }
  }

  const startPrepareDataTimestamp = Date.now();
  console.log('Preparing data...');

  const algorithmsWithIndexByAggregatePartial: Partial<
    Record<Timestamp, [Algorithm | AnyUserAlgorithmType, number][]>
  > = groupBy(
    algorithms.map((algorithm, index) => [algorithm, index]),
    ([algorithm, _index]) => algorithm.aggregate,
  );
  const algorithmsByIndexByAggregate: Record<
    Timestamp,
    Map<number, Algorithm | AnyUserAlgorithmType>
  > = aggregateTimestamps.reduce(
    (acc, aggregate) => {
      acc[aggregate] = new Map<number, Algorithm>();
      if (algorithmsWithIndexByAggregatePartial[aggregate] == undefined) {
        return acc;
      }

      for (const [algorithm, index] of algorithmsWithIndexByAggregatePartial[aggregate]) {
        acc[aggregate].set(index, algorithm);
      }
      return acc;
    },
    {} as Record<Timestamp, Map<number, Algorithm | AnyUserAlgorithmType>>,
  );

  const distinctTickersByAggregate: Record<Timestamp, Ticker[]> = getDistinctTickersByAggregate(
    algorithmsByIndexByAggregate,
  );
  const allTickers: Ticker[] = getAllTickers(distinctTickersByAggregate);

  // Get filename and index by aggregate by ticker and slippage by ticker
  const { filenameByAggregateByTicker, indexByAggregateByTicker } =
    getFilenameAndIndexByAggregateByTicker(tickerData, distinctTickersByAggregate, verboseLogging);
  const marketSlippageByTicker = getMarketSlippageByTicker(allTickers, userInuttedSlippageByTicker);

  const batchAlgorithmImplementationsFn: BatchAlgorithmImplementationsFn =
    language != null
      ? // If user algorithms are provided, create RPC function for batching algorithm implementations
        await getBatchAlgorithmImplementationsRpcFunction(
          algorithms as AnyUserAlgorithmType[],
          language,
        )
      : // If default algorithms are provided, use default function for batching algorithm implementations
        await getBatchAlgorithmImplementationsDefaultFunction(algorithms as Algorithm[]);

  // Get ticker iterator bounds
  const { timespan, iteratorBoundsByAggregateByTicker } = await getIteratorBounds(
    indexByAggregateByTicker,
    userInputtedTimespan,
  );
  console.log(`Testing timespan: ${timespan[0]} to ${timespan[1]}`);
  const bytesToProcess = countBytesToProcess(iteratorBoundsByAggregateByTicker);
  console.log(`Bytes to process: ${withCommas(bytesToProcess)}`);

  // Output variables
  const algorithmGraphs: {
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }[] = [];
  const tickerPlotByAggregateByTicker: Record<
    Timestamp,
    Record<Ticker, SimplePlot>
  > = emptyIndexByAggregateByTicker<SimplePlot>();
  const timestampsByAggregate: Record<Timestamp, string[]> = aggregateTimestamps.reduce(
    (acc, aggregate) => {
      acc[aggregate] = [];
      return acc;
    },
    {} as Record<Timestamp, string[]>,
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
    const currentAlgorithmsByIndex: Map<number, Algorithm | AnyUserAlgorithmType> =
      algorithmsByIndexByAggregate[aggregate];
    const algorithmDataByAlgorithmIndex: Record<number, AlgorithmData> = {};
    for (const [algorithmIndex, algorithm] of currentAlgorithmsByIndex.entries()) {
      algorithmDataByAlgorithmIndex[algorithmIndex] = {
        algorithmYs: [],
        balance: 100,
        cumulativeHoldingTime: 0,
        cumulativeProfitLoss: [0, 0],
        entracePriceExitPriceByTickerPosition: createIndexByTicker(
          getTickers(algorithm),
          (_ticker) => [0, 0],
        ),
        entraceTimeByTickerPosition: createIndexByTicker(getTickers(algorithm), (_ticker) => 0),
        indicatorResultsFunction: indicatorsToIndicatorResultsFunction(
          (algorithm.indicators ?? []) as Indicator[],
        ),
        positions: createIndexByTicker(getTickers(algorithm), (_ticker) => 0),
        positionsClosed: 0,
        sharpeRatioCalculator: new SharpeRatioCalculator(),
        trades: 0,
        winsLosses: [0, 0],
      } satisfies AlgorithmData;
    }

    // Calculate maximum context length for all algorithms
    const maxContextLengthByTicker = {} as Record<Ticker, number>;
    for (const algorithm of currentAlgorithmsByIndex.values()) {
      for (const ticker of getTickers(algorithm)) {
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
    let currentTimestamp: string | null = null;
    while (hasNextBar) {
      const currentBarByTicker: Record<Ticker, Bar> | null =
        nextBarByTicker != null ? { ...nextBarByTicker } : null;

      // Get next bars from iterators
      nextBarByTicker = {} as Record<Ticker, Bar>;
      let nextTimestamp: string | null = null;
      let deltaBytesProcessed = 0;
      for (const ticker in tickerIteratorByTicker) {
        const iteratorResult = await tickerIteratorByTicker[ticker as Ticker].next();
        if (iteratorResult.done) {
          // Iterator is finished; end of timespan reached
          hasNextBar = false;
          break;
        }

        deltaBytesProcessed += iteratorResult.value.bytesProcessed;
        const nextBar = iteratorResult.value.bar;

        if (nextTimestamp == null) {
          nextTimestamp = nextBar[0];
        } else if (nextBar[0] !== nextTimestamp) {
          throw new ErrorWithCode(
            `Iterator timestamp mismatch for ticker '${ticker}' (${aggregate}); expected '${nextTimestamp}' but got '${nextBar[0]}'`,
            'INTERNAL_SERVER_ERROR',
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
        currentTimestamp = nextTimestamp!;
        continue;
      }

      let updatePlotSpacing = false;
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
          const tickerPortfolioValue =
            (currentBarByTicker[ticker][4] / firstPriceByTicker[ticker]!) * 100;
          updatePlotSpacing = updateGraph({
            graphIndex: ticker,
            graphObject: tickerYsByTicker,
            newPoint: roundToDecimal(tickerPortfolioValue, 2),
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

      // Compile implementation arguments for all algorithms
      const implementationArgumentsByAlgorithmIndex: ImplementationArgumentsByAlgorithmIndex =
        new Map();
      for (const [algorithmIndex, algorithm] of currentAlgorithmsByIndex.entries()) {
        const { contextLength } = algorithm;

        // Ensure enough context to execute algorithm
        if (hasNextBar && ticks + 1 >= contextLength) {
          // Get context
          const context = getTickers(algorithm).reduce(
            (acc, ticker) => {
              acc[ticker] = contextByTicker[ticker].slice(-contextLength);
              return acc;
            },
            {} as Record<Ticker, Bar[]>,
          );

          // Get positions and calculate indicators
          const algorithmData = algorithmDataByAlgorithmIndex[algorithmIndex];
          const positions = algorithmDataByAlgorithmIndex[algorithmIndex].positions;

          const indicators = createIndexByTicker(getTickers(algorithm), (ticker) => {
            const indicatorResults = algorithmData.indicatorResultsFunction(
              context[ticker],
              indicatorMetadataByTicker[ticker],
            );
            return indicatorResults;
          });

          implementationArgumentsByAlgorithmIndex.set(algorithmIndex, [
            context,
            positions,
            indicators,
          ]);
        } else if (!hasNextBar) {
          implementationArgumentsByAlgorithmIndex.set(algorithmIndex, null);
        }
      }

      // Execute algorithm implementations concurrently
      const getAlgorithmActionsResponse = await tryAsync(() =>
        batchAlgorithmImplementationsFn(implementationArgumentsByAlgorithmIndex),
      );
      if (!getAlgorithmActionsResponse.ok) {
        throw getAlgorithmActionsResponse.error;
      }
      const actionsByAlgorithmIndex = getAlgorithmActionsResponse.data;

      // Update positions and graph variables
      for (const [algorithmIndex, algorithm] of currentAlgorithmsByIndex.entries()) {
        const { algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } =
          algorithm;
        const tickers = getTickers(algorithm);
        const algorithmData = algorithmDataByAlgorithmIndex[algorithmIndex];
        const actions = actionsByAlgorithmIndex.get(algorithmIndex)!;

        if (actions != null) {
          updatePosition({
            actions,
            algorithmData,
            algorithmMaxHoldingProportion,
            algorithmTickers: tickers,
            priceByTicker,
            slippageByTicker,
            ticks,
          });
        } else {
          closeAllPositions({
            algorithmData,
            priceByTicker,
            slippageByTicker,
            ticks,
          });
        }

        const portfolioValue = getPortfolioValue({
          priceByTicker,
          algorithmData,
        });
        algorithmData.sharpeRatioCalculator.addPrice(portfolioValue);

        // Update plotting variables
        if (ticks % plotSpacing === 0) {
          updatePlotSpacing = updateGraph({
            graphIndex: 'algorithmYs',
            graphObject: algorithmData,
            newPoint: roundToDecimal(portfolioValue, 2),
          });
        }
      }

      // Update plotting variables
      if (ticks % plotSpacing === 0) {
        updatePlotSpacing = updateGraph({
          graphIndex: aggregate,
          graphObject: timestampsByAggregate,
          newPoint: currentTimestamp!,
        });
      }

      if (updatePlotSpacing) {
        plotSpacing *= 2;
        updatePlotSpacing = false;
      }
      currentTimestamp = nextTimestamp!;
      ticks++;
    }

    for (const ticker in tickerIteratorByTicker) {
      await tickerIteratorByTicker[ticker].close();
    }
    if (verboseLogging) {
      console.log(`Finished processing ${aggregate} aggregate data`);
    }

    // Compile ticker plots
    for (const ticker in tickerYsByTicker) {
      const tickerGraph: SimplePlot = {
        name: ticker,
        y: tickerYsByTicker[ticker],
      };
      tickerPlotByAggregateByTicker[aggregate][ticker] = tickerGraph;
    }

    // Compile algorithm plots
    const yearsBetweenStartAndEnd = yearsBetween(timespan[1], timespan[0]);
    for (const [algorithmIndex, algorithm] of currentAlgorithmsByIndex.entries()) {
      const algorithmGraph = await getAlgorithmGraph({
        aggregate,
        algorithm,
        algorithmData: algorithmDataByAlgorithmIndex[algorithmIndex],
        timespan,
        yearsBetweenStartAndEnd,
      });
      algorithmGraphs.push(algorithmGraph);
    }
  }
  const endBatchAlgorithmImplementationsResponse = await tryAsync(() =>
    batchAlgorithmImplementationsFn.end?.(),
  );
  if (!endBatchAlgorithmImplementationsResponse.ok) {
    throw new ErrorWithCode(
      endBatchAlgorithmImplementationsResponse.error,
      'INTERNAL_SERVER_ERROR',
    );
  }

  if (trackProgress) {
    progressBar.update(bytesToProcess);
    progressBar.stop();
    console.log(`Time taken: ${withCommas(Date.now() - progressStartTimestamp)}ms`);
  }
  return { algorithmGraphs, tickerPlotByAggregateByTicker, timestampsByAggregate };
}
