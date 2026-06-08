#!/usr/bin/env sh
# ccline-zh bare install (macOS / Linux): detect node, delegate to setup.js.
# Kept ASCII-only for consistency with the .ps1 scripts; user-facing Chinese
# messages come from setup.js (Node UTF-8 stdout).
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "[ccline-zh] Node.js not found. Requires Node.js >= 18."
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/setup.js"
