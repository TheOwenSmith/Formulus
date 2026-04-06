import type { Bar } from '@shared/api';
import { IF_GREEN_CODE } from '@shared/examples';
import { Action } from '@worker/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@worker/core/algorithms/indicators/indicator';
import type { SimpleMarketInvariantAlgorithm } from '@worker/core/algorithms/simple-algorithm';
import { AlgorithmType } from '@worker/core/algorithms/user-algorithm';
import type { UserSimpleAlgorithm } from '@worker/core/algorithms/user-simple-algorithm';
import { type SupportedLanguage } from '@worker/core/backtesting/rpc/languages';
import { algorithmByLanguage } from './utils';

export const ifGreenAlgorithm: SimpleMarketInvariantAlgorithm = {
  contextLength: 1,
  implementation: async (
    context: Bar[],
    _position: number,
    _indicators: Partial<IndicatorResultByIndicator>,
  ): Promise<Action> => {
    const prevBar = context[0];
    return prevBar[4] <= prevBar[1] ? Action.BUY : Action.SELL;
  },
  name: 'If Green',
};

const ifGreenUserAlgorithmImplementationCodeByLanguage = IF_GREEN_CODE;

const ifGreenUserAlgorithmBase: Omit<
  UserSimpleAlgorithm,
  'language' | 'userAlgorithmImplementationCode'
> = {
  aggregate: '60min',
  contextLength: 1,
  name: 'If Green (User-Defined)',
  ticker: 'SPY',
  type: AlgorithmType.SIMPLE,
};

export const ifGreenUserAlgorithmByLanguage: Record<SupportedLanguage, UserSimpleAlgorithm> =
  algorithmByLanguage<UserSimpleAlgorithm>(
    ifGreenUserAlgorithmBase,
    ifGreenUserAlgorithmImplementationCodeByLanguage,
  );
