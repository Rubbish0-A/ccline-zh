'use strict';

/**
 * 纯格式化工具：数字、路径、时长、进度条。
 * 约定：输入无效（NaN/负数/空）一律返回 null，由调用方决定是否隐藏该字段。
 */

/** 数字 → 带 K/M 后缀的紧凑字符串。1234 → "1.2K"，2_500_000 → "2.5M"。 */
function fmtCount(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

/**
 * 路径 → 末 segments 段，并把 Windows 反斜杠归一为正斜杠。
 * 段数不足则原样返回；超出则前缀 "…/"。
 */
function shortenPath(p, segments = 2) {
  if (!p) return null;
  const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length <= segments) return parts.join('/');
  return '…/' + parts.slice(-segments).join('/');
}

/** 毫秒 → 人类可读时长。90s → "1m30s"，3700s → "1h1m"。 */
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return totalSec + 's';
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return totalMin + 'm' + (totalSec % 60) + 's';
  const hours = Math.floor(totalMin / 60);
  return hours + 'h' + (totalMin % 60) + 'm';
}

/** 已用百分比 → 文本进度条。usedPct=30 → "[███░░░░░░░]"。 */
function bar(usedPct, width = 10) {
  const pct = Math.max(0, Math.min(100, Number(usedPct) || 0));
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

/**
 * 距 resetSec（unix 秒）的倒计时。nowMs 可注入便于测试（默认 Date.now()）。
 * 已过期→'即将重置'；非数字/缺失→null；超 7 天（时钟异常）→null。
 */
function fmtCountdown(resetSec, nowMs = Date.now()) {
  if (!Number.isFinite(resetSec)) return null;
  const diffSec = Math.round(resetSec - nowMs / 1000);
  if (diffSec <= 0) return '即将重置';
  if (diffSec > 7 * 24 * 3600) return null; // 上界保护
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  return (h > 0 ? h + 'h' + m + 'm' : m + 'm') + '后重置';
}

module.exports = { fmtCount, shortenPath, fmtDuration, bar, fmtCountdown };
