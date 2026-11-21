#!/bin/sh
# Copies the APK + its download page into dist/ right before a hosting deploy (kept out of the APK's own bundle).
set -e; cd "$(dirname "$0")"; mkdir -p dist/download && cp download-page/index.html dist/download/index.html && cp release/pingo.apk dist/download/pingo.apk
