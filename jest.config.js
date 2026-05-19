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
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
};
