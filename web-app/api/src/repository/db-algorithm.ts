import type { tickers, Timestamp, UserTicker } from '@api/fetch/types';
import {
  AlgorithmType as DbAlgorithmType,
  SupportedLanguage as DbSupportedLanguage,
  Timestamp as DbTimestamp,
} from '@api/generated/prisma/enums';
import type { AlgorithmModel } from '@api/generated/prisma/models';
import { prisma } from '@api/lib/prisma';
import { badRequest, fromThrowableAsync, internal, type AppError } from '@api/utils/error-handling';
import {
  AlgorithmType,
  getTickers,
  type AnyUserAlgorithmType,
  type Indicator,
  type SupportedLanguage,
  type UserAlgorithm,
  type UserSimpleAlgorithm,
  type UserTopKAlgorithm,
} from '@shared/worker';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

export function convertTimestampToDbTimestamp(timestamp: Timestamp): DbTimestamp {
  switch (timestamp) {
    case '1min':
      return DbTimestamp.min1;
    case '5min':
      return DbTimestamp.min5;
    case '15min':
      return DbTimestamp.min15;
    case '30min':
      return DbTimestamp.min30;
    case '60min':
      return DbTimestamp.min60;
    default: {
      const _exhaustiveCheck: never = timestamp;
      return _exhaustiveCheck;
    }
  }
}

export function convertDbTimestampToTimestamp(timestamp: DbTimestamp): Timestamp {
  switch (timestamp) {
    case DbTimestamp.min1:
      return '1min';
    case DbTimestamp.min5:
      return '5min';
    case DbTimestamp.min15:
      return '15min';
    case DbTimestamp.min30:
      return '30min';
    case DbTimestamp.min60:
      return '60min';
    default: {
      const _exhaustiveCheck: never = timestamp;
      return _exhaustiveCheck;
    }
  }
}

function convertAlgorithmTypeToDbAlgorithmType(algorithmType: AlgorithmType): DbAlgorithmType {
  switch (algorithmType) {
    case AlgorithmType.NORMAL:
      return DbAlgorithmType.NORMAL;
    case AlgorithmType.SIMPLE:
      return DbAlgorithmType.SIMPLE;
    case AlgorithmType.TOP_K:
      return DbAlgorithmType.TOP_K;
    default: {
      const _exhaustiveCheck: never = algorithmType;
      return _exhaustiveCheck;
    }
  }
}

function convertDbAlgorithmTypeToAlgorithmType(dbAlgorithmType: DbAlgorithmType): AlgorithmType {
  switch (dbAlgorithmType) {
    case DbAlgorithmType.NORMAL:
      return AlgorithmType.NORMAL;
    case DbAlgorithmType.SIMPLE:
      return AlgorithmType.SIMPLE;
    case DbAlgorithmType.TOP_K:
      return AlgorithmType.TOP_K;
    default: {
      const _exhaustiveCheck: never = dbAlgorithmType;
      return _exhaustiveCheck;
    }
  }
}

function convertSupportedLanguageToDbSupportedLanguage(
  supportedLanguage: SupportedLanguage,
): DbSupportedLanguage {
  switch (supportedLanguage) {
    case 'cpp':
      return DbSupportedLanguage.cpp;
    case 'javascript':
      return DbSupportedLanguage.javascript;
    case 'python':
      return DbSupportedLanguage.python;
    case 'typescript':
      return DbSupportedLanguage.typescript;
    default: {
      const _exhaustiveCheck: never = supportedLanguage;
      return _exhaustiveCheck;
    }
  }
}

function convertDbSupportedLanguageToSupportedLanguage(
  dbSupportedLanguage: DbSupportedLanguage,
): SupportedLanguage {
  switch (dbSupportedLanguage) {
    case DbSupportedLanguage.cpp:
      return 'cpp';
    case DbSupportedLanguage.javascript:
      return 'javascript';
    case DbSupportedLanguage.python:
      return 'python';
    case DbSupportedLanguage.typescript:
      return 'typescript';
    default: {
      const _exhaustiveCheck: never = dbSupportedLanguage;
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
        tickers: dbAlgorithm.tickers as (typeof tickers)[number][],
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
