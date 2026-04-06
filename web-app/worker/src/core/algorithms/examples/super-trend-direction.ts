import type { Bar, Ticker } from '@shared/api';
import { SUPER_TREND_DIRECTION_CODE } from '@shared/examples';
import { Action, type MarketInvariantAlgorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { Direction } from '@worker/core/algorithms/indicators/super-trend';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const superTrendDirectionAlgorithm: MarketInvariantAlgorithm = {
  name: 'Super Trend Direction',
  contextLength: 11,
  indicators: ['SuperTrend(10,3)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const { direction } = indicators[ticker]['SuperTrend(10,3)']!.at(-1)!;
      result[ticker] = direction === Direction.UP ? Action.BUY : Action.SELL;
    }
    return result;
  },
};

const superTrendDirectionUserAlgorithmImplementationCodeByLanguage = SUPER_TREND_DIRECTION_CODE;
export const superTrendDirectionUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 11,
  indicators: ['SuperTrend(10,3)'],
  name: 'Super Trend Direction Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const superTrendDirectionUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    superTrendDirectionUserAlgorithmBase,
    superTrendDirectionUserAlgorithmImplementationCodeByLanguage,
  );
