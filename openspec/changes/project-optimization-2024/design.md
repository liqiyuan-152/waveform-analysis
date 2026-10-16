# Design

## Context

动机见 [proposal.md](proposal.md)。审核基准为 2026-10-16 的工作区：
库有根、native、vue 三个公开入口，exports 指向 dist；构建使用 Vite 8 / Rolldown，D3 和 Vue 已 externalize。
根 build 负责类型检查、库、声明和 demo，部署读取根 dist-demo。
lint 使用 --max-warnings=0。显式 WASM 打包依赖 Rust、Cargo 和 wasm-pack，并验证缓存。
GitHub 与 Gitea 都存在标签发布工作流；Gitea 使用源码归档包而非普通 Git checkout。
根 workspace 配置已有未跟踪文件，实施时必须保留和核对其内容，不能直接覆盖。

## Goals / Non-Goals

**Goals:**

- 在保持消费者契约和根开发命令的前提下隔离 demo。
- 所有新增门禁都可验证失败场景；基线、决策和验收结果可追溯。
- 让版本准备与发布职责明确，不额外增加本地发布路径。

**Non-Goals:**

- 不改图表行为、公开 API、运行时依赖或外部化边界。
- 不迁移 Git 历史、不删除既有证据、不调整发布版本。
- 不实现手动代码分割、额外 TypeScript 严格选项或自动视觉回归。

## Decisions

### 1. 使用私有 pnpm workspace demo

选择 pnpm 原生 workspace，避免为两个包引入额外任务编排框架。
只声明实际存在的 demo 包路径，不预留空 packages/_；合并现有配置。
demo 包命名为 demo-app，设置 private: true，以 workspace:_ 引用根库。
先盘点 demo、路由、入口 HTML、公共资源、模拟数据、样式及测试引用，再整体迁移。
demo 自身的 @ 别名指向 demo 源码；库使用库的别名。demo 通过公开入口消费库；
如发现内部导入，先用现有公开能力替代或将 demo 专用辅助代码迁入 demo，不顺带扩大公开 API。

根 typecheck 继续覆盖库、测试和构建配置，并新增 demo 检查，不能退化为仅检查库源码。
按用户 2026-10-16 的补充要求，根 dev 使用已有 wasm/pkg，构建库和声明后启动库/声明监听与 demo 服务；
启动、类型检查、JS 构建和测试不探测 Rust 工具链。仅显式 build:wasm / prepare:wasm 使用 Rust；
修改 Rust 源码或缺失 WASM 产物时先显式打包，不自动更新 WASM。
统一退出时释放所有子进程。监听需验证 Vue、TypeScript、CSS 修改生效。
不能直接把 --watch 追加到含多个命令的 build:lib 脚本；单独设计监听脚本，并处理 native 样式生成。

根 build 保留完整构建：typecheck → build:lib → build:types → build:demo。
build:demo 的独立入口也必须确保库和声明已准备，使用无循环的内部 demo 构建命令避免递归。
demo 输出固定为根 dist-demo，preview 指向该目录。
验收从无 dist、无 dist-demo 的干净检出开始；仅安装依赖后 pnpm dev 必须可用。

将仅 demo 使用的 UI 包移入 demo dependencies；迁移前检查测试、夹具和脚本是否仍直接导入。
若非 demo 代码仍使用它们，先迁移或隔离相应测试归属，不依赖 workspace 的偶然提升。
更新 pnpm-lock.yaml 后，以 frozen install 验证。devDependencies 数量仅作为测量数据，
不能因新增工具而人为要求净减少两个包。

### 2. 保留 Git 历史，先评估二进制资产

替代原先“立即 LFS + --everything”方案，本次只记录 WASM 当前大小、历史累计对象大小、
变更频率、clone 成本及托管服务限制，形成是否值得引入 LFS 的决策记录。
约 59 KiB 的当前文件大小不是历史累计大小，也不是必须迁移的证据。

显式 WASM 打包继续使用现有构建和缓存机制；日常 JS 开发使用仓库已有产物。
若后续证据支持 LFS，另开变更，优先只从新提交开始跟踪；
该变更需覆盖 GitHub checkout、Gitea 源码归档下载、对象可用性、离线失败提示与恢复。
历史重写须另行明确范围、备份和协作安排，不能作为普通优化命令执行。

