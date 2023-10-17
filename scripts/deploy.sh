#!/usr/bin/env bash -eu

targetdir="$(cat .targetdir)/forged"
mkdir -pv "${targetdir:?}/data"
cp -v main.js* manifest.json styles.css "${targetdir:?}"
cp -v data/* "${targetdir:?}/data/"
