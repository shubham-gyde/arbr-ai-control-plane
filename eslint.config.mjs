import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ...js.configs.recommended,
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    ignores: ["web/**", "docs/**", "clients/**"],
  },
];
