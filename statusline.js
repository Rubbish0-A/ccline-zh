#!/usr/bin/env node
'use strict';
/* ccline-zh —— 打包单文件，由 scripts/bundle.js 自动生成，请勿手改。
   源码见 src/；修改后运行 `npm run build` 重新生成。 */

const __mods = {};
function __require(id) {
  const m = __mods[id];
  if (!m) return require(id);
  if (m.cached) return m.cached.exports;
  const module = { exports: {} };
  m.cached = module;
  m.fn(module, module.exports, __require);
  return module.exports;
}

__mods['colors'] = { fn: function (module, exports, require) {
'use strict';

/**
 * ANSI 颜色工具：着色、按阈值选色、颜色开关。
 * 纯函数，无副作用（colorEnabled 只读环境变量）。
 */

const RESET = '\x1b[0m';

const CODES = {
  reset: RESET,
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * 是否启用颜色。statusLine 子进程 stdout 不是 TTY（探测不可靠），
 * 而 Claude Code 渲染层支持 ANSI，因此默认开启。
 * 尊重通用约定 NO_COLOR，以及本项目自有开关 CCLINE_NO_COLOR。
 */
function colorEnabled(env = process.env) {
  if (env.NO_COLOR) return false; // https://no-color.org/
  if (env.CCLINE_NO_COLOR) return false;
  return true;
}

/** 给 text 套上 color 的 ANSI 码；enabled=false 或未知色名时原样返回。 */
function paint(color, text, enabled) {
  if (!enabled) return text;
  const code = CODES[color];
  if (!code) return text;
  return code + text + RESET;
}

/**
 * 按"剩余百分比"选颜色：剩得越少越红。
 * thresholds: { warn, danger } —— 剩余 < danger 红，< warn 黄，否则绿。
 */
function colorByRemaining(remaining, thresholds) {
  const t = thresholds || { warn: 50, danger: 20 };
  if (remaining < t.danger) return 'red';
  if (remaining < t.warn) return 'yellow';
  return 'green';
}

/** 按"已用百分比"选颜色（用得越多越红）。 */
function colorByUsed(used, thresholds) {
  return colorByRemaining(100 - used, thresholds);
}

module.exports = { CODES, RESET, colorEnabled, paint, colorByRemaining, colorByUsed };

} };

__mods['format'] = { fn: function (module, exports, require) {
'use strict';

/**
 * 纯格式化工具：数字、路径、时长、进度条。
 * 约定：输入无效（NaN/负数/空）一律返回 null，由调用方决定是否隐藏该字段。
 */

/** 数字 → 带 K/M 后缀的紧凑字符串。1234 → "1.2K"，2_500_000 → "2.5M"。 */
function fmtCount(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

/**
 * 路径 → 末 segments 段，并把 Windows 反斜杠归一为正斜杠。
 * 段数不足则原样返回；超出则前缀 "…/"。
 */
function shortenPath(p, segments = 2) {
  if (!p) return null;
  const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length <= segments) return parts.join('/');
  return '…/' + parts.slice(-segments).join('/');
}

/** 毫秒 → 人类可读时长。90s → "1m30s"，3700s → "1h1m"。 */
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return totalSec + 's';
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return totalMin + 'm' + (totalSec % 60) + 's';
  const hours = Math.floor(totalMin / 60);
  return hours + 'h' + (totalMin % 60) + 'm';
}

/** 已用百分比 → 文本进度条。usedPct=30 → "[███░░░░░░░]"。 */
function bar(usedPct, width = 10) {
  const pct = Math.max(0, Math.min(100, Number(usedPct) || 0));
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

/**
 * 距 resetSec（unix 秒）的倒计时。nowMs 可注入便于测试（默认 Date.now()）。
 * 已过期→'即将重置'；非数字/缺失→null；超 7 天（时钟异常）→null。
 */
function fmtCountdown(resetSec, nowMs = Date.now()) {
  if (!Number.isFinite(resetSec)) return null;
  const diffSec = Math.round(resetSec - nowMs / 1000);
  if (diffSec <= 0) return '即将重置';
  if (diffSec > 7 * 24 * 3600) return null; // 上界保护
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  return (h > 0 ? h + 'h' + m + 'm' : m + 'm') + '后重置';
}

module.exports = { fmtCount, shortenPath, fmtDuration, bar, fmtCountdown };

} };

__mods['git'] = { fn: function (module, exports, require) {
'use strict';

/**
 * git 信息读取——零依赖优先。
 *  - getBranch：纯文件方式（读 .git/HEAD），不依赖 git CLI、不 spawn 子进程。
 *  - isDirty：可选，必须用 git CLI 子进程，带超时；失败返回 null（未知）。
 * 任何错误都吞掉返回 null，绝不让 statusline 因 git 崩溃。
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** 从 startDir 向上逐级查找 .git（目录或文件），返回其路径或 null。 */
function findGitPath(startDir) {
  let cur = path.resolve(startDir);
  for (let i = 0; i < 50; i++) {
    const gitPath = path.join(cur, '.git');
    if (fs.existsSync(gitPath)) return gitPath;
    const parent = path.dirname(cur);
    if (parent === cur) break; // 抵达文件系统根
    cur = parent;
  }
  return null;
}

/**
 * 把 .git 解析为真正的 git 目录。
 * 普通仓库：.git 即目录。worktree/submodule：.git 是文件，内容形如 "gitdir: <path>"。
 */
function resolveGitDir(gitPath) {
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) return gitPath;
  const content = fs.readFileSync(gitPath, 'utf8').trim();
  const m = content.match(/^gitdir:\s*(.+)$/m);
  if (!m) return null;
  const target = m[1].trim();
  return path.isAbsolute(target)
    ? target
    : path.resolve(path.dirname(gitPath), target);
}

/**
 * 当前分支名；detached HEAD 返回短 commit hash；非仓库或异常返回 null。
 */
function getBranch(startDir) {
  try {
    if (!startDir) return null;
    const gitPath = findGitPath(startDir);
    if (!gitPath) return null;
    const gitDir = resolveGitDir(gitPath);
    if (!gitDir) return null;
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (ref) return ref[1].trim();
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head.slice(0, 7); // detached
    return null;
  } catch {
    return null;
  }
}

/**
 * 工作区是否有未提交改动。需要 git CLI；超时/不可用/出错返回 null（未知）。
 */
function isDirty(dir, timeoutMs = 800) {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], {
      cwd: dir,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      windowsHide: true,
    });
    return out.trim().length > 0;
  } catch {
    return null;
  }
}

