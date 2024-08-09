#!/usr/bin/env node

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RELEASE_MANIFEST = resolve(__dirname, "../manifest.json");
const BETA_MANIFEST = resolve(__dirname, "../manifest-beta.json");

function writeManifest(destinationManifest, version) {
  const manifest = JSON.parse(readFileSync(RELEASE_MANIFEST, "utf8"));

  manifest.version = version;

  writeFileSync(destinationManifest, JSON.stringify(manifest, null, 2));
}

const mode = process.argv[2];
const version = process.argv[3];
if (mode == "release") {
  writeManifest(RELEASE_MANIFEST, version);
  rmSync(BETA_MANIFEST, { force: true });
} else if (mode == "beta") {
  writeManifest(BETA_MANIFEST, version);
} else {
  throw new Error(`What kind of mode is ${mode}?`);
}
