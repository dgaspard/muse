module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  ignorePatterns: ["node_modules", ".next", "out", "coverage"],
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      env: {
        jest: true
      }
    }
  ]
};
