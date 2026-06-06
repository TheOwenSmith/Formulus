import type { Action } from '@shared/constants/algorithm';
import type { IndicatorResultByIndicator } from '@shared/constants/indicators/indicator';
import { AlgorithmType, type Bar, type Ticker } from '@shared/constants/trading';
import { actionSchema, type AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import type { ZodType } from 'zod';
import { rpcUserAlgorithmResponseSchemaFromTickers } from './user-algorithm';
import {
  userSimpleAlgorithmInputTransformer,
  userSimpleAlgorithmOutputTransformer,
} from './user-simple-algorithm';
import {
  rpcUserTopKAlgorithmResponseSchemaFromTickers,
  userTopKAlgorithmOutputTransformer,
} from './user-top-k-algorithm';

export type InputTransformer = (
  context: Record<Ticker, Bar[]>,
  positions: Record<Ticker, number>,
  indicators: Record<Ticker, Partial<IndicatorResultByIndicator>>,
  userAlgorithm: AnyUserAlgorithmType,
) => unknown[];

export type OutputTransformer = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- We need Action extends (typeof userResponse); Action does not extend unkown
  userResponse: any,
  userAlgorithm: AnyUserAlgorithmType,
  positions: Record<Ticker, number>,
) => Record<Ticker, Action>;

export type UserAlgorithmPipeline = {
  userResponseSchema: ZodType<unknown>;
  inputTransformer?: InputTransformer;
  outputTransformer?: OutputTransformer;
};

export function getAlgorithmPipelinesFromUserAlgorithms(
  userAlgorithms: AnyUserAlgorithmType[],
): UserAlgorithmPipeline[] {
  return userAlgorithms.map((userAlgorithm: AnyUserAlgorithmType): UserAlgorithmPipeline => {
    switch (userAlgorithm.type) {
      case AlgorithmType.NORMAL:
        return {
          userResponseSchema: rpcUserAlgorithmResponseSchemaFromTickers(userAlgorithm.tickers),
        };
      case AlgorithmType.SIMPLE:
        return {
          inputTransformer: userSimpleAlgorithmInputTransformer,
          outputTransformer: userSimpleAlgorithmOutputTransformer,
          userResponseSchema: actionSchema,
        };
      case AlgorithmType.TOP_K:
        return {
          outputTransformer: userTopKAlgorithmOutputTransformer,
          userResponseSchema: rpcUserTopKAlgorithmResponseSchemaFromTickers(userAlgorithm.tickers),
        };
      default: {
        const _exhaustiveCheck: never = userAlgorithm;
        return _exhaustiveCheck;
      }
    }
  });
}
