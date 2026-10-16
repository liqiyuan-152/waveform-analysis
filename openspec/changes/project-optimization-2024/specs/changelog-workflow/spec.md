# Spec Delta

## Purpose

让版本和变更日志在发布前可以审核，并将预发布、稳定发布及多个 registry 的职责明确衔接到既有标签流水线，避免私有 demo 被发布或同一版本被多个入口重复发布。

## ADDED Requirements

### Requirement: Reviewable version preparation

版本准备 SHALL 生成可审核的版本、锁文件和 CHANGELOG 变更，排除私有 demo 的发布记录与标签；配置演练 SHALL 在临时副本完成，不改变真实版本或发布包。

#### Scenario: Version preparation rehearsal

- **WHEN** 在临时副本消费一个示例 changeset
- **THEN** 库版本及变更日志按预期更新，锁文件一致，私有 demo 不产生发布项
- **AND** 原工作区版本不变，示例变更不进入真实发布

### Requirement: Tag pipeline owns publication

正式发布 SHALL 在版本提交和完整检查完成后由匹配 package.json 的 annotated tag 触发；贡献流程 SHALL 不要求本地发布，同一版本 SHALL 只有一个指定主发布入口。

#### Scenario: Mirrored repositories

- **WHEN** 版本标签需要在 GitHub 与 Gitea 之间同步
- **THEN** 备用入口的发布触发已被控制，同一版本不会由两个流程重复发布到相同 registry

### Requirement: Prerelease and stable release distinction

预发布 SHALL 使用 next，稳定版 SHALL 使用 latest，demo SHALL 仅在稳定发布时部署；版本准备 SHALL 验证已有 rc 版本的后续预发布及稳定退出。

#### Scenario: Prerelease preparation

- **WHEN** 从当前 rc 版本准备后续预发布
- **THEN** 演练确认版本递增和标签匹配，发布计划使用 next 且不部署 demo

#### Scenario: Stable release preparation

- **WHEN** 退出预发布并准备稳定版本
- **THEN** 演练确认无预发布后缀的正确版本，发布计划使用 latest 并允许 demo 部署

### Requirement: Partial registry failure recovery

多 registry 发布 SHALL 使用同一 tarball 与校验值；部分失败恢复 SHALL 核对已发布版本并仅处理缺失目标，不覆盖已有版本。

#### Scenario: One registry already published

- **WHEN** 一个 registry 成功而另一个失败
- **THEN** 恢复流程验证现有版本和产物校验值，仅重试缺失目标，不盲目重复全部发布步骤
