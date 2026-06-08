#!/usr/bin/env node
'use strict';

/**
 * 零依赖打包器：把 src/ 的各模块拼成自包含单文件 statusline.js（仓库根）。
 *
 * 原理：内联一个迷你 __require + 模块注册表。每个 src 模块包成一个工厂函数，
 * 模块内 `require('./x')` 改写为 `__require('x')`；`require('node:*')` 落到
 * __require 的兜底分支走真实 require。入口 statusline 的 `require.main === module`
 * 守卫在打包版里恒为 true（单文件直接运行即入口）。
 *
 * 这样产物完全自包含（不依赖 src/），可被用户裸 copy 到任意位置运行。
 */

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const OUT = path.join(__dirname, '..', 'statusline.js');
// 注册顺序（惰性加载，顺序其实不敏感，但按依赖排列更直观）
const MODULES = ['colors', 'format', 'git', 'config', 'widgets', 'statusline'];

function readModule(name) {
  let code = fs.readFileSync(path.join(SRC, name + '.js'), 'utf8');
  code = code.replace(/^#!.*\r?\n/, ''); // 去 shebang
  // 内部相对依赖 require('./x') → __require('x')
  code = code.replace(/require\('\.\/([^']+)'\)/g, "__require('$1')");
  // 入口守卫：打包版单文件直接运行即入口
  if (name === 'statusline') {
    code = code.replace('require.main === module', 'true');
  }
  return code;
}

const header = [
  '#!/usr/bin/env node',
  "'use strict';",
  '/* ccline-zh —— 打包单文件，由 scripts/bundle.js 自动生成，请勿手改。',
  '   源码见 src/；修改后运行 `npm run build` 重新生成。 */',
  '',
  'const __mods = {};',
  'function __require(id) {',
  '  const m = __mods[id];',
  '  if (!m) return require(id);', // node:* 等走真实 require
  '  if (m.cached) return m.cached.exports;',
  '  const module = { exports: {} };',
  '  m.cached = module;',
  '  m.fn(module, module.exports, __require);',
  '  return module.exports;',
  '}',
  '',
].join('\n');

let out = header + '\n';
for (const name of MODULES) {
  const code = readModule(name);
  out += `__mods['${name}'] = { fn: function (module, exports, require) {\n`;
  out += code;
  out += `\n} };\n\n`;
}
out += "__require('statusline');\n";

fs.writeFileSync(OUT, out, 'utf8');
process.stdout.write('✓ 已生成单文件: ' + OUT + ' (' + out.length + ' 字节)\n');
