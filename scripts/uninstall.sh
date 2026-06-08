#!/usr/bin/env sh
# ccline-zh uninstall (macOS / Linux): delegate to uninstall.js.
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "[ccline-zh] Node.js not found."
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/uninstall.js"