module.exports = { getBranch, isDirty, findGitPath, resolveGitDir };

} };

__mods['config'] = { fn: function (module, exports, require) {
'use strict';

/**
 * 配置：默认值 + 外部文件加载 + 校验合并。
 *
 * 查找顺序（先命中先用）：
 *   1. 环境变量 CCLINE_CONFIG 指定的绝对路径
 *   2. <脚本所在目录>/ccline-zh.config.json （裸 copy 场景：脚本与配置同放一处）
 *   3. ~/.claude/ccline-zh.config.json        （用户级，跨项目）
 *
 * 合并规则：顶层标量/阈值「用户提供且合法则覆盖」；widgets 数组「用户提供合法项则整体替换」。
 * 任何非法值都回落默认，配置文件损坏/缺失绝不导致崩溃。
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULT_CONFIG = {
  separator: ' │ ',
  separatorColor: 'gray',
  pathSegments: 2,
  thresholds: { warn: 50, danger: 20 },
  widgets: [
    // ── 默认开（8 段：含最初要的 模型/代码增删/用量/额度 + 新增 会话短码/上下文进度条）──
    { type: 'session', enabled: true, label: '', color: 'gray' },
    { type: 'model', enabled: true, label: '', color: 'cyan' },
    { type: 'dir', enabled: true, label: '', color: 'yellow', useProjectDir: false },
    { type: 'git', enabled: true, label: '', color: 'magenta', dirty: false, symbol: '⎇ ' },
    { type: 'lines', enabled: true, label: '' },
    { type: 'context', enabled: true, label: '上下文', bar: true },
    { type: 'tokens', enabled: true, label: '用量', color: 'blue' },
    { type: 'rateLimit', enabled: true, label: '', bar: false },
    // ── 默认关（按需在 ccline-zh.config.json 里设 enabled:true）──
    { type: 'cost', enabled: false, label: '', color: 'green' },
    { type: 'duration', enabled: false, label: '时长', color: 'gray' },
    { type: 'blockTimer', enabled: false, label: '', window: 'five_hour', color: 'gray' },
    { type: 'worktree', enabled: false, label: '', color: 'magenta' },
    { type: 'outputStyle', enabled: false, label: '', color: 'gray' },
    { type: 'version', enabled: false, label: 'v', color: 'gray' },
  ],
};

const VALID_TYPES = new Set(DEFAULT_CONFIG.widgets.map((w) => w.type));

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPosInt(n) {
  return Number.isInteger(n) && n > 0;
}
function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/** 候选配置文件路径列表（按优先级）。 */
function candidatePaths(env = process.env, scriptDir = __dirname) {
  const list = [];
  if (env.CCLINE_CONFIG) list.push(env.CCLINE_CONFIG);
  list.push(path.join(scriptDir, 'ccline-zh.config.json'));
  list.push(path.join(os.homedir(), '.claude', 'ccline-zh.config.json'));
  return list;
}

/** 读取首个存在且能解析的用户配置；读取/解析失败的候选会被静默跳过。 */
function readUserConfig(env, scriptDir) {
  for (const p of candidatePaths(env, scriptDir)) {
    try {
      if (p && fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
      }
    } catch {
      // 损坏的候选跳过，尝试下一个
    }
  }
  return null;
}

/** 把用户配置安全合并进默认配置；非法字段一律忽略。 */
function mergeConfig(base, user) {
  const merged = clone(base);
  if (!user || typeof user !== 'object') return merged;

  if (typeof user.separator === 'string') merged.separator = user.separator;
  if (typeof user.separatorColor === 'string') merged.separatorColor = user.separatorColor;
  if (isPosInt(user.pathSegments)) merged.pathSegments = user.pathSegments;

  if (user.thresholds && typeof user.thresholds === 'object') {
    if (isNum(user.thresholds.warn)) merged.thresholds.warn = user.thresholds.warn;
    if (isNum(user.thresholds.danger)) merged.thresholds.danger = user.thresholds.danger;
  }

  if (Array.isArray(user.widgets)) {
    const valid = user.widgets.filter(
      (w) => w && typeof w === 'object' && VALID_TYPES.has(w.type)
    );
    if (valid.length > 0) merged.widgets = valid;
  }

  return merged;
}

/**
 * 加载最终配置。
 * @param {object} [opts] - { env, scriptDir } 便于测试注入；省略则用真实环境。
 */
function loadConfig(opts = {}) {
  const env = opts.env || process.env;
  const scriptDir = opts.scriptDir || __dirname;
  let user = null;
  try {
    user = readUserConfig(env, scriptDir);
  } catch {
    user = null;
  }
  return mergeConfig(DEFAULT_CONFIG, user);
}

module.exports = {
  DEFAULT_CONFIG,
  VALID_TYPES,
  loadConfig,
  mergeConfig,
  candidatePaths,
  clone,
};

} };

