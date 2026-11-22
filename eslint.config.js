import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Reglas de frontera (sección 4.1 del plan maestro, lado API):
 *  1. Solo `config/firebase.ts` importa `firebase-admin`.
 *  2. Solo `ambulances.store.ts` (y, en la Fase 3, `kpis/load-alertas.ts`) y `server.ts`
 *     importan `config/firebase`. El resto trabaja con los puertos de `domain/puertos.ts`.
 */
const ADMIN = {
  group: ['firebase-admin', 'firebase-admin/*'],
  message: 'Solo src/config/firebase.ts importa firebase-admin.',
};
const CONFIG_FIREBASE = {
  group: ['**/config/firebase', '**/config/firebase.js'],
  message: 'Solo los stores (ambulances.store.ts, load-alertas.ts) y server.ts importan config/firebase. Usa los puertos de domain/puertos.ts.',
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': ['error', { patterns: [ADMIN, CONFIG_FIREBASE] }],
    },
  },
  {
    files: ['src/modules/ambulances/ambulances.store.ts', 'src/modules/kpis/load-alertas.ts', 'src/server.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [ADMIN] }] },
  },
  { files: ['src/config/firebase.ts'], rules: { 'no-restricted-imports': 'off' } },
);
