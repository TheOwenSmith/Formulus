// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['dist', 'node_modules', 'generated', '*.config.{ts,mjs,js}'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    languageOptions: {
      ecmaVersion: 2024,
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        // tsConfigRootDir: process.cwd(),
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Import/Export rules
      'import/no-default-export': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // Block ../* imports
            {
              group: ['../*'],
              message: 'Use @shared/path/to/file instead of ../path/to/file',
            },
            // Block @client/* imports
            {
              group: ['@client/*'],
              message: 'Shared code cannot import from @client.',
            },
            // Block @api/* imports
            {
              group: ['@api/*'],
              message: 'Shared code cannot import from @api.',
            },
            // Block @worker/* imports
            {
              group: ['@worker/*'],
              message: 'Shared code cannot import from @worker.',
            },
          ],
        },
      ],
      'import/no-cycle': [
        'error',
        {
          maxDepth: Infinity,
          ignoreExternal: true,
        },
      ],
    },
  },
  {
    files: ['api.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['*.config.ts', '*.config.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  eslintConfigPrettier,
]);
