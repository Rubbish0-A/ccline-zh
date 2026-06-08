# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
