module.exports = {
  root: true,
  ignorePatterns: [
    'dist/',
    'build/',
    'node_modules/',
    'coverage/',
    '.firebase/',
    'functions/lib/',
    'public/firebase-messaging-sw.js',
  ],
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
      plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
      extends: [
        'eslint:recommended',
      ],
      rules: {
        // Keep baseline permissive for legacy codebase; tighten incrementally.
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-undef': 'off',
        'no-empty': 'off',
        'no-extra-semi': 'off',
      },
    },
    {
      files: ['**/*.{js,cjs,mjs}'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
      extends: ['eslint:recommended'],
      rules: {
        'no-empty': 'off',
        'no-extra-semi': 'off',
      },
    },
  ],
}
