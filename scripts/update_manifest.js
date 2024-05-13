#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../manifest.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

manifest.version = process.argv[2];

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
