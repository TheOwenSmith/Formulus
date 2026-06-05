import {
  LANGUAGES,
  SUPPORTED_LANGUAGE_VALUES,
  type SupportedLanguage,
} from '@shared/constants/trading';
import { config } from '@worker/lib/config';
import { RUNNER_CPP_BATCHED_FROM_FILENAMES, UTILS_CPP_CODE, UTILS_CPP_HEADER } from './cpp';
import { RUNNER_JS_BATCHED_FROM_FILENAMES, UTILS_JS_CODE } from './javascript';
import { RUNNER_PY_BATCHED_FROM_FILENAMES, UTILS_PY_CODE } from './python';
import { RUNNER_TS_BATCHED_FROM_FILENAMES, UTILS_TS_CODE } from './typescript';

export const supportedLanguages = SUPPORTED_LANGUAGE_VALUES;
export type { SupportedLanguage };

export const EXTENSION_BY_LANGUAGE: Record<SupportedLanguage, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.value, l.ext.replace(/^\./, '')]),
) as Record<SupportedLanguage, string>;

export function getImageForLanguage(language: SupportedLanguage): string {
  if (config.env === 'dev') {
    const devImages: Record<SupportedLanguage, string> = {
      cpp: 'formulus:cpp',
      javascript: 'node:24-slim',
      python: 'python:3.12-slim',
      typescript: 'formulus:typescript',
    };
    return devImages[language];
  }
  const registry = config.getDeployKey('ECR_REGISTRY');
  const tag = config.env === 'prod' ? 'latest' : 'staging';
  const deployImages: Record<SupportedLanguage, string> = {
    cpp: `${registry}/formulus-runner-cpp:${tag}`,
    javascript: 'node:24-slim',
    python: 'python:3.12-slim',
    typescript: `${registry}/formulus-runner-typescript:${tag}`,
  };
  return deployImages[language];
}

export const START_COMMAND_BY_LANGUAGE: Record<SupportedLanguage, string[]> = {
  cpp: [
    'sh',
    '-c',
    'cd /sandbox && (g++ -std=c++17 -fno-verbose-asm -o /app/runner /sandbox/runner.cpp /sandbox/utils.cpp $(ls /sandbox/*.cpp | grep -v runner.cpp | grep -v utils.cpp | tr "\\n" " ") 2>&1 || (echo "COMPILATION_FAILED" >&2 && exit 1)) && /app/runner',
  ],
  javascript: ['node', '/sandbox/runner.js'],
  python: ['python', '/sandbox/runner.py'],
  typescript: ['tsx', '/sandbox/runner.ts'],
};

export const RUNNER_CODE_FROM_LANGUAGE_AND_CODE_FILENAMES = (
  language: SupportedLanguage,
  codeFilenames: string[],
  files?: Record<string, string>,
): string => {
  switch (language) {
    case 'cpp':
      return RUNNER_CPP_BATCHED_FROM_FILENAMES(codeFilenames, files);
    case 'javascript':
      return RUNNER_JS_BATCHED_FROM_FILENAMES(codeFilenames);
    case 'python':
      return RUNNER_PY_BATCHED_FROM_FILENAMES(codeFilenames);
    case 'typescript':
      return RUNNER_TS_BATCHED_FROM_FILENAMES(codeFilenames);
    default: {
      const _exhaustiveCheck: never = language;
      return _exhaustiveCheck;
    }
  }
};

export const UTILS_CODE_FROM_LANGUAGE: Record<SupportedLanguage, string> = {
  cpp: UTILS_CPP_CODE,
  javascript: UTILS_JS_CODE,
  python: UTILS_PY_CODE,
  typescript: UTILS_TS_CODE,
};

export const UTILS_HEADER_FROM_LANGUAGE: Partial<Record<SupportedLanguage, string>> = {
  cpp: UTILS_CPP_HEADER,
};
