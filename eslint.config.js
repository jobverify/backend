import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/.cache/**', '**/fixtures/**', '**/tests/**', '**/*.test.js'] },
  { files: ['*.js', 'src/**/*.js', 'db/**/*.js', 'scripts/**/*.js', 'scraper-support/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { ...js.configs.recommended.rules,
      // Unused declarations are introduced gradually; runtime defects fail CI now.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // These patterns intentionally remove control bytes from scraped input.
      'no-control-regex': 'off',
      'no-useless-escape': 'warn',
      'no-useless-catch': 'warn',
      'no-regex-spaces': 'warn',
      'no-useless-assignment': 'warn',
    },
  },
  // Browser callbacks in collectors and Playwright scripts execute in a DOM
  // realm. Ordinary API/database modules must still reject browser-only globals.
  { files: ['scripts/**/*.js', 'scraper-support/**/*.js', 'src/services/autoApplyBrowser.js'],
    languageOptions: { globals: globals.browser },
  },
];
