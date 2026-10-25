import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude holds local worktree copies of the repo; ios is the Capacitor build output
  globalIgnores(['dist', '.claude', 'ios']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Plain JavaScript: Node scripts and configs (ES modules)…
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    // A leading underscore marks a parameter that has to be there (Express
    // tells an error handler by its four parameters)
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  // …the sync server (CommonJS)…
  {
    files: ['sync-server/**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  // …and the one script the page loads before the app
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
])
