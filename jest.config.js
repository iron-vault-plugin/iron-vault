/** @type {import('jest').Config} */
const config = {
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  testEnvironment: "jsdom",
  rootDir: "src",
  modulePaths: ["<rootDir>"],
};

export default config;
