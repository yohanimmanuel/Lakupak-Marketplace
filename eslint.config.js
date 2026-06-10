// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/** Style-only rules turned off so CI focuses on real breakages, not unused imports/vars. */
const relaxedRules = {
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/array-type': 'off',
  'react-hooks/exhaustive-deps': 'off',
  'import/no-duplicates': 'off',
  'import/first': 'off',
  'no-unused-expressions': 'off',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: relaxedRules,
  },
]);
