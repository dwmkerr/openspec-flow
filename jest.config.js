module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/tests/**/*.test.ts",
  ],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts"],
  // Strip `.js` extensions added for Node16 ESM-style imports so ts-jest can resolve.
  // Also redirect `jose` to its CJS build — the ESM-default entry can't be required
  // by ts-jest's CJS transform, but the CJS bundle is shipped alongside.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  // Scrub GitHub Actions env so status-comment bodies render
  // deterministically whether tests run locally or in CI.
  setupFiles: ["<rootDir>/jest.setup.ts"],
};
