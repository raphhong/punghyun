#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'rm -f .ocr-test-module.cjs' EXIT
npm_config_cache=/tmp/punghyun-ocr-npm-cache npx --yes esbuild@0.28.2 tests/local-ocr-entry.ts --bundle --platform=node --packages=external --format=cjs --outfile=.ocr-test-module.cjs
env -u OPENAI_API_KEY -u SUPABASE_SERVICE_ROLE_KEY node --require ./tests/local-ocr-deny-network.cjs tests/local-ocr-integration.cjs
