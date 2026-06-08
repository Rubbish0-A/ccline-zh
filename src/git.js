'use strict';

/**
 * git 信息读取——零依赖优先。
 *  - getBranch：纯文件方式（读 .git/HEAD），不依赖 git CLI、不 spawn 子进程。
 *  - isDirty：可选，必须用 git CLI 子进程，带超时；失败返回 null（未知）。
 * 任何错误都吞掉返回 null，绝不让 statusline 因 git 崩溃。
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** 从 startDir 向上逐级查找 .git（目录或文件），返回其路径或 null。 */
function findGitPath(startDir) {
  let cur = path.resolve(startDir);
  for (let i = 0; i < 50; i++) {
    const gitPath = path.join(cur, '.git');
    if (fs.existsSync(gitPath)) return gitPath;
    const parent = path.dirname(cur);
    if (parent === cur) break; // 抵达文件系统根
    cur = parent;
  }
  return null;
}

/**
 * 把 .git 解析为真正的 git 目录。
 * 普通仓库：.git 即目录。worktree/submodule：.git 是文件，内容形如 "gitdir: <path>"。
 */
function resolveGitDir(gitPath) {
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) return gitPath;
  const content = fs.readFileSync(gitPath, 'utf8').trim();
  const m = content.match(/^gitdir:\s*(.+)$/m);
  if (!m) return null;
  const target = m[1].trim();
  return path.isAbsolute(target)
    ? target
    : path.resolve(path.dirname(gitPath), target);
}

/**
 * 当前分支名；detached HEAD 返回短 commit hash；非仓库或异常返回 null。
 */
function getBranch(startDir) {
  try {
    if (!startDir) return null;
    const gitPath = findGitPath(startDir);
    if (!gitPath) return null;
    const gitDir = resolveGitDir(gitPath);
    if (!gitDir) return null;
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    if (ref) return ref[1].trim();
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head.slice(0, 7); // detached
    return null;
  } catch {
    return null;
  }
}

/**
 * 工作区是否有未提交改动。需要 git CLI；超时/不可用/出错返回 null（未知）。
 */
function isDirty(dir, timeoutMs = 800) {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], {
      cwd: dir,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      windowsHide: true,
    });
    return out.trim().length > 0;
  } catch {
    return null;
  }
}

module.exports = { getBranch, isDirty, findGitPath, resolveGitDir };
