# claude-plugins

我的 Claude Code 插件（mod）合集。

| 插件 | 命令 | 说明 |
| --- | --- | --- |
| [burn-meter](burn-meter/) | `/burn` | 输入框上方的会话花费仪表：火焰进度条、5 小时/每周额度、超额提醒。配色改为 Ayu Dark |

## 安装

需要 Claude Code 2.1.287 或更高版本。

通过插件市场（推送到 GitHub 之后）：

```
/plugin marketplace add <github-user>/claude-plugins
/plugin install burn-meter@makai01-plugins
```

本地加载单次会话：

```bash
claude --plugin-dir D:/github/claude-plugins/burn-meter
```

每次会话都加载：在 `~/.claude/settings.json` 的 `env` 里设置 `CLAUDE_CODE_PLUGIN_DIRS`。

## 开发

```bash
claude plugin validate ./burn-meter
claude plugin test ./burn-meter
```

## 来源

burn-meter 来自 [OneWave-AI/claude-code-mods](https://github.com/OneWave-AI/claude-code-mods)（commit `e6da26c`），MIT 许可。本仓库在其基础上修改。
