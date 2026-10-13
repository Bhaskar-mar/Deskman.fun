// Lint config for the browser game source (run: npx eslint src/game).
export default [
  {
    files: ['src/game/**/*.js'],
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', performance: 'readonly',
        requestAnimationFrame: 'readonly', setTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        ResizeObserver: 'readonly', IntersectionObserver: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error', 'no-unused-vars': ['error', {args: 'none', caughtErrors: 'none'}], 'no-redeclare': 'error',
      'no-dupe-keys': 'error', 'no-unreachable': 'error', 'eqeqeq': ['error', 'smart'], 'no-implicit-globals': 'error'
    }
  }
];
