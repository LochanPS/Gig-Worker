// Root ESLint config. The repo shipped `pnpm lint` and `pnpm format` scripts with
// eslint and prettier in devDependencies but no config file, so neither could run.
// Deliberately non-type-aware: it stays fast enough to run on every commit, and
// tsc --noEmit (pnpm typecheck, also in CI) already covers type correctness.
module.exports = {
  root: true,
  env: { node: true, es2022: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '**/*.d.ts',
    'contracts/lib', // vendored forge-std + openzeppelin
    'contracts/out',
    'variants', // preserved lineages, outside the pnpm workspace (CONSOLIDATION.md)
  ],
  rules: {
    // The codebase already annotates its deliberate `any`s with disable comments
    // at the Prisma boundary, so this stays on as a warning rather than an error.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      files: ['**/*.test.ts'],
      env: { node: true },
    },
  ],
};