长期 evidence 中的结论、测量 JSON、验收截图和复现说明继续提交。
只忽略明确的临时路径，例如 evidence/tmp/、分析 HTML 和生成的 docs/api；
不使用 openspec/changes/*/evidence/ 通配忽略，也不批量取消已有文件跟踪。
原始大日志若使用 CI artifacts，长期摘要必须记录 commit、命令、结果、校验值、链接和过期时间；
支撑结论的最小数据必须保留在仓库，不能只保留会过期的链接。

### 3. 提交前只运行格式化和 lint，CI 保持完整检查

采用 Husky + lint-staged；与仅依赖 CI 相比，可缩短反馈时间，但 CI 仍是最终门禁。
pre-commit 不运行测试，避免与原提案的相关测试承诺冲突。
每个文件匹配键只出现一次，例如：

```json
{
  "lint-staged": {
    "*.{ts,tsx,vue,js,mjs,cjs}": ["prettier --write", "eslint --fix --max-warnings=0"],
    "*.{json,md,yaml,yml,css}": ["prettier --write"]
  }
}
```

具体匹配范围与 ESLint 支持的文件类型对齐，验证部分暂存和含空格路径，不意外暂存其他修改。
prepare 使用跨平台安装包装脚本：CI、HUSKY=0 和无 .git 的源码归档环境明确跳过 hooks，
正常开发环境安装失败则报告错误，不用无条件吞错掩盖问题。
消费者安装发布包不应依赖 Husky 或仓库 Git 元数据。

consistent-type-imports 与 explicit-function-return-type 按目录审计、修复后启用 error，
先覆盖 src/utils 和 src/core。未迁移目录在新增规则覆盖之外，保留原规则。
不使用全仓 warn 加“修复 50%”方案。每阶段 pnpm lint:all 必须零警告；
独立审计结果可非阻塞，但不能降低现有 CI 标准。记录剩余目录及后续迁移条件。

### 4. 先测量再决定压缩配置

保留 Vite 8 / Rolldown 及多入口架构，不假设当前是单体 bundle。
比较当前 terser 3 passes、terser 1 pass、oxc 和 esbuild；验证候选工具与当前版本兼容后再测量。
D3/Vue 继续 external，不为它们新增 vendor chunk。代码分割单独延期。

测量绑定同一 commit、Node/pnpm 版本、机器、操作系统和锁文件，记录命令、缓存状态和依赖版本。
每种方案至少运行三次，保留原始数据并比较中位数；安装测量区分全 workspace 和受控库开发范围，
区分冷/热 pnpm store，不能把共享 store 占用当作单包占用，也不能清除用户全局缓存。
磁盘数据注明统计路径及逻辑大小/实际占用口径。原文中的 45 秒、200MB 等数字不作为基线。

记录每个入口及其可达共享 JS chunk 的 gzip 合计，单个入口内去重；
另记录整个发布包 JS 去重合计、CSS、WASM、声明和 tarball 大小，避免只看 index.js。
选择新压缩配置必须同时满足：

- 每个入口可达 JS gzip 合计及全部 JS 去重合计均不增加超过 5%；
- build:lib 中位耗时至少改善 10%，且测量波动不掩盖收益；
- 类型、ESM/CJS、三入口、CSS、WASM、tree-shaking 和包消费验证通过。
  体积下降不设下限；无法达到条件则保留 terser 3 passes，记录结果仍算完成评估。

增加显式 pnpm analyze 命令。先验证 rollup-plugin-visualizer 与 Rolldown 的兼容性，
不兼容时使用当前打包器支持的等效分析工具并记录选择。
报告在本地生成，缺失或失败时命令非零退出；正常 build 不依赖报告生成。
报告展示入口、共享 chunk 和外部依赖边界，不把 external 模块计入内嵌体积。

### 5. API 文档覆盖所有公开入口

使用 TypeDoc 生成参考文档，手写 README/贡献指南负责教程，避免重复维护类型签名。
优先以 build:types 产生的声明为输入，覆盖根、native、vue 三个公开入口，
避免直接解析 Vue SFC 和 TypeScript 6 兼容性问题。选择经验证兼容的 TypeDoc 版本。
docs:api 负责所需声明准备，生成 docs/api；检查入口、类型链接和组件 props/events 可读性，
不能仅以命令退出码判断文档完整。无法解析公开类型时必须失败，不能跳过后宣称完成。
生成目录不提交；贡献指南说明生成和本地预览方式。
README 链接可用的生成说明；没有部署站点前不放置虚假的在线 API 链接。

### 6. Changesets 仅负责版本准备

使用 Changesets 显式记录用户可见变更，替代依赖提交信息推断版本的方案。
demo-app 保持 private，并配置不为其生成发布标签或发布记录。
初始化及版本演练在临时副本中进行，删除演示 changeset，不改变工作区真实版本。

正式流程：编写 changeset → 版本准备 PR → 审核版本、锁文件和 CHANGELOG →
完整发布检查 → 提交版本变更 → 创建与 package.json 一致的 annotated tag →
由既有标签流水线构建、打包和发布。禁止把本地 changeset publish 加入贡献流程。

预发布在临时副本验证 pre enter rc、version、pre exit 及稳定版本准备；
验证已有 0.2.0-rc.1 到后续 rc/正式版的版本演算，不预设工具自动选择正确版本。
含预发布标识的标签使用 next，稳定版本使用 latest，demo 仅稳定版本部署。

GitHub/Gitea 均可能发布 npmjs，维护发布入口清单：同一版本只通过指定主发布入口触发发布，
默认保留负责双 registry 的 Gitea 流程。镜像同步前应禁止备用工作流发布同一版本；
不以“两个平台都推标签”作为发布步骤。若切换主入口，须先更新运行手册和备用入口开关。
双 registry 使用同一 tarball 与校验值；一个成功另一个失败时仅恢复缺失目标，
先核验现有版本及校验值，不删除重发、不盲目重复全部流水线。
本变更只通过临时副本和模拟流程验证，不实际发布或推送标签。

## Risks / Trade-offs

- workspace 仍安装 demo 依赖 → 不承诺全仓安装提速，分别报告测量范围。
- 监听、别名和构建顺序改变 → 通过干净检出、热更新和退出清理验证。
- 源码归档没有 .git → prepare 明确跳过 hooks，保持 Gitea 构建可运行。
- 新工具增加维护成本 → 固定兼容版本并更新锁文件，保留 CI 作为最终门禁。
- 本次变更范围较广 → 按任务阶段提交，每阶段记录验证，避免跨阶段混合修改。

## Migration Plan

1. 记录基线 commit、工具版本和现有工作区差异；仅处理本变更涉及的内容。
2. 完成 workspace 迁移及根命令兼容后再接入工具；资产评估可独立完成。
3. 测量并选择压缩配置，生成 API 文档，演练版本准备，最后更新贡献指南。
4. 在干净检出执行 tasks 中的完整检查，记录证据并重新验证 OpenSpec。
5. 回滚使用各阶段对应提交的 revert，重新安装锁定依赖并验证完整构建；
   不以移动中的 main 作为恢复点，不改写 Git 历史。生成的报告可重新生成。
6. 已发布的 npm 版本不通过覆盖恢复；如需修复，另行走新版本发布流程。

## Deferred Work

| 项目                     | 当前决定                 | 重新评估条件                                |
| ------------------------ | ------------------------ | ------------------------------------------- |
| Git LFS                  | 本次仅评估，保留普通 Git | 历史体积/clone 成本有实测证据支持，另开变更 |
| 手动代码分割             | 不实施                   | 发现可量化加载瓶颈并定义兼容契约，另开变更  |
| 额外 TS 严格选项         | 不实施                   | 独立审计明确错误规模、修复范围和验收条件    |
| 自动视觉回归/定时性能 CI | 不实施                   | 人工与现有浏览器验证不足时另行设计          |

此表是延期事项的跟踪位置，不在 tasks 中保留含糊的可选实施复选框。
