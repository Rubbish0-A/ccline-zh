'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const { fmtCount, shortenPath, fmtDuration, bar } = require('../src/format');
const { colorByRemaining, paint, colorEnabled } = require('../src/colors');
const { mergeConfig, DEFAULT_CONFIG, clone } = require('../src/config');
const { getBranch } = require('../src/git');

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
