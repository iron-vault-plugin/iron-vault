import { defineConfig } from "tsup";

export default defineConfig((config) => ({
  entry: ["src/bin/cli.ts"],
  minify: !config.watch,
  sourcemap: true,
  clean: true,
  format: ["esm"],
  target: "node20",
  experimentalDts: true,
  noExternal: [/^@ironvault\/[^/]+($|\/)/],
  external: ["yaml"],
  banner: ({ format }) => {
    if (format === "esm")
      return {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
      };
    return {};
  },
}));
