// @ts-check

import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import sortKeysFix from 'eslint-plugin-sort-keys';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { ignores: ['dist', 'node_modules', 'vendor'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      'sort-keys-fix': sortKeysFix,
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
      // Safety
      '@typescript-eslint/no-floating-promises': 'error',

      // Clean code
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all', // check all variables
          args: 'after-used', // check function arguments after used ones
          varsIgnorePattern: '^_', // ignore variables starting with _
          argsIgnorePattern: '^_', // ignore function args starting with _
        },
      ],

      // Import/Export rules
      'import/no-default-export': 'error',

      // Sorting
      'sort-keys-fix/sort-keys-fix': [
        'warn',
        'asc',
        { caseSensitive: false, natural: true, minKeys: 5 },
      ],
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
