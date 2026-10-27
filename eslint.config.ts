import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'public/hub/**'] },
  {
    files: ['public/**/*.{js,mjs,cjs}', 'hub/**/*.{js,mjs,cjs}', 'tools/**/*.{js,mjs,cjs}'],
    rules: { 'no-restricted-syntax': ['error', { selector: 'Program', message: 'Maintain production sources in TypeScript; JavaScript belongs in generated dist output.' }] },
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { reportUnusedDisableDirectives: 'error', noInlineConfig: true },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false }],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ClassDeclaration', message: 'Use functions and explicit Effect services instead of classes.' },
        { selector: 'ClassExpression', message: 'Use functions and explicit Effect services instead of classes.' },
        { selector: 'ThisExpression', message: 'Pass dependencies and state explicitly.' },
        { selector: 'Property[kind="set"]', message: 'Represent state transitions explicitly with immutable Effect Ref updates.' },
      ],
    },
  },
);
