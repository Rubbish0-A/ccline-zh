'use strict';

/**
 * widget 渲染器。每个 widget 是纯函数 (input, widgetCfg, ctx) => string | null。
 * 约定：取不到数据一律返回 null（由主流程跳过该段），绝不抛错给上层依赖。
 * ctx = { colorOn, thresholds, pathSegments }
 */

const { paint, colorByRemaining } = require('./colors');
const { fmtCount, shortenPath, fmtDuration, bar, fmtCountdown } = require('./format');
const gitlib = require('./git');
const usagelib = require('./usage');

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

/**
 * token：会话累计 input↑/output↓（含 cache，不随 auto-compact 回退）。
 * ⚠️ CC 2.1.x 起 stdin 的 context_window.total_*_tokens 语义已变为「当前上下文
 * 内容」（= current_usage 之和），不再是会话累计 —— 因此这里改为从 transcript
 * JSONL 增量统计（见 usage.js），与计费体感一致。
 * cfg.stateDir 仅测试注入用，生产走 tmpdir。
 */
function tokens(input, cfg, ctx) {
  const got = usagelib.cumulative(
    input && input.transcript_path,
    input && input.session_id,
    { stateDir: cfg.stateDir }
  );
  if (!got || (got.tin <= 0 && got.tout <= 0)) return null;
  const body = (fmtCount(got.tin) || '0') + '↑' + (fmtCount(got.tout) || '0') + '↓';
  return pre(cfg) + paint(cfg.color || 'blue', body, ctx.colorOn);
}

/**
 * context：当前上下文已用百分比（与累计 token 不同概念）；颜色按剩余量。
 * 口径（2.1.170 实测）：used_percentage = 上下文 input 侧 / context_window_size，
 * 与官方一致，直接透传不自算。
 *
 * ⚠️ 弹性超窗失真：1M 原生模型（如 Fable 5）超过 200K 后，CC 仍报
 * context_window_size=200000 且 used_percentage 被 cap 在 100（remaining=0），
 * 同时置 exceeds_200k_tokens=true —— 上游 #35059 NOT_PLANNED 未修。此时
 * 百分比无意义，切换为绝对量显示（如 "220.6K"），配色按绝对阈值
 * （默认 300K warn / 400K danger，即 context rot 经验阈值；
 * cfg.tokensWarn / cfg.tokensDanger 可调）。
 * 显式 [1m]（window_size>=1M，百分比正确）与真·200K 用满（无 exceeds 标志，
 * 100% 红色是对的）两种场景不受影响。
 */
function context(input, cfg, ctx) {
  const cw = input && input.context_window;
  if (!cw || typeof cw.used_percentage !== 'number') return null;

  if (input.exceeds_200k_tokens === true && !(cw.context_window_size >= 1e6)) {
    const cu = cw.current_usage || {};
    const abs =
      typeof cw.total_input_tokens === 'number' && cw.total_input_tokens > 0
        ? cw.total_input_tokens
        : (cu.input_tokens || 0) +
          (cu.cache_creation_input_tokens || 0) +
          (cu.cache_read_input_tokens || 0);
    if (abs > 0) {
      const warn = cfg.tokensWarn > 0 ? cfg.tokensWarn : 300000;
      const danger = cfg.tokensDanger > 0 ? cfg.tokensDanger : 400000;
      const color = abs >= danger ? 'red' : abs >= warn ? 'yellow' : 'green';
      // 百分比按 1M 弹性窗口重算：能超 200K 仍在跑 = 实际运行在 1M 窗口
      // （Anthropic 仅 200K/1M 两档，平台行为而非模型猜测）；颜色仍按绝对
      // 阈值——1M 的"剩余%"会绿到 700K，远晚于 context rot 危险区
      const pct = Math.min(100, Math.round((abs / 1e6) * 100));
      let body = pct + '% ' + fmtCount(abs);
      if (cfg.bar) body = bar(pct) + ' ' + body;
      return pre(cfg) + paint(color, body, ctx.colorOn);
    }
  }

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

/**
 * effort 档位默认配色 —— 编码的是工作流语义，不是审美：
 *   xhigh = 本机 baseline（绿=常态）；high = 4.8 产品默认，多半是切模型后被
 *   静默重置（黄=该检查了）；max = 主动开的高耗档（紫=醒目）；low/medium
 *   对 coding 工作流是异常档（红）。
 * TODO(user): 这张表是你的 effort 运营策略，按自己的档位语义调整；
 * 也可不改代码，在 config 里对 effort widget 配 colors: { high: 'red', ... } 覆盖。
 */
const EFFORT_COLORS = {
  xhigh: 'green',
  high: 'yellow',
  max: 'magenta',
  medium: 'red',
  low: 'red',
};

/** effort 档位（effort.level）；config colors 可逐档覆盖默认表。 */
function effort(input, cfg, ctx) {
  const lv = input && input.effort && input.effort.level;
  if (!lv || typeof lv !== 'string') return null;
  const color = (cfg.colors && cfg.colors[lv]) || EFFORT_COLORS[lv] || 'cyan';
  return pre(cfg) + paint(color, lv, ctx.colorOn);
}

/**
 * 大上下文标记：1M 窗口显示 "1M"，普通窗口但已超 200K 显示 ">200K"；
 * 常规 200K 会话返回 null 隐藏（条件显示，不占位）。
 */
function bigContext(input, cfg, ctx) {
  const cw = (input && input.context_window) || {};
  let tag = null;
  if (typeof cw.context_window_size === 'number' && cw.context_window_size >= 1e6) {
    tag = '1M';
  } else if (input && input.exceeds_200k_tokens === true) {
    tag = '>200K';
  }
  if (!tag) return null;
  return pre(cfg) + paint(cfg.color || 'magenta', tag, ctx.colorOn);
}

/** 会话名（CC 自动起名）；按 code point 截断到 cfg.maxLen（默认 12）字。 */
function sessionName(input, cfg, ctx) {
  const name = input && input.session_name;
  if (!name || typeof name !== 'string') return null;
  const max = Number.isInteger(cfg.maxLen) && cfg.maxLen > 0 ? cfg.maxLen : 12;
  const chars = Array.from(name);
  const text = chars.length > max ? chars.slice(0, max).join('') + '…' : name;
  return pre(cfg) + paint(cfg.color || 'white', text, ctx.colorOn);
}

/** fast mode 指示：开启时才显示（Opus 快速输出计费不同，值得醒目）。 */
function fastMode(input, cfg, ctx) {
  if (!input || input.fast_mode !== true) return null;
  const symbol = typeof cfg.symbol === 'string' ? cfg.symbol : '⚡fast';
  return pre(cfg) + paint(cfg.color || 'yellow', symbol, ctx.colorOn);
}

/** thinking 开关指示：enabled 时才显示。 */
function thinking(input, cfg, ctx) {
  const th = input && input.thinking;
  if (!th || th.enabled !== true) return null;
  const symbol = typeof cfg.symbol === 'string' ? cfg.symbol : 'think';
  return pre(cfg) + paint(cfg.color || 'gray', symbol, ctx.colorOn);
}

module.exports = {
  session, model, dir, git, lines, tokens, context, rateLimit, cost, duration,
  blockTimer, worktree, outputStyle, version,
  effort, bigContext, sessionName, fastMode, thinking,
  EFFORT_COLORS,
};
