# ccline-zh · Claude Code 中文状态栏

> 为 **Windows / 中文** 用户打造的**零依赖单文件** Claude Code 状态栏。
> Marketplace 装好跑一条命令即用，或直接复制一个 `statusline.js` 就能跑。

[![CI](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[English](./README.en.md)

---

## 效果

```
Opus 4.8 │ …/ccline-zh/src │ ⎇ main │ +156/-23 │ 上下文 34% │ 用量 1.3M↑45.0K↓ │ 5h 70%剩 7d 88%剩
  模型         目录          分支     代码增删    上下文占用     会话累计token       额度剩余
```

各段颜色按状态变化：额度 / 上下文剩余越少，由绿→黄→红预警。

## 为什么是它

[ccstatusline](https://github.com/sirmalloc/ccstatusline) 等成熟项目功能很全，但它们几乎都是 **mac/bash 优先、英文界面、依赖 npm/npx**。ccline-zh 只补它们没覆盖好的那块：

- **零依赖单文件** — 一个 `statusline.js`，复制到任意位置 `node` 就能跑，不需要 `npm install`，冷启动快。
- **Windows 一等公民** — PowerShell 安装脚本、绝对路径处理、`.git/HEAD` 纯文件读分支（不依赖 git CLI）、UTF-8/BOM 兼容。
- **中文界面** — 模型 / 目录 / 额度 / 上下文全中文标签。
- **坏一个字段也不黑屏** — 逐 widget 兜底，取不到的数据隐藏而非报错；JSON 解析失败给提示而非空白；退出码恒 0。
- **数据准确** — 区分「会话累计 token」与「当前上下文占用」，用 `context_window_size` 而非硬编码 200K（兼容 1M 模型）。

## 安装

### 方式 A：Marketplace 插件（推荐）

```text
/plugin marketplace add Rubbish0-A/ccline-zh
/plugin install ccline-zh
/ccline-zh:setup
```

`setup` 会自动定位插件内脚本的绝对路径、备份现有 `settings.json`、**只合并写入** `statusLine` 字段。完成后**重启 Claude Code** 生效。

### 方式 B：裸 copy 单文件

```powershell
# Windows
git clone https://github.com/Rubbish0-A/ccline-zh.git
cd ccline-zh
powershell -ExecutionPolicy Bypass -File scripts\install.ps1
```

```sh
# macOS / Linux
git clone https://github.com/Rubbish0-A/ccline-zh.git
cd ccline-zh
sh scripts/install.sh
```

> 最小裸装：只把仓库根的 `statusline.js`（已打包的自包含单文件）下载到任意位置，然后在 `~/.claude/settings.json` 里加：
> ```json
> { "statusLine": { "type": "command", "command": "node \"<你的路径>/statusline.js\"" } }
> ```

## 字段（widget）

| widget | 显示 | 数据来源 | 默认 |
|---|---|---|---|
| `model` | 模型名 | `model.display_name` | 开 |
| `dir` | 当前目录（末 N 段） | `workspace.current_dir` | 开 |
| `git` | `⎇ 分支`（可选 dirty `*`） | 读 `.git/HEAD` | 开 |
| `lines` | `+增/-删` | `cost.total_lines_added/removed` | 开 |
| `context` | 上下文已用 % | `context_window.used_percentage` | 开 |
| `tokens` | 会话累计 `输入↑输出↓` | `context_window.total_input/output_tokens` | 开 |
| `rateLimit` | `5h/7d 剩余%` | `rate_limits.*.used_percentage` | 开 |
| `cost` | `$花费` | `cost.total_cost_usd` | 关 |
| `duration` | 会话时长 | `cost.total_duration_ms` | 关 |

## 配置

复制仓库内 `statusline.config.example.json` 为 `~/.claude/ccline-zh.config.json` 后编辑（无需重装，下次刷新生效）。

```jsonc
{
  "separator": " │ ",          // 字段分隔符
  "pathSegments": 2,            // 目录显示末几段
  "thresholds": { "warn": 50, "danger": 20 },  // 剩余% 阈值：<danger 红，<warn 黄
  "widgets": [                 // 数组顺序 = 显示顺序；删除某项或 enabled:false 即隐藏
    { "type": "model", "enabled": true, "color": "cyan" },
    { "type": "git",   "enabled": true, "dirty": true, "symbol": "⎇ " },
    { "type": "cost",  "enabled": true }
  ]
}
```

- 查找顺序：`CCLINE_CONFIG` 环境变量 → 脚本同目录 → `~/.claude/ccline-zh.config.json`。
- 可用颜色：`cyan green yellow red blue magenta gray white`。
- 配置损坏或字段非法会**自动回落默认**，不影响运行。
- 关闭颜色：设环境变量 `NO_COLOR=1` 或 `CCLINE_NO_COLOR=1`。

## 已知限制

- **「安装即用」需要跑一次 `setup`** — Claude Code 的插件机制不能直接注入 statusLine（它是 `settings.json` 专属字段），所有 statusLine 插件都靠一条 setup 命令写配置。这是平台限制（[#52079](https://github.com/anthropics/claude-code/issues/52079)：`${CLAUDE_PLUGIN_ROOT}` 不注入 statusLine 子进程），本项目用 setup 写**绝对路径**规避。
- **`tokens` 是会话累计值**（含 cache，不随 auto-compact 回退）。想看「当前上下文还剩多少」请看 `context` 字段。
- **`rateLimit` 仅 claude.ai 订阅可见**，且需当次会话发生过至少一次 API 响应；API Key 直连用户取不到，该段自动隐藏，由 `context` 顶上。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1   # Windows
sh scripts/uninstall.sh                                          # macOS / Linux
```

仅移除 ccline-zh 的 statusLine 配置（command 含 `statusline.js` 才动），其余配置保留并备份。

## 开发

```sh
npm test          # node:test 单元 + 集成（25 用例）
npm run check     # 对 src/scripts/test 跑 node --check
npm run build     # 把 src/ 打包成自包含单文件 statusline.js
npm run demo      # 用 full fixture 跑一次看效果
```

- 源码在 `src/`（CommonJS、零运行依赖），发布用的单文件 `statusline.js` 由 `npm run build` 生成。
- **贡献者注意**：`.ps1` 脚本必须保持 **ASCII**（Windows PowerShell 5.1 按系统 ANSI 代码页读取，非 ASCII 会乱码崩溃）；中文提示放在 `setup.js`（Node UTF-8 stdout）。

## License

MIT © cjh
