import type { Bar, Ticker } from '@shared/api';
import { LONG_SHORT_CODE } from '@shared/examples';
import { Action, type Algorithm } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import { AlgorithmType, type UserAlgorithm } from '@worker/core/algorithms/user-algorithm';
import type { SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const longShortAlgorithm: Algorithm = {
  aggregate: '60min',
  contextLength: 15,
  implementation: async (
    _context: Record<Ticker, Bar[]>,
    positions: Record<Ticker, number>,
    indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  ): Promise<Record<Ticker, Action>> => {
    const haveSH = positions['SH'] > 0;

    const spyRSI = indicators['SPY']['RSI(14)']!.at(-1)!;
    if (spyRSI < 25) {
      return { SPY: Action.BUY, SH: Action.SELL } as Record<Ticker, Action>;
    }

    if (haveSH) {
      if (spyRSI < 50) {
        return { SPY: Action.HOLD, SH: Action.SELL } as Record<Ticker, Action>;
      } else {
        return { SPY: Action.HOLD, SH: Action.HOLD } as Record<Ticker, Action>;
      }
    }

    if (spyRSI > 85) {
      return { SPY: Action.SELL, SH: Action.BUY } as Record<Ticker, Action>;
    } else if (spyRSI > 75) {
      return { SPY: Action.SELL, SH: Action.HOLD } as Record<Ticker, Action>;
    }

    return { SPY: Action.HOLD, SH: Action.HOLD } as Record<Ticker, Action>;
  },
  indicators: ['RSI(14)'],
  name: 'Long-Short',
  tickers: ['SPY', 'SH'],
};

const longShortUserAlgorithmImplementationCodeByLanguage = LONG_SHORT_CODE;

export const longShortUserAlgorithmBase: Omit<
  UserAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 20,
  indicators: ['RSI(14)'],
  name: 'Long-Short Example (User-Defined)',
  tickers: ['SPY', 'SH'],
  type: AlgorithmType.NORMAL,
};

export const longShortUserAlgorithmByLanguage: Record<SupportedLanguage, UserAlgorithm> =
  algorithmByLanguage<UserAlgorithm>(
    longShortUserAlgorithmBase,
    longShortUserAlgorithmImplementationCodeByLanguage,
  );
