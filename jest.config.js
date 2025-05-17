/** @type {import('jest').Config} */
const config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: ["worker"],
  },
  rootDir: "src",
  modulePaths: ["<rootDir>"],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
};

export default config;
