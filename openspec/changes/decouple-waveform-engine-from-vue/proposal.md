## Why

当前发布入口直接导出 Vue 组件，控制器、生命周期和视图依赖 Vue，React 或普通 JavaScript 消费者无法直接使用完整图表。需要建立同一套无框架图表实现，通过真实 DOM 节点初始化，以类式实例 API 在 React 和 Vue 中共享完整功能。

## What Changes

- 提供 `init(dom, options?, initOptions?)`、`getInstanceByDom(dom)` 和 `dispose(domOrInstance)`；实例支持 `setOption`、`on/off`、`resize`、`dispatchAction`、现有视口命令、状态查询、图片导出和销毁。
- 使用 TypeScript 类、组合和职责划分组织实例、模型、调度、数据、布局、视图、交互、标注和导出；在实际变化点采用 Facade、Observer、Strategy、State、Command 和 Factory，保留纯计算函数。
- 保留现有 D3/SVG、全量数据查询、WASM/Worker 采样与动画算法，迁移 Vue 模板和响应式编排，移除原生消费链中的 Vue、Vue UI 组件及其样式依赖。
- React 和 Vue 直接通过 DOM ref 使用同一 API；现有 Vue 组件成为可选薄适配层，保留 props、emits 和 exposed 方法语义。React 组件包装不是完成本变更的前提。
- 增加原生、React、Vue 示例，验证挂载、更新、事件、卸载、React Strict Mode 和多实例隔离。
- **BREAKING**：最终主入口改为无框架 API，原 `WaveformChart` Vue 组件移到 `waveform-analysis/vue`；保留原有纯工具和类型出口，公开实例接口通过工厂取得，内部类不直接导出构造器。先提供 `waveform-analysis/native` 过渡入口，最终入口切换必须配套迁移文档和适当的版本策略，不在创建本提案时发布。

## Capabilities

### New Capabilities

- `waveform-native-instance-api`: DOM 初始化、实例命令、配置更新、类型化事件与实例查询。
- `waveform-native-lifecycle`: 渲染调度、尺寸更新、异步失效、销毁及多实例隔离。
- `waveform-native-behavior-parity`: 原生实现保留现有数据、布局、交互、标注、动画和导出的用户行为。
- `waveform-framework-consumption`: 无框架发布边界、React/Vue DOM ref 接入、可选 Vue 兼容入口和示例。

### Modified Capabilities

无。当前 `openspec/specs/` 无已归档基线；以上采用 ADDED Requirements。已有动画、工具栏、采样和原生控件变更作为兼容输入，实施前对照当前源码和实际测试，不覆盖其文档或证据。

## Impact

涉及 `src/index.ts`、现有 `src/components/` 各模块、`src/core/`、`src/animation/`、公共类型、样式、构建与声明产物配置、包 exports/依赖/锁文件、消费者验证脚本、README、示例和测试。目标目录在 design.md 中定义；demo 可继续使用 Vue 和开发期 UI 依赖，原生发布入口不得依赖它们。

本变更按 tasks.md 实施，验证结果与历史差异记录在 implementation.md 和 compatibility.md；不自动提交、推送、发布或归档。
