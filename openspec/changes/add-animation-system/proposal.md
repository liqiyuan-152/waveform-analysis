## Why

波形图需要在初次显示、替换数据和增删标注时提供平滑反馈，同时保持数据查询、坐标、受控状态和图片导出的正确性。当前 SVG 路径和标注由 Vue 模板管理，D3 提供比例尺、路径等计算能力；动画不能引入另一套竞争 DOM 所有权的机制。

本方案参考固定提交的 ECharts 和 ZRender 源码，借鉴分阶段过渡、属性轨道、时间调度和静态回退。它不声称 D3 transition 无法实现这些能力；选择独立引擎是为了统一暂停、方向、循环、累加和组件生命周期，而非已证明的性能优势。

## What Changes

- 新增完整动画引擎：本地 `Animation` 时间实例、`Animator` 共享 RAF 调度器、数值属性轨道和组件级 `WaveformAnimationController`。支持延迟、暂停恢复、有限/无限循环、四种方向、兼容数值轨道累加及高级公共 API。
- 复用已有 D3 easing，提供 31 个命名缓动及自定义函数，不重新维护缓动公式。
- 入场通过系列整体 ClipPath 展开；更新在几何兼容时插值坐标，不兼容时交叉淡化；标注提供 fade-in、scale、slide-in、bounce 及退场效果。
- 保留五个顶层 props：`animationEnabled`、`animation`、`animationUpdate`、`animationAnnotation`、`animationThreshold`；三类配置均可独立关闭。
- 默认开启动画：入场 1000ms，更新/标注 300ms，多系列交错 100ms。有效规范化总点数达到 50000、减少动态效果或缺少 RAF 时静态渲染。
- Vue 渲染独立展示状态；动画不修改输入数据、真实域、查询缓存或受控 annotations。交互接管、降级及导出提交最新最终状态，卸载只清理所属实例。
- 明确公开根入口导出和包验证，不引入 ECharts/ZRender 运行时依赖。

## Capabilities

### New Capabilities

- `waveform-animation-engine`：时间线、属性轨道、循环/方向/累加、缓动、回调与 RAF 调度。
- `waveform-animation-presets`：系列入场、数据更新、同步域展示、标注出现及退场。
- `waveform-animation-controller`：实例隔离、状态所有权、数据版本、交互接管、导出及销毁。
- `waveform-animation-props`：配置默认值、合并与校验、禁用策略、公共导出和兼容边界。

### Modified Capabilities

无已有主规格需要以 MODIFIED delta 修改。本 change 的新增规格明确约束动画对现有渲染、交互及导出入口的影响，并非宣称这些行为完全不变；相关回归必须覆盖已有契约。

## Impact

后续实现涉及 core/controller、rendering、annotation、图片导出准备阶段、公共类型、README、Demo 和测试。`WaveformChart.vue` 继续保持 props/events/expose 边界，不承担逐帧渲染编排。

不删除现有 API，不改变 data 引用更新语义、秒单位坐标、完整数据查询和受控数组事件。但默认开启会改变首次完整显示和数据过渡的时机，需要发布说明；不能据此宣称完全无行为变化。使用 `:animation-enabled="false"` 恢复静态展示。

第二轮修订进一步明确安全域插值、累加固定偏移、同步替换事务、完整数据标注锚点、采样结果分类、动态配置和独立暂停原因，并在规格内固化公共接口。

第三轮修订把公共接口纳入可归档的 Requirement，明确纯工厂与事务初始化、对象级冲突、settled 单份终态、批量终止屏障及用户通知顺序。

2026-10-12 首批实施已完成 1.1、1.2、2.1、2.2：公共类型与接口基线、测试调度器和 owner 键、配置预检、31 种 D3 缓动及单元测试。组件接入、播放引擎、控制器、预设及性能证据仍待实施；实际验证见 implementation.md。不修改版本、不提交、不发布。

2026-10-13 继续实施：用户授权完成剩余任务后，播放引擎、累加/替换事务、预设、owner 控制器和
组件独立展示层已接入。新增分类 Demo、根入口包消费测试及真实浏览器运行器。实际验证和性能
限制见 implementation.md 与 evidence；不把目标预算或未运行环境记作通过。
