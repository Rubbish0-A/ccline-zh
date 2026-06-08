# ccline-zh · Claude Code 中文状态栏

> 为 **Windows / 中文** 用户打造的**零依赖单文件** Claude Code 状态栏。
> Marketplace 装好跑一条命令即用，或直接复制一个 `statusline.js` 就能跑。

[![CI](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml/badge.svg)](https://github.com/Rubbish0-A/ccline-zh/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

[English](./README.en.md)

---

## 效果

```
#a1b2c3d4 │ Opus 4.8 │ …/ccline-zh/src │ ⎇ main │ +156/-23 │ 上下文 [███░░░░░░░] 34% │ 用量 1.3M↑45K↓ │ 5h 70%剩 7d 88%剩
 会话短码      模型         目录          分支    代码增删     上下文进度条          token用量       额度剩余
```

- **会话短码** `#a1b2c3d4`：多终端时一眼区分会话，`claude -r a1b2c3d4` 任意目录续上。
- **进度条**：上下文/额度可视化，剩余越少越由绿→黄→红预警（85%+ 上下文 Claude 会明显变笨，提前看到很关键）。

## 为什么是它

[ccstatusline](https://github.com/sirmalloc/ccstatusline) 等成熟项目功能很全，但几乎都是 **mac/bash 优先、英文、依赖 npm/npx**。ccline-zh 只补它们没覆盖好的那块：

- **零依赖单文件** — 一个 `statusline.js`，复制到任意位置 `node` 就能跑，无需 `npm install`，冷启动快。
- **Windows 一等公民** — PowerShell 安装、绝对路径处理、`.git/HEAD` 纯文件读分支（不依赖 git CLI）、UTF-8/BOM 兼容。
- **中文界面** — 全中文标签。
- **坏一个字段也不黑屏** — 逐 widget 兜底，取不到的隐藏；JSON 解析失败给提示；退出码恒 0。
- **数据准确** — 区分「会话累计 token」与「当前上下文占用」，用 `context_window_size` 而非硬编码 200K（兼容 1M 模型）。

## 安装

### 方式 A：Marketplace 插件（推荐）

```text
/plugin marketplace add Rubbish0-A/ccline-zh
/plugin install ccline-zh
/ccline-zh:setup
```

`setup` 自动定位脚本绝对路径、备份 `settings.json`、**只合并写入** `statusLine` 字段。完成后**重启 Claude Code** 生效。

### 方式 B：裸 copy 单文件

```powershell
git clone https://github.com/Rubbish0-A/ccline-zh.git
cd ccline-zh
powershell -ExecutionPolicy Bypass -File scripts\install.ps1   # Windows
# sh scripts/install.sh                                         # macOS / Linux
```

> 最小裸装：只下载仓库根的 `statusline.js`（自包含单文件）到任意位置，在 `~/.claude/settings.json` 加：
> `{ "statusLine": { "type": "command", "command": "node \"<你的路径>/statusline.js\"" } }`

## 配置与使用

**启动**：装好后启动 Claude Code 即自动显示，**没有单独进程要启动**——Claude Code 每次刷新自动调用脚本。

**关闭整个状态栏**：跑 `uninstall.ps1` / `uninstall.sh`，或手动删 `~/.claude/settings.json` 的 `statusLine` 字段。

**开 / 关某个 widget**（三步）：
1. 首次：把仓库里的 `statusline.config.example.json` 复制为 `~/.claude/ccline-zh.config.json`。
2. 编辑该文件，找到对应 widget，把 `"enabled"` 改 `true`(显示) / `false`(隐藏)。**推荐改 `enabled` 而非删行**（以后好改回）。
3. 保存即生效，**无需重启**（下次状态栏刷新自动读取）。

> ⚠️ `widgets` 数组是**整体替换**默认的——配置文件里要**写全你想显示的所有 widget**，漏写的不会显示。（所以 example 文件给的是完整列表，你在上面改 `enabled` / 调顺序，而不是从空白加。）

**调顺序**：`widgets` 数组顺序 = 显示顺序，调行序即可。

**会话短码 `#a1b2c3d4` 怎么用**：它是当前会话 id 前 8 位，主要用于**多终端识别**——一眼看出每个终端是哪个会话、在哪个项目。续会话有三种方式：

- `claude -c` —— 续**当前目录**最近的会话（最省事，不用记 id）
- `claude -r` —— 弹交互列表，按目录 / 时间 / 摘要挑
- `claude -r <session_id>` —— 按 id 直接续；短码能否当前缀直接用（`claude -r a1b2c3d4`）视 Claude Code 版本，可自行一试

**配置不生效排查**：① 路径必须是 `~/.claude/ccline-zh.config.json`（不是脚本目录）② JSON 格式合法（损坏会静默回落默认值，不报错——格式错是最常见原因）。

**关颜色**：设环境变量 `NO_COLOR=1` 或 `CCLINE_NO_COLOR=1`。

## 字段（widget）

| widget | 显示 | 数据来源 | 默认 |
|---|---|---|---|
| `session` | 会话短码 `#a1b2c3d4` | `session_id` / `transcript_path` | **开** |
| `model` | 模型名 | `model.display_name` | **开** |
| `dir` | 目录（末 N 段，可选 `useProjectDir`） | `workspace.current_dir`/`project_dir` | **开** |
| `git` | `⎇ 分支`（可选 dirty `*`） | 读 `.git/HEAD` | **开** |
| `context` | 上下文进度条 `[███░░░] 34%` | `context_window.used_percentage` | **开** |
| `rateLimit` | `5h/7d 剩余%`（可选 `bar`） | `rate_limits.*.used_percentage` | **开** |
| `lines` | `+增/-删` | `cost.total_lines_added/removed` | **开** |
| `tokens` | 会话累计 `输入↑输出↓` | `context_window.total_input/output_tokens` | **开** |
| `cost` | `$花费` | `cost.total_cost_usd` | 关 |
| `duration` | 会话时长 | `cost.total_duration_ms` | 关 |
| `blockTimer` | 额度重置倒计时 `5h 3h10m后重置` | `rate_limits.*.resets_at` | 关 |
| `worktree` | `wt:名` | `workspace.git_worktree` | 关 |
| `outputStyle` | 输出风格名 | `output_style.name` | 关 |
| `version` | CC 版本 | `version` | 关 |

## 已知限制

- **「安装即用」需要跑一次 `setup`** — Claude Code 插件机制不能直接注入 statusLine（它是 `settings.json` 专属字段），所有 statusLine 插件都靠 setup 命令写配置。本项目用 setup 写**绝对路径**规避 [#52079](https://github.com/anthropics/claude-code/issues/52079)（`${CLAUDE_PLUGIN_ROOT}` 不注入 statusLine 子进程）。
- **`tokens` 是会话累计值**（含 cache，不随 auto-compact 回退，[#13783](https://github.com/anthropics/claude-code/issues/13783)）。想看「当前上下文还剩多少」用 `context`。
- **`rateLimit` / `blockTimer` 仅 claude.ai 订阅可见**，且需当次会话发生过至少一次 API 响应；API Key / 中转用户取不到，自动隐藏。
- **`git` 分支仅在 git 仓库目录显示**：当前目录（及其父级）没有 `.git` 时自动隐藏，不是 bug；`cd` 到任意 git 项目即出现。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1   # Windows
sh scripts/uninstall.sh                                          # macOS / Linux
```

仅移除 ccline-zh 的 statusLine 配置（command 含 `statusline.js` 才动），其余保留并备份。

## 开发

```sh
npm test          # node:test 单元 + 集成（35 用例）
npm run check     # 对 src/scripts/test 跑 node --check
npm run build     # 把 src/ 打包成自包含单文件 statusline.js
npm run demo      # 用 full fixture 跑一次看效果
```

- 源码在 `src/`（CommonJS、零运行依赖）；发布单文件 `statusline.js` 由 `npm run build` 生成。
- **贡献者注意**：`.ps1` 脚本必须保持 **ASCII**（Windows PowerShell 5.1 按系统 ANSI 代码页读取，非 ASCII 会乱码崩溃）；中文提示放在 `setup.js`（Node UTF-8 stdout）。

## License

MIT © cjh
