'use strict';

/**
 * widget 渲染器。每个 widget 是纯函数 (input, widgetCfg, ctx) => string | null。
 * 约定：取不到数据一律返回 null（由主流程跳过该段），绝不抛错给上层依赖。
 * ctx = { colorOn, thresholds, pathSegments }
 */

const { paint, colorByRemaining } = require('./colors');
const { fmtCount, shortenPath, fmtDuration, bar, fmtCountdown } = require('./format');
const gitlib = require('./git');

/** label 前缀：有 label 则 "label "，否则空。 */
function pre(cfg) {
  return cfg.label ? cfg.label + ' ' : '';
}

/**
 * 会话短码：多终端识别 + `claude -r <短码>` 续会话。
 * 优先 session_id；回退用正则从 transcript_path 提文件名（不用 path.basename，避免
 * 跨平台路径差异：Linux 上对 Windows 反斜杠路径 basename 会出错）。
 */
function session(input, cfg, ctx) {
  let id = null;
  if (input && typeof input.session_id === 'string' && input.session_id) {
    id = input.session_id;
  } else if (input && typeof input.transcript_path === 'string') {
    const m = input.transcript_path.match(/([^/\\]+)\.jsonl$/);
    if (m) id = m[1];
  }
  if (!id) return null;
  return pre(cfg) + paint(cfg.color || 'gray', '#' + id.slice(0, 8), ctx.colorOn);
}

function model(input, cfg, ctx) {
  const name = input && input.model && input.model.display_name;
  if (!name) return null;
  return pre(cfg) + paint(cfg.color || 'cyan', String(name), ctx.colorOn);
}

function dir(input, cfg, ctx) {
  const ws = (input && input.workspace) || {};
  // useProjectDir=true 用会话启动目录（cd 后不变，更适合标识"属于哪个项目"）
  const d =
    (cfg.useProjectDir && ws.project_dir) ||
    ws.current_dir ||
    (input && input.cwd);
  const short = shortenPath(d, ctx.pathSegments);
  if (!short) return null;
  return pre(cfg) + paint(cfg.color || 'yellow', short, ctx.colorOn);
}

/** git 分支：零依赖读 .git/HEAD。dirty 可选（git 子进程 + 超时），脏则加 *。 */
function git(input, cfg, ctx) {
  const dir =
    (input && input.workspace && input.workspace.current_dir) ||
    (input && input.cwd);
  if (!dir) return null;
  const branch = gitlib.getBranch(dir);
  if (!branch) return null;
  const symbol = typeof cfg.symbol === 'string' ? cfg.symbol : '⎇ ';
  let body = symbol + branch;
  if (cfg.dirty && gitlib.isDirty(dir, 800)) body += '*';
  return pre(cfg) + paint(cfg.color || 'magenta', body, ctx.colorOn);
}

function lines(input, cfg, ctx) {
  const cost = (input && input.cost) || {};
  const added = cost.total_lines_added || 0;
  const removed = cost.total_lines_removed || 0;
  if (added <= 0 && removed <= 0) return null;
  const parts = [];
  if (added > 0) parts.push(paint('green', '+' + added, ctx.colorOn));
  if (removed > 0) parts.push(paint('red', '-' + removed, ctx.colorOn));
  return pre(cfg) + parts.join('/');
}

/** token：会话累计 input↑/output↓（含 cache，不随 auto-compact 回退）。 */
function tokens(input, cfg, ctx) {
  const cw = (input && input.context_window) || {};
  const inTok = cw.total_input_tokens || 0;
  const outTok = cw.total_output_tokens || 0;
  if (inTok <= 0 && outTok <= 0) return null;
  const body = (fmtCount(inTok) || '0') + '↑' + (fmtCount(outTok) || '0') + '↓';
  return pre(cfg) + paint(cfg.color || 'blue', body, ctx.colorOn);
}

/** context：当前上下文已用百分比（与累计 token 不同概念）；颜色按剩余量。 */
function context(input, cfg, ctx) {
  const cw = input && input.context_window;
  if (!cw || typeof cw.used_percentage !== 'number') return null;
  const used = Math.round(cw.used_percentage);
  const remaining = 100 - used;
  const color = colorByRemaining(remaining, ctx.thresholds);
  let body = used + '%';
  if (cfg.bar) body = bar(used) + ' ' + body;
  return pre(cfg) + paint(color, body, ctx.colorOn);
}

/** 额度：5h / 7d 滚动窗口剩余百分比，接近耗尽自动变色。 */
function rateLimit(input, cfg, ctx) {
  const rl = input && input.rate_limits;
  if (!rl) return null;
  const parts = [];
  const windows = [
    { key: 'five_hour', tag: '5h' },
    { key: 'seven_day', tag: '7d' },
  ];
  for (const w of windows) {
    const obj = rl[w.key];
    if (obj && typeof obj.used_percentage === 'number') {
      const used = Math.round(obj.used_percentage);
      const rem = 100 - used;
      const color = colorByRemaining(rem, ctx.thresholds);
      // bar 按"已用"填充（条满=快耗尽=红），与"X%剩"文字方向一致（用得少→条空→安全）
      const body = (cfg.bar ? bar(used) + ' ' : '') + rem + '%剩';
      parts.push(w.tag + ' ' + paint(color, body, ctx.colorOn));
    }
  }
  if (parts.length === 0) return null;
  return pre(cfg) + parts.join(' ');
}

function cost(input, cfg, ctx) {
  const usd = input && input.cost && input.cost.total_cost_usd;
  if (typeof usd !== 'number') return null;
  return pre(cfg) + paint(cfg.color || 'green', '$' + usd.toFixed(2), ctx.colorOn);
}

function duration(input, cfg, ctx) {
  const ms = input && input.cost && input.cost.total_duration_ms;
  const s = fmtDuration(ms);
  if (!s) return null;
  return pre(cfg) + paint(cfg.color || 'gray', s, ctx.colorOn);
}

/** 额度重置倒计时：读 rate_limits[window].resets_at（默认 5h 窗口）。 */
function blockTimer(input, cfg, ctx) {
  const rl = input && input.rate_limits;
  if (!rl) return null;
  const win = cfg.window || 'five_hour';
  const obj = rl[win];
  if (!obj || typeof obj.resets_at !== 'number') return null;
  const s = fmtCountdown(obj.resets_at);
  if (!s) return null;
  const tag = win === 'seven_day' ? '7d' : '5h';
  return pre(cfg) + paint(cfg.color || 'gray', tag + ' ' + s, ctx.colorOn);
}

/** git worktree 名（仅在 linked worktree 里有值）。 */
function worktree(input, cfg, ctx) {
  const wt = input && input.workspace && input.workspace.git_worktree;
  if (!wt) return null;
  return pre(cfg) + paint(cfg.color || 'magenta', 'wt:' + wt, ctx.colorOn);
}

function outputStyle(input, cfg, ctx) {
  const name = input && input.output_style && input.output_style.name;
  if (!name) return null;
  return pre(cfg) + paint(cfg.color || 'gray', String(name), ctx.colorOn);
}

function version(input, cfg, ctx) {
  const v = input && input.version;
  if (!v) return null;
  return pre(cfg) + paint(cfg.color || 'gray', String(v), ctx.colorOn);
}

module.exports = {
  session, model, dir, git, lines, tokens, context, rateLimit, cost, duration,
  blockTimer, worktree, outputStyle, version,
};
