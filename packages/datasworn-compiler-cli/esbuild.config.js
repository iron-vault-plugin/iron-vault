import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/bin/cli.ts"],
  bundle: true,
  platform: "node",
  target: ["node20"],
  outdir: "dist",
  format: "esm",
  sourcemap: true,
  external: ["node:process"],
});
