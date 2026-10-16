# Proposal

## Why

项目需要明确 demo 与库的开发依赖边界，并完善提交检查、产物测量、API 文档和版本准备流程。现有计划缺少行为规格，且对构建、发布和历史迁移的假设与当前仓库不一致，需要先建立可验证的工程化契约。

## What Changes

- 将 demo 迁入私有 workspace 包，保持根开发命令、完整构建和发布目录可用。
- 建立二进制资产评估与验收证据保留规则；本次不引入 LFS，不重写 Git 历史。
- 添加 EditorConfig 和提交前格式化、lint 检查，按目录引入类型规则，保持 CI 零警告。
- 提供显式产物分析命令，测量当前压缩器与候选方案；只有满足体积、兼容性及速度条件时才切换。
- 自动生成公开入口的 API 文档，补充贡献指南。
- 引入 Changesets 准备版本和 CHANGELOG，保留标签触发的发布流程。
- 延后代码分割、额外 TypeScript 严格选项和自动视觉回归；不将其作为本次未完成任务。
- 保持公开 API、运行时依赖、导入路径、类型入口、CSS 路径及包消费行为兼容。源码目录和工程配置会改变。

## Capabilities

### New Capabilities

- `project-workspace-isolation`: demo 依赖隔离、干净检出开发流程与完整构建契约。
- `project-asset-evidence-management`: 二进制资产决策可追溯，历史与长期验收证据得到保留。
- `pre-commit-quality-gates`: 暂存文件格式化和 lint 门禁，以及持续集成零警告约束。
- `build-artifact-monitoring`: 可复现的产物分析、压缩评估及包兼容性验证。
- `api-documentation-automation`: 公开入口 API 文档生成和贡献者使用指引。
- `changelog-workflow`: 可审核的版本准备、预发布管理和既有发布流水线衔接。

### Modified Capabilities

无。2026-10-16 执行 `openspec list --specs` 未发现已归档的主规格。上述能力只新增工程工作流契约；实施前仍须核对进行中的变更，避免重复修改。

## Impact

- 目录和配置：`examples/demo-app/`、根 workspace 配置、依赖锁文件、TypeScript/Vite 配置、demo 资源和测试引用。
- 工具：EditorConfig、Husky、lint-staged、产物分析工具、TypeDoc、Changesets；具体版本需验证现有 Node 22、pnpm 10.32.1、TypeScript 6 和 Vite 8 兼容性。
- 自动化：根脚本、GitHub/Gitea 构建及发布工作流、部署所需的根 `dist-demo/`。
- 文档：README、CONTRIBUTING、生成的 API 文档，以及本变更的长期验收记录。
- 不承诺 workspace 全量安装必然提速或缩小磁盘占用；量化结论由同环境测量支持。
