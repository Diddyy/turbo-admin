import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The same code style as nitro-next (4-space indent, single quotes, semicolons, spaced array
 * brackets), so the hotel's two React codebases read alike.
 */
const stylisticConfig = stylistic.configs.customize({
    indent: 4,
    quotes: 'single',
    semi: true,
    jsx: true,
    arrowParens: false,
    braceStyle: '1tbs',
    blockSpacing: true,
    quoteProps: 'as-needed',
    commaDangle: 'always-multiline',
});

export default tseslint.config(
    { ignores: [ 'dist/**', 'node_modules/**', '**/*.d.ts', 'eslint.config.js', 'vite.config.ts', 'src/vendor/**' ] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    stylisticConfig,
    {
        files: [ 'src/**/*.{ts,tsx}' ],
        languageOptions: { globals: globals.browser },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
            'simple-import-sort': simpleImportSort,
            'unused-imports': unusedImports,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': [ 'warn', { allowConstantExport: true } ],
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'unused-imports/no-unused-imports': 'error',
            '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
            '@stylistic/jsx-one-expression-per-line': 'off',
        },
    },
);
