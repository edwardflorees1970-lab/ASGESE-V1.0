import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-autofocus': 'error',
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // The legacy screens predate strict boundary typing. Keep the debt visible
    // through typecheck/tests while preventing it from blocking CI. New modules
    // remain covered by typescript-eslint's recommended no-explicit-any rule.
    files: [
      'src/pages/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/lib/adminApi.ts',
      'src/lib/appConfig.ts',
      'src/lib/dynamicHeader.ts',
      'src/lib/pdf/**/*.ts',
      'supabase/functions/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/app/*Provider.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
