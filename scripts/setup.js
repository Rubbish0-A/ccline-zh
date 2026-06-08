#!/usr/bin/env node
'use strict';

/**
 * ccline-zh 安装器：把本插件内的 statusline.js 注册进 ~/.claude/settings.json 的 statusLine。
 *
 * 设计要点：
 *  - 用 __dirname 解析脚本的真实绝对路径写入 command —— 不依赖 ${CLAUDE_PLUGIN_ROOT}
 *    在 statusLine 子进程展开（Issue #52079：该变量对 statusLine 不注入）。
 *  - 只改 statusLine 字段，保留 settings.json 其余全部内容；写入前自动备份。
 *  - 幂等：重复运行只覆盖 statusLine。
 *  - 测试可用 CCLINE_SETTINGS 环境变量把目标 settings 指向临时文件。
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/** 解析要写入 command 的 statusline.js 绝对路径。优先 bundle 单文件，回退 src/。 */
function resolveStatuslinePath() {
  const pluginRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(pluginRoot, 'statusline.js'), // bundle 产物
    path.join(pluginRoot, 'src', 'statusline.js'), // 开发期源码
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]; // 都不存在也返回首选，便于提示
}

function settingsPath() {
  return (
    process.env.CCLINE_SETTINGS ||
    path.join(os.homedir(), '.claude', 'settings.json')
  );
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  } catch {
    return {};
  }
}

function main() {
  const scriptPath = resolveStatuslinePath();
  const sp = settingsPath();
  const dir = path.dirname(sp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const exists = fs.existsSync(sp);
  const settings = exists ? readJsonSafe(sp) : {};

  if (exists) {
    try {
      fs.copyFileSync(sp, sp + '.bak');
    } catch {
      // 备份失败不阻断安装，但会在输出里少一行提示
    }
  }

  // 只动 statusLine，其余原样保留
  settings.statusLine = {
    type: 'command',
    command: `node "${scriptPath}"`,
    padding: 0,
  };

  fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  const lines = [
    '✓ ccline-zh 状态栏已写入配置',
    '  脚本: ' + scriptPath,
    '  配置: ' + sp + (exists ? '（原配置已备份为 settings.json.bak）' : '（新建）'),
  ];
  if (!fs.existsSync(scriptPath)) {
    lines.push('  ⚠️ 警告：statusline.js 当前不存在，请先运行 `npm run build` 生成单文件。');
  }
  lines.push('  ➜ 请重启 Claude Code 使状态栏生效。');
  lines.push('  ➜ 自定义：复制 statusline.config.example.json 为 ~/.claude/ccline-zh.config.json 后编辑。');
  process.stdout.write(lines.join('\n') + '\n');
}

main();
