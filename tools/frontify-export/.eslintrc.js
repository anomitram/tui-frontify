// One-off Node migration scripts (export, capture, verification) - not shipped to the site.
module.exports = {
  env: { node: true, browser: false },
  rules: {
    'no-console': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'no-continue': 'off',
    'import/no-dynamic-require': 'off',
    'global-require': 'off',
    'max-len': ['error', { code: 140 }],
    'no-nested-ternary': 'off',
    'no-promise-executor-return': 'off',
  },
};
