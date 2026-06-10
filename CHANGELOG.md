# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-06-10

### 修正（重要：用量语义失准）
- **`tokens`（用量）改为 transcript 真累计**。Claude Code 2.1.x 起 stdin 的
  `context_window.total_*_tokens` 语义已从「会话累计」变为「当前上下文内容」
  （实测 2.1.170：`total_input_tokens` 精确等于 `current_usage` 各分项之和，
  而真实会话累计是它的 20+ 倍）。旧实现显示的「用量」实为上下文占用，与
  context 段重复且与计费体感完全对不上。新实现从 transcript JSONL 增量统计
  （`src/usage.js`：offset 缓存只读新增字节 + 按 `message.id` 去重——同一条
  assistant 消息的多个 content block 会拆成多行、各带相同 usage，逐行累加会
  高估 ~75%）。
- `context` 段口径注释修正：`used_percentage` = 上下文 input 侧 ÷ 窗口大小
  （2.1.170 实测）。
- **`context` 弹性超窗失真修复**：1M 原生模型（Fable 5）超过 200K 后，CC 仍报
  `context_window_size=200000` 且 `used_percentage` cap 在 100（上游 #35059
  NOT_PLANNED 未修），红条 100% 制造假恐慌（实际 220K/1M≈22%）。修复：检测到
  `exceeds_200k_tokens=true` 且窗口仍报 <1M 时，**百分比与进度条按 1M 弹性
  窗口重算**（能超 200K 仍在跑 = 实际运行在 1M 窗口；Anthropic 仅 200K/1M
  两档），并附绝对量，如 `[██░░░░░░░░] 22% 220.6K`；配色按绝对阈值（默认
  300K warn / 400K danger，即 context rot 经验危险区——1M 的"剩余%"配色会
  绿到 700K，太晚；`tokensWarn`/`tokensDanger` 可配）。显式 `[1m]`（窗口报
  1M、百分比正确）与真·200K 用满（100% 红色正确）两种场景不受影响。

### 新增（适配 2.1.170 新 stdin 字段）
- `effort` widget（**默认开**，model 后）：显示 effort 档位，按工作流语义配色
  （xhigh=绿=常态、high=黄=可能被切模型重置、max=紫=高耗档、low/medium=红）；
  config 可逐档覆盖（`colors: { high: "red" }`）。
- `bigContext` widget（**默认开**，条件显示）：1M 窗口显示 `1M`、超 200K 显示
  `>200K`（读 `exceeds_200k_tokens`），常规 200K 会话自动隐藏。
- `sessionName` widget（默认关）：CC 自动会话名，code point 截断（`maxLen`，默认 12）。
- `fastMode` widget（默认关）：`fast_mode` 开启时显示 `⚡fast`。
- `thinking` widget（默认关）：thinking 开启时显示标记。

### 文档
- README「已知限制」补充第三方中转场景：`rate_limits` 整字段缺失（额度段
  自动隐藏）、`cost` 为官方价口径（中转计费以中转后台为准）。
- fixtures 升级到 2.1.170 真实 schema；新增 usage 模块 17 用例（共 52）。

## [0.2.1] - 2026-06-08

### 修正
- `lines`（代码增删）与 `tokens`（用量）改回**默认开**——v0.2.0 精简默认集时误把这两个用户核心字段默认关了，本版纠正。默认显示集恢复为 8 段：`session · model · dir · git · lines · context(进度条) · tokens · rateLimit`。

### 健壮性
- 有效 JSON 但所有 widget 都无数据时，兜底显示工具名 `ccline-zh`，而非空白状态栏。

## [0.2.0] - 2026-06-08

### 新增
- `session` widget：显示会话短码 `#xxxxxxxx`（session_id 前 8 位），配合 `claude -r <短码>` 在多终端间快速 resume——跨目录有效。默认开、放最前。
- `context` 升级为进度条 `[███░░░░░░░] 34%`（默认开），保留阈值绿/黄/红。
- `rateLimit` 支持可选进度条（配置 `bar:true`）。
- `blockTimer` widget：5h / 7d 额度重置倒计时（如 `5h 3h10m后重置`），默认关。
- `worktree` / `outputStyle` / `version` widget，默认关。
- `dir` 新增 `useProjectDir` 选项：用会话启动目录（cd 后不变），更适合标识"属于哪个项目"。

### 变更
- **默认显示集调整为 6 段**：`session · model · dir · git · context(进度条) · rateLimit`。
- `lines` / `tokens` 改为**默认关**（按需在 `ccline-zh.config.json` 设 `enabled:true`）。无配置文件的用户会看到默认行变化；**有配置文件的用户不受影响**（其 widgets 列表不含新 type）。

### 文档
- README 中英新增「配置与使用」章节：如何启动 / 关闭整个状态栏 / 开关单个 widget / 用短码 resume / 排查。

## [0.1.0] - 2026-06-08

首次发布。

### 新增
- 零依赖单文件 Claude Code 状态栏（CommonJS，可裸 copy 到任意位置运行）。
- 9 个 widget：`model` / `dir` / `git` / `lines` / `context` / `tokens` / `rateLimit` / `cost` / `duration`。
- JSON 配置文件驱动：字段开关 / 顺序 / 颜色 / 阈值；查找顺序 `CCLINE_CONFIG` → 脚本同目录 → `~/.claude/ccline-zh.config.json`。
- git 分支零依赖读 `.git/HEAD`（支持 worktree 的 `gitdir:` 文件、detached HEAD）；dirty 状态可选（git 子进程 + 800ms 超时，默认关）。
- Marketplace 插件分发 + `/ccline-zh:setup` 安装命令；裸装脚本 `install.ps1` / `install.sh` 及对应 uninstall。

### 健壮性
- 逐 widget 兜底：单字段异常只丢该段，整行其余正常。
- 字段缺失隐藏；JSON 解析失败给提示而非空白；退出码恒 0。
- 数据准确：区分会话累计 token 与当前上下文占用；用 `context_window_size` 而非硬编码 200K。
- UTF-8 BOM 兼容；`NO_COLOR` / `CCLINE_NO_COLOR` 颜色开关。
- 规避 `${CLAUDE_PLUGIN_ROOT}` 不注入 statusLine 子进程的问题（setup 写绝对路径）。

### 工程
- 25 个 `node:test` 用例（format / colors / config / git 单元 + render 集成 + 进程级兜底 + 性能）。
- 跨 OS（windows / ubuntu / macos）× Node 18 / 20 / 22 的 GitHub Actions CI。
- `scripts/bundle.js` 零依赖打包器，把 `src/` 合成自包含单文件。
