---
description: 安装 ccline-zh 中文状态栏（写入 ~/.claude/settings.json）
---

请帮用户安装 ccline-zh 状态栏，按以下步骤执行：

1. 运行命令：`node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.js"`

   该脚本是确定性的，会：
   - 用自身路径定位本插件内 `statusline.js` 的**真实绝对路径**（不依赖 `${CLAUDE_PLUGIN_ROOT}` 在 statusLine 子进程展开——那是 Claude Code 的已知 bug）；
   - 备份现有 `~/.claude/settings.json` 为 `settings.json.bak`；
   - **只合并写入** `statusLine` 字段，保留 hooks / plugins / 其他所有配置。

2. 把脚本的输出原样展示给用户。

3. 明确提醒用户：**重启 Claude Code** 后状态栏才会生效。

4. 告诉用户：如需自定义字段 / 顺序 / 颜色 / 阈值，把插件内的 `statusline.config.example.json`
   复制为 `~/.claude/ccline-zh.config.json` 后编辑即可（无需重装）。
