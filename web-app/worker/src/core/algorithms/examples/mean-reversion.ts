import { type Bar, type Ticker } from '@shared/api';
import { Action, type Algorithm } from '@worker/core/algorithms/algorithm';
import { OnlineStats } from '@worker/utils/sharpe-ratio-calculator';

const tickers: [Ticker, ...Ticker[]] = [
  'QQQ',
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOG',
  'META',
  'NVDA',
  'AMD',
  'TSLA',
];

export function meanReversionAlgorithmByParams({
  lookback,
  epsilon,
  momentumPeriods,
  withMomentum,
  momentumThreshold,
  useLogReturns,
}: {
  lookback: number;
  epsilon: number;
  momentumPeriods: number;
  withMomentum: boolean;
  momentumThreshold: number;
  useLogReturns: boolean;
}) {
  const contextLength = lookback + 1;
  const meanReversionAlgorithm: Algorithm = {
    aggregate: '60min',
    contextLength,
    implementation: async (
      context: Record<Ticker, Bar[]>,
      positions: Record<Ticker, number>,
    ): Promise<Record<Ticker, Action>> => {
      const returnByTicker = {} as Record<Ticker, number>;
      for (const ticker in context) {
        const latest = context[ticker][contextLength - 1][4];
        const prev = context[ticker][0][4];
        returnByTicker[ticker] = useLogReturns
          ? Math.log(latest) - Math.log(prev)
          : (latest - prev) / prev;
      }

      let sectorReturnSum = 0;
      for (const ticker in context) {
        sectorReturnSum += returnByTicker[ticker];
      }
      const sectorMeanReturns = sectorReturnSum / tickers.length;

      let sumDiffSquare = 0;
      for (const ticker in context) {
        sumDiffSquare += (returnByTicker[ticker] - sectorMeanReturns) ** 2;
      }
      const sectorStdDev = Math.sqrt((1 / (tickers.length - 1)) * sumDiffSquare);

      const momentumByTicker = (ticker: Ticker) => {
        const returnStats = new OnlineStats();
        const ctx = context[ticker];
        for (let i = contextLength - momentumPeriods; i < contextLength; i++) {
          const r = useLogReturns
            ? Math.log(ctx[i][4]) - Math.log(ctx[i - 1][4])
            : (ctx[i][4] - ctx[i - 1][4]) / ctx[i - 1][4];
          returnStats.add(r);
        }
        return returnStats.mean / returnStats.stddev()!;
      };

      const actionsByTicker = {} as Record<Ticker, Action>;
      for (const ticker in context) {
        const z = (returnByTicker[ticker] - sectorMeanReturns) / sectorStdDev;
        if (positions[ticker] === 0) {
          // Entry strategy
          if (z < -epsilon && (!withMomentum || momentumByTicker(ticker) > -momentumThreshold)) {
            actionsByTicker[ticker] = Action.BUY;
          } else {
            actionsByTicker[ticker] = Action.HOLD;
          }
        } else {
          // Holding strategy
          if (z > epsilon && (!withMomentum || momentumByTicker(ticker) < momentumThreshold)) {
            actionsByTicker[ticker] = Action.SELL;
          } else {
            actionsByTicker[ticker] = Action.HOLD;
          }
        }
      }
      return actionsByTicker;
    },
    name: `XMSR (L: ${lookback}, ε: ${epsilon}, MP: ${momentumPeriods}, Mom: ${withMomentum}, MT: ${momentumThreshold} Log: ${useLogReturns})`,
    tickers,
  };
  return meanReversionAlgorithm;
}
