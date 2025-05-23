import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin/cli.ts"],
  sourcemap: true,
  clean: true,
  format: ["esm"],
  target: "node20",
  dts: true,
  noExternal: [/^@ironvault\/[^/]+($|\/)/],
  external: ["yaml"],
});
