# 项目工程化与质量优化

## Status

2026-10-16：阶段 1 完成，阶段 2 各条专项验收完成；全量覆盖率仍有两例基线超时，未宣称完整 CI 通过。
实际结果见 [基线](evidence/baseline.md) 与 [Workspace 证据](evidence/workspace.md)，任务状态见 tasks.md。
保留 project-optimization-2024 目录名以避免破坏既有引用；名称中的年份不作为实际时间依据。

## Documents

- [proposal.md](proposal.md)：动机、范围和能力。
- [design.md](design.md)：迁移、工具选择、发布职责、测量标准及延期事项。
- [tasks.md](tasks.md)：实施任务、依赖和完整验收。
- [REVIEW.md](REVIEW.md)：本次修订及实际验证记录。
- specs/：六项工程工作流能力的行为规格。
- evidence/：实施时生成并保留的长期证据，不全局忽略。

## Workflow

1. 阅读 proposal、design 和 specs，按 tasks 的依赖顺序实施。
2. 完成任务后记录实际验证结果，再勾选任务；未运行的检查明确标为未验证。
3. 性能结论必须关联 commit、环境、原始数据和测量范围。
4. 所有场景和工程检查完成后重新校验，再使用 OpenSpec 归档流程。

```bash
openspec status --change project-optimization-2024
openspec validate project-optimization-2024 --strict
```

## Scope

本次不重写 Git 历史，不本地执行 changeset publish，不实现手动代码分割和额外 TS 严格选项。
延期事项及重新评估条件统一记录在 design 的 Deferred Work。
规划文件齐全只表示可以实施，不表示工程检查、浏览器验证或发布已完成。

## References

- [仓库 README](../../../README.md)
- [OpenSpec 配置](../../config.yaml)
