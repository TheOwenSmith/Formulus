import { UserTicker } from '@shared/api';
import { AlgorithmType as DbAlgorithmType } from '@shared/generated/prisma/enums';
import { AlgorithmVersionModel } from '@shared/generated/prisma/models';
import {
  AlgorithmType,
  AnyUserAlgorithmType,
  Indicator,
  UserSimpleAlgorithm,
  UserTopKAlgorithm,
} from '@shared/worker';
import { convertSupportedLanguageToDbSupportedLanguage } from './language';
import { convertDbTimestampToTimestamp } from './timestamp';

export function convertAlgorithmVersionToUserAlgorithm(
  version: AlgorithmVersionModel,
): AnyUserAlgorithmType {
  const base = {
    aggregate: convertDbTimestampToTimestamp(version.aggregate),
    algorithmMaxHoldingProportion: version.algorithmMaxHoldingProportion ?? undefined,
    contextLength: version.contextLength,
    indicators: version.indicators as Indicator[],
    language: convertSupportedLanguageToDbSupportedLanguage(version.language),
    name: version.name,
    userAlgorithmImplementationCode: version.userAlgorithmImplementationCode,
  };

  switch (version.type) {
    case DbAlgorithmType.NORMAL:
      return {
        ...base,
        tickers: version.tickers as UserTicker[],
        type: AlgorithmType.NORMAL,
      };
    case DbAlgorithmType.SIMPLE:
      return {
        ...base,
        ticker: version.tickers[0] as UserTicker,
        type: AlgorithmType.SIMPLE,
      } satisfies UserSimpleAlgorithm;
    case DbAlgorithmType.TOP_K:
      return {
        ...base,
        k: version.k!,
        tickers: version.tickers as UserTicker[],
        type: AlgorithmType.TOP_K,
      } satisfies UserTopKAlgorithm;
    default: {
      const _exhaustive: never = version.type;
      return _exhaustive;
    }
  }
}
