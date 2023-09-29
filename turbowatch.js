import { watch } from "turbowatch";

const ASSETS = ["styles.css", "starforged.json", "manifest.json"];

void watch({
  project: __dirname,
  triggers: [
    {
      expression: [
        "allof",
        ["not", ["dirname", "node_modules"]],
        ["not", ["dirname", "test-vault"]],
        [
          "anyof",
          ["match", "*.ts", "basename"],
          ["match", "{.swcrc,tsconfig.json}", "wholename"],
        ],
      ],
      name: "type-check",
      onChange: async ({ spawn }) => {
        await spawn`tsc --noEmit`;
      },
      retry: { retries: 0 },
    },
    {
      expression: ["dirname", __dirname],
      // Marking this routine as non-interruptible will ensure that
      // next dev is not restarted when file changes are detected.
      interruptible: false,
      name: "esbuild",
      onChange: async ({ spawn }) => {
        await spawn`node esbuild.config.mjs`;
      },
      // Enabling this option modifies what Turbowatch logs and warns
      // you if your configuration is incompatible with persistent tasks.
      persistent: true,
    },
    {
      expression: ["match", `{${ASSETS.join(",")}}`, "wholename"],
      name: "copy-assets",
      onChange: async ({ spawn, files, first }) => {
        const assetsToCopy = first ? ASSETS : files.map((f) => f.name);
        await spawn`cp -v ${assetsToCopy} test-vault/.obsidian/plugins/forged/`;
      },
    },
  ],
});
