'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { render } = require('../src/statusline');
const { DEFAULT_CONFIG, clone } = require('../src/config');

const FIX = path.join(__dirname, 'fixtures');
const load = (name) => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** 默认集去掉 git（git 行为由 units 用临时 .git 覆盖），用于测"默认行"。 */
function cfgNoGit() {
  const c = clone(DEFAULT_CONFIG);
  c.widgets = c.widgets.filter((w) => w.type !== 'git');
  return c;
}

/** 显式开启指定字段、进度条关，用于稳定测"字段内容"，与默认开关变化解耦。 */
function cfgFields(types) {
  return {
    separator: ' │ ',
    separatorColor: 'gray',
    pathSegments: 2,
    thresholds: { warn: 50, danger: 20 },
    widgets: types.map((t) => {
      const w = { type: t, enabled: true, label: '' };
      if (t === 'context') {
        w.label = '上下文';
        w.bar = false;
      }
      if (t === 'tokens') w.label = '用量';
      return w;
    }),
  };
}

function renderText(input, cfg) {
  process.env.NO_COLOR = '1';
  return stripAnsi(render(input, cfg || cfgNoGit()));
}

test('默认行（full, 去 git）: 精确整行（effort 在 model 后；tokens 因无 transcript 隐藏）', () => {
  const out = renderText(load('full.json'));
  assert.strictEqual(
    out,
    '#a1b2c3d4 │ Fable 5 │ xhigh │ …/ccline-zh/src │ +156/-23 │ 上下文 [████░░░░░░] 43% │ 5h 70%剩 7d 88%剩'
  );
});

test('tokens 真累计: transcript fixture 增量统计 + 去重', () => {
  const input = load('full.json');
  input.transcript_path = path.join(FIX, 'transcript.jsonl');
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccline-render-test-'));
  const cfg = {
    separator: ' │ ',
    separatorColor: 'gray',
    pathSegments: 2,
    thresholds: { warn: 50, danger: 20 },
    widgets: [{ type: 'tokens', enabled: true, label: '用量', stateDir }],
  };
  // fixture：msg_01 重复两行（去重计一次 1110/5），msg_02 计 5000000/50000
  assert.strictEqual(renderText(input, cfg), '用量 5.0M↑50.0K↓');
  // 第二次渲染走 state 缓存热路径，结果一致
  assert.strictEqual(renderText(input, cfg), '用量 5.0M↑50.0K↓');
});

test('context 进度条渲染', () => {
  const cfg = {
    separator: ' │ ',
    separatorColor: 'gray',
    pathSegments: 2,
    thresholds: { warn: 50, danger: 20 },
    widgets: [{ type: 'context', enabled: true, label: '上下文', bar: true }],
  };
  const out = renderText(load('full.json'), cfg);
  assert.strictEqual(out, '上下文 [████░░░░░░] 43%');
});

test('rateLimit bar 模式: 已用条 + 剩余%', () => {
  const cfg = {
    separator: ' │ ',
    separatorColor: 'gray',
    pathSegments: 2,
    thresholds: { warn: 50, danger: 20 },
    widgets: [{ type: 'rateLimit', enabled: true, label: '', bar: true }],
  };
  const out = renderText(load('full.json'), cfg);
  assert.ok(out.includes('5h [███░░░░░░░] 70%剩'));
  assert.ok(out.includes('7d [█░░░░░░░░░] 88%剩'));
});

test('api-key-user: 无 rate_limits → 无额度段，context 仍在', () => {
  const out = renderText(load('api-key-user.json'), cfgFields(['model', 'context', 'rateLimit', 'lines']));
  assert.ok(out.includes('Sonnet 4.6'));
  assert.ok(out.includes('上下文 15%'));
  assert.ok(out.includes('+10/-3'));
  assert.ok(!out.includes('剩'), '不应出现 5h/7d 额度段');
});

test('session-start: 无 session_id/context → 仅模型 + 目录', () => {
  const out = renderText(load('session-start.json'));
  assert.strictEqual(out, 'Opus 4.8 │ repo');
});

test('1m-context: used_percentage 不出错 + bigContext 显示 1M 标记', () => {
  const out = renderText(load('1m-context.json'), cfgFields(['context', 'bigContext', 'tokens']));
  assert.ok(out.includes('上下文 8%'));
  assert.ok(out.includes('1M'));
  assert.ok(!out.includes('用量'), '无 transcript 时 tokens 段应隐藏');
});

test('huge-numbers: 大数格式化 + 200K 会话无 bigContext 标记', () => {
  const out = renderText(load('huge-numbers.json'), cfgFields(['lines', 'bigContext', 'context']));
  assert.ok(out.includes('+999999/-123456'));
  assert.ok(out.includes('上下文 99%'));
  assert.ok(!out.includes('1M') && !out.includes('>200K'));
});

test('新 widget 内容: sessionName 原样 / thinking 指示 / fastMode=false 隐藏', () => {
  const out = renderText(load('full.json'), cfgFields(['sessionName', 'fastMode', 'thinking']));
  assert.strictEqual(out, '升级状态栏适配新模型 │ think');
});

test('exceeds-200k 实况 fixture: 百分比按 1M 重算 + 绝对量，>200K 标记同现', () => {
  const out = renderText(load('exceeds-200k.json'), cfgFields(['model', 'context', 'bigContext']));
  assert.ok(out.includes('Fable 5'));
  assert.ok(out.includes('上下文 22% 220.6K'), `应显示 1M 口径百分比+绝对量，实际: ${out}`);
  assert.ok(out.includes('>200K'));
  assert.ok(!out.includes('100%'), '不应再显示被 cap 的 100%');
});

test('exceeds-200k + bar: 进度条按 1M 口径填充', () => {
  const cfg = {
    separator: ' │ ',
    separatorColor: 'gray',
    pathSegments: 2,
    thresholds: { warn: 50, danger: 20 },
    widgets: [{ type: 'context', enabled: true, label: '上下文', bar: true }],
  };
  assert.strictEqual(renderText(load('exceeds-200k.json'), cfg), '上下文 [██░░░░░░░░] 22% 220.6K');
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
