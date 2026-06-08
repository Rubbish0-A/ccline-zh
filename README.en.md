# ccline-zh · Chinese-friendly status line for Claude Code

> A **zero-dependency, single-file** status line for Claude Code, built for **Windows / Chinese** users.
> Install via marketplace + one command, or just copy a single `statusline.js`.

[![CI](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[中文](./README.md)

---

## Preview

```
#a1b2c3d4 │ Opus 4.8 │ …/ccline-zh/src │ ⎇ main │ 上下文 [███░░░░░░░] 34% │ 5h 70%剩 7d 88%剩
 session    model       dir              branch    context bar           quota left
```

- **Session short code** `#a1b2c3d4`: tell sessions apart across terminals; `claude -r a1b2c3d4` resumes from any directory.
- **Progress bars**: context/quota go green → yellow → red as they fill (context above ~85% noticeably degrades Claude — seeing it early matters).

## Why this one

Mature tools like [ccstatusline](https://github.com/sirmalloc/ccstatusline) are great but almost all are
**mac/bash-first, English-only, npm/npx-dependent**. ccline-zh fills the gap:

- **Zero-dependency single file** — one `statusline.js`, runs anywhere with `node`, no `npm install`.
- **Windows first-class** — PowerShell installer, absolute-path handling, branch via reading `.git/HEAD`, UTF-8/BOM tolerant.
- **Chinese labels**, **never blanks out** (per-widget fallback, exit code always 0), **accurate data** (cumulative tokens vs current context; uses `context_window_size`, not hardcoded 200K).

## Install

### A. Marketplace plugin (recommended)

```text
/plugin marketplace add Rubbish0-A/ccline-zh
/plugin install ccline-zh
/ccline-zh:setup
```

### B. Bare single file

```sh
git clone https://github.com/Rubbish0-A/ccline-zh.git
cd ccline-zh
sh scripts/install.sh                                            # macOS / Linux
# powershell -ExecutionPolicy Bypass -File scripts\install.ps1   # Windows
```

## Configure & use

- **Start**: shows automatically once Claude Code starts — no separate process.
- **Disable**: run `uninstall.*`, or delete the `statusLine` field in `~/.claude/settings.json`.
- **Toggle a widget**: copy `statusline.config.example.json` → `~/.claude/ccline-zh.config.json`, set a widget's `"enabled"` to `true`/`false`, save — **no restart**. ⚠️ The `widgets` array **replaces** the default wholesale, so list every widget you want.
- **Resume by short code**: the leading `#a1b2c3d4` is the session id prefix; run `claude -r a1b2c3d4` from any directory.
- **No color**: set `NO_COLOR=1`.

## Widgets

Default on: `session` · `model` · `dir` · `git` · `context`(bar) · `rateLimit`.
Default off (enable on demand): `lines` · `tokens` · `cost` · `duration` · `blockTimer`(quota reset countdown) · `worktree` · `outputStyle` · `version`.

## Known limitations

- **"Install and use" needs one `setup` run** — plugins can't inject `statusLine`; setup writes an **absolute path** to work around [#52079](https://github.com/anthropics/claude-code/issues/52079).
- **`tokens` is cumulative** (incl. cache, [#13783](https://github.com/anthropics/claude-code/issues/13783)); use `context` for "how much is left".
- **`rateLimit` / `blockTimer` are claude.ai-subscription only**, appear after one API response; hidden for API-key users.

## Development

```sh
npm test          # node:test units + integration (35 cases)
npm run check     # node --check across src/scripts/test
npm run build     # bundle src/ into a self-contained statusline.js
```

Keep `.ps1` scripts ASCII-only (Windows PowerShell 5.1 reads them via the system ANSI code page).

## License

MIT © cjh
