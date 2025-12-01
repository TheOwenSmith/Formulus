import {
  ALGORITHM_MAX_HOLDING_PROPORTION_LIMIT,
  DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
  type Algorithm,
} from '@/algorithms/create-simple-algorithm';
import type { DescriptionMetrics } from '@/algorithms/plot';
import { aggregateTimestamps, type Ticker, type Timestamp } from '@/fetch/fetch';
import type { SimplePlot } from '@/lib/nodeplotlib';
import { type SelectionOption } from '@/utils/cli';
import { dateToDay, timespanToDays, yearsBetween, type Day } from '@/utils/date-utils';
import { tryAsync, trySync } from '@/utils/errorHandling';
import { countLinesInFile } from '@/utils/file';
import { groupBy } from '@/utils/groupBy';
import { withCommas, withCommasRounded } from '@/utils/number-utils';
import { SharpeRatioCalculator } from '@/utils/sharpe-ratio-calculator';
import cliProgress, { Presets } from 'cli-progress';
import { closeAllPositions, getPortfolioValue, updatePosition } from './position-utils';
import { getAggregateDataIterator, type AggregateDataIterator, type Bar } from './read-data';
import {
  createIndexByAggregateByAlgorithm,
  createIndexByAggregateByTicker,
  emptyIndexByAggregateByTicker,
  getDistinctTickersByAggregate,
  getTickerDataByAggregateByTicker,
  matchAggregateDataIterators,
  tickersToString,
  type IndexedByAggregateByAlgorithm,
  type IndexedByAggregateByTicker,
  type TickerDataIndexed,
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

const MAX_POINTS_PER_PLOT = 1_000;
const PROGRESS_UPDATE_INTERVAL = 1_000;

export async function backtestAlgorithmsConcurrently({
  algorithms,
  tickerData = [],
  timespan,
  trackProgress = true,
  verboseLogging = false,
}: {
  algorithms: Algorithm[];
  tickerData?: TickerData[];
  timespan?: [string, string];
  trackProgress?: boolean;
  verboseLogging?: boolean;
}): Promise<
  [
    SelectionOption<{
      name: string;
      aggregate: Timestamp;
      descriptionMetrics: DescriptionMetrics;
      algorithmPlot: SimplePlot;
    }>[],
    Record<Timestamp, SelectionOption<SimplePlot>[]>,
  ]
> {
  if (verboseLogging && trackProgress) {
    throw new Error('Verbose logging and tracking progress cannot be used together');
  }

  const timespanDates: [Day, Day] | undefined =
    timespan != undefined ? timespanToDays(timespan) : undefined;

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

  const tickerDataByAggregateByTicker: TickerDataIndexed = getTickerDataByAggregateByTicker(
    tickerData,
    distinctTickersByAggregate,
    verboseLogging,
  );

  const balancesByAggregateByAlgorithm: IndexedByAggregateByAlgorithm<number> =
    createIndexByAggregateByAlgorithm(algorithmsByAggregate, () => 100);
  const tradesByAggregateByAlgorithm: IndexedByAggregateByAlgorithm<number> =
    createIndexByAggregateByAlgorithm(algorithmsByAggregate, () => 0);
  const positionsByAggregateByAlgorithm: IndexedByAggregateByAlgorithm<Record<Ticker, number>> =
    createIndexByAggregateByAlgorithm(algorithmsByAggregate, (aggregate, algorithmIndex) => {
      return algorithmsByAggregate[aggregate][algorithmIndex].tickers.reduce(
        (acc, ticker) => {
          acc[ticker] = 0;
          return acc;
        },
        {} as Record<Ticker, number>,
      );
    });

  // Count number of lines that need to be processed
  let totalLines = 0;
  console.log('Counting number of lines to process...');
  for (const aggregate of aggregateTimestamps) {
    for (const [tickDataFilename] of Object.values(tickerDataByAggregateByTicker[aggregate])) {
      const getIteratorResponse = await tryAsync(() => countLinesInFile(tickDataFilename));
      if (!getIteratorResponse.ok) {
        throw getIteratorResponse.error;
      }
      const linesInFile = getIteratorResponse.data;
      totalLines += linesInFile;
    }
  }
  console.log(`Total lines to process: ${withCommas(totalLines)}`);

  // Initialize progress bar
  const progressBar = new cliProgress.SingleBar({}, Presets.shades_grey);
  const progressStartTimestamp = Date.now();
  if (trackProgress) {
    progressBar.start(totalLines, 0);
  }

  // Fetch ticker iterators for all tickers
  const tickerIteratorByAggregateByTicker: IndexedByAggregateByTicker<AggregateDataIterator> =
    createIndexByAggregateByTicker(distinctTickersByAggregate, (aggregate, ticker) => {
      const tickDataFilename = tickerDataByAggregateByTicker[aggregate][ticker][0];
      if (verboseLogging) {
        console.log(`Fetching '${tickDataFilename}'...`);
      }

      const getIteratorResponse = trySync(() =>
        getAggregateDataIterator(tickDataFilename, verboseLogging),
      );
      if (!getIteratorResponse.ok) {
        throw getIteratorResponse.error;
      }
      return getIteratorResponse.data;
    });

  // Plotting variables
  const tickerYsByAggregateByTicker: IndexedByAggregateByTicker<number[]> =
    createIndexByAggregateByTicker(distinctTickersByAggregate, () => []);
  const tickerGraphSelectionOptionsByAggregate: Record<Timestamp, SelectionOption<SimplePlot>[]> =
    aggregateTimestamps.reduce(
      (acc, aggregate) => {
        acc[aggregate] = [];
        return acc;
      },
      {} as Record<Timestamp, SelectionOption<SimplePlot>[]>,
    );
  const algorithmYsByAggregateByAlgorithm: IndexedByAggregateByAlgorithm<number[]> =
    createIndexByAggregateByAlgorithm(algorithmsByAggregate, () => []);
  const sharpeRatioCalculatorByAggregateByAlgorithm: IndexedByAggregateByAlgorithm<SharpeRatioCalculator> =
    createIndexByAggregateByAlgorithm(algorithmsByAggregate, () => new SharpeRatioCalculator());
  const algorithmGraphSelectionOptionsWithPerformance: SelectionOptionWithPerformance<{
    name: string;
    aggregate: Timestamp;
    descriptionMetrics: DescriptionMetrics;
    algorithmPlot: SimplePlot;
  }>[] = [];

  // Calculate maximum context length for all algorithms
  const maxContextLengthByAggregateByTicker: IndexedByAggregateByTicker<number> =
    emptyIndexByAggregateByTicker();
  for (const aggregate of aggregateTimestamps) {
    for (const algorithm of algorithmsByAggregate[aggregate]) {
      for (const ticker of algorithm.tickers) {
        maxContextLengthByAggregateByTicker[aggregate][ticker] = Math.max(
          maxContextLengthByAggregateByTicker[aggregate][ticker] ?? 1,
          algorithm.contextLength,
        );
      }
    }
  }

  // Match all iterators buffer one bar ahead to determine market state efficiently
  const [startDay, nextBarByAggregateByTicker] = await matchAggregateDataIterators(
    tickerIteratorByAggregateByTicker,
    timespanDates?.[0],
  );
  if (verboseLogging) {
    console.log(`Starting on day ${startDay.join('-')}`);
  }

  // Tracking variables
  const contextByAggregateByTicker: IndexedByAggregateByTicker<Bar[]> =
    createIndexByAggregateByTicker(distinctTickersByAggregate, () => []);
  const firstPriceByAggregateByTicker: IndexedByAggregateByTicker<number> =
    createIndexByAggregateByTicker(
      distinctTickersByAggregate,
      (aggregate, ticker) => nextBarByAggregateByTicker[aggregate][ticker][1],
    );
  const lastPriceByAggregateByTicker: IndexedByAggregateByTicker<number> =
    createIndexByAggregateByTicker(
      distinctTickersByAggregate,
      (aggregate, ticker) => nextBarByAggregateByTicker[aggregate][ticker][4],
    );

  let linesProcessed = 0;
  for (const aggregate of aggregateTimestamps) {
    // Backtest algorithms
    if (Object.keys(tickerIteratorByAggregateByTicker[aggregate]).length === 0) {
      continue;
    }
    if (verboseLogging) {
      console.log(`Processing ${aggregate} aggregate data...`);
    }

    // Plotting variables
    let ticks = 0;
    let plotSpacing = 1;
    let updatePlotSpacing = false;

    let hasNextBar = true;
    let endDay: Day | null = null;
    while (hasNextBar) {
      // Get next bars
      let nextBarTimestamp = '';
      const currentBarByTicker: Record<Ticker, Bar> = nextBarByAggregateByTicker[aggregate];
      for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
        const nextBarIteratorResult =
          await tickerIteratorByAggregateByTicker[aggregate][ticker].next();
        if (nextBarIteratorResult.done) {
          hasNextBar = false;
          break;
        }

        const nextBar = nextBarIteratorResult.value;
        nextBarByAggregateByTicker[aggregate][ticker] = nextBar;
        if (nextBarTimestamp === '') nextBarTimestamp = nextBar[0];
        else if (nextBar[0] !== nextBarTimestamp) throw new Error('Iterator timestamp mismatch');
      }

      // Update plotting variables
      for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
        // Update progress bar
        if (trackProgress && ++linesProcessed % PROGRESS_UPDATE_INTERVAL === 0) {
          progressBar.update(linesProcessed);
        }

        // Update tracking variable
        lastPriceByAggregateByTicker[aggregate][ticker] = currentBarByTicker[ticker][4];

        // Update context
        if (
          contextByAggregateByTicker[aggregate][ticker].length <
          maxContextLengthByAggregateByTicker[aggregate][ticker]
        ) {
          contextByAggregateByTicker[aggregate][ticker].push(currentBarByTicker[ticker]);
        } else {
          contextByAggregateByTicker[aggregate][ticker].shift();
          contextByAggregateByTicker[aggregate][ticker].push(currentBarByTicker[ticker]);
        }

        // Update plotting variables
        const tickerYs = tickerYsByAggregateByTicker[aggregate][ticker];
        if (ticks % plotSpacing === 0) {
          tickerYs.push(
            (currentBarByTicker[ticker][4] / firstPriceByAggregateByTicker[aggregate][ticker]) *
              100,
          );

          if (tickerYs.length > MAX_POINTS_PER_PLOT) {
            // Reduce the number of points in the plot by half
            const reducedTickerPlot: number[] = [];
            for (let j = 0; j < tickerYs.length; j += 2) {
              reducedTickerPlot.push(tickerYs[j]);
            }
            tickerYsByAggregateByTicker[aggregate][ticker] = reducedTickerPlot;
            updatePlotSpacing = true;
          }
        }
      }

      // Execute algorithm trades
      for (
        let algorithmIndex = 0;
        algorithmIndex < algorithmsByAggregate[aggregate].length;
        algorithmIndex++
      ) {
        const algorithm = algorithmsByAggregate[aggregate][algorithmIndex];
        const {
          tickers,
          contextLength,
          algorithmMaxHoldingProportion = DEFAULT_ALGORITHM_MAX_HOLDING_PROPORTION,
        } = algorithm;

        const positions = positionsByAggregateByAlgorithm[aggregate][algorithmIndex];
        const priceByTicker: Record<Ticker, number> = tickers.reduce(
          (acc, ticker) => {
            acc[ticker] = contextByAggregateByTicker[aggregate][ticker].at(-1)![4];
            return acc;
          },
          {} as Record<Ticker, number>,
        );

        // Ensure enough context to execute algorithm
        if (hasNextBar && ticks + 1 >= contextLength) {
          const context = algorithm.tickers.reduce(
            (acc, ticker) => {
              acc[ticker] = contextByAggregateByTicker[aggregate][ticker].slice(-contextLength);
              return acc;
            },
            {} as Record<Ticker, Bar[]>,
          );

          // Get actions from implementation
          const actions = algorithm.implementation(context, positions);

          updatePosition({
            actions,
            algorithmIndex,
            algorithmMaxHoldingProportion,
            algorithmPositions: positions,
            algorithmTickers: tickers,
            balancesByAlgorithm: balancesByAggregateByAlgorithm[aggregate],
            priceByTicker,
            tickerDataByTicker: tickerDataByAggregateByTicker[aggregate],
            tradesByAlgorithm: tradesByAggregateByAlgorithm[aggregate],
          });
        } else if (!hasNextBar) {
          closeAllPositions({
            algorithmIndex,
            algorithmPositions: positions,
            balancesByAlgorithm: balancesByAggregateByAlgorithm[aggregate],
            priceByTicker,
            tickerDataByTicker: tickerDataByAggregateByTicker[aggregate],
            tradesByAlgorithm: tradesByAggregateByAlgorithm[aggregate],
          });
        }

        const portfolioValue = getPortfolioValue({
          algorithmPositions: positions,
          priceByTicker,
          balance: balancesByAggregateByAlgorithm[aggregate][algorithmIndex],
        });
        sharpeRatioCalculatorByAggregateByAlgorithm[aggregate][algorithmIndex].addPrice(
          portfolioValue,
        );

        // Update plotting variables
        const algorithmYs = algorithmYsByAggregateByAlgorithm[aggregate][algorithmIndex];
        if (ticks % plotSpacing === 0) {
          algorithmYs.push(portfolioValue);

          if (algorithmYs.length > MAX_POINTS_PER_PLOT) {
            // Reduce the number of points in the plot by half
            const reducedAlgorithmPlot: number[] = [];
            for (let j = 0; j < algorithmYs.length; j += 2) {
              reducedAlgorithmPlot.push(algorithmYs[j]);
            }
            algorithmYsByAggregateByAlgorithm[aggregate][algorithmIndex] = reducedAlgorithmPlot;
            updatePlotSpacing = true;
          }
        }

        if (!hasNextBar) {
          const endTimestamp = Object.values(currentBarByTicker)[0][0];
          endDay = dateToDay(endTimestamp);
        }
      }

      // Update plotting variables
      ticks++;
      if (updatePlotSpacing) {
        plotSpacing *= 2;
        updatePlotSpacing = false;
      }
    }

    for (const ticker in tickerIteratorByAggregateByTicker[aggregate]) {
      tickerIteratorByAggregateByTicker[aggregate][ticker].close();
    }
    if (verboseLogging) {
      console.log(`Finished processing ${aggregate} aggregate data`);
    }

    // Compile ticker plots
    const pointsPlotted = algorithmYsByAggregateByAlgorithm[aggregate][0].length;
    const xs = Array.from({ length: pointsPlotted }, (_, i) => i);

    for (const ticker in tickerYsByAggregateByTicker[aggregate]) {
      const tickerYs = tickerYsByAggregateByTicker[aggregate][ticker];
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

      const algorithmYs = algorithmYsByAggregateByAlgorithm[aggregate][algorithmIndex];
      const algorithmPlot: SimplePlot = {
        name: 'Algorithm',
        x: xs,
        y: algorithmYs,
        type: 'scatter',
      };

      const balance = balancesByAggregateByAlgorithm[aggregate][algorithmIndex];
      const returnPercentage = balance - 100;
      const growthRatePercentage = (Math.pow(balance / 100, 1 / yearsBetweenStartAndEnd) - 1) * 100;
      const trades = tradesByAggregateByAlgorithm[aggregate][algorithmIndex];
      const sharpRatio =
        sharpeRatioCalculatorByAggregateByAlgorithm[aggregate][algorithmIndex].sharpe(
          yearsBetweenStartAndEnd,
        );

      const descriptionMetrics: DescriptionMetrics = {
        aggregate: `Aggregate: ${aggregate}`,
        algorithmReturn: `Algorithm return: ${withCommasRounded(returnPercentage)}%`,
        contextLength: `Context length: ${contextLength}`,
        growthRate: `Growth rate: ${withCommasRounded(growthRatePercentage)}%`,
        maxHoldingPercentage: `Max holding percentage: ${algorithmMaxHoldingProportion * 100}%`,
        sharpeRatio: `Sharpe ratio: ${withCommasRounded(sharpRatio)}`,
        tickers: `Tickers: ${tickersToString(tickers)}`,
        timespan: `Timespan: ${startDay.join('-')} to ${endDay!.join('-')}`,
        tradesMade: `Trades made: ${withCommas(trades)}`,
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
    progressBar.update(totalLines);
    progressBar.stop();
    console.log(`Time taken: ${withCommas(Date.now() - progressStartTimestamp)}ms`);
  }
  return [algorithmGraphSelectionOptionsWithPerformance, tickerGraphSelectionOptionsByAggregate];
}
