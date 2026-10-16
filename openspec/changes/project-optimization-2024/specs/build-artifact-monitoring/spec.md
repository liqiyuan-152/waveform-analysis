# Spec Delta

## Purpose

为维护者提供可复现的产物组成与压缩效果数据，使构建优化同时考虑所有公开入口的加载体积、构建耗时和包消费兼容性，避免用单个输出文件的变化代替整体收益。

## ADDED Requirements

### Requirement: Explicit artifact analysis

项目 SHALL 提供显式分析命令，生成覆盖入口、共享产物和外部依赖边界的报告；报告失败 SHALL 返回非零状态，普通构建 SHALL 不依赖报告生成。

#### Scenario: Analysis report generation

- **WHEN** 维护者运行分析命令
- **THEN** 可查看各入口及共享 chunk 的组成，external 依赖不被计为内嵌代码

#### Scenario: Analysis failure

- **WHEN** 分析工具无法生成报告
- **THEN** 命令明确失败，不以缺失或旧报告宣称分析成功

### Requirement: Reproducible optimization measurements

优化记录 SHALL 关联 commit、锁文件、工具版本、机器、命令和缓存状态，至少三次测量并保留原始值和中位数；安装与磁盘统计 SHALL 明确范围和口径。

#### Scenario: Workspace installation comparison

- **WHEN** 比较迁移前后的安装成本
- **THEN** 使用相同环境，分别标明全工作区与受控库开发范围以及冷热缓存，不将未测量的提速作为结论

### Requirement: Compression acceptance gates

新压缩配置 SHALL 保持公开消费契约，且每入口可达 JS 与全部 JS 去重 gzip 合计均不增长超过 5%，构建耗时中位数至少改善 10%；不满足条件 SHALL 保留原配置。

#### Scenario: Candidate acceptance

- **WHEN** 候选满足体积和耗时条件，且测量波动不掩盖收益
- **THEN** 只有三入口 ESM/CJS、声明、CSS、WASM 和 tree-shaking 消费验证通过后才采纳
- **AND** 报告同时列出 CSS、WASM、声明及 tarball 大小

#### Scenario: No qualifying candidate

- **WHEN** 没有候选同时满足收益与兼容性条件
- **THEN** 保留当前压缩配置并记录结果，评估任务可以完成而不强制修改配置
