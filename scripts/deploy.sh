#!/usr/bin/env bash -eu

targetdir="$(cat .targetdir)/forged"
mkdir -pv "${targetdir:?}"
cp -v main.js* starforged.json manifest.json styles.css starforged.supplement.yaml "${targetdir:?}"
