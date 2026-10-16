# Spec Delta

## Purpose

为贡献者提供依赖边界明确、从干净检出即可复现的开发与构建流程，使 demo 作为库的消费者独立维护，同时保留根命令、部署目录和已发布包的消费契约。

## ADDED Requirements

### Requirement: Demo dependency isolation

项目 SHALL 将 demo 作为私有工作区包维护，显式声明其依赖并通过库的公开入口消费库；迁移 SHALL 保持库运行时依赖和公开消费契约兼容。

#### Scenario: Locked workspace installation

- **WHEN** 贡献者在干净检出中安装锁定依赖
- **THEN** demo 依赖可解析，库不因 demo 迁移新增运行时 UI 依赖，且安装不修改锁文件

#### Scenario: Independent package consumption

- **WHEN** 独立消费者安装打包后的库
- **THEN** 根、native、vue 的 ESM/CJS 与类型入口、CSS 路径及 WASM 功能保持可用
- **AND** 消费者不需要安装 demo 或提交检查工具

### Requirement: Reproducible root development commands

项目 SHALL 保留根开发、构建、demo 构建和预览命令，并在所需库产物缺失时自动准备；完整构建 SHALL 生成库、声明及根 dist-demo，类型检查 SHALL 覆盖库、测试、构建配置和 demo。

#### Scenario: First development startup

- **WHEN** 工具链和锁定依赖已安装，且干净检出中没有构建产物，贡献者执行根 dev 命令
- **THEN** 库及声明先被准备，随后 demo 可访问，源码修改能刷新结果
- **AND** 停止命令后相关监听进程退出

#### Scenario: Development without Rust tools

- **WHEN** 仓库已有 wasm/pkg 产物，贡献者执行 dev、typecheck、test 或 JS 构建命令
- **THEN** 命令复用这些产物，不调用 rustc、cargo 或 wasm-pack，不要求安装 Rust 工具链
- **AND** 修改 Rust 源码或缺失 WASM 产物时，贡献者显式执行 build:wasm 或 prepare:wasm

#### Scenario: Production demo build

- **WHEN** 贡献者从干净检出运行根完整构建或独立 demo 构建命令
- **THEN** 根 dist-demo 包含可部署的 demo，根预览命令能够加载它，且不发生构建循环
