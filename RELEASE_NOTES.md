# waveform-analysis 0.3.0

0.3 系列功能版本，将波形分析、波形展示和基础交互组件统一为一个可按需导入的 npm 包。

## 新增与改进

- 新增 `waveform-analysis/analysis` 和 `/display` 独立入口；根入口同时提供分析实例 API 与 `Waveform` 展示类。
- 两种波形组件复用坐标轴、格式化、SVG 绘制与动画基础能力，保持实例数据、暂停和销毁隔离。
- 独立导出 InputNumber、Select、ColorPicker、Pagination、Modal、Popup，以及每个组件的样式入口和类型。
- 基础组件支持 `auto`、`light`、`dark` 主题；分析组件支持 `controlTheme`，Vue 适配同步支持。
- Popup 参考 Ant Design Popover 重做，支持标题、内容、箭头、悬停/点击/聚焦、12 个方向、边界调整和长内容滚动。
- Demo 新增“基础组件”二级菜单和六个独立示例页，包含使用源码、交互反馈与主题切换；波形展示提供独立配置页面。
- 统一基础组件示例的内容布局、按钮间距、弹窗页脚与窄屏换行。
- 增强独立 ESM/CJS/类型声明消费、无 Vue 导入、组件边界、跨入口实例注册和浏览器资源释放检查。

## 升级说明

```sh
pnpm add waveform-analysis@0.3.0
```

- 原分析 API、`/native` 与 `/vue` 入口继续保留；Vue 分析组件仍从 `waveform-analysis/vue` 导入。
- 从 `waveform-display` 迁移时，将导入路径改为 `waveform-analysis/display`；数据和配置结构保持兼容。
- 展示类型在根入口使用 `WaveformDisplay` 前缀，在 `/display` 入口保持原名称。
- 基础组件按子路径导入，并加载对应的 `/style.css`。Popup 旧位置参数构造方式仍支持手动开关，新 options 构造方式默认悬停触发。
- 分析 X 坐标仍以秒存储，显示单位不改变原始数据；受控显隐和标注状态仍由宿主持有。
- 旧 Demo `#/components` 重定向到分析页，基础组件示例位于 `#/controls/*`。

0.3.0 汇总统一组件包与基础组件的功能更新，现有分析组件消费者无需进行破坏性迁移。
正式发布使用 npm `latest`，由 Release 工作流构建发布包并部署演示站。
