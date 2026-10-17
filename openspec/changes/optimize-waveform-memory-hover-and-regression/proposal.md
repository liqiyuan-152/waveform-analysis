## Why

当前项目已完成原生引擎迁移、增量更新和基础质量门禁。2026-10-17 扫描发现，采样索引先分配再检查预算、悬停视图重复创建节点，以及紧凑数据的 JavaScript 降级路径缺少索引，仍有明确的优化空间。已有浏览器验证也需要持续执行，避免性能和兼容性随迭代退化。

内存传输和跨命令构建复用属于已有取舍的后续评估，不能仅凭复制次数或重复调用就认定应当替换现状。

## What Changes

- 高优先级：先检查索引额度再分配，验证超预算路径的瞬时分配，而不只统计保留字节。
- 高优先级：按稳定系列 ID 复用 Tooltip 行节点，分离内容更新、尺寸测量和位置更新。
- 高优先级：将已有浏览器交互验证接入 PR，增加定期 Firefox/WebKit、内存和性能回归。
- 中优先级：优先为 typed/samples 的 peak/min/max/minmax 提供紧凑 JavaScript 索引；sum/average 保留现有数值后备路径，证明聚合兼容后才考虑索引化。
- 测量后决策：评估多系列、多实例总内存和安全传输候选；只有端到端收益成立才实施。
- 测量后决策：评估 CI 复用已验证发布产物，保留独立命令和直接 pack 的完整准备能力。
- 工程配套：统一 Node 22 与 pnpm 10.32.1 入口，衔接既有资产计划，约定新诊断产物去向。

## Capabilities

### New Capabilities

- `waveform-sampling-memory-budget`：分配前预算检查、资源生命周期和总内存评估。
- `waveform-persistent-hover-view`：持续悬停中的节点复用、测量和完整数据展示。
- `waveform-compact-fallback-sampling`：紧凑输入的 JavaScript 索引与采样兼容。
- `waveform-continuous-browser-regression`：分层浏览器回归和可复核性能基线。
- `waveform-reproducible-verification`：工具链入口、发布产物复用决策和证据交接。

### Modified Capabilities

无。当前主规格目录无已归档能力，使用 ADDED Requirements；既有变更作为兼容输入，不改写其规格或任务状态。

## Impact

涉及 `src/core/workerSampling/`、`src/sampling/`、`src/view/TooltipView.ts`、相关测试、浏览器脚本、包验证脚本及 GitHub/Gitea 工作流。默认不增加公开 API、运行时依赖或改变采样输出语义。

承接 `optimize-native-waveform-update-and-quality` 的增量更新、Worker 恢复及构建契约；资产历史和统一保留策略继续由 `project-optimization-2024` 负责。本提案只交接新增输出约定，不重复清理历史。

本次交付仅为规划文档，不实施优化、不清理文件、不提交、归档或发布。
