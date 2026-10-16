# Spec Delta

## Purpose

为库消费者和贡献者提供与公开类型入口一致、可在本地重复生成的 API 参考，覆盖原生与 Vue 使用方式，并通过清晰的生成和预览指引避免依赖失效的文档链接。

## ADDED Requirements

### Requirement: Complete public API documentation

项目 SHALL 提供 API 文档生成命令，自动准备所需声明并覆盖根、native、vue 三个公开入口；公开类型、组件 props/events 和交叉链接 SHALL 可读且可检查。

#### Scenario: Generation from clean checkout

- **WHEN** 已准备工具链与锁定依赖，贡献者执行文档生成命令
- **THEN** 无需手工先生成声明即可得到三个入口的参考文档，公开类型及相关链接完整

#### Scenario: Public type cannot be documented

- **WHEN** 工具无法解析公开声明或缺少必要入口
- **THEN** 生成或完整性检查明确失败，不将不完整输出标记为验收通过

### Requirement: Usable documentation guidance

贡献指南 SHALL 说明文档生成和预览方式；README SHALL 链接到可用说明或已部署文档，不引用不存在的站点，生成目录 SHALL 不作为手工维护源码提交。

#### Scenario: No deployed documentation site

- **WHEN** 尚未部署 API 文档
- **THEN** README 指向本地生成说明，贡献者能够按步骤生成并预览
