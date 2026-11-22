import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Node scripts (balance runner).
    files: ['scripts/**/*.mjs', 'assets/author/**/*.mjs'],
    languageOptions: {
      globals: { URL: 'readonly', process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'sim must not import Phaser.' },
            { group: ['preact', 'preact/*', '@preact/*'], message: 'sim must not import Preact.' },
            {
              group: ['**/view', '**/view/*', '**/ui', '**/ui/*', '**/platform', '**/platform/*'],
              message: 'sim must not import view/ui/platform code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'self'].map(
          (name) => ({ name, message: 'sim must stay DOM-free.' }),
        ),
      ],
    },
  },
);
