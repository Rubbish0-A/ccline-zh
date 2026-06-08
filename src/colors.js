'use strict';

/**
 * ANSI 颜色工具：着色、按阈值选色、颜色开关。
 * 纯函数，无副作用（colorEnabled 只读环境变量）。
 */

const RESET = '\x1b[0m';

const CODES = {
  reset: RESET,
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * 是否启用颜色。statusLine 子进程 stdout 不是 TTY（探测不可靠），
 * 而 Claude Code 渲染层支持 ANSI，因此默认开启。
 * 尊重通用约定 NO_COLOR，以及本项目自有开关 CCLINE_NO_COLOR。
 */
function colorEnabled(env = process.env) {
  if (env.NO_COLOR) return false; // https://no-color.org/
  if (env.CCLINE_NO_COLOR) return false;
  return true;
}

/** 给 text 套上 color 的 ANSI 码；enabled=false 或未知色名时原样返回。 */
function paint(color, text, enabled) {
  if (!enabled) return text;
  const code = CODES[color];
  if (!code) return text;
  return code + text + RESET;
}

/**
 * 按"剩余百分比"选颜色：剩得越少越红。
 * thresholds: { warn, danger } —— 剩余 < danger 红，< warn 黄，否则绿。
 */
function colorByRemaining(remaining, thresholds) {
  const t = thresholds || { warn: 50, danger: 20 };
  if (remaining < t.danger) return 'red';
  if (remaining < t.warn) return 'yellow';
  return 'green';
}

/** 按"已用百分比"选颜色（用得越多越红）。 */
function colorByUsed(used, thresholds) {
  return colorByRemaining(100 - used, thresholds);
}

module.exports = { CODES, RESET, colorEnabled, paint, colorByRemaining, colorByUsed };
