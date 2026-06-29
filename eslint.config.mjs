import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".next/**", "coverage/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/lib/db/schema.ts", "src/proxy.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSIndexedAccessType[object.type='TSTypeQuery'][object.exprName.property.name='enumValues']",
          message:
            "SSoT Drift Detected: Do not infer database enum types locally. Import the exported type from @/lib/db/schema instead.",
        },
      ],
    },
  },
  {
    // Service worker uses WebWorker lib — typecheck against tsconfig.sw.json
    files: ["src/sw.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["tsconfig.sw.json"],
      },
    },
  },
);
