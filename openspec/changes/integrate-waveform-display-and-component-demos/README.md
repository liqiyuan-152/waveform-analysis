# integrate-waveform-display-and-component-demos

将波形展示纳入单一 npm 包，抽离可复用基础能力，统一动画系统，并建立按组件组织的 Demo。

- [proposal.md](proposal.md)：范围和能力清单。
- [design.md](design.md)：共享边界、动画适配架构及迁移顺序。
- [tasks.md](tasks.md)：实施任务和验收门禁；未执行项保持未勾选。
- [specs/](specs/)：单包双组件、共享基础、统一动画和 Demo 的行为规格。

实施与验收已完成，任务和证据见 [tasks.md](tasks.md) 与 evidence/verification.md（历史验证文件，已清理）。原失败记录及修复说明保留；OpenSpec 结构校验与功能验收分别记录。未发布、归档或删除原项目。

## 后续版本说明

以上任务与 evidence 文档保留集成阶段的历史验收记录；原始日志和截图保留在本地，未全部加入仓库。当前 Demo 的 `/components` 已重定向至分析页，基础组件示例位于 `/controls/*`。0.3.0 最终发布验证以 [版本验证记录](../../../docs/releases/0.3.0/verification.md) 为准。
