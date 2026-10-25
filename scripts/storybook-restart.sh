#!/usr/bin/env bash
# Replace this checkout's Storybook lane with a fresh supervised dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec env STORYBOOK_REPLACE=1 WATCHPACK_POLLING=250 node "$ROOT/scripts/storybook-run.mjs" --no-open --config-dir .storybook
