import { getTickers, type Algorithm } from '@shared/constants/algorithm';
import type { Indicator, IndicatorResultByIndicator } from '@shared/constants/indicators/indicator';
import type { IndicatorMetadata } from '@shared/constants/indicators/indicator-metadata';
import type {
  BacktestAlgorithmsResult,
  DescriptionMetrics,
  SimplePlot,
  Ticker,
  Timestamp,
} from '@shared/constants/trading';
import {
  aggregateTimestamps,
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Bar,
} from '@shared/constants/trading';
import type { AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import { badRequest, internal, safeReduce, type AppError } from '@shared/utils/error-handling';
import { roundToDecimal, withCommas } from '@shared/utils/number-utils';
import { config } from '@worker/lib/config';
import { yearsBetween } from '@worker/utils/date-utils';
import { groupBy } from '@worker/utils/group-by';
import { SharpeRatioCalculator } from '@worker/utils/sharpe-ratio-calculator';
import { err, ok, type Result } from 'neverthrow';
import { BYTES_PROGRESS_UPDATE_INTERVAL, type TickerData } from './constants';
import { indicatorsToIndicatorResultsFunction } from './indicator-utils';
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
import { getAlgorithmGraph, updateGraph } from './statistics';
import {
  createIndexByTicker,
  downloadTickDataFromS3,
  emptyIndexByAggregateByTicker,
  getAllTickers,
  getDistinctTickersByAggregate,
  getFilenameAndIndexByAggregateByTicker,
  getMarketSlippageByTicker,
} from './ticker-utils';

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
  ) => Result<Partial<IndicatorResultByIndicator>, AppError>;
  maxDrawdown: number;
  peakBalance: number;
  positions: Record<Ticker, number>;
  positionsClosed: number;
  sharpeRatioCalculator: SharpeRatioCalculator;
  trades: number;
  winsLosses: [wins: number, losses: number];
};

export type BacktestingAlgorithmsConcurrentlyOptions = {
  iteratorStrictParsing?: boolean;
  onProgress?: (pct: number) => void | Promise<void>;
  sharePrecisionNumberOfDecimals?: number;
  slippageByTicker?: Partial<Record<Ticker, number>>;
  tickerData?: TickerData[];
  verboseLogging?: boolean;
};

