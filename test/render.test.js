'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { render } = require('../src/statusline');
const { DEFAULT_CONFIG, clone } = require('../src/config');

const FIX = path.join(__dirname, 'fixtures');
const load = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * 测试统一禁色 + 去掉 git widget：git 行为由 units.test 用临时 .git 覆盖，
 * 这里去掉它以保证渲染快照与运行环境的真实 git 状态无关、稳定可断言。
 */
function cfgNoGit() {
  const c = clone(DEFAULT_CONFIG);
  c.widgets = c.widgets.filter((w) => w.type !== 'git');
  return c;
}
function renderText(input, cfg) {
  process.env.NO_COLOR = '1';
  return stripAnsi(render(input, cfg || cfgNoGit()));
}

test('full: 精确整行', () => {
  const out = renderText(load('full.json'));
  assert.strictEqual(
    out,
    'Opus 4.8 │ …/ccline-zh/src │ +156/-23 │ 上下文 34% │ 用量 1.3M↑45.0K↓ │ 5h 70%剩 7d 88%剩'
  );
});

test('api-key-user: 无 rate_limits → 无额度段，context 仍在', () => {
  const out = renderText(load('api-key-user.json'));
  assert.ok(out.includes('Sonnet 4.6'));
  assert.ok(out.includes('上下文 15%'));
  assert.ok(out.includes('+10/-3'));
  assert.ok(!out.includes('剩'), '不应出现 5h/7d 额度段');
});

test('session-start: 仅模型 + 目录', () => {
  const out = renderText(load('session-start.json'));
  assert.strictEqual(out, 'Opus 4.8 │ repo');
});

test('1m-context: used_percentage 不因 1M 窗口出错', () => {
  const out = renderText(load('1m-context.json'));
  assert.ok(out.includes('上下文 8%'));
  assert.ok(out.includes('用量 80.0K↑20.0K↓'));
});

test('huge-numbers: 大数 K/M 化', () => {
  const out = renderText(load('huge-numbers.json'));
  assert.ok(out.includes('+999999/-123456'));
  assert.ok(out.includes('用量 5.0M↑2.5M↓'));
  assert.ok(out.includes('上下文 99%'));
});

test('missing-fields: 全缺 → 空行但不崩', () => {
  const out = renderText(load('missing-fields.json'));
  assert.strictEqual(out, '');
});

test('性能: 单次 render < 50ms（含 git widget 文件 IO）', () => {
  const input = load('full.json');
  const cfg = clone(DEFAULT_CONFIG);
  const t0 = process.hrtime.bigint();
  render(input, cfg);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 50, `render 耗时 ${ms.toFixed(2)}ms，超过 50ms`);
});
