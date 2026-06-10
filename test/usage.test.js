'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { cumulative } = require('../src/usage');

/** 造一行 transcript assistant 记录（与 CC 真实 JSONL 同构）。 */
function row(id, tin, tout, cacheCreate = 0, cacheRead = 0) {
  return (
    JSON.stringify({
      type: 'assistant',
      message: {
        id,
        usage: {
          input_tokens: tin,
          output_tokens: tout,
          cache_creation_input_tokens: cacheCreate,
          cache_read_input_tokens: cacheRead,
        },
      },
    }) + '\n'
  );
}

/** 每个用例独立临时目录：transcript + state 互不污染。 */
function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccline-usage-test-'));
  return { dir, transcript: path.join(dir, 'session.jsonl') };
}

test('usage: 基本统计（input 侧 = input+cache_creation+cache_read）', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(
    transcript,
    '{"type":"user","message":{}}\n' +
      row('msg_a', 10, 5, 100, 1000) +
      'not json at all\n' +
      row('msg_b', 20, 7, 0, 2000)
  );
  const got = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 10 + 100 + 1000 + 20 + 2000, tout: 12 });
});

test('usage: 相邻同 message.id 行只计一次（content block 拆行去重）', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(
    transcript,
    row('msg_a', 10, 5, 0, 100) + row('msg_a', 10, 5, 0, 100) + row('msg_a', 10, 5, 0, 100) +
      row('msg_b', 1, 1, 0, 0)
  );
  const got = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 110 + 1, tout: 6 });
});

test('usage: 去重跨增量批次有效（lastId 持久化）', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(transcript, row('msg_a', 10, 5, 0, 0));
  cumulative(transcript, 'sess1234', { stateDir: dir });
  // 第二批以同 id 开头（同一条消息的后续 block 在下次刷新间隔里写入）
  fs.appendFileSync(transcript, row('msg_a', 10, 5, 0, 0) + row('msg_b', 3, 2, 0, 0));
  const got = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 13, tout: 7 });
});

test('usage: 增量读取——第二次统计不重读旧字节', () => {
  const { dir, transcript } = setup();
  const first = row('msg_a', 100, 50, 0, 0);
  fs.writeFileSync(transcript, first);
  const got1 = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got1, { tin: 100, tout: 50 });

  // 把已统计的旧字节原位破坏（长度不变），再追加新行。
  // 真·增量实现只读新增部分 → 旧内容被破坏也不影响累计。
  fs.writeFileSync(transcript, ' '.repeat(first.length));
  fs.appendFileSync(transcript, row('msg_b', 7, 3, 0, 0));
  const got2 = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got2, { tin: 107, tout: 53 });
});

test('usage: 不完整尾行不计入、补全后计入', () => {
  const { dir, transcript } = setup();
  const half = row('msg_b', 5, 5, 0, 0);
  const cut = Math.floor(half.length / 2);
  fs.writeFileSync(transcript, row('msg_a', 1, 1, 0, 0) + half.slice(0, cut));
  const got1 = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got1, { tin: 1, tout: 1 });

  fs.appendFileSync(transcript, half.slice(cut));
  const got2 = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got2, { tin: 6, tout: 6 });
});

test('usage: 文件被截断（size < offset）→ 全量重算', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(transcript, row('msg_a', 10, 5, 0, 0) + row('msg_b', 20, 6, 0, 0));
  cumulative(transcript, 'sess1234', { stateDir: dir });

  fs.writeFileSync(transcript, row('msg_c', 3, 2, 0, 0)); // 更短的新内容
  const got = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 3, tout: 2 });
});

test('usage: transcript 路径变化（resume 换文件）→ 重算不混账', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(transcript, row('msg_a', 10, 5, 0, 0));
  cumulative(transcript, 'sess1234', { stateDir: dir });

  const other = path.join(dir, 'other.jsonl');
  fs.writeFileSync(other, row('msg_z', 1, 1, 0, 0));
  const got = cumulative(other, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 1, tout: 1 });
});

test('usage: state 文件损坏 → 静默全量重算', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(transcript, row('msg_a', 10, 5, 0, 0));
  cumulative(transcript, 'sess1234', { stateDir: dir });
  const stateFiles = fs.readdirSync(dir).filter((f) => f.startsWith('ccline-zh-usage-'));
  assert.strictEqual(stateFiles.length, 1);
  fs.writeFileSync(path.join(dir, stateFiles[0]), '{broken');

  fs.appendFileSync(transcript, row('msg_b', 2, 2, 0, 0));
  const got = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 12, tout: 7 });
});

test('usage: 缺文件/空参数 → null（widget 隐藏约定）', () => {
  const { dir } = setup();
  assert.strictEqual(cumulative(path.join(dir, 'nope.jsonl'), 's', { stateDir: dir }), null);
  assert.strictEqual(cumulative('', 's', { stateDir: dir }), null);
  assert.strictEqual(cumulative(null, 's', { stateDir: dir }), null);
});

test('usage: 空 transcript（0 字节）→ 零值而非 null', () => {
  const { dir, transcript } = setup();
  fs.writeFileSync(transcript, '');
  const got = cumulative(transcript, 'sess1234', { stateDir: dir });
  assert.deepStrictEqual(got, { tin: 0, tout: 0 });
});
