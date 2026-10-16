# Review

## Status

审核日期：2026-10-16。规划通过 OpenSpec 严格校验；阶段 1 已完成基线记录，阶段 2 各条专项验收完成。
完整覆盖率的最终结果以 evidence/workspace.md 和原始日志为准，不能用规划校验代替工程验证。

## Scope

本次按用户要求仅实施阶段 1–2：基线、迁移准备和 private demo workspace 隔离。
迁移 demo 源码/测试、拆分 UI 开发依赖，调整根脚本、类型项目及浏览器夹具路径；
保留公开包 API、库运行时依赖、版本和发布流程。没有提交、推送、发布或操作标签。
原有 WASM、.kiro 和其他 change 保留；现有 workspace allowBuilds 合并保留。
阶段 3–7 尚未实施，也没有归档 change。

## Findings and Resolutions

| 原问题                           | 修订结果                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| 声明六项能力却无 specs           | 六份能力规格包含 Purpose、ADDED Requirements、SHALL 和可验证 Scenario；不使用 skip_specs 绕过 |
| lint 留存警告与零警告 CI 冲突    | 按已修复目录启用 error，保留全量 lint:all 零警告                                              |
| 本地发布与标签发布重复           | Changesets 仅准备版本；指定主发布入口并补充备用入口控制和双 registry 恢复                     |
| LFS 全历史迁移缺乏依据           | 本次仅测量和决策，不迁移历史；重新评估条件列入 Deferred Work                                  |
| lint-staged 重复键及测试策略冲突 | 单个匹配键，统一为格式化和 lint，不在 pre-commit 运行测试                                     |
| workspace 缺少启动和构建顺序     | 明确干净启动、三入口产物准备、声明监听、完整类型检查及根 dist-demo                            |
| 忽略全部 evidence                | 保留长期证据，只忽略明确临时输出，外部日志须有可长期复核的最小数据                            |
| 构建架构及优化指标不一致         | 对齐 Vite 8 / Rolldown、多入口及 D3/Vue external；统一 5% 体积上限与至少 10% 耗时改善         |
| 无依据的基线和收益承诺           | 移除估算现状，要求同环境至少三次测量，区分安装范围和缓存                                      |
| 可选任务长期悬空                 | 分割、额外 TS 严格选项、自动视觉回归等明确延期，集中记录重新评估条件                          |
| 文档入口与审核信息过时           | 日期改为实际修订日，删除占位链接和无依据评分，压缩重复内容                                    |

## Traceability

| 能力                              | 主要实施任务     | 核心验收                                         |
| --------------------------------- | ---------------- | ------------------------------------------------ |
| project-workspace-isolation       | 1、2、7          | 干净安装/启动、热更新、完整构建、独立消费者      |
| project-asset-evidence-management | 3、7             | 资产测量、历史不变、证据可追溯                   |
| pre-commit-quality-gates          | 4、7             | 成功/失败提交、部分暂存、源码归档安装、CI 零警告 |
| build-artifact-monitoring         | 1.3、5.1、5.2、7 | 报告、重复测量、体积/耗时门槛、消费兼容          |
| api-documentation-automation      | 5.3、6.4、7      | 三入口文档、公开类型完整性、本地使用指引         |
| changelog-workflow                | 6、7             | 临时副本版本演练、标签/发布职责、部分失败恢复    |

## Validation

使用本机 OpenSpec 1.14.1：

- openspec validate project-optimization-2024 --strict：通过。
- openspec status --change project-optimization-2024 --json：isPlanningComplete 为 true，四类规划产物均为 done。
- 规划状态中的 isComplete 代表规划产物齐全，不代表 tasks 中的工程实施已经完成。
- 本 change 的 Markdown/YAML 使用仓库 Prettier 格式化并检查。

工程验证和基准已运行，详见 evidence/baseline.md、migration-inventory.md、workspace.md。
其中记录了 typecheck、lint、冻结安装、干净启动/构建、包消费、浏览器路由/交互、监听清理和三次测量。
基线完整覆盖率有 11 例超时；阶段 2 串行全量为 2062/2064 测试通过，另两例为相同文件的既有超时，
对应文件普通定向复测 7/7 通过，coverage 线程池定向复核仍有两例超时。
不提高超时、不降低覆盖率门槛；完整覆盖率未通过，Docker 镜像构建未验证。
阶段 2 以外的六份规格其余场景仍属于后续验收范围，不声称全变更完成。

## Artifact Requirements

proposal、specs、design、tasks 是本 change 的 spec-driven 规划产物。
README 和 REVIEW 为导航与审核辅助文档；implementation、compatibility、FINAL-AUDIT 不作为额外必需文件。
实施可以直接在 evidence 中记录命令和结果；不得为满足文档形式而编造已完成的验收。
