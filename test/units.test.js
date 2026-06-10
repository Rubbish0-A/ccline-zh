'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const { fmtCount, shortenPath, fmtDuration, bar, fmtCountdown } = require('../src/format');
const { colorByRemaining, paint, colorEnabled } = require('../src/colors');
const { mergeConfig, DEFAULT_CONFIG, clone } = require('../src/config');
const { getBranch } = require('../src/git');
const widgets = require('../src/widgets');

// ───────────────────────── format ─────────────────────────
test('fmtCount: K/M 后缀与边界', () => {
  assert.strictEqual(fmtCount(500), '500');
  assert.strictEqual(fmtCount(1500), '1.5K');
  assert.strictEqual(fmtCount(1250000), '1.3M');
  assert.strictEqual(fmtCount(0), '0');
  assert.strictEqual(fmtCount(-5), null);
  assert.strictEqual(fmtCount(NaN), null);
});

test('shortenPath: 末N段 + 反斜杠归一', () => {
  assert.strictEqual(shortenPath('E:\\a\\b\\c', 2), '…/b/c');
  assert.strictEqual(shortenPath('/repo', 2), 'repo');
  assert.strictEqual(shortenPath('/a/b', 2), 'a/b');
  assert.strictEqual(shortenPath('', 2), null);
  assert.strictEqual(shortenPath(null, 2), null);
});

test('fmtDuration: s/m/h 进位', () => {
  assert.strictEqual(fmtDuration(5000), '5s');
  assert.strictEqual(fmtDuration(90000), '1m30s');
  assert.strictEqual(fmtDuration(3700000), '1h1m');
  assert.strictEqual(fmtDuration(-1), null);
});

test('bar: 填充比例', () => {
  assert.strictEqual(bar(0, 10), '[░░░░░░░░░░]');
  assert.strictEqual(bar(100, 10), '[██████████]');
  assert.strictEqual(bar(30, 10), '[███░░░░░░░]');
});

// ───────────────────────── colors ─────────────────────────
test('colorByRemaining: 阈值绿/黄/红', () => {
  const t = { warn: 50, danger: 20 };
  assert.strictEqual(colorByRemaining(70, t), 'green');
  assert.strictEqual(colorByRemaining(40, t), 'yellow');
  assert.strictEqual(colorByRemaining(10, t), 'red');
});

test('paint: enabled 开关与未知色名', () => {
  assert.strictEqual(paint('red', 'x', false), 'x');
  assert.ok(paint('red', 'x', true).startsWith('\x1b['));
  assert.ok(paint('red', 'x', true).includes('x'));
  assert.strictEqual(paint('nosuchcolor', 'x', true), 'x');
});

test('colorEnabled: NO_COLOR / CCLINE_NO_COLOR', () => {
  assert.strictEqual(colorEnabled({ NO_COLOR: '1' }), false);
  assert.strictEqual(colorEnabled({ CCLINE_NO_COLOR: '1' }), false);
  assert.strictEqual(colorEnabled({}), true);
});

// ───────────────────────── config merge ─────────────────────────
test('mergeConfig: 合法值覆盖', () => {
  const m = mergeConfig(DEFAULT_CONFIG, { separator: ' | ', pathSegments: 1 });
  assert.strictEqual(m.separator, ' | ');
  assert.strictEqual(m.pathSegments, 1);
});

test('mergeConfig: 非法值回落默认', () => {
  const m = mergeConfig(DEFAULT_CONFIG, {
    pathSegments: -3,
    separator: 123,
    thresholds: 'bad',
  });
  assert.strictEqual(m.pathSegments, DEFAULT_CONFIG.pathSegments);
  assert.strictEqual(m.separator, DEFAULT_CONFIG.separator);
  assert.deepStrictEqual(m.thresholds, DEFAULT_CONFIG.thresholds);
});

test('mergeConfig: 过滤非法 widget type', () => {
  const m = mergeConfig(DEFAULT_CONFIG, {
    widgets: [{ type: 'model' }, { type: 'bogus' }, { type: 'cost' }],
  });
  assert.deepStrictEqual(m.widgets.map((w) => w.type), ['model', 'cost']);
});

test('mergeConfig: 全非法 widgets → 保留默认', () => {
  const m = mergeConfig(DEFAULT_CONFIG, { widgets: [{ type: 'bogus' }] });
  assert.strictEqual(m.widgets.length, DEFAULT_CONFIG.widgets.length);
});

