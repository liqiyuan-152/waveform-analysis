## Purpose

首次记录本项目的工程质量契约，使干净环境能够构建 WASM 和组件库，并在合并前通过静态检查、覆盖率与真实包消费验证，同时约束模块规模并补足真实浏览器中的采样验证。

## ADDED Requirements

### Requirement: 干净环境可重现构建

CI SHALL 显式配置 Node.js 22、pnpm 10.32.1、锁定版本的 Rust、wasm32-unknown-unknown target 和 wasm-pack，并使用 frozen lockfile 安装依赖。

#### Scenario: 全新 runner 执行流水线

- **WHEN** runner 没有项目构建缓存或预装 wasm-pack
- **THEN** 流水线先准备工具链和 WASM 产物，再执行类型检查、测试与构建，不依赖开发者机器上的工具

### Requirement: 质量门禁和分发验证

CI SHALL 执行类型检查、源文件长度检查、ESLint、Oxlint、覆盖率、库及 Demo 构建和包消费测试，覆盖率至少达到行/语句/函数 80%、分支 75%。开发者现有入口和 prepack SHALL 保留必要的准备能力。

#### Scenario: 存在 lint 错误或打包缺失

- **WHEN** 源码包含 lint 错误或 tarball 无法提供声明及 ESM/CJS 消费所需产物
- **THEN** 质量检查失败，不以普通单元测试通过代替对应门禁

#### Scenario: 同一 CI 作业运行多个检查

- **WHEN** 作业已完成 WASM 准备并依次执行类型检查、测试和构建
- **THEN** 后续步骤复用已准备的产物，避免重复触发相同的 WASM 构建，同时不使用过期产物

### Requirement: 嵌入路由校验保持行为一致

嵌入桥接 SHALL 拒绝包含控制字符或不安全目标的路由，并在保留现有来源和消息校验语义的前提下通过 ESLint，不全局关闭控制字符规则。

#### Scenario: 输入包含控制字符

- **WHEN** childRoute 含 U+0000 至 U+001F 或 U+007F
- **THEN** 路由被拒绝，合法站内路由维持原有行为

### Requirement: 模块规模与浏览器验证

src 下文本文件 SHALL 不超过 450 物理行，AGENTS.md、ESLint 和独立文件长度检查脚本 SHALL 使用相同上限，保持原检查范围且不忽略空行或注释；生命周期模块按状态所有权分离职责；交互和可视化改动 SHALL 在真实浏览器验证可复用组件和相关 Demo。

#### Scenario: 重构后验收

- **WHEN** 尺寸测量、视口恢复和采样会话职责拆分完成
- **THEN** 文件长度检查通过，桌面和小容器下的 Worker/WASM、缩放、注解、分页及卸载行为有可检查的验证记录

#### Scenario: 长度限制边界

- **WHEN** 在各检查器原有覆盖范围内分别检查 450 行和 451 行的源文件
- **THEN** 450 行通过，451 行失败，仓库指导文档与自动检查均使用 450 行上限

### Requirement: 自动准备有效 WASM 产物

现有开发命令及 prepack SHALL 自动验证并准备 WASM，CI SHALL 使用同一入口；有效性依据输入内容、工具链版本及产物内容摘要，不能仅依赖文件存在或跳过标记。

#### Scenario: 嵌套打包复用产物

- **WHEN** 同一输入已成功准备，test:package 触发 pack 和 prepack
- **THEN** 准备入口验证产物后复用，不重复实际 WASM 构建，也不递归调用打包流程

#### Scenario: 输入或产物已变化

- **WHEN** Rust 源码、Cargo 配置、工具链版本、构建参数发生变化，或产物缺失/被修改
- **THEN** 现有命令自动重新准备，失败时不写入成功记录，不能以旧记录接受过期产物
