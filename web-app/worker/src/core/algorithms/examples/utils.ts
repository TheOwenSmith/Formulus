import type { AnyUserAlgorithmType } from '@worker/core/algorithms/user-algorithm';
import { supportedLanguages, type SupportedLanguage } from '@worker/core/backtesting/rpc/languages';

export function algorithmByLanguage<T extends AnyUserAlgorithmType>(
  algorithmBase: Omit<T, 'language' | 'userAlgorithmImplementationCode'>,
  implementationCodeByLanguage: Record<SupportedLanguage, string>,
): Record<SupportedLanguage, T> {
  return supportedLanguages.reduce(
    (acc: Record<SupportedLanguage, T>, language: SupportedLanguage) => {
      acc[language] = {
        ...algorithmBase,
        language,
        userAlgorithmImplementationCode: implementationCodeByLanguage[language],
      } as T;
      return acc;
    },
    {} as Record<SupportedLanguage, T>,
  );
}
