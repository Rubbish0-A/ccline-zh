'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'src', 'statusline.js');
const FIX = path.join(__dirname, 'fixtures');

/** 以真实子进程运行 statusline.js，喂 stdin，返回 {status, stdout, stderr}。 */
function run(input) {
  return spawnSync(process.execPath, [SCRIPT], {
    input,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

test('malformed JSON → 退出码 0 且输出非空白（不黑屏）', () => {
  const r = run('{ not json');
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.trim().length > 0);
});

test('空 stdin → 退出码 0', () => {
  const r = run('');
  assert.strictEqual(r.status, 0);
});

test('full fixture 经真实进程 → 退出码 0 且含模型名与 effort', () => {
  const r = run(fs.readFileSync(path.join(FIX, 'full.json'), 'utf8'));
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('Fable 5'));
  assert.ok(r.stdout.includes('xhigh'));
});

test('missing-fields 经进程 → 退出码 0 且兜底显示工具名（不空白）', () => {
  const r = run(fs.readFileSync(path.join(FIX, 'missing-fields.json'), 'utf8'));
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('ccline-zh'), '渲染为空时应兜底显示工具名');
});
