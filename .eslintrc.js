module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Frontend code uses `any` extensively in API response handlers and event types.
    '@typescript-eslint/no-explicit-any': 'off',
    // Hungarian UI strings frequently contain characters that trigger this rule.
    'react/no-unescaped-entities': 'off',
    // Unused vars: errors for named exports, ignore args/vars starting with _
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    // Hook deps: off — many components intentionally omit stable callbacks (load functions)
    'react-hooks/exhaustive-deps': 'off',
    // Alt-text: off — Lucide icon components named 'Image' trigger false positives
    'jsx-a11y/alt-text': 'off',
  },
};
