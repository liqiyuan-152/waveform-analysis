## Why

波形组件目前通过分页、标注弹窗和数值输入依赖 Ant Design Vue，消费者需要提供额外的 UI 框架。用户希望移除组件对 antd 的依赖，同时尽量保持现有视觉与交互，并为后续移除 Vue 依赖准备可复用的边界。

## What Changes

- 使用原生 HTML、组件自有样式和轻量交互逻辑替代 Pagination、Modal、InputNumber，保持现有布局、状态和操作习惯。
- 组件消费者无需安装 ant-design-vue 或加载 antd.css；demo 可继续使用 antd，将其限定为开发依赖。
- 保持分页、标注编辑、时间校验与吸附、受控更新及公开 API 兼容。
- 新增控件的纯逻辑和 DOM 生命周期逻辑不依赖 Vue，现阶段以薄 Vue 包装接入图表。
- 本阶段保留 Vue 与 vue3-colorpicker；记录后续框架解耦路径，不在此任务中完成整个图表的 Vue 迁移。

## Capabilities

### New Capabilities

- `waveform-native-controls`: 无 antd 消费环境下的分页与标注编辑行为、视觉一致性及样式隔离。

### Modified Capabilities

无。当前 openspec/specs 无基线规格，使用 ADDED Requirements 记录新的依赖边界及替换时必须保留的行为。

## Impact

涉及 WaveformChartView、标注编辑器、分页和弹窗内部模块、组件样式、相关测试、package.json、锁文件、库构建与包验证脚本、README。demo 中的 antd 控件继续保留，不改变 src/index.ts 的公开接口。

本次仅创建 OpenSpec 规划文档；所有实施任务待执行，不修改业务代码、不更新依赖、不提交或发布。
