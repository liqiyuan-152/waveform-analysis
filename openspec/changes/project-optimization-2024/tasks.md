# Tasks

## Status

2026-10-16：阶段 1 基线记录与迁移准备完成，证据见 evidence/baseline.md、migration-inventory.md 及原始数据。
基线完整覆盖率有 11 个超时，四文件单 worker 定向复测 43/43 通过；不将覆盖率失败标为通过。
阶段 2 各条专项验收完成，证据见 evidence/workspace.md 及 JSON/截图/原始日志。
启动回归已补修：原生 pnpm.exe 调用方式已修正；按用户要求日常命令不检查 Rust，
显式 WASM 打包才使用工具链。普通终端启动及浏览器复验见 evidence/startup-fix.md。
勾选代表所列专项条件已验证，不代表完整 CI 通过：全量覆盖率串行运行有 2 例既有整数缩放超时，
该文件普通定向复测 7/7 通过；没有调整超时或覆盖率阈值。Docker 仅静态核查，未构建镜像。
阶段 3–7 尚未实施，不将完整验收或归档标为完成。
用户后续已授权提交并明确发布正式版 0.2.1；发布检查见 evidence/release-0.2.1.md。

## 1. 基线与迁移准备

- [x] 1.1 记录 commit、工作区已有修改、Node/pnpm/Rust 工具版本和基线检查结果；保存到 evidence/baseline.md，不覆盖无关改动。
- [x] 1.2 盘点 demo、资源、别名、测试/夹具、直接依赖、公开入口和进行中的相关变更；形成迁移清单，每项标明目标路径及验证方式。
- [x] 1.3 按 design 的口径记录安装、磁盘、构建及包体积基线，至少三次测量，保留原始数据；区分冷/热缓存与测量范围。

## 2. Workspace 隔离

- [x] 2.1 合并现有 workspace 配置，建立 private demo-app，迁移 demo 代码、HTML、资源与 UI 依赖，更新锁文件；验收：无依赖提升造成的隐式导入，库运行时依赖保持不变。
- [x] 2.2 调整源码别名、测试引用、TypeScript 项目和 CI 路径；验收：根 typecheck 覆盖库、测试、构建配置和 demo。
- [x] 2.3 保留根 dev/build/build:demo/preview 语义，实现无循环的准备与构建顺序；验收：干净检出安装后可直接 dev，build 和独立 build:demo 均产生根 dist-demo。
- [x] 2.4 验证 TS/Vue/CSS 热更新、native 样式更新、停止时子进程清理，执行桌面与小容器 demo 验证；记录截图、路由、尺寸和结果。
- [x] 2.5 完成 frozen install、三入口 ESM/CJS/声明/CSS/WASM 包消费验证；复测安装成本，报告真实差异，不以预设提速比例作为通过条件。

## 3. 资产与证据保留

- [ ] 3.1 测量 WASM 当前/历史对象大小、变更频率和 clone 成本；记录 LFS 的收益、托管约束、源码归档限制及后续决策，本次不迁移历史。
- [ ] 3.2 只忽略分析报告、生成 API 和明确临时路径；验收：已有证据仍被跟踪，新增长期报告可提交，临时日志不进入发布包。
- [ ] 3.3 为外部大日志记录链接、保留期限、commit 和校验值，并将足以复核结论的摘要/最小数据保留在仓库。

## 4. 质量工具链

- [ ] 4.1 添加与 Prettier 一致的 EditorConfig，验证换行、缩进、文件末尾换行及 Markdown 尾随空白规则。
- [ ] 4.2 接入 Husky/lint-staged 和跨平台 prepare 包装脚本；验收：有效提交成功、不可修复 lint 失败、部分暂存及含空格路径正常；pre-commit 不运行测试。
- [ ] 4.3 验证 CI、HUSKY=0、无 .git 源码归档和独立消费者安装场景；跳过 hooks 不得跳过 CI 检查。
- [ ] 4.4 审计并修复 src/utils、src/core 的新增类型规则，按目录启用 error，记录剩余目录；验收：pnpm lint:all 零警告，原有规则未降低。

## 5. 构建与 API 文档

- [ ] 5.1 测量 terser 3/1 passes、oxc、esbuild 的兼容性、速度及全入口体积；满足 design 的 5% 体积上限和至少 10% 耗时改善才切换，否则保留当前配置并记录理由。
- [ ] 5.2 接入兼容的产物分析工具及 pnpm analyze；验收：报告覆盖入口、共享 chunk 和 external 边界，失败返回非零，普通 build 不依赖报告。
- [ ] 5.3 选择兼容的 TypeDoc 版本并实现 docs:api 的声明准备和三入口生成；验收：公开类型、组件 props/events、链接完整，生成失败可见，无虚假部署链接。

## 6. 版本与贡献流程

- [ ] 6.1 配置 Changesets 与 private demo 排除规则，在临时副本验证变更消费、版本及 CHANGELOG/锁文件更新；不提交演示变更，不改真实版本。
- [ ] 6.2 在临时副本演练现有 rc 版本的后续预发布和稳定退出，验证 next/latest、标签与版本一致、稳定版才部署 demo。
- [ ] 6.3 更新发布手册，指定主发布入口并落实备用入口防重复发布控制；模拟双 registry 部分失败的恢复流程，验证同一 tarball/校验值，不实际发布或推送标签。
- [ ] 6.4 完成 CONTRIBUTING 和 README：环境、干净启动、检查、hooks 跳过、API 文档、OpenSpec、版本准备及恢复流程。

## 7. 完整验收

- [ ] 7.1 在干净检出执行下方检查，记录命令、退出码、工具版本和 commit；失败不得标为通过。
- [ ] 7.2 对照六份规格逐项记录场景证据，保留桌面/小容器及包消费者结果；更新 REVIEW，明确已验证和未验证部分。
- [ ] 7.3 运行 openspec validate project-optimization-2024 --strict，确认任务状态真实，再使用 OpenSpec 归档流程；不得手工把整个 change 目录移入 openspec/specs。

## Testing Strategy

迭代时执行最接近的检查；最终干净检出按依赖顺序完成：

1. Node 22、pnpm 10.32.1，以及当前 CI 固定的 Rust/wasm-pack 环境准备。
2. pnpm install --frozen-lockfile；无 .git 的归档副本也验证安装和构建。
3. pnpm typecheck、pnpm typecheck:examples、pnpm check:file-length、pnpm lint:all。
4. pnpm test:coverage；保持既有全局和模块覆盖率阈值，不通过排除文件降低标准。
5. pnpm build、pnpm pack --dry-run、pnpm test:package；按现有脚本要求准备 Playwright 浏览器。
6. pnpm check:native-boundary、pnpm check:licenses。
7. pnpm analyze、pnpm docs:api；检查生成内容而非仅检查退出码。
8. 根 dev、独立 build:demo 和 preview；验证代表性 demo 路由及可复用组件/打包消费者，
   至少覆盖桌面 1200px 与小容器 360px，检查缩放、平移、标注、分页、动画、导出与 WASM。
9. GitHub/Gitea 构建与发布配置检查、Changesets 临时副本演练，不产生实际发布。
10. OpenSpec 严格校验及场景证据核对。

## Dependencies

1 → 2 → 4 → 5 → 6 → 7；3 在基线记录后可独立进行，最终纳入 7。
工具接入阶段均以迁移后的目录为准。未通过上一阶段必要检查，不进入依赖它的阶段。
不设未经测量的工时承诺，实施时在证据中记录实际投入与阻塞。
