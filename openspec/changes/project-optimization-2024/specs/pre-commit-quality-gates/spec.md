# Spec Delta

## Purpose

让贡献者在提交前获得快速、可靠的格式和代码质量反馈，同时保证源码归档与自动化环境能够安装依赖，并维持持续集成检查的严格程度和对暂存内容的保护。

## ADDED Requirements

### Requirement: Staged file quality checks

提交门禁 SHALL 对支持的暂存文件执行格式化与 lint，存在不可修复错误或警告时阻止提交；门禁 SHALL 保留无关未暂存修改，不在 pre-commit 中运行测试。

#### Scenario: Successful formatting

- **WHEN** 暂存文件只有可自动修复的格式问题
- **THEN** 格式修复且质量检查通过后允许提交，不意外暂存无关修改

#### Scenario: Unresolved lint violation

- **WHEN** 暂存文件仍存在 lint 错误或警告
- **THEN** 提交失败并显示诊断

#### Scenario: Partial staging and spaced paths

- **WHEN** 文件路径包含空格或同一文件同时有暂存与未暂存修改
- **THEN** 检查正确处理文件路径，并保留用户未暂存修改的状态

### Requirement: Environment aware hook installation

依赖安装 SHALL 在 CI、显式跳过 hooks 或缺少 Git 元数据时跳过本地 hooks 安装；普通开发环境的 hooks 安装失败 SHALL 可见，发布包消费者 SHALL 不依赖 hooks 工具。

#### Scenario: Source archive installation

- **WHEN** CI 使用不包含 .git 的源码归档安装锁定依赖
- **THEN** 安装和构建可继续，hooks 跳过不会跳过独立 CI 质量检查

### Requirement: Incremental rules preserve zero warnings

新增规则 SHALL 仅在已修复的目录启用，启用范围内错误与警告均阻止 CI；未迁移目录 SHALL 保留既有检查，且迁移范围与剩余工作可追溯。

#### Scenario: First rule rollout

- **WHEN** 新类型规则首先覆盖 src/utils 和 src/core
- **THEN** 这些目录遵守新规则，完整 lint 检查零警告，其他目录的既有规则不被降低
