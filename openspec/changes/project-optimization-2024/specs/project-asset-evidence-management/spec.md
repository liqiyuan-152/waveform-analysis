# Spec Delta

## Purpose

使二进制资产管理决策建立在可复核的成本数据之上，并保证工程优化的验收结论、测量数据和必要截图长期可追溯，避免清理临时文件时误删历史或关键证据。

## ADDED Requirements

### Requirement: Evidence based asset decisions

项目 SHALL 在改变二进制资产存储方式前记录当前大小、历史累计对象大小、变更频率、克隆成本及托管约束；本次变更 SHALL 保留已有 Git 历史和 WASM 准备流程。

#### Scenario: Asset optimization assessment

- **WHEN** 维护者完成 WASM 资产评估
- **THEN** 决策记录包含测量范围、方法和结果，并区分当前文件大小与历史累计体积
- **AND** 本次评估不重写提交或标签，也不替代现有 WASM 工具链与缓存验证

### Requirement: Durable verification evidence

项目 SHALL 保留已跟踪的验收证据和新增结论所需的最小复核数据，只忽略明确的临时产物；外部日志 SHALL 记录来源版本、校验值、链接与保留期限。

#### Scenario: Temporary artifact cleanup

- **WHEN** 更新忽略规则或清理临时输出
- **THEN** 既有验收报告、基线和必要截图仍可追溯，新增长期证据可正常提交

#### Scenario: External log expiration

- **WHEN** 原始大日志存放于有过期时间的 CI artifacts
- **THEN** 仓库保留命令、commit、结果及足以复核结论的最小数据，日志链接过期不会使验收结论失去全部依据
