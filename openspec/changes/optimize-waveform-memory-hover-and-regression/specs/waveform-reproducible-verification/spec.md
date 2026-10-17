## ADDED Requirements

### Requirement: 产物复用保持独立命令可靠性

构建复用 SHALL 在测量后决定，coverage 产物 SHALL 与发布产物隔离。若采用复用，凭据 SHALL 包含源码、配置、锁文件、工具版本和产物校验值；独立命令及直接 pack SHALL 保留完整准备行为。

#### Scenario: 产物过期或损坏

- **WHEN** 输入身份发生变化或产物缺失、被修改
- **THEN** 重建或拒绝复用，不验证或发布旧产物

#### Scenario: 干净检出直接打包

- **WHEN** 无现有构建产物时执行直接 pack 或独立 test:package
- **THEN** 生成完整发布产物并通过实际 tarball 消费验证

### Requirement: 工具链和证据交接

项目 SHALL 提供与 CI 协调的 Node 22 入口并指定 pnpm 10.32.1。新增诊断 SHALL 区分临时输出与长期最小证据；既有证据管理计划 SHALL 继续拥有历史资产清理工作。

#### Scenario: 扫描产物管理

- **WHEN** 新增诊断脚本或输出约定
- **THEN** 明确输出位置和保留方式，不自动删除未跟踪文件或笼统忽略 evidence，长期结论保留命令、版本和最小复核数据
