## Why

0.2.1 已完成原生引擎与 Vue 适配层迁移，但当前源码仍有更新范围过大、全序列重新准备、配置重复复制和构建重复执行的问题，Worker 无响应恢复与已有检查接入 CI 也有完善空间。需要以兼容性回归和可复现测量为依据，分阶段降低交互、数据更新及工程验证成本。

## What Changes

- 接入现有原生依赖边界、许可证和示例类型检查，覆盖 GitHub CI 及 GitHub/Gitea 发布验证入口。
- 按实际变化细分布局、几何和样式更新，减少无关的布局计算与采样准备；仅曲线颜色更新时保留活动手势、标注编辑和动画，明确改进目前通用更新会取消交互的行为。
- 在不可变输入契约内按稳定系列 ID、子数据引用及相关配置复用未变化序列，并保留对应 Worker 数据集。
- 为 Worker 无响应增加有限超时、失效处理与模式一致的降级；失效请求必须结束等待，高 revision 数据集按当前快照恢复；测量大数组复制，验证安全传输方案后再决定是否采用。
- 统一 Vue 配置快照责任，减少重复深拷贝，保留嵌套响应式配置检测与数据引用更新语义。
- 消除同一构建链中的重复声明生成和重复构建，将纯计算测试与 DOM 测试分开运行。
- 修正交互图例的按钮语义，验证键盘与屏幕阅读器可操作性。
- 更新开发指南与目录说明，记录 CodeGraph 索引过期的处理方法，并与已有资产管理任务衔接。
- 将点标记和误差棒几何缓存作为测量候选；只有结果支持时实施，否则记录不采用的依据。

## Capabilities

### New Capabilities

- `waveform-incremental-update-compatibility`：优化后的配置、数据和框架更新保持视口、交互、完整数据与事件兼容，并提供可复核的性能证据。
- `waveform-worker-request-resilience`：无响应请求的有限终止、模式一致的恢复及缓冲区所有权保护。
- `waveform-quality-pipeline`：已有门禁覆盖验证与发布入口，独立命令和去重构建链均保持可用。
- `waveform-accessible-legend-controls`：交互图例保留列表结构、按钮角色和可感知的可见性状态。

### Modified Capabilities

无。当前 `openspec/specs/` 仅有 `.gitkeep`，以上使用 ADDED Requirements。已有变更中的行为要求作为兼容输入，不修改其任务或证据。

## Impact

- 更新链：`src/chart/`、`src/model/`、`src/data/`、`src/layout/`、`src/sampling/`、`src/rendering/` 和 `src/adapters/vue/`。
- 工程与验证：`package.json`、Vitest 配置、包消费脚本、GitHub/Gitea 工作流、相关测试及浏览器基准。
- 可访问性与文档：`src/view/LegendView.ts`、`AGENTS.md`、必要的 README 说明及本变更的验证记录。
- 保留现有公开入口、props、事件载荷、受控状态、时间单位和注解格式，不引入新运行时依赖。颜色更新期间保留活动交互是本次明确的行为改进；颜色更新本身不新增手势或标注事件。
- `project-optimization-2024` 的任务 3.1–3.3 继续负责资产测量、临时路径忽略和长期证据保留；本变更只补扫描产物约定和交接，不重复实施历史迁移、LFS、压缩器替换、API 文档或版本工具。

本次只创建 OpenSpec 规划文档，不实施优化，不提交、推送、归档或发布。
