# ccline-zh · Chinese-friendly status line for Claude Code

> A **zero-dependency, single-file** status line for Claude Code, built for **Windows / Chinese** users.
> Install via marketplace + one command, or just copy a single `statusline.js`.

[![CI](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[中文](./README.md)

---

## Why this one

Mature tools like [ccstatusline](https://github.com/sirmalloc/ccstatusline) are great but almost all are
**mac/bash-first, English-only, and depend on npm/npx**. ccline-zh fills the gap they leave:

- **Zero-dependency single file** — one `statusline.js`, `node` runs it from anywhere, no `npm install`.
- **Windows first-class** — PowerShell installer, absolute-path handling, branch via reading `.git/HEAD`
  (no git CLI needed), UTF-8/BOM tolerant.
- **Chinese labels** — model / dir / quota / context in Chinese.
- **Never blanks out** — per-widget fallback; missing data is hidden, not errored; exit code always 0.
- **Accurate data** — distinguishes *cumulative session tokens* from *current context usage*; uses
  `context_window_size` instead of a hardcoded 200K (works with 1M models).

## Install

### A. Marketplace plugin (recommended)

```text
/plugin marketplace add Rubbish0-A/ccline-zh
/plugin install ccline-zh
/ccline-zh:setup
```

`setup` resolves the script's absolute path, backs up your `settings.json`, and merges only the
`statusLine` field. Restart Claude Code afterwards.

### B. Bare single file

```sh
git clone https://github.com/Rubbish0-A/ccline-zh.git
cd ccline-zh
sh scripts/install.sh                                            # macOS / Linux
# or: powershell -ExecutionPolicy Bypass -File scripts\install.ps1   (Windows)
```

## Configuration

Copy `statusline.config.example.json` to `~/.claude/ccline-zh.config.json` and edit. The `widgets`
array order is the display order; remove an item or set `enabled:false` to hide it. Invalid values
fall back to defaults. Set `NO_COLOR=1` to disable colors.

## Known limitations

- **"Install and use" needs one `setup` run** — plugins can't inject `statusLine` (a `settings.json`-only
  field); every status line plugin writes it via a setup command. We write an **absolute path** to work
  around [#52079](https://github.com/anthropics/claude-code/issues/52079).
- **`tokens` is a cumulative session value** (includes cache, not reduced by auto-compact). Use `context`
  for "how much context is left".
- **`rateLimit` is claude.ai-subscription only** and appears after at least one API response; hidden for
  API-key users (context takes its place).

## Development

```sh
npm test          # node:test units + integration (25 cases)
npm run check     # node --check across src/scripts/test
npm run build     # bundle src/ into a self-contained statusline.js
```

Keep `.ps1` scripts ASCII-only (Windows PowerShell 5.1 reads them via the system ANSI code page).

## License

MIT © cjh
