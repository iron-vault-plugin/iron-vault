import builtins from "builtin-modules";
import esbuild from "esbuild";
import process from "process";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

const ASSETS = ["styles.css", "manifest.json"];

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: ["src/index.ts"],
  bundle: true,
  external: [
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
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: prod ? "main.js" : "test-vault/.obsidian/plugins/forged/main.js",
  // plugins: prod
  //   ? []
  //   : [
  //       copy({
  //         // resolveFrom: "cwd",
  //         verbose: true,
  //         assets: ASSETS.map((filename) => ({
  //           from: filename,
  //           to: filename,
  //         })),
  //         watch: true,
  //       }),
  //     ],
});

const cssCtx = await esbuild.context({
  entryPoints: ["src/styles.css"],
  bundle: true,
  sourcemap: prod ? false : "inline",
  outfile: prod
    ? "styles.css"
    : "test-vault/.obsidian/plugins/forged/styles.css",
  loader: {
    ".svg": "dataurl",
  },
});

if (prod) {
  await Promise.all([context.rebuild(), cssCtx.rebuild()]);
  process.exit(0);
} else {
  await Promise.all([context.watch(), cssCtx.watch()]);
}