export async function backtestAlgorithmsConcurrently(inp: {
  algorithms: Algorithm[];
  options?: BacktestingAlgorithmsConcurrentlyOptions;
  slippageMapFn?: (marketSlippage: number, price: number) => number;
  timespan?: [string | null, string | null];
}): Promise<Result<BacktestAlgorithmsResult, AppError>>;
export async function backtestAlgorithmsConcurrently(inp: {
  algorithms: AnyUserAlgorithmType[];
  options?: BacktestingAlgorithmsConcurrentlyOptions;
  slippageMapFn?: (marketSlippage: number, price: number) => number;
  timespan?: [string | null, string | null];
}): Promise<Result<BacktestAlgorithmsResult, AppError>>;

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
}): Promise<Result<BacktestAlgorithmsResult, AppError>> {
  const {
    iteratorStrictParsing = false,
    onProgress,
    sharePrecisionNumberOfDecimals = 8,
    slippageByTicker: userInputtedSlippageByTicker,
    tickerData = [],
    verboseLogging = false,
  } = options;
  if (algorithms.length === 0) {
    return err(badRequest('No algorithms provided to backtest'));
  }

  const language: SupportedLanguage | null =
    'language' in algorithms[0] ? algorithms[0].language : null;
  if (language != null) {
    for (let i = 1; i < algorithms.length; i++) {
      if ((algorithms[i] as AnyUserAlgorithmType).language !== language) {
        return err(
          badRequest(
            `All user algorithms must be the same language; expected '${language}' but got '${(algorithms[i] as AnyUserAlgorithmType).language}'`,
          ),
        );
      }
    }
  }

  // Verify no algorithm max holding proportion is greater than the limit
  for (const algorithm of algorithms) {
    const { algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } = algorithm;
    if (algorithmMaxHoldingProportion > ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT) {
      return err(
        badRequest(
          `Algorithm max holding proportion '${algorithmMaxHoldingProportion}' is greater than the limit ${ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT}`,
        ),
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

  // Download tick data files
  if (config.env !== 'dev') {
    const downloadTickDataResult = await downloadTickDataFromS3(
      distinctTickersByAggregate,
      config.getDeployKey('DATA_BUCKET'),
    );
    if (downloadTickDataResult.isErr()) return err(downloadTickDataResult.error);
  }

  // Get filename and index by aggregate by ticker and slippage by ticker
  const getFilenameAndIndexByAggregateByTickerResponse = getFilenameAndIndexByAggregateByTicker(
    tickerData,
    distinctTickersByAggregate,
    verboseLogging,
  );
  if (getFilenameAndIndexByAggregateByTickerResponse.isErr()) {
    return err(getFilenameAndIndexByAggregateByTickerResponse.error);
  }
  const { filenameByAggregateByTicker, indexByAggregateByTicker } =
    getFilenameAndIndexByAggregateByTickerResponse.value;
  const marketSlippageByTickerResponse = getMarketSlippageByTicker(
    allTickers,
    userInputtedSlippageByTicker,
  );
  if (marketSlippageByTickerResponse.isErr()) {
    return err(marketSlippageByTickerResponse.error);
  }
  const marketSlippageByTicker = marketSlippageByTickerResponse.value;

  const batchAlgorithmImplementationsFnResponse: Result<BatchAlgorithmImplementationsFn, AppError> =
    language != null
      ? // If user algorithms are provided, create RPC function for batching algorithm implementations
        await getBatchAlgorithmImplementationsRpcFunction(
          algorithms as AnyUserAlgorithmType[],
          language,
        )
      : // If default algorithms are provided, use default function for batching algorithm implementations
        ok(await getBatchAlgorithmImplementationsDefaultFunction(algorithms as Algorithm[]));
  if (batchAlgorithmImplementationsFnResponse.isErr()) {
    return err(batchAlgorithmImplementationsFnResponse.error);
  }
  const batchAlgorithmImplementationsFn = batchAlgorithmImplementationsFnResponse.value;

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

  // try/finally wraps everything from here so the Docker container is always destroyed
  let endBatchAlgorithmImplementationsResult: Result<undefined, AppError> | undefined;
  try {
    // Get ticker iterator bounds
    const getIteratorBoundsResponse = await getIteratorBounds(
      indexByAggregateByTicker,
      userInputtedTimespan,
    );
    if (getIteratorBoundsResponse.isErr()) {
      return err(getIteratorBoundsResponse.error);
    }
    const { timespan, iteratorBoundsByAggregateByTicker } = getIteratorBoundsResponse.value;

    console.log(`Testing timespan: ${timespan[0]} to ${timespan[1]}`);
    const bytesToProcess = countBytesToProcess(iteratorBoundsByAggregateByTicker);
    console.log(`Bytes to process: ${withCommas(bytesToProcess)}`);

    console.log(
      `Data successfully prepared (took ${withCommas(Date.now() - startPrepareDataTimestamp)}ms)`,
    );

    // Signal 0% progress: preparation is done, actual backtesting is starting.
    // This fires before any bytes are processed so the client transitions from "Preparing..."
    // to "Running..." and can begin showing accurate ETA from this moment.
    if (onProgress != null) {
      await onProgress(0);
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
      const getTickerIteratorByTickerResponse = getTickerIteratorsByTicker({
        distinctTickers: distinctTickersByAggregate[aggregate],
        filenameByTicker: filenameByAggregateByTicker[aggregate],
        iteratorBoundsByTicker: iteratorBoundsByAggregateByTicker[aggregate],
        parseStrictly: iteratorStrictParsing,
        verboseLogging,
      });
      if (getTickerIteratorByTickerResponse.isErr()) {
        return err(getTickerIteratorByTickerResponse.error);
      }
      const tickerIteratorByTicker: Record<Ticker, AggregateDataIterator> =
        getTickerIteratorByTickerResponse.value;

      // Algorithm tracking variables
      const currentAlgorithmsByIndex: Map<number, Algorithm | AnyUserAlgorithmType> =
        algorithmsByIndexByAggregate[aggregate];
      const algorithmDataByAlgorithmIndex: Record<number, AlgorithmData> = {};
      for (const [algorithmIndex, algorithm] of currentAlgorithmsByIndex.entries()) {
        const indicatorsToIndicatorResultsFunctionResponse = indicatorsToIndicatorResultsFunction(
          (algorithm.indicators ?? []) as Indicator[],
        );
        if (indicatorsToIndicatorResultsFunctionResponse.isErr()) {
          return err(indicatorsToIndicatorResultsFunctionResponse.error);
        }
        const indicatorResultsFunction = indicatorsToIndicatorResultsFunctionResponse.value;

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
          indicatorResultsFunction,
          maxDrawdown: 0,
          peakBalance: 100,
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
      const tickerYsByTicker: Record<Ticker, number[]> = distinctTickersByAggregate[
        aggregate
      ].reduce(
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
            return err(
              internal(
                undefined,
                `Iterator timestamp mismatch for ticker '${ticker}' (${aggregate}); expected '${nextTimestamp}' but got '${nextBar[0]}'`,
              ),
            );
          }

          nextBarByTicker[ticker] = nextBar;
        }

        const shouldUpdateProgress =
          Math.floor((bytesProcessed + deltaBytesProcessed) / BYTES_PROGRESS_UPDATE_INTERVAL) >
          Math.floor(bytesProcessed / BYTES_PROGRESS_UPDATE_INTERVAL);
        bytesProcessed += deltaBytesProcessed;
        if (shouldUpdateProgress) {
          if (onProgress != null && bytesToProcess > 0) {
            await onProgress(Math.min(99, (bytesProcessed / bytesToProcess) * 100));
          }
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

            const getIndicatorsResult = safeReduce(
              getTickers(algorithm),
              (acc: Record<Ticker, Partial<IndicatorResultByIndicator>>, ticker: Ticker) => {
                const getIndicatorResultsResponse = algorithmData.indicatorResultsFunction(
                  context[ticker],
                  indicatorMetadataByTicker[ticker],
                );
                return getIndicatorResultsResponse.map((indicatorResults) => {
                  acc[ticker] = indicatorResults;
                  return acc;
                });
              },
              {} as Record<Ticker, Partial<IndicatorResultByIndicator>>,
            );
            if (getIndicatorsResult.isErr()) {
              return err(getIndicatorsResult.error);
            }
            const indicators = getIndicatorsResult.value;

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
        const getAlgorithmActionsResponse = await batchAlgorithmImplementationsFn(
          implementationArgumentsByAlgorithmIndex,
        );
        if (getAlgorithmActionsResponse.isErr()) {
          return err(getAlgorithmActionsResponse.error);
        }
        const actionsByAlgorithmIndex = getAlgorithmActionsResponse.value;

        // Update positions and graph variables
        for (const [algorithmIndex, algorithm] of currentAlgorithmsByIndex.entries()) {
          const { algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION } =
            algorithm;
          const tickers = getTickers(algorithm);
          const algorithmData = algorithmDataByAlgorithmIndex[algorithmIndex];
          const actions = actionsByAlgorithmIndex.get(algorithmIndex)!;

          if (actions != null) {
            const updatePositionResult = updatePosition({
              actions,
              algorithmData,
              algorithmMaxHoldingProportion,
              algorithmTickers: tickers,
              priceByTicker,
              sharePrecisionNumberOfDecimals,
              slippageByTicker,
              ticks,
            });
            if (updatePositionResult.isErr()) {
              return err(updatePositionResult.error);
            }
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

          // Update statistics
          algorithmData.sharpeRatioCalculator.addPrice(portfolioValue);
          algorithmData.peakBalance = Math.max(algorithmData.peakBalance, portfolioValue);
          algorithmData.maxDrawdown = Math.max(
            algorithmData.maxDrawdown,
            (algorithmData.peakBalance - portfolioValue) / algorithmData.peakBalance,
          );

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
        }
        currentTimestamp = nextTimestamp!;
        ticks++;
      }

      for (const ticker in tickerIteratorByTicker) {
        const closeTickerIteratorResponse = await tickerIteratorByTicker[ticker].close();
        if (closeTickerIteratorResponse.isErr()) {
          return err(closeTickerIteratorResponse.error);
        }
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
  } finally {
    // End RPC function
    endBatchAlgorithmImplementationsResult = await batchAlgorithmImplementationsFn.end?.();
  }

  if (
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- Typescript throws another error if we use optional chaining
    endBatchAlgorithmImplementationsResult != null &&
    endBatchAlgorithmImplementationsResult.isErr()
  ) {
    return err(endBatchAlgorithmImplementationsResult.error);
  }

  return ok({ algorithmGraphs, tickerPlotByAggregateByTicker, timestampsByAggregate });
}
