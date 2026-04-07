import type { UserTicker } from '@api/fetch/types';
import { prisma } from '@api/lib/prisma';
import {
  badRequest,
  fromThrowableAsync,
  internal,
  isPrismaUniqueConstraintError,
  type AppError,
} from '@api/utils/error-handling';
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

function dbAlgorithmToUserAlgorithm(
  dbAlgorithm: AlgorithmModel,
): AnyUserAlgorithmType & { id: string; updatedAt: Date } {
  const base = {
    id: dbAlgorithm.id,
    updatedAt: dbAlgorithm.updatedAt,
  };
  switch (dbAlgorithm.type) {
    case DbAlgorithmType.NORMAL:
      return {
        ...base,
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        language: convertDbSupportedLanguageToSupportedLanguage(dbAlgorithm.language),
        name: dbAlgorithm.name,
        tickers: dbAlgorithm.tickers as UserTicker[],
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type) as AlgorithmType.NORMAL,
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      } satisfies UserAlgorithm & { id: string; updatedAt: Date };
    case DbAlgorithmType.SIMPLE:
      return {
        ...base,
        aggregate: convertDbTimestampToTimestamp(dbAlgorithm.aggregate),
        algorithmMaxHoldingProportion: dbAlgorithm.algorithmMaxHoldingProportion ?? undefined,
        contextLength: dbAlgorithm.contextLength,
        indicators: dbAlgorithm.indicators as Indicator[],
        language: convertDbSupportedLanguageToSupportedLanguage(dbAlgorithm.language),
        name: dbAlgorithm.name,
        ticker: dbAlgorithm.tickers[0] as UserTicker,
        type: convertDbAlgorithmTypeToAlgorithmType(dbAlgorithm.type) as AlgorithmType.SIMPLE,
        userAlgorithmImplementationCode: dbAlgorithm.userAlgorithmImplementationCode,
      } satisfies UserSimpleAlgorithm & { id: string; updatedAt: Date };
    case DbAlgorithmType.TOP_K:
      return {
        ...base,
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
      } satisfies UserTopKAlgorithm & { id: string; updatedAt: Date };
    default: {
      const _exhaustiveCheck: never = dbAlgorithm.type;
      return _exhaustiveCheck;
    }
  }
}

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
    (e) =>
      isPrismaUniqueConstraintError(e)
        ? badRequest('An algorithm with that name already exists')
        : internal(e),
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
  return ok(dbAlgorithmToUserAlgorithm(dbAlgorithm));
}

export async function getAlgorithmByIdForCreator(
  id: string,
  creatorId: string,
): Promise<Result<(AnyUserAlgorithmType & { id: string }) | null, AppError>> {
  const getResult = await fromThrowableAsync(
    () => prisma.algorithm.findFirst({ where: { id, creatorId } }),
    (e) => internal(e),
  );
  if (getResult.isErr()) return err(getResult.error);
  if (getResult.value == null) return ok(null);
  return ok(dbAlgorithmToUserAlgorithm(getResult.value));
}

export async function updateAlgorithmCode({
  id,
  code,
  creatorId,
}: {
  id: string;
  code: string;
  creatorId: string;
}): Promise<Result<void, AppError>> {
  const updateResult = await fromThrowableAsync(
    () =>
      prisma.algorithm.updateMany({
        data: { userAlgorithmImplementationCode: code },
        where: { creatorId, id },
      }),
    (e) => internal(e, 'Failed to update algorithm code'),
  );
  if (updateResult.isErr()) return err(updateResult.error);
  if (updateResult.value.count === 0) return err(badRequest('Algorithm not found'));
  return ok(undefined);
}

export async function getAlgorithmsByCreatorId(
  creatorId: string,
): Promise<Result<Array<AnyUserAlgorithmType & { id: string; updatedAt: Date }>, AppError>> {
  const getDbAlgorithmsResult = await fromThrowableAsync(
    () =>
      prisma.algorithm.findMany({
        orderBy: { createdAt: 'desc' },
        where: { creatorId },
      }),
    (e) => internal(e, 'Failed to load algorithms'),
  );
  if (getDbAlgorithmsResult.isErr()) {
    return err(getDbAlgorithmsResult.error);
  }
  return ok(getDbAlgorithmsResult.value.map(dbAlgorithmToUserAlgorithm));
}

export async function updateAlgorithmIndicators({
  id,
  indicators,
  creatorId,
}: {
  id: string;
  indicators: Indicator[];
  creatorId: string;
}): Promise<Result<void, AppError>> {
  const updateResult = await fromThrowableAsync(
    () =>
      prisma.algorithm.updateMany({
        data: { indicators },
        where: { creatorId, id },
      }),
    (e) => internal(e, 'Failed to update algorithm indicators'),
  );
  if (updateResult.isErr()) return err(updateResult.error);
  if (updateResult.value.count === 0) return err(badRequest('Algorithm not found'));
  return ok(undefined);
}

export async function deleteAlgorithmByIdForCreator({
  id,
  creatorId,
}: {
  id: string;
  creatorId: string;
}): Promise<Result<void, AppError>> {
  const deleteResult = await fromThrowableAsync(
    () => prisma.algorithm.deleteMany({ where: { id, creatorId } }),
    (e) => internal(e, 'Failed to delete algorithm'),
  );
  if (deleteResult.isErr()) return err(deleteResult.error);
  if (deleteResult.value.count === 0) return err(badRequest('Algorithm not found'));
  return ok(undefined);
}
