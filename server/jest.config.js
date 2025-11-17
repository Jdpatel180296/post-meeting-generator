module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: ["**/*.js", "!**/node_modules/**", "!**/db/migrations/**"],
  coveragePathIgnorePatterns: ["/node_modules/", "/db/migrations/"],
};
