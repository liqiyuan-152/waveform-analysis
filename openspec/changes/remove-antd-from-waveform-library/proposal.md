# Proposal

## Why

波形库当前通过分页和标注编辑器要求使用者安装 Ant Design Vue，增加接入成本并耦合其样式。本次先解除这项运行时依赖，为后续框架解耦建立边界，同时保持现有功能和视觉体验。

## What Changes

- 使用原生 HTML 控件和自有 CSS 替换库内的 Pagination、Modal、InputNumber，保留 Vue 组件组织方式。
- 保持分页、标注编辑、键盘操作、数值校验及现有公共 props、事件和方法的行为。
- 清除库内 Ant Design 样式选择器和构建依赖，将 ant-design-vue 仅作为 demo 的开发依赖。
- 验证未安装 Ant Design、未加载其全局 CSS 的消费端也能正常使用图表。
- demo 继续使用 Vue 和 Ant Design；本次不移除 Vue，不替换 vue3-colorpicker，不改动 D3/SVG 渲染路线。

## Capabilities

### New Capabilities

- `standalone-chart-controls`: 定义不需要宿主安装 Ant Design 的图表内置控件，以及分页、标注对话框和时间输入的兼容行为。

### Modified Capabilities

无。当前 openspec/specs 尚无已归档规范。

## Impact

- WaveformChartView.vue、WaveformAnnotationEditor.vue 及对应 CSS，新增内部原生控件模块。
- package.json、pnpm-lock.yaml、vite.lib.config.ts、README.md 和打包消费测试。
- 组件回归测试、真实浏览器下的桌面和小容器视觉验证。
- 不改变 src/index.ts 的现有公共导出；demo 的 Ant Design 全局样式不得成为库的隐式前提。
