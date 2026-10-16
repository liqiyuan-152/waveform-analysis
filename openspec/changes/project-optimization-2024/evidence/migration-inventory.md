# 阶段 1：迁移清单

起点与环境见 baseline.md。清单基于 CodeGraph 及配置/直接导入核查。

| 现有项                                                        | 目标/处理                                                             | 验证                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------- |
| src/App.vue、main.ts、DemoRouterApp.vue、router.ts            | demo-app/src 同名文件                                                 | 四条 hash 路由、App/路由测试        |
| src/demo/**、src/views/**                                     | demo-app/src 下保留内部目录                                           | demo 单测、桌面/360px               |
| src/styles.css、demoRoutes.css、index.html                    | demo-app 内同名路径                                                   | HTML 入口、CSS、生产预览            |
| demo 数据（src/demo/data）                                    | demo-app/src/demo/data                                                | simulatedWaveforms 测试             |
| src/data/**                                                   | 保留：库数据管理层，被原生 chart 和测试引用                           | 库 typecheck/数据测试               |
| 静态 public/资源                                              | 当前无根 public 或独立 src/assets；样式/数据随所属模块迁移            | 构建资源引用与浏览器网络            |
| demo 的 components/types/core 导入                            | WaveformChart 从 waveform-analysis/vue，类型/算法从根公开入口         | 声明构建、无 ../../src 或私有子路径 |
| toolbarRegistry                                               | demo 只需要选项、标签和默认值，迁为 demo 自有展示配置，不复制执行器   | toolbar 控件回归                    |
| applyXDomainStrategy                                          | demo 自有时间窗口对齐辅助，保留秒坐标语义；不扩大 API                 | integerZoom/初始域回归              |
| normalizeWaveformSeriesSources                                | 使用已有公开 normalizeWaveformSeries 后按完整点过滤窗口               | 空窗口、边界点、系列 ID/合并测试    |
| ant-design-vue、vue3-colorpicker、vue-router                  | demo dependencies；直接使用这些包的测试随 demo 迁移或声明独立测试归属 | frozen install、直接依赖核查        |
| tests/App、tests/demo、tests/views、simulatedWaveforms        | demo-app/tests，保留全局测试执行与 coverage 门槛                      | 完整 coverage                       |
| 历史夹具及 annotation/components/native-controls 对 UI 的引用 | 明确测试依赖归属，不能靠提升                                          | 根与 demo 类型/测试、浏览器 fixture |
| 根 @、@tests                                                  | 继续指向库与根测试；demo @ 指向自己的 src，demo 测试用专属别名        | vue-tsc 覆盖库/测试/demo/配置       |
| vite.config.ts 中混合 demo/Vitest 配置                        | 分离 demo 构建配置，根保留测试与历史浏览器 fixture 支持               | 原测试和脚本构建路径                |
| tsconfig.app/lib/node、根 references                          | 新增 demo 项目，根覆盖测试和两套配置；库声明不含 demo                 | typecheck、typecheck:examples       |
| dev/build/build:demo/preview                                  | 根脚本编排 WASM→库→声明→demo，内部 demo 命令不递归                    | 无 dist 首次 dev、独立 build:demo   |
| 库/声明监听、native CSS 复制                                  | 专门启动/停止脚本，声明后处理与 native CSS 更新必须随监听执行         | TS/Vue/CSS/native 修改与进程清理    |
| GitHub/Gitea/Dokploy                                          | 保留根命令和根 dist-demo 输出，核查路径而不触发部署                   | 配置审查、本地根命令                |
| 三公开入口/exports/typesVersions/运行时 deps                  | 保持契约、版本与依赖不变                                              | ESM/CJS/声明/CSS/WASM 消费测试      |
| pnpm-workspace.yaml                                           | 保留已有 allowBuilds，仅添加实际 demo 包；测试归属如需包则显式列入    | 锁文件 importer、frozen install     |

相关变更：remove-antd-from-waveform-library 为已有未跟踪规划；
remove-waveform-antd-dependency、decouple-waveform-engine-from-vue、add-animation-system 已有实现/证据。
当前库已具有 root/native/vue 三入口和纯原生 runtime，不能按旧文档重新移除 Vue/AntD 或改变 API。
所有这些 change 保留原状；本次不归档它们。
