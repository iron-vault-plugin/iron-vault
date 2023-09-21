const { config } = require("@swc/core/spack");
const builtins = require("builtin-modules");

module.exports = config({
  entry: {
    main: __dirname + "/src/index.ts",
  },
  output: {
    path: __dirname,
  },
  target: "browser",
  module: {},
  externalModules: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
});
