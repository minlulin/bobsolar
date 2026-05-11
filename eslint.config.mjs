import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '*.config.*',
    'drizzle.config.ts',
    'drizzle.test.config.ts',
    'vitest.config.mts',
    'postcss.config.mjs',
    'src/sw.ts',
  ]),
  // Strict TypeScript type-checked rules.
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ── CORE: Zero tolerance for `any` ──────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // ── CORE: Non-null assertions banned ─────────────────────────────────
      '@typescript-eslint/no-non-null-assertion': 'error',

      // ── CORE: Deprecated API usage ──────────────────────────────────────
      '@typescript-eslint/no-deprecated': 'error',

      // ── CORE: Template expression safety (allow numbers) ────────────────
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],

      // ── CORE: Condition safety ──────────────────────────────────────────
      '@typescript-eslint/no-unnecessary-condition': 'error',

      // ── CORE: Catch clause safety ───────────────────────────────────────
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

      // ── CORE: Type conversion safety ────────────────────────────────────
      '@typescript-eslint/no-unnecessary-type-conversion': 'error',

      // ── UNUSED VARS ─────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],

      // ── IMPORT ──────────────────────────────────────────────────────────
      'import/no-anonymous-default-export': 'warn',

      // ── MAXIMUM STRICTNESS ──────────────────────────────────────────────
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
    },
  },
]);

export default eslintConfig;