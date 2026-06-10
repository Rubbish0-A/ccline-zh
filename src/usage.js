'use strict';

/**
 * 会话累计 token 统计：从 transcript JSONL 增量读取 assistant usage 行累加。
 *
 * 背景：CC 2.1.x 起 stdin 的 context_window.total_*_tokens 语义已变为「当前
 * 上下文内容」（= current_usage 之和），不再是会话累计。要拿到与计费体感一致
 * 的真累计（含 cache），只能自己统计 transcript。
 *
 * 设计：
 *  - 增量读取：state 缓存（tmpdir）记 { path, offset, tin, tout, lastId }，
 *    每次刷新只读 offset 之后的新增字节；offset 只推进到最后一个完整行的行尾
 *    （字节级找 '\n'，容忍 CC 正在写入的不完整尾行与 UTF-8 多字节字符）。
 *  - 去重：同一条 assistant 消息的多个 content block 会拆成多行、各带相同
 *    usage（实测一条消息最多重复 7 行）。重复行总是相邻 → 只需记住最后一个
 *    已计入的 message.id。
 *  - 兜底：任何异常返回 null（widget 隐藏约定）；state 损坏/截断/换文件一律
 *    全量重算，绝不抛错。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** 单次增量读取上限；超长会话冷启动只统计末尾部分，避免阻塞渲染。 */
const MAX_READ_BYTES = 64 * 1024 * 1024;

/** state 文件路径：按 session 前 16 位隔离，多会话并发互不干扰（碰撞→互踩重算，仅性能损失）。 */
function statePath(sessionId, stateDir) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9-]/g, '').slice(0, 16) || 'unknown';
  return path.join(stateDir, 'ccline-zh-usage-' + safe + '.json');
}

/** 读 state；缺失/损坏/字段非法 → null（调用方按全量重算处理）。 */
function readState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!s || typeof s !== 'object') return null;
    if (typeof s.path !== 'string') return null;
    if (!Number.isInteger(s.offset) || s.offset < 0) return null;
    if (!Number.isFinite(s.tin) || !Number.isFinite(s.tout)) return null;
    return s;
  } catch {
    return null;
  }
}

/** 从 buf 中解析完整行，返回新累计（不修改入参对象）。 */
function consumeLines(buf, acc) {
  const lastNl = buf.lastIndexOf(0x0a);
  if (lastNl === -1) return { consumed: 0, tin: acc.tin, tout: acc.tout, lastId: acc.lastId };

  let { tin, tout, lastId } = acc;
  const lines = buf.slice(0, lastNl + 1).toString('utf8').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.replace(/^﻿/, '').trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue; // 完整但非 JSON 的行（不应出现），跳过不影响 offset
    }
    if (!obj || obj.type !== 'assistant') continue;
    const msg = obj.message;
    const u = msg && msg.usage;
    if (!u || typeof u !== 'object') continue;
    const id = msg.id;
    // 同消息拆行去重：依赖「重复行总是相邻」（2.1.170 实测成立）；
    // 若 CC 未来出现非相邻同 id 行，需改为有界 Set 去重
    if (id && id === lastId) continue;
    tin +=
      (u.input_tokens || 0) +
      (u.cache_creation_input_tokens || 0) +
      (u.cache_read_input_tokens || 0);
    tout += u.output_tokens || 0;
    if (id) lastId = id;
  }
  return { consumed: lastNl + 1, tin, tout, lastId };
}

/**
 * 会话累计 usage。
 * @param {string} transcriptPath - stdin 的 transcript_path
 * @param {string} sessionId - stdin 的 session_id（state 文件隔离用）
 * @param {object} [opts] - { stateDir } 测试注入；默认 os.tmpdir()
 * @returns {{tin:number, tout:number} | null} tin = input+cache_creation+cache_read 累计
 */
function cumulative(transcriptPath, sessionId, opts = {}) {
  try {
    if (!transcriptPath || typeof transcriptPath !== 'string') return null;
    const stateDir = opts.stateDir || os.tmpdir();

    let size;
    try {
      size = fs.statSync(transcriptPath).size;
    } catch {
      return null; // transcript 不存在：widget 隐藏
    }

    const sFile = statePath(sessionId, stateDir);
    let state = readState(sFile);
    // 换文件（resume）或被截断（重写）→ 全量重算
    if (!state || state.path !== transcriptPath || state.offset > size) {
      state = { path: transcriptPath, offset: 0, tin: 0, tout: 0, lastId: null };
    }
    if (size === state.offset) return { tin: state.tin, tout: state.tout };

    // 超长增量保护：增量超限时只读末尾 MAX_READ_BYTES，**有意丢弃**
    // [offset, size-MAX) 区间（接受有限低估，statusline 正常体量不可达）；
    // 截断起点落在行中间时首个不完整行 parse 失败被自然跳过
    const start = Math.max(state.offset, size - MAX_READ_BYTES);

    const len = size - start;
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(transcriptPath, 'r');
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(fd, buf, 0, len, start);
    } finally {
      fs.closeSync(fd);
    }

    const next = consumeLines(buf.slice(0, bytesRead), state);
    const newState = {
      path: transcriptPath,
      offset: start + next.consumed,
      tin: next.tin,
      tout: next.tout,
      lastId: next.lastId,
    };
    try {
      fs.writeFileSync(sFile, JSON.stringify(newState));
    } catch {
      // state 写失败仅损失下次的增量优化，不影响本次结果
    }
    return { tin: newState.tin, tout: newState.tout };
  } catch {
    return null;
  }
}

module.exports = { cumulative, statePath };
