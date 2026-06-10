# ccline-zh · Chinese-friendly status line for Claude Code

> A **zero-dependency, single-file** status line for Claude Code, built for **Windows / Chinese** users.
> Install via marketplace + one command, or just copy a single `statusline.js`.

[![CI](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[中文](./README.md)

---

## Preview

```
#a1b2c3d4 │ Fable 5 │ xhigh │ …/ccline-zh/src │ ⎇ main │ +156/-23 │ 上下文 [████░░░░░░] 43% │ 用量 1.9M↑29K↓ │ 5h 70%剩 7d 88%剩
 session    model     effort    dir              branch    lines       context bar           tokens (cumul.)  quota left
```

- **Session short code** `#a1b2c3d4`: tell sessions apart across terminals; `claude -r a1b2c3d4` resumes from any directory.
- **Effort level**: colored by workflow semantics — xhigh green = baseline, high yellow = likely silently reset by a model switch, max magenta = expensive tier.
- **Tokens**: true session-cumulative usage (incl. cache, computed from the transcript) — the same order of magnitude as your bill, not the small "current context" number.
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
- **Session short code `#a1b2c3d4`**: the leading code is the session id prefix, mainly for telling sessions apart across terminals. To resume: `claude -c` (most recent in current dir), `claude -r` (interactive list), or `claude -r <session_id>` (by id; whether the 8-char prefix works depends on your Claude Code version — try it).
- **`git` branch shows only inside a git repo**: hidden automatically when the directory has no `.git` (not a bug).
- **No color**: set `NO_COLOR=1`.

## Widgets

Default on: `session` · `model` · `effort` · `dir` · `git` · `lines` · `context`(bar) · `bigContext`(`1M`/`>200K` badge, hidden on regular 200K sessions) · `tokens`(cumulative) · `rateLimit`.
Default off (enable on demand): `sessionName` · `fastMode` · `thinking` · `cost` · `duration` · `blockTimer`(quota reset countdown) · `worktree` · `outputStyle` · `version`.

## Known limitations

- **"Install and use" needs one `setup` run** — plugins can't inject `statusLine`; setup writes an **absolute path** to work around [#52079](https://github.com/anthropics/claude-code/issues/52079).
- **`tokens` is session-cumulative** (incl. cache, doesn't shrink on auto-compact), computed by incrementally tailing the transcript JSONL — since CC 2.1.x the stdin `total_*_tokens` fields mean "current context content", no longer cumulative. Main session only (subagent transcripts excluded). Use `context` for "how much is left".
- **`rateLimit` / `blockTimer` are claude.ai-subscription only**, appear after one API response; hidden for API-key / relay users (the whole `rate_limits` field is absent — that's the data source, not a bug).
- **`cost` uses official Anthropic pricing**; if you're on a third-party relay, your actual billing (multipliers, currency) is whatever the relay says — treat this as an order-of-magnitude reference.
- **`context` on native-1M models (Fable 5) beyond 200K**: CC still reports `context_window_size: 200000` and caps `used_percentage` at 100 (upstream #35059, NOT_PLANNED). The widget detects `exceeds_200k_tokens` and recomputes the percentage/bar against the actual 1M elastic window, appending the absolute count (e.g. `[████░░░░░░] 41% 406.8K`). Color is the **more dangerous of two independent scales**: relative remaining thresholds (window space) and an absolute context-rot guard (default 300K yellow / 400K red — model quality degrades by absolute token count regardless of window size; a pure relative scale stays green until ~800K on 1M windows). Tune via `tokensWarn`/`tokensDanger`; set `"tokensWarn": 0` to disable the absolute guard. Explicit `[1m]` sessions use the same unified coloring.

## Development

```sh
npm test          # node:test units + integration (35 cases)
npm run check     # node --check across src/scripts/test
npm run build     # bundle src/ into a self-contained statusline.js
```

Keep `.ps1` scripts ASCII-only (Windows PowerShell 5.1 reads them via the system ANSI code page).

## License

MIT © cjh
