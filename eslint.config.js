import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * The point of this config is the rules TypeScript cannot check.
 *
 * `tsc --noEmit` already passes on code that calls a hook inside a condition,
 * or that reads a value in an effect without listing it as a dependency — the
 * two mistakes this codebase is most exposed to, given how much hand-written
 * effect and memo logic lives in the booking flow. Those two rules are errors
 * here, not warnings, so CI and the pre-commit habit actually stop them.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'supabase/.temp'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Fast Refresh only works when a module exports components and nothing
      // else; a stray constant export silently turns edits into full reloads.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // `_zone`-style names are how this codebase drops a destructured value on
      // purpose — that is intent, not an oversight.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // The catch blocks around Supabase and localStorage are deliberate: a
      // backend hiccup must never take the booking form down with it.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // The Deno edge function has its own globals and never runs in the browser.
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: { globals: { Deno: 'readonly' } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
