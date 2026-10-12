# claude-plugins

我的 Claude Code 插件合集。

| 插件 | 命令 | 说明 |
| --- | --- | --- |
| [oceanus-themes](oceanus-themes/) | `/theme` | 配色主题：Ayu Dark（来自 ccthemes），ID `custom:oceanus-themes:ayu-dark` |

## 安装

需要 Claude Code 2.1.287 或更高版本。

```
/plugin marketplace add invictuskai/claude-plugins
/plugin install oceanus-themes@oceanus-plugins
```

然后在 `/theme` 里选 Ayu Dark，或在 `settings.json` 里设置 `"theme": "custom:oceanus-themes:ayu-dark"`。

## 开发

```bash
claude plugin validate ./oceanus-themes
```

## 来源

Ayu Dark 主题来自 [livlign/ccthemes](https://github.com/livlign/ccthemes)（commit `a4f7528`），MIT 许可。
