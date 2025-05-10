/** @type {import('jest').Config} */
const config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  testEnvironment: "node",
  rootDir: "src",
  modulePaths: ["<rootDir>"],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
};

export default config;
