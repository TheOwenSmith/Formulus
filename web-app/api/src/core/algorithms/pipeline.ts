import type { Bar, Ticker } from '@api/fetch/types';
import type { ZodType } from 'zod';
import { actionSchema, type Action } from './algorithm';
import type { IndicatorResultByIndicator } from './indicators/indicator';
import {
  AlgorithmType,
  rpcUserAlgorithmResponseSchemaFromTickers,
  type AnyUserAlgorithmType,
} from './user-algorithm';
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
