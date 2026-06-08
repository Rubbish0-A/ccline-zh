#!/usr/bin/env node
'use strict';

/**
 * 卸载：从 settings.json 移除 ccline-zh 的 statusLine 字段，保留其余配置。
 * 防御：仅当 command 含 "statusline.js" 时才移除，避免误删用户其它 statusLine。
 * 测试可用 CCLINE_SETTINGS 指向临时文件。
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function settingsPath() {
  return (
    process.env.CCLINE_SETTINGS ||
    path.join(os.homedir(), '.claude', 'settings.json')
  );
}

function main() {
  const sp = settingsPath();
  if (!fs.existsSync(sp)) {
    process.stdout.write('settings.json 不存在，无需卸载。\n');
    return;
  }
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(sp, 'utf8').replace(/^﻿/, ''));
  } catch {
    process.stdout.write('settings.json 无法解析，未改动。\n');
    return;
  }
  if (!settings.statusLine) {
    process.stdout.write('未发现 statusLine 配置，无需卸载。\n');
    return;
  }
  const cmd = String((settings.statusLine && settings.statusLine.command) || '');
  if (!cmd.includes('statusline.js')) {
    process.stdout.write(
      '当前 statusLine 似乎不是 ccline-zh（command 不含 statusline.js），未改动。\n' +
        '如需手动移除，请编辑 ' + sp + '\n'
    );
    return;
  }
  try {
    fs.copyFileSync(sp, sp + '.bak');
  } catch {
    // 备份失败不阻断
  }
  delete settings.statusLine;
  fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  process.stdout.write(
    '✓ 已移除 statusLine 配置（其余保留，原配置备份为 settings.json.bak）。重启 Claude Code 生效。\n'
  );
}

main();
