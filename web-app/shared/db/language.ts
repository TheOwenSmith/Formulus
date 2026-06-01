import { type SupportedLanguage } from '@shared/constants/trading';
import { SupportedLanguage as DbSupportedLanguage } from '@shared/generated/prisma/enums';

export function convertSupportedLanguageToDbSupportedLanguage(
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

export function convertDbSupportedLanguageToSupportedLanguage(
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
