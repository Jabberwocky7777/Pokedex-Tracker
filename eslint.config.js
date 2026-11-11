import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // .claude holds local worktree copies of the repo; ios is the Capacitor build output
  globalIgnores(["dist", ".claude", "ios"]),
  {
    files: ["**/*.{ts,tsx}"],
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
    rules: {
      // `const { dropped: _x, ...kept } = obj` is how a field is left out of a copy
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  // The app itself: type-aware rules, mainly for promises that are never
  // awaited or are passed where a void callback is expected (sync, storage).
  // (eslint-plugin-jsx-a11y would go here too, once it supports ESLint 10.)
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      // An async onClick is fine: React ignores the promise. Everywhere else a
      // promise passed where nothing awaits it is reported.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      // zustand selectors hand out store actions, which don't use `this`
      "@typescript-eslint/unbound-method": "off",
    },
  },
  // Tests read JSON and build fakes on purpose
  {
    files: ["src/**/__tests__/**", "src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
  // Plain JavaScript: Node scripts and configs (ES modules)…
  {
    files: ["**/*.{js,mjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    // A leading underscore marks a parameter that has to be there (Express
    // tells an error handler by its four parameters)
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  // …the sync server (CommonJS)…
  {
    files: ["sync-server/**/*.js"],
    languageOptions: { sourceType: "commonjs" },
  },
  // …and the one script the page loads before the app
  {
    files: ["public/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
  },
]);
