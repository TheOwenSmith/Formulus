import type { Bar, Ticker } from '@shared/api';
import { ABOVE_BELOW_SMA_CODE } from '@shared/examples';
import { Action, type MarketInvariantAlgorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import { type SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const aboveBelowSmaAlgorithm: MarketInvariantAlgorithm = {
  name: 'Above-Below SMA',
  contextLength: 20,
  indicators: ['SMA(20)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const sma = indicators[ticker]['SMA(20)']!.at(-1)!;
      const latestPrice = context[ticker].at(-1)![4];

      if (latestPrice > sma) {
        result[ticker] = Action.BUY;
      } else if (latestPrice < sma) {
        result[ticker] = Action.SELL;
      } else {
        result[ticker] = Action.HOLD;
      }
    }
    return result;
  },
};

const aboveBelowSmaUserAlgorithmImplementationCodeByLanguage = ABOVE_BELOW_SMA_CODE;

const aboveBelowSmaUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 20,
  indicators: ['SMA(20)'],
  name: 'Above-Below SMA Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const aboveBelowSmaUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    aboveBelowSmaUserAlgorithmBase,
    aboveBelowSmaUserAlgorithmImplementationCodeByLanguage,
  );
