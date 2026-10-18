## Why

波形分析与波形展示目前位于两个独立仓库，组件发布、示例入口和使用说明分散。需要将展示组件纳入波形分析项目，通过一个 npm 包和版本统一发布，并像 Ant Design 组件站一样集中展示两个独立组件及其示例。

## What Changes

- 在 `waveform-analysis` 内迁入同级 `waveform-display` 的展示组件源码、必要资源、测试和使用说明，两个组件保持独立职责及行为。
- 保留单一可发布 npm 包 `waveform-analysis`、单一版本号和发布流水线；不将两个组件拆成 workspace 子包或独立发布包。
- 保持分析组件现有根入口、`/native`、`/vue` 和样式入口兼容，根入口新增 `Waveform`，新增 `/analysis`、`/display` 按需入口及无歧义的展示类型导出；`/native` 继续作为根入口兼容别名。
- 建立统一 Demo 站点，按“波形分析”和“波形展示”分组导航；保留两边现有示例和控制面板，提供示例说明、运行展示、可查看的使用代码和同页共存示例。
- 对照两个项目的实际行为建立复用清单，将一致的格式化、SVG 基础能力及生命周期工具提取为内部共享模块；数据、配置、事件和业务调度的差异通过组件策略保留。
- 统一为一套框架无关的动画运行时及共用动画策略，通过分析/展示适配层接入；保留既有 API、实例隔离和分析组件的紧凑几何性能路径，迁移完成后删除重复动画运行时。
- 更新构建、包消费验证（包括 tree shaking、跨入口身份、类型与样式边界）、文档和发布说明，保证发布产物同时包含两个组件，Demo 一次构建和部署。

## Capabilities

### New Capabilities

- `waveform-unified-component-package`: 单包双组件、公共导出兼容、按需消费、资源隔离与统一发布。
- `waveform-component-demo-site`: 按组件组织的示例站点、原有示例保留、代码展示、路由兼容与同页共存验证。
- `waveform-shared-foundation`: 内部共享模块、行为适配、性能边界和实际复用验证。
- `waveform-unified-animation`: 单一动画运行时、共用策略、组件适配、生命周期与性能兼容。

### Modified Capabilities

无。当前 `openspec/specs/` 无已归档基线，使用 ADDED Requirements；现有原生化、工具栏、动画及性能等变更作为兼容输入，不覆盖其任务和证据。

## Impact

涉及内部共享层、统一动画内核及两个组件的适配层、新增展示模块、`src/index.ts`、包 exports、声明和库构建、测试发现与质量门禁、`demo-app/` 路由和布局、发布与部署脚本、README 和许可证说明。分析组件已有 API 与行为保持兼容；展示组件原用户需要将导入来源迁至 `waveform-analysis` 或 `waveform-analysis/display`，本任务不自动发布、删除原仓库或停用原包。

实施进度由 tasks.md 跟踪，实际运行结果及未解决问题记录于 evidence/verification.md；提案描述目标行为，不代表当前实现已完成验收。
