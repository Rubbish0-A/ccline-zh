#!/usr/bin/env node
'use strict';

/**
 * 零依赖语法检查：对 src/ scripts/ test/ 下所有 .js 跑 `node --check`。
 * 作为本项目的 lint 兜底——不引入 eslint，保持"零依赖"承诺。
 * 用法：node scripts/check.js  （或 npm run check）
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function collectJsFiles(dir) {
  let result = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result; // 目录不存在则跳过
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result = result.concat(collectJsFiles(full));
    } else if (entry.name.endsWith('.js')) {
      result.push(full);
    }
  }
  return result;
}

const root = path.resolve(__dirname, '..');
const targets = ['src', 'scripts', 'test'].flatMap((d) =>
  collectJsFiles(path.join(root, d))
);
// 根目录的 bundle 产物（若存在）也检查
const rootBundle = path.join(root, 'statusline.js');
if (fs.existsSync(rootBundle)) targets.push(rootBundle);

if (targets.length === 0) {
  console.log('没有找到 .js 文件可检查（项目骨架阶段，正常）。');
  process.exit(0);
}

let failed = 0;
for (const file of targets) {
  const rel = path.relative(root, file);
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('  ok   ' + rel);
  } catch (err) {
    failed++;
    console.error(' FAIL  ' + rel);
    const detail = err.stderr ? err.stderr.toString() : err.message;
    console.error(detail.trim());
  }
}

if (failed > 0) {
  console.error(`\n${failed} 个文件未通过 node --check`);
  process.exit(1);
}
console.log(`\n全部 ${targets.length} 个文件通过 node --check`);