__mods['widgets'] = { fn: function (module, exports, require) {
'use strict';

/**
 * widget 渲染器。每个 widget 是纯函数 (input, widgetCfg, ctx) => string | null。
 * 约定：取不到数据一律返回 null（由主流程跳过该段），绝不抛错给上层依赖。
 * ctx = { colorOn, thresholds, pathSegments }
 */

const { paint, colorByRemaining } = __require('colors');
const { fmtCount, shortenPath, fmtDuration, bar, fmtCountdown } = __require('format');
const gitlib = __require('git');

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

} };

__mods['statusline'] = { fn: function (module, exports, require) {
'use strict';

/**
 * ccline-zh —— Claude Code 中文状态栏（核心入口）。
 *
 * 工作方式：Claude Code 每次刷新时把一段 JSON 写入 stdin，本脚本读取后渲染单行
 * 状态栏文本到 stdout（取第一行）。
 *
 * 设计底线（体感 / 兜底）：
 *  - 逐 widget 隔离：单个 widget 抛错只丢该段，整行其余正常输出。
 *  - 字段缺失即隐藏：取不到的数据不显示，绝不出现 undefined / +0/-0。
 *  - JSON 解析失败 → 输出最小提示，不黑屏。
 *  - 退出码恒 0：任何异常都以 0 退出，避免 Claude Code 把状态栏判为空白。
 */

const widgets = __require('widgets');
const { loadConfig, DEFAULT_CONFIG, clone } = __require('config');
const { colorEnabled, paint } = __require('colors');

/** 读取整个 stdin；无管道输入时 1s 后兜底返回空串，避免永久挂起。 */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let settled = false;
    let timer;
    const stdin = process.stdin;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(data);
    };
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
      data += chunk;
    });
    stdin.on('end', done);
    stdin.on('error', done);
    timer = setTimeout(done, 1000);
  });
}

/** 按配置顺序渲染各 widget，逐个兜底，最后用分隔符拼接。 */
function render(input, config) {
  const colorOn = colorEnabled();
  const ctx = {
    colorOn,
    thresholds: config.thresholds,
    pathSegments: config.pathSegments,
  };
  const parts = [];
  for (const w of config.widgets || []) {
    if (!w || !w.enabled) continue;
    const fn = widgets[w.type];
    if (typeof fn !== 'function') continue;
    try {
      const out = fn(input, w, ctx);
      if (out) parts.push(out);
    } catch {
      // 逐 widget 兜底：单个 widget 失败不影响其余字段
    }
  }
  const sep = paint(config.separatorColor, config.separator, colorOn);
  return parts.join(sep);
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch {
    raw = '';
  }

  let input;
  try {
    input = JSON.parse(raw.replace(/^﻿/, ''));
  } catch {
    // 非法 / 空 stdin 的兜底：给一行可读提示而非空白
    process.stdout.write('ccline-zh: 等待数据…\n');
    return;
  }

  let config;
  try {
    config = loadConfig();
  } catch {
    config = clone(DEFAULT_CONFIG);
  }

  let line = '';
  try {
    line = render(input, config);
  } catch {
    line = '';
  }

  // 兜底：有效 JSON 但所有 widget 都无数据时，给最小标识而非空白状态栏
  if (!line) line = paint('gray', 'ccline-zh', colorEnabled());

  process.stdout.write(line + '\n');
}

// 仅在直接运行时驱动 stdin → 渲染 → 退出；被 require（测试）时只导出函数
if (true) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(0));
}

module.exports = { render };

} };

__require('statusline');
