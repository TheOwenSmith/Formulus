import { type Indicator } from '@shared/constants/indicators/indicator';
import { AlgorithmType } from '@shared/constants/trading';
import { AlgorithmType as DbAlgorithmType } from '@shared/generated/prisma/enums';
import { type AlgorithmVersionModel } from '@shared/generated/prisma/models';
import { type AnyUserAlgorithmType } from '@shared/schemas/algorithms/user-algorithm';
import { type UserSimpleAlgorithm } from '@shared/schemas/algorithms/user-simple-algorithm';
import { type UserTopKAlgorithm } from '@shared/schemas/algorithms/user-top-k-algorithm';
import { type UserTicker } from '@shared/schemas/trading';
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
