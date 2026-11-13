// @ts-check
// ESLint 10 (flat config). Reglas recomendadas de typescript-eslint para el código del backend.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'src/generated/**', 'node_modules/**', 'coverage/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Parámetros o variables que empiezan con "_" se dejan sin usar a propósito.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // En las pruebas los mocks usan "any" a propósito.
    files: ['**/*.spec.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
