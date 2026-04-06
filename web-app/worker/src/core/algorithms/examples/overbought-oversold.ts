import type { Bar, Ticker } from '@shared/api';
import { OVERBOUGHT_OVERSOLD_CODE } from '@shared/examples';
import { Action, type MarketInvariantAlgorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const overboughtOversoldAlgorithm: MarketInvariantAlgorithm = {
  name: 'Overbought-Oversold',
  contextLength: 15,
  indicators: ['RSI(14)'],
  implementation: async (
    context: Record<Ticker, Bar[]>,
    _positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const result = {} as Record<Ticker, Action>;
    for (const ticker in context) {
      const rsi = indicators[ticker]['RSI(14)']!.at(-1)!;

      if (rsi < 30) {
        result[ticker] = Action.BUY;
      } else if (rsi > 70) {
        result[ticker] = Action.SELL;
      } else {
        result[ticker] = Action.HOLD;
      }
    }
    return result;
  },
};

export const overboughtOversoldUserAlgorithmImplementationCodeByLanguage = OVERBOUGHT_OVERSOLD_CODE;

export const overboughtOversoldUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 15,
  indicators: ['RSI(14)'],
  name: 'Overbought-Oversold Example (User-Defined)',
  tickers: ['SPY'],
  type: AlgorithmType.NORMAL,
};

export const overboughtOversoldUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    overboughtOversoldUserAlgorithmBase,
    overboughtOversoldUserAlgorithmImplementationCodeByLanguage,
  );
