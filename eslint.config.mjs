import coreWebVitals from "eslint-config-next/core-web-vitals"
import typescript from "eslint-config-next/typescript"
import unusedImports from "eslint-plugin-unused-imports"

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
      "server-reference/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  // Legacy codebase: tighten these back to "error" over time (see .github/workflows/ci.yml).
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      // Prefer tightening gradually; `unknown` + narrowing is the long-term path.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      // Imports are auto-fixed; non-import unused bindings are very noisy in a large legacy app.
      "unused-imports/no-unused-vars": "off",
      // React Compiler plugin rules: re-enable and fix incrementally when refactoring components.
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      // Apostrophes/quotes in UI copy are common; escape only where it matters for a11y.
      "react/no-unescaped-entities": "off",
      "jsx-a11y/alt-text": "warn",
      "prefer-const": "warn",
      // Many screens use dynamic URLs or plain <img>; migrate to next/image per screen when stable.
      "@next/next/no-img-element": "off",
      // Dynamic requires in client libs and Leaflet shims; prefer ESM when touching those modules.
      "@typescript-eslint/no-require-imports": "off",
      // @ts-nocheck / @ts-expect-error still used in a few Leaflet/API edge files.
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
]

export default eslintConfig
