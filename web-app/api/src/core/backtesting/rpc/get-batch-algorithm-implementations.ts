import type { Action, Algorithm } from '@api/core/algorithms/algorithm';
import type { IndicatorResultByIndicator } from '@api/core/algorithms/indicators/indicator';
import {
  getAlgorithmPipelinesFromUserAlgorithms,
  type UserAlgorithmPipeline,
} from '@api/core/algorithms/pipeline';
import type { AnyUserAlgorithmType } from '@api/core/algorithms/user-algorithm';
import type { Bar, Ticker } from '@api/fetch/types';
import { tryAsync } from '@api/utils/error-handling';
import { createBatchRpcFunctionFromUserCode } from './create-rpc-function';
import { EXTENSION_BY_LANGUAGE, type SupportedLanguage } from './languages';

export type ImplementationArgumentsByAlgorithmIndex = Map<
  number,
  | [
      Record<Ticker, Bar[]>,
      Record<Ticker, number>,
      Record<Ticker, Partial<IndicatorResultByIndicator>>,
    ]
  | null
>;

export type BatchAlgorithmImplementationsFn = ((
  implementationArgumentsByAlgorithmIndex: ImplementationArgumentsByAlgorithmIndex,
) => Promise<Map<number, Record<Ticker, Action> | null>>) & { end?: () => Promise<void> };

export async function getBatchAlgorithmImplementationsRpcFunction(
  algorithms: AnyUserAlgorithmType[],
  language: SupportedLanguage,
): Promise<BatchAlgorithmImplementationsFn> {
  // Get algorithm pipelines
  const algorithmPipelines: UserAlgorithmPipeline[] =
    getAlgorithmPipelinesFromUserAlgorithms(algorithms);

  // Create RPC function
  const createBatchRpcFunctionResponse = await tryAsync(() =>
    createBatchRpcFunctionFromUserCode<Record<number, unknown[]>, Record<number, unknown>>({
      userCodeByFilename: algorithms.reduce(
        (acc, algorithm) => {
          const filename = `${algorithm.name.replaceAll(' ', '_')}.${EXTENSION_BY_LANGUAGE[language]}`;
          acc[filename] = algorithm.userAlgorithmImplementationCode;
          return acc;
        },
        {} as Record<string, string>,
      ),
      userResponseSchemas: algorithms.map(
        (_algorithm, algorithmIndex) => algorithmPipelines[algorithmIndex].userResponseSchema,
      ),
      language,
    }),
  );
  if (!createBatchRpcFunctionResponse.ok) {
    throw createBatchRpcFunctionResponse.error;
  }
  const batchAlgorithmImplementationsRpcFunction = createBatchRpcFunctionResponse.data;

  // Creat callable batch function
  const batchAlgorithmImplementationsFn = async (
    implementationArgumentsByAlgorithmIndex: ImplementationArgumentsByAlgorithmIndex,
  ): Promise<Map<number, Record<Ticker, Action> | null>> => {
    const actionsByAlgorithmIndex = new Map<number, Record<Ticker, Action> | null>();

    const rpcInput: Record<number, unknown[]> = {};
    for (const [
      algorithmIndex,
      implementationArguments,
    ] of implementationArgumentsByAlgorithmIndex.entries()) {
      if (implementationArguments != null) {
        // Apply input transformation if provided
        rpcInput[algorithmIndex] =
          algorithmPipelines[algorithmIndex].inputTransformer?.(
            ...implementationArguments,
            algorithms[algorithmIndex],
          ) ?? implementationArguments;
      } else {
        actionsByAlgorithmIndex.set(Number(algorithmIndex), null);
      }
    }

    const userOutputByAlgorithmIndexResponse = await tryAsync(() =>
      batchAlgorithmImplementationsRpcFunction(rpcInput),
    );
    if (!userOutputByAlgorithmIndexResponse.ok) {
      throw userOutputByAlgorithmIndexResponse.error;
    }
    const userOutputByAlgorithmIndex = userOutputByAlgorithmIndexResponse.data;

    for (const [
      algorithmIndex,
      implementationArguments,
    ] of implementationArgumentsByAlgorithmIndex.entries()) {
      if (implementationArguments != null) {
        const actionsByTicker =
          algorithmPipelines[algorithmIndex].outputTransformer?.(
            userOutputByAlgorithmIndex[algorithmIndex],
            algorithms[algorithmIndex],
            implementationArguments[1],
          ) ?? (userOutputByAlgorithmIndex[algorithmIndex] as Record<Ticker, Action>);

        actionsByAlgorithmIndex.set(Number(algorithmIndex), actionsByTicker);
      }
    }
    return actionsByAlgorithmIndex;
  };
  batchAlgorithmImplementationsFn.end = batchAlgorithmImplementationsRpcFunction.end;
  return batchAlgorithmImplementationsFn;
}

export async function getBatchAlgorithmImplementationsDefaultFunction(
  algorithms: Algorithm[],
): Promise<BatchAlgorithmImplementationsFn> {
  return async (
    implementationArgumentsByAlgorithmIndex: ImplementationArgumentsByAlgorithmIndex,
  ): Promise<Map<number, Record<Ticker, Action> | null>> => {
    return new Map<number, Record<Ticker, Action> | null>(
      // structure returned by Promise.all is [algorithmIndex: number, actions: Record<Ticker, Action> | null][]
      await Promise.all(
        [...implementationArgumentsByAlgorithmIndex.entries()].map(
          async ([algorithmIndex, params]) => {
            const algorithm = algorithms[algorithmIndex];
            if (params != null) {
              return [algorithmIndex, await algorithm.implementation(...params)] as [
                number,
                Record<Ticker, Action>,
              ];
            } else {
              return [algorithmIndex, null] as [number, Record<Ticker, Action> | null];
            }
          },
        ),
      ),
    );
  };
}
