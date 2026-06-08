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
    // ── 默认开（6 段，遵循"精选而非堆砌"）──
    { type: 'session', enabled: true, label: '', color: 'gray' },
    { type: 'model', enabled: true, label: '', color: 'cyan' },
    { type: 'dir', enabled: true, label: '', color: 'yellow', useProjectDir: false },
    { type: 'git', enabled: true, label: '', color: 'magenta', dirty: false, symbol: '⎇ ' },
    { type: 'context', enabled: true, label: '上下文', bar: true },
    { type: 'rateLimit', enabled: true, label: '', bar: false },
    // ── 默认关（按需在 ccline-zh.config.json 里设 enabled:true）──
    { type: 'lines', enabled: false, label: '' },
    { type: 'tokens', enabled: false, label: '用量', color: 'blue' },
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
