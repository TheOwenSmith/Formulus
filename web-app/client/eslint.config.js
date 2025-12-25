import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sortKeysFix from 'eslint-plugin-sort-keys';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      'sort-keys-fix': sortKeysFix,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Clean code
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
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
