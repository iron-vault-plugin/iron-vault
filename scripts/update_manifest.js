#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, '../manifest.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

manifest.version = process.argv[2];

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