test('mergeConfig: null user → 默认副本（非引用）', () => {
  const m = mergeConfig(DEFAULT_CONFIG, null);
  assert.deepStrictEqual(m, clone(DEFAULT_CONFIG));
  assert.notStrictEqual(m, DEFAULT_CONFIG);
});

// ───────────────────────── git ─────────────────────────
test('getBranch: 普通/子目录/detached/非仓库', () => {
  const repo = path.join(os.tmpdir(), 'ccl-unit-' + process.pid);
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  try {
    fs.writeFileSync(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/dev\n');
    assert.strictEqual(getBranch(repo), 'dev');
    const sub = path.join(repo, 'a', 'b');
    fs.mkdirSync(sub, { recursive: true });
    assert.strictEqual(getBranch(sub), 'dev');
    fs.writeFileSync(path.join(repo, '.git', 'HEAD'), 'abcdef1234567890\n');
    assert.strictEqual(getBranch(repo), 'abcdef1');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
  const clean = path.join(os.tmpdir(), 'ccl-clean-unit-' + process.pid);
  fs.mkdirSync(clean, { recursive: true });
  try {
    assert.strictEqual(getBranch(clean), null);
  } finally {
    fs.rmSync(clean, { recursive: true, force: true });
  }
});

test('getBranch: worktree 风格 .git 文件（gitdir 指向）', () => {
  const real = path.join(os.tmpdir(), 'ccl-wt-real-' + process.pid);
  const wt = path.join(os.tmpdir(), 'ccl-wt-' + process.pid);
  fs.mkdirSync(real, { recursive: true });
  fs.mkdirSync(wt, { recursive: true });
  try {
    fs.writeFileSync(path.join(real, 'HEAD'), 'ref: refs/heads/wt-branch\n');
    fs.writeFileSync(path.join(wt, '.git'), 'gitdir: ' + real + '\n');
    assert.strictEqual(getBranch(wt), 'wt-branch');
  } finally {
    fs.rmSync(real, { recursive: true, force: true });
    fs.rmSync(wt, { recursive: true, force: true });
  }
});

// ───────────────────────── session widget ─────────────────────────
const NOCOLOR = { colorOn: false };

test('session: session_id 优先取前 8', () => {
  assert.strictEqual(
    widgets.session({ session_id: 'a1b2c3d4-5678-90ab' }, {}, NOCOLOR),
    '#a1b2c3d4'
  );
});

test('session: 无 session_id 回退 transcript 文件名（含 Windows 路径）', () => {
  assert.strictEqual(
    widgets.session({ transcript_path: '/home/u/p/deadbeef-1111.jsonl' }, {}, NOCOLOR),
    '#deadbeef'
  );
  assert.strictEqual(
    widgets.session({ transcript_path: 'C:\\Users\\x\\cafe1234-2222.jsonl' }, {}, NOCOLOR),
    '#cafe1234'
  );
});

test('session: 两者都缺 → null', () => {
  assert.strictEqual(widgets.session({}, {}, NOCOLOR), null);
  assert.strictEqual(widgets.session({ session_id: '' }, {}, NOCOLOR), null);
});

test('dir: useProjectDir 切换到 project_dir', () => {
  const input = { workspace: { current_dir: '/a/cur', project_dir: '/b/proj' } };
  const ctx = { colorOn: false, pathSegments: 2 };
  assert.strictEqual(widgets.dir(input, { useProjectDir: false }, ctx), 'a/cur');
  assert.strictEqual(widgets.dir(input, { useProjectDir: true }, ctx), 'b/proj');
});

// ───────────────────────── fmtCountdown + 扩展 widget ─────────────────────────
test('fmtCountdown: 正常/已过期/缺失/超界（注入 nowMs）', () => {
  const now = 1_000_000_000; // ms → 1_000_000 s
  assert.strictEqual(fmtCountdown(1_000_000 + 3600, now), '1h0m后重置');
  assert.strictEqual(fmtCountdown(1_000_000 + 1800, now), '30m后重置');
  assert.strictEqual(fmtCountdown(999_000, now), '即将重置');
  assert.strictEqual(fmtCountdown(undefined, now), null);
  assert.strictEqual(fmtCountdown('x', now), null);
  assert.strictEqual(fmtCountdown(1_000_000 + 8 * 24 * 3600, now), null);
});

test('blockTimer: 有 resets_at→含标签且非 null；缺失→null', () => {
  const future = Math.floor(Date.now() / 1000) + 7200;
  const out = widgets.blockTimer(
    { rate_limits: { five_hour: { resets_at: future } } }, {}, NOCOLOR
  );
  assert.ok(out && out.includes('5h') && out.includes('后重置'));
  assert.strictEqual(widgets.blockTimer({}, {}, NOCOLOR), null);
  assert.strictEqual(widgets.blockTimer({ rate_limits: { five_hour: {} } }, {}, NOCOLOR), null);
});

test('worktree: 有 git_worktree 显示，无则 null', () => {
  assert.strictEqual(
    widgets.worktree({ workspace: { git_worktree: 'feat-x' } }, {}, NOCOLOR), 'wt:feat-x'
  );
  assert.strictEqual(widgets.worktree({ workspace: {} }, {}, NOCOLOR), null);
});

test('outputStyle / version', () => {
  assert.strictEqual(
    widgets.outputStyle({ output_style: { name: 'Explanatory' } }, {}, NOCOLOR), 'Explanatory'
  );
  assert.strictEqual(widgets.outputStyle({}, {}, NOCOLOR), null);
  assert.strictEqual(widgets.version({ version: '2.1.90' }, {}, NOCOLOR), '2.1.90');
  assert.strictEqual(widgets.version({}, {}, NOCOLOR), null);
});

// ───────────────────────── 2.1.170 新字段 widget ─────────────────────────
const COLORON = { colorOn: true };

test('effort: 档位文本 + 默认配色 + config colors 覆盖', () => {
  assert.strictEqual(widgets.effort({ effort: { level: 'xhigh' } }, {}, NOCOLOR), 'xhigh');
  // 默认表：xhigh=green(32) / high=yellow(33) / max=magenta(35)
  assert.ok(widgets.effort({ effort: { level: 'xhigh' } }, {}, COLORON).startsWith('\x1b[32m'));
  assert.ok(widgets.effort({ effort: { level: 'high' } }, {}, COLORON).startsWith('\x1b[33m'));
  assert.ok(widgets.effort({ effort: { level: 'max' } }, {}, COLORON).startsWith('\x1b[35m'));
  // config 覆盖单档
  assert.ok(
    widgets.effort({ effort: { level: 'high' } }, { colors: { high: 'red' } }, COLORON)
      .startsWith('\x1b[31m')
  );
  // 未知档位回落 cyan，不报错
  assert.ok(widgets.effort({ effort: { level: 'turbo' } }, {}, COLORON).startsWith('\x1b[36m'));
  assert.strictEqual(widgets.effort({}, {}, NOCOLOR), null);
  assert.strictEqual(widgets.effort({ effort: {} }, {}, NOCOLOR), null);
});

test('context: 弹性超窗失真（exceeds_200k + window 仍 200K）→ 按 1M 重算百分比 + 绝对量 + 绝对阈值配色', () => {
  const mk = (totalIn) => ({
    context_window: {
      used_percentage: 100,
      context_window_size: 200000,
      total_input_tokens: totalIn,
    },
    exceeds_200k_tokens: true,
  });
  // 220648/1M = 22%，bar 恢复显示；颜色按绝对阈值（<300K → green）
  assert.strictEqual(
    widgets.context(mk(220648), { bar: true }, NOCOLOR),
    '[██░░░░░░░░] 22% 220.6K'
  );
  assert.strictEqual(widgets.context(mk(220648), {}, NOCOLOR), '22% 220.6K');
  assert.ok(widgets.context(mk(220648), {}, COLORON).startsWith('\x1b[32m'));
  // 跨 warn/danger 阈值变色（默认 300K/400K），百分比仍按 1M
  assert.ok(widgets.context(mk(350000), {}, COLORON).startsWith('\x1b[33m'));
  assert.ok(widgets.context(mk(450000), {}, COLORON).startsWith('\x1b[31m'));
  assert.strictEqual(widgets.context(mk(450000), {}, NOCOLOR), '45% 450.0K');
  // 阈值可配
  assert.ok(
    widgets.context(mk(220648), { tokensWarn: 100000, tokensDanger: 500000 }, COLORON)
      .startsWith('\x1b[33m')
  );
  // total 缺失时回退 current_usage 求和
  const viaUsage = {
    context_window: {
      used_percentage: 100,
      context_window_size: 200000,
      current_usage: { input_tokens: 189, cache_creation_input_tokens: 3609, cache_read_input_tokens: 216850 },
    },
    exceeds_200k_tokens: true,
  };
  assert.strictEqual(
    widgets.context(viaUsage, {}, { ...NOCOLOR, thresholds: { warn: 50, danger: 20 } }),
    '22% 220.6K'
  );
});

test('context: 显式 1M 窗口与真·200K 用满不受绝对量模式影响', () => {
  const t = { colorOn: false, thresholds: { warn: 50, danger: 20 } };
  // 显式 [1m]：window_size=1M，百分比正确，即使 exceeds=true 也走百分比
  const oneM = {
    context_window: { used_percentage: 22, context_window_size: 1000000 },
    exceeds_200k_tokens: true,
  };
  assert.strictEqual(widgets.context(oneM, {}, t), '22%');
  // 真·200K 模型用满（无 exceeds 标志）：100% 红色是正确警示
  const full = { context_window: { used_percentage: 100, context_window_size: 200000 } };
  assert.strictEqual(widgets.context(full, {}, t), '100%');
});

test('bigContext: 1M 窗口 / exceeds_200k / 常规会话隐藏', () => {
  assert.strictEqual(
    widgets.bigContext({ context_window: { context_window_size: 1000000 } }, {}, NOCOLOR), '1M'
  );
  assert.strictEqual(
    widgets.bigContext(
      { context_window: { context_window_size: 200000 }, exceeds_200k_tokens: true }, {}, NOCOLOR
    ),
    '>200K'
  );
  assert.strictEqual(
    widgets.bigContext(
      { context_window: { context_window_size: 200000 }, exceeds_200k_tokens: false }, {}, NOCOLOR
    ),
    null
  );
  assert.strictEqual(widgets.bigContext({}, {}, NOCOLOR), null);
});

test('sessionName: code point 截断（中文安全）+ maxLen 配置', () => {
  assert.strictEqual(
    widgets.sessionName({ session_name: '短名' }, {}, NOCOLOR), '短名'
  );
  assert.strictEqual(
    widgets.sessionName({ session_name: '一二三四五六七八九十一二三' }, {}, NOCOLOR),
    '一二三四五六七八九十一二…'
  );
  assert.strictEqual(
    widgets.sessionName({ session_name: 'abcdefgh' }, { maxLen: 4 }, NOCOLOR), 'abcd…'
  );
  assert.strictEqual(widgets.sessionName({}, {}, NOCOLOR), null);
  assert.strictEqual(widgets.sessionName({ session_name: '' }, {}, NOCOLOR), null);
});

test('fastMode / thinking: 开启才显示', () => {
  assert.strictEqual(widgets.fastMode({ fast_mode: true }, {}, NOCOLOR), '⚡fast');
  assert.strictEqual(widgets.fastMode({ fast_mode: false }, {}, NOCOLOR), null);
  assert.strictEqual(widgets.fastMode({}, {}, NOCOLOR), null);
  assert.strictEqual(widgets.thinking({ thinking: { enabled: true } }, {}, NOCOLOR), 'think');
  assert.strictEqual(widgets.thinking({ thinking: { enabled: false } }, {}, NOCOLOR), null);
  assert.strictEqual(widgets.thinking({}, {}, NOCOLOR), null);
});

test('tokens: transcript 真累计（widget 级，stateDir 注入）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccline-tokens-test-'));
  const transcript = path.join(dir, 't.jsonl');
  fs.writeFileSync(
    transcript,
    '{"type":"assistant","message":{"id":"m1","usage":{"input_tokens":1500,"output_tokens":300,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}\n'
  );
  const out = widgets.tokens(
    { transcript_path: transcript, session_id: 'unit-test' }, { stateDir: dir }, NOCOLOR
  );
  assert.strictEqual(out, '1.5K↑300↓');
  // 无 transcript → 隐藏
  assert.strictEqual(widgets.tokens({}, { stateDir: dir }, NOCOLOR), null);
});
