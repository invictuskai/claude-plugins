# oceanus-themes

Claude Code 配色主题。加载后出现在 `/theme` 选择器中，ID 为 `custom:oceanus-themes:<slug>`。

| 主题 | ID | 来源 |
| --- | --- | --- |
| Ayu Dark | `custom:oceanus-themes:ayu-dark` | [livlign/ccthemes](https://github.com/livlign/ccthemes/blob/main/plugins/theme-gallery/themes/ayu-dark.json)（commit `a4f7528`，MIT） |

每个主题是 `themes/` 下的一个 JSON 文件：`base` 选 `dark` 或 `light`，`overrides` 覆盖对应的颜色 token。

## 安装

```
/plugin marketplace add invictuskai/claude-plugins
/plugin install oceanus-themes@oceanus-plugins
```

然后在 `/theme` 里选 Ayu Dark，或在 `settings.json` 里设置 `"theme": "custom:oceanus-themes:ayu-dark"`。
