# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
