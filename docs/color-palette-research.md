# mtab 配色调研与建议

## 结论先行

建议把当前主题收敛为三组色彩方向，每组提供亮、暗两个版本，共六套：

1. **云蓝 / 午夜蓝**：最通用的中性蓝，适合默认主题。
2. **鼠尾草 / 森林夜**：低饱和绿，适合希望界面更安静的用户。
3. **暖纸 / 石墨紫**：一个偏暖亮色、一个低饱和暗色，为用户保留个性但不过度花哨。

这里的“主流”不是用户喜好排行榜。没有找到能直接证明“多数新标签页用户最喜欢某个具体 HEX 值”的可靠一手数据。本文所说的主流，是 Apple、Material 3、Microsoft Fluent 等成熟设计系统反复采用的共同结构：**大面积中性色表面 + 清晰的文字层级 + 少量强调色 + 独立的亮暗配色**。[Apple Color](https://developer.apple.com/design/human-interface-guidelines/color) [Material 3 theming](https://developer.android.com/codelabs/m3-design-theming) [Fluent 2 Color](https://fluent2.microsoft.design/color)

“护眼”也不作为医学效果宣称。更准确的产品文案应是“柔和”“低饱和”“适合暗光环境”或“减少刺眼感”。Apple 只把深色模式描述为针对低光环境的舒适观看体验，并强调仍需测试可读性与对比度；它没有证明某组颜色可以保护眼睛。[Apple Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

## 可直接落地的六套调色板

下列数值是依据官方设计原则为 mtab 合成的项目建议，并非照抄任何品牌的官方调色板。每套都采用语义角色，便于映射到现有 CSS 变量。

| 名称 | 模式 | 背景 `background` | 表面 `surface` | 主文字 `text-primary` | 次文字 `text-secondary` | 强调色 `accent` | 强调色上文字 `on-accent` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 云蓝 Cloud Blue | 亮 | `#F7F9FC` | `#FFFFFF` | `#172033` | `#536176` | `#2563EB` | `#FFFFFF` |
| 鼠尾草 Sage Paper | 亮 | `#F3F6F1` | `#FBFCF8` | `#1D2A22` | `#58645B` | `#2F6F4E` | `#FFFFFF` |
| 暖纸 Warm Paper | 亮 | `#F7F3EB` | `#FFFCF6` | `#29261F` | `#655F54` | `#A34720` | `#FFFFFF` |
| 午夜蓝 Midnight Blue | 暗 | `#0F141C` | `#171E29` | `#EAF0F8` | `#ACB8C8` | `#78A9FF` | `#0B1730` |
| 森林夜 Forest Night | 暗 | `#121815` | `#19221D` | `#E8F0EB` | `#AFC0B5` | `#86C79B` | `#102018` |
| 石墨紫 Graphite Violet | 暗 | `#151419` | `#201E27` | `#F1EEF5` | `#BBB4C4` | `#C5A7FF` | `#211533` |

选择建议：

- **默认主题**：云蓝。中性、熟悉，强调色只用于主操作、选中态和链接。
- **柔和亮色**：鼠尾草。背景和表面略带绿灰，但文字仍用深中性色，避免整页“发绿”。
- **暖色亮色**：暖纸。适合笔记、阅读感，但强调色保持偏深，确保白字按钮可读。
- **默认暗色**：午夜蓝。使用深蓝灰而非纯黑，并用更亮的表面色建立层级。
- **柔和暗色**：森林夜。低饱和绿只承担氛围与强调，不用绿色区分成功/普通状态。
- **个性暗色**：石墨紫。紫色集中在交互强调，主体仍保持石墨中性色。

## 对比度核验

WCAG 2.2 AA 要求普通文本与背景至少 `4.5:1`，大号文本至少 `3:1`；识别控件及其状态所需的视觉信息与相邻颜色至少 `3:1`。[WCAG 2.2, SC 1.4.3](https://www.w3.org/TR/WCAG22/#contrast-minimum) [WCAG 2.2, SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)

按 WCAG 相对亮度公式计算，上述六套颜色的结果如下：

| 名称 | 主文字/背景 | 次文字/背景 | 强调色/背景 | `on-accent`/强调色 |
| --- | ---: | ---: | ---: | ---: |
| 云蓝 | 15.42 | 5.96 | 4.90 | 5.17 |
| 鼠尾草 | 13.70 | 5.68 | 5.50 | 5.99 |
| 暖纸 | 13.64 | 5.72 | 5.45 | 6.04 |
| 午夜蓝 | 16.11 | 9.18 | 7.84 | 7.56 |
| 森林夜 | 15.50 | 9.45 | 9.13 | 8.58 |
| 石墨紫 | 15.96 | 9.11 | 9.03 | 8.48 |

所有主文字、次文字和按钮文字组合均超过普通文本的 `4.5:1` 门槛。实际实现仍需逐一检查透明度、`color-mix()`、壁纸叠层、hover、focus、disabled 等最终合成后的颜色；表格只验证不透明纯色组合。

## 为什么这样收敛

Material 3 把颜色分为 accent、surface 和 semantic 三组角色，并指出 surface 应覆盖界面的大部分面积，primary 应优先留给高强调操作，而不是让所有组件都使用主色。[Material 3 theming](https://developer.android.com/codelabs/m3-design-theming)

Fluent 2 同样将中性色用于表面、文字和布局，把 shared/brand 色用于少量强调；其 token 系统以语义别名支持亮色、暗色和高对比度模式。[Fluent 2 Color](https://fluent2.microsoft.design/color) [Fluent 2 Design tokens](https://fluent2.microsoft.design/design-tokens)

Apple 建议为自定义颜色同时提供亮色、暗色和增强对比度变体，并在多彩背景上减少控件色彩、维持单色工具栏；暗色界面不是简单反转亮色，而应使用较暗的基础表面和稍亮的浮层表面建立深度。[Apple Color](https://developer.apple.com/design/human-interface-guidelines/color) [Apple Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

因此，mtab 不宜继续堆叠多个来源各异、饱和度和明度逻辑不一致的主题。更稳妥的做法是共享同一套语义角色和层级，仅改变中性色温与强调色家族。

## 实现约束

- 主题值应映射到语义 token，不让组件直接依赖 `blue-500`、`green-600` 这类色相名称。Material 和 Fluent 都以角色/token 管理颜色，避免换主题时逐组件替换。[Material 3 theming](https://developer.android.com/codelabs/m3-design-theming) [Fluent 2 Design tokens](https://fluent2.microsoft.design/design-tokens)
- 强调色仅用于主按钮、链接、选中态、focus ring 等重要交互；大面积卡片继续使用中性 surface。
- 选中、错误、成功等状态不能只靠颜色表达，还要结合图标、勾选、边框或文字。WCAG 明确要求颜色不能成为传达信息的唯一视觉方式。[WCAG 2.2, SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- 壁纸模式下，应在内容区使用足够不透明的 surface/overlay，再针对“最终合成颜色”测对比度；不能拿 token 原值代替实际渲染结果。
- 亮暗模式应分别定义，而不是用滤镜或 RGB 反转自动生成。优先跟随 `prefers-color-scheme`，同时保留用户明确选择。
- 产品文案建议使用“柔和配色”“低饱和配色”“暗光主题”，避免“护眼”“防疲劳”等无证据医学承诺。

## 一手来源

- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C — Understanding SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [W3C — Understanding SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [Apple Human Interface Guidelines — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple Human Interface Guidelines — Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)
- [Google Android Developers — Material 3 theming](https://developer.android.com/codelabs/m3-design-theming)
- [Microsoft Fluent 2 — Color](https://fluent2.microsoft.design/color)
- [Microsoft Fluent 2 — Design tokens](https://fluent2.microsoft.design/design-tokens)
