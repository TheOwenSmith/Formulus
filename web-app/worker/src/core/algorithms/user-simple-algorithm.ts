import type { Action } from '@shared/constants/algorithm';
import type { IndicatorResultByIndicator } from '@shared/constants/indicators/indicator';
import type { Bar, Ticker } from '@shared/constants/trading';
import { type AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import type { UserSimpleAlgorithm } from '@shared/schemas/algorithms/user-simple-algorithm';
import type { InputTransformer, OutputTransformer } from './pipeline';

export const userSimpleAlgorithmInputTransformer: InputTransformer = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  userAlgorithm: AnyUserAlgorithmType,
): [Bar[], number, Partial<IndicatorResultByIndicator>] => {
  const { ticker } = userAlgorithm as UserSimpleAlgorithm;
  return [context[ticker], positions[ticker], indicators[ticker]];
};

export const userSimpleAlgorithmOutputTransformer: OutputTransformer = (
  userResponse: Action,
  userAlgorithm: AnyUserAlgorithmType,
  _positions: Record<Ticker, number>,
): Record<Ticker, Action> => {
  const { ticker } = userAlgorithm as UserSimpleAlgorithm;
  return { [ticker]: userResponse } as Record<Ticker, Action>;
};
