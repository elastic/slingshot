module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    '@elastic/eslint-config-kibana'
  ],
  plugins: [
    "@typescript-eslint",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module"
  },
  rules: {
    "prettier/prettier": ["error", { singleQuote: true }],
  }
};
