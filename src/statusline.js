#!/usr/bin/env node
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

const widgets = require('./widgets');
const { loadConfig, DEFAULT_CONFIG, clone } = require('./config');
const { colorEnabled, paint } = require('./colors');

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
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(0));
}

module.exports = { render };
