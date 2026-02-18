import type { UserTicker } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
import { badRequest, fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import {
  convertAlgorithmTypeToDbAlgorithmType,
  convertDbAlgorithmTypeToAlgorithmType,
} from '@shared/db/algorithm';
import {
  convertDbSupportedLanguageToSupportedLanguage,
  convertSupportedLanguageToDbSupportedLanguage,
} from '@shared/db/language';
import { convertDbTimestampToTimestamp, convertTimestampToDbTimestamp } from '@shared/db/timestamp';
import { AlgorithmType as DbAlgorithmType } from '@shared/generated/prisma/enums';
import type { AlgorithmModel } from '@shared/generated/prisma/models';
import {
  AlgorithmType,
  getTickers,
  type AnyUserAlgorithmType,
  type Indicator,
  type UserAlgorithm,
  type UserSimpleAlgorithm,
  type UserTopKAlgorithm,
} from '@shared/worker';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

export async function uploadAlgorithm({
  algorithm,
  creatorId,
}: {
  algorithm: AnyUserAlgorithmType;
  creatorId: string;
}): Promise<Result<AlgorithmModel, AppError>> {
  if (algorithm.type === AlgorithmType.TOP_K && !('k' in algorithm)) {
    return err(
      badRequest('Failed to upload algorithm: k is required for TOP_K algorithms', 'BAD_REQUEST'),
    );
  }

  const createAlgorithmResult = await fromThrowableAsync(
    () =>
      prisma.algorithm.create({
        data: {
          aggregate: convertTimestampToDbTimestamp(algorithm.aggregate),
          algorithmMaxHoldingProportion: algorithm.algorithmMaxHoldingProportion,
          contextLength: algorithm.contextLength,
          creator: {
            connect: {
              id: creatorId,
            },
          },
          indicators: algorithm.indicators ?? [],
          k: 'k' in algorithm ? algorithm.k : undefined,
          language: convertSupportedLanguageToDbSupportedLanguage(algorithm.language),
          name: algorithm.name,
          tickers: getTickers(algorithm),
          type: convertAlgorithmTypeToDbAlgorithmType(algorithm.type),
          userAlgorithmImplementationCode: algorithm.userAlgorithmImplementationCode,
        },
      }),
    (e) => internal(e),
  );
  return createAlgorithmResult;
}

export async function retrieveAlgorithmById(
  id: string,
): Promise<Result<AnyUserAlgorithmType | null, AppError>> {
  const getDbAlgorithmResult = await fromThrowableAsync(
    () =>
      prisma.algorithm.findUnique({
        where: {
          id,
        },
      }),
    (e) => internal(e),
  );
  if (getDbAlgorithmResult.isErr()) {
    return err(getDbAlgorithmResult.error);
  }
  const dbAlgorithm = getDbAlgorithmResult.value;

  if (dbAlgorithm == null) {
    return ok(null);
  }
  switch (dbAlgorithm.type) {
    case DbAlgorithmType.NORMAL:
      return ok({
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        language: convertDbSupportedLanguageToSupportedLanguage(dbAlgorithm.language),
        name: dbAlgorithm.name,
        tickers: dbAlgorithm.tickers as UserTicker[],
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type) as AlgorithmType.NORMAL,
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      } satisfies UserAlgorithm);
    case DbAlgorithmType.SIMPLE:
      return ok({
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        language: convertDbSupportedLanguageToSupportedLanguage(dbAlgorithm.language),
        name: dbAlgorithm.name,
        ticker: dbAlgorithm.tickers[0] as UserTicker,
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type) as AlgorithmType.SIMPLE,
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      } satisfies UserSimpleAlgorithm);
    case DbAlgorithmType.TOP_K:
      return ok({
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        k: dbAlgorithm.k!,
        language: convertDbSupportedLanguageToSupportedLanguage(dbAlgorithm.language),
        name: dbAlgorithm.name,
        tickers: dbAlgorithm.tickers as UserTicker[],
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type) as AlgorithmType.TOP_K,
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      } satisfies UserTopKAlgorithm);
    default: {
      const _exhaustiveCheck: never = dbAlgorithm.type;
      return _exhaustiveCheck;
    }
  }
}
