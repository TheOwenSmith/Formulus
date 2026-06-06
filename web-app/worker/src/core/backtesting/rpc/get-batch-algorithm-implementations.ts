import type { Action, Algorithm } from '@shared/constants/algorithm';
import type { IndicatorResultByIndicator } from '@shared/constants/indicators/indicator';
import type { Bar, Ticker } from '@shared/constants/trading';
import type { AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import type { AppError } from '@shared/utils/error-handling';
import {
  getAlgorithmPipelinesFromUserAlgorithms,
  type UserAlgorithmPipeline,
} from '@worker/core/algorithms/pipeline';
import { err, ok, Result } from 'neverthrow';
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
) => Promise<Result<Map<number, Record<Ticker, Action> | null>, AppError>>) & {
  end?: () => Promise<Result<undefined, AppError>>;
};

export async function getBatchAlgorithmImplementationsRpcFunction(
  algorithms: AnyUserAlgorithmType[],
  language: SupportedLanguage,
): Promise<Result<BatchAlgorithmImplementationsFn, AppError>> {
  // Get algorithm pipelines
  const algorithmPipelines: UserAlgorithmPipeline[] =
    getAlgorithmPipelinesFromUserAlgorithms(algorithms);

  // Create RPC function
  const createBatchRpcFunctionResponse = await createBatchRpcFunctionFromUserCode<
    Record<number, unknown[]>,
    Record<number, unknown>
  >({
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
  });
  if (createBatchRpcFunctionResponse.isErr()) {
    return err(createBatchRpcFunctionResponse.error);
  }
  const batchAlgorithmImplementationsRpcFunction = createBatchRpcFunctionResponse.value;

  // Creat callable batch function
  const batchAlgorithmImplementationsFn = async (
    implementationArgumentsByAlgorithmIndex: ImplementationArgumentsByAlgorithmIndex,
  ): Promise<Result<Map<number, Record<Ticker, Action> | null>, AppError>> => {
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

    const userOutputByAlgorithmIndexResponse =
      await batchAlgorithmImplementationsRpcFunction(rpcInput);
    if (userOutputByAlgorithmIndexResponse.isErr()) {
      return err(userOutputByAlgorithmIndexResponse.error);
    }
    const userOutputByAlgorithmIndex = userOutputByAlgorithmIndexResponse.value;

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
    return ok(actionsByAlgorithmIndex);
  };
  batchAlgorithmImplementationsFn.end = batchAlgorithmImplementationsRpcFunction.end;
  return ok(batchAlgorithmImplementationsFn);
}

export async function getBatchAlgorithmImplementationsDefaultFunction(
  algorithms: Algorithm[],
): Promise<BatchAlgorithmImplementationsFn> {
  return async (
    implementationArgumentsByAlgorithmIndex: ImplementationArgumentsByAlgorithmIndex,
  ): Promise<Result<Map<number, Record<Ticker, Action> | null>, AppError>> => {
    return ok(
      new Map<number, Record<Ticker, Action> | null>(
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
      ),
    );
  };
}
