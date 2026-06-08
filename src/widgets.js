'use strict';

/**
 * widget 渲染器。每个 widget 是纯函数 (input, widgetCfg, ctx) => string | null。
 * 约定：取不到数据一律返回 null（由主流程跳过该段），绝不抛错给上层依赖。
 * ctx = { colorOn, thresholds, pathSegments }
 */

const { paint, colorByRemaining } = require('./colors');
const { fmtCount, shortenPath, fmtDuration, bar } = require('./format');
const gitlib = require('./git');

/** label 前缀：有 label 则 "label "，否则空。 */
function pre(cfg) {
  return cfg.label ? cfg.label + ' ' : '';
}

function model(input, cfg, ctx) {
  const name = input && input.model && input.model.display_name;
  if (!name) return null;
  return pre(cfg) + paint(cfg.color || 'cyan', String(name), ctx.colorOn);
}

function dir(input, cfg, ctx) {
  const d =
    (input && input.workspace && input.workspace.current_dir) ||
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
      const rem = Math.round(100 - obj.used_percentage);
      parts.push(
        w.tag + ' ' + paint(colorByRemaining(rem, ctx.thresholds), rem + '%剩', ctx.colorOn)
      );
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

module.exports = { model, dir, git, lines, tokens, context, rateLimit, cost, duration };
