import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
  // Section boundaries (see CLAUDE.md): theory and practice never import each other.
  {
    files: ['src/features/practice/**/*.{ts,tsx}', 'src/routes/practice/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/features/theory/**', '**/routes/_theory/**'], message: 'Practice code must not import theory code. Shared code goes in components/ or musiclib.' }],
      }],
    },
  },
  {
    files: ['src/features/theory/**/*.{ts,tsx}', 'src/routes/_theory/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/features/practice/**', '**/routes/practice/**'], message: 'Theory code must not import practice code. Shared code goes in components/ or musiclib.' }],
      }],
    },
  },
  // The score engine and MIDI layer are plain TypeScript.
  {
    files: ['src/features/practice/engine/**/*.ts', 'src/features/practice/midi/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-dom', 'react/*', '@mui/*', 'opensheetmusicdisplay', 'opensheetmusicdisplay/*'], message: 'The engine and MIDI layer must not depend on React, MUI or OSMD.' },
          { group: ['**/features/theory/**'], message: 'Practice code must not import theory code.' },
        ],
      }],
    },
  },
])
