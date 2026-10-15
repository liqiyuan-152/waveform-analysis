## Status

迁移执行中。根入口仍为旧 Vue 组件；原生入口已连接基础实例与 SVG，但尚未达到替换旧组件的行为等价门槛。不得将本记录或基础浏览器测试解释为完整验收。

## Baseline

- 开始时 HEAD 为 `247144ee3e88a7fceb6cb3382fb80eb5b274dd3e`，已跟踪工作树无改动。
- 已有未跟踪动画和原生控件证据保留；完整清单位于 `evidence/public-api-baseline.json`。
- 原公共入口快照包含 134 个出口、43 个基础 props、5 个动画 props、19 个旧事件，以及 handle 重载、默认值和序列化源码。快照不覆盖当前文件，不能重新覆盖为新实现。
- 工具链为 Node 22.23.2 / pnpm 10.32.1，已运行 frozen install。
- `prepare:wasm` 自动产生的两项原有 WASM 产物变化属于工具副作用，不纳入迁移设计；本轮检查后已还原到初始 HEAD，未纳入迁移改动；后续 prepare:wasm 可能再次生成。

## Dependencies

| 前序变更 / 业务基线                              | 当前状态 / 迁移依赖                          | 本轮处理                                            |
| ------------------------------------------------ | -------------------------------------------- | --------------------------------------------------- |
| add-waveform-toolbar-and-external-controls       | 24/24；命令结果、target 和旧数字重载静默语义 | 复用约束函数，原生命令仍待完整协议验收              |
| add-animation-system                             | 68/68；controller、presets、采样与展示层职责 | 保留算法与全部前序证据；原生动画编排尚未接入        |
| remove-waveform-antd-dependency                  | 16/16；dialog、输入、分页与工具栏            | 原生控件迁移需要保留焦点和键盘契约                  |
| configure-y-axis-padding-and-maximum-ticks       | 16/16；振幅与最值刻度规则                    | 原生布局复用当前域、padding 和 tick 算法            |
| improve-waveform-reliability-and-maintainability | 30/30；不可变数据、完整数据查询              | 抽取纯数据准备，并使旧 Vue watcher 继续委托同一函数 |
| 其余未完成提案                                   | oversize、any、props casting、旧测试提案     | 不修改其任务状态，不批量搬迁未接入模块              |

以上状态来自本次 `openspec list --json`。这里只记录依赖，不归档或修改前序提案。

## Implementation

- `types/options.ts` 和 `types/native.ts` 定义无框架契约；旧 Vue 类型引用同一 props 定义。
- `model/` 使用 OptionManager、ChartModel、ViewportModel、SeriesVisibilityModel 和 PresentationModel；先准备候选配置和数据，再提交状态。
- `data/` 管理不可变输入与完整点源；查询使用完整数据，不读取 SVG 抽样点。
- `chart/` 管理注册、类型化事件、资源、帧调度和尺寸；公共入口只导出工厂与实例接口。
- `layout/` 复用现有纯域、网格和轨道布局函数；`rendering/`、`view/` 按稳定 ID 保留 SVG/轨道/系列节点，并为多实例分配唯一 clip ID。
- `export/` 已接入基础稳定版本捕获与 SVG/PNG；采样、动画、标注、标题与图例完整导出仍待对应业务模块接入和第 9 阶段验收。
- 模拟数据移至 `src/demo/data/`。native 子入口与 native/style.css 独立构建，旧 Vue 入口继续可用。

## Verification

| 实际执行                                        | 结果 / 范围                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                                | 通过；原生契约及项目类型                                                                                                                                                 |
| 定向 Vitest 12 文件                             | 78 项通过；模型、事件、调度、实例、基础布局、归一化、序列化与旧数据生命周期                                                                                              |
| `pnpm check:file-length`                        | 通过；src 文件未超过 450 行                                                                                                                                              |
| `pnpm lint:all`                                 | 通过；Oxlint 和 ESLint                                                                                                                                                   |
| `pnpm build`                                    | 通过；库、native CSS、声明、旧 demo                                                                                                                                      |
| `pnpm check:native-boundary`                    | 通过；108 个传递源模块不依赖 Vue/React/.vue，原生 CSS 无框架引用                                                                                                         |
| `node scripts/verify-native-package.mjs`        | 隔离安装通过；无框架/浏览器 ESM/CJS 导入、skipLibCheck:false 声明及资产；日志为 evidence/native-package-verification.txt                                                 |
| `node scripts/test-native-instance-browser.mjs` | Chromium 141、Firefox 142、WebKit 26 基础实例测试通过；桌面和 360px 截图、同步命令、SVG/PNG、隐藏恢复及每浏览器 30 次创建/销毁，见 evidence/native-instance-browser.json |
| 旧浏览器基线                                    | 18 组性能场景、100 次视口操作、30 次循环已记录；原始测量脚本和 browser-baseline.json 保留                                                                                |

原生基础截图与旧完整图表有明显功能差异，尚未验证全部控件、标注、动画和视觉等价。30 次循环只证明本次基础资源/DOM 检查，不等于已完成全部 Observer/Worker/动画/浮层的资源验收。完整覆盖率、消费示例和最终预切换检查以后续实际记录为准。

补充：最新 `pnpm test:coverage` 已通过（165 文件、1366 项；statements 91.92%、branches 86.73%、functions 93.48%、lines 93.98%）。`pnpm test:package` 也已通过旧 Vue 包的分页、标注 CRUD、完整数据吸附、颜色、校验、小容器和清理验证。实际日志位于 evidence/coverage-current.txt、build-current.txt、lint-current.txt、package-current.txt；旧提案的测试截图副作用已恢复，不纳入本轮改动。

## DOM Ref Examples

4.6 已完成。`examples/vanilla`、`examples/vue`、`examples/react` 全部导入已构建公开 native 入口及样式，未引用内部源码。React 19.2.0 及其类型只加入开发依赖。

- `pnpm install --frozen-lockfile`、`pnpm typecheck:examples` 和 `pnpm lint:all` 已通过；示例目录补齐浏览器 globals。
- `node scripts/test-native-examples-browser.mjs` 在开发服务器运行，以实际触发 React Strict Mode effect 重放。Chromium 141.0.7390.37、Firefox 142.0.1、WebKit 26.0 的三种消费者共 9 组通过。
- 验证单一实例注册/根节点、数据引用更新、最新 rendered 回调、360px 尺寸、卸载与重新挂载；React 首次挂载记录 2 次创建/1 次销毁，最终卸载创建数等于销毁数，无 pageerror。
- 证据为 `evidence/native-examples-browser.json` 和 18 张 example 截图。范围仅基础生命周期；第 10.3 阶段完整业务示例仍未完成。

## Visual Migration In Progress

原生已接入共享点/误差条几何、原虚线规则、网格、零线、轴标题/单位、极值标签避让、帧号水印和帧样式；原 Vue 继续使用共享几何与样式解析，避免复制算法。图例原生视图及受控显隐请求已接入。标题布局/测量、X 轴标题和空图提示已接入；分页、全部视觉与交互验收仍待完成，因此 5.x/7.x 不提前勾选。新增 nativeVisualLayers 测试覆盖复合路径、网格、单位、零线阈值、clean、跨窗口节点；已运行 6 项通过；连同原生实例回归为 2 文件/23 项通过，旧相关回归 7 文件/56 项通过。图例更新保持原按钮焦点，受控显隐在宿主回传前保持现状，两个请求事件各用独立快照。字体加载后重新计算布局，保持当前业务 revision。

本轮最新完整验证为 166 文件、1373 项通过，statements 92.19%、branches 86.66%、functions 93.54%、lines 94.24%；构建、lint:all、file-length、typecheck、examples 类型检查及 OpenSpec strict 通过。原生边界检查为 122 个模块。隔离 native ESM/CJS/声明/资产验证通过；旧 Vue packed consumer 的浏览器操作通过。为保护旧提案证据，包验证脚本新增可选 `WAVEFORM_PACKAGE_EVIDENCE_DIR`，本轮截图输出到当前提案 evidence，旧提案无差异。

原生三浏览器脚本已增加桌面/360px 标题与 SVG 高度总和、图例切换/恢复、键盘焦点和点/误差条复合路径检查，3 浏览器全部通过；新增 6 张 native-layers 截图，已人工查看 Chromium 360px 截图。三种消费者共 9 组在最新构建后重新通过。

当前明确限制：原生 exporter 只序列化 SVG，尚未合并 HTML 标题；图例的 foreignObject 还需按第 9 阶段转换为独立 SVG 几何后验证 PNG。此记录当时原生采样尚未接入；下方记录已完成的采样迁移。原生动画、手势、标注和分页/工具栏仍未完成。以上绿色测试不代表完整行为等价或预切换验收。

## Shared Sampling and Axis Layout

5.1–5.3、6.1–6.2 已完成。旧 Vue 根入口保持不变，未执行最终入口切换。

- `sampling/LatestTaskScheduler`、`WorkerSamplingClient`、`SamplingSession`、`RenderSamplingController` 为共享类。旧 Vue hook 只桥接响应式输入和结果；底层缓存、协议、JS/WASM 算法与 Worker runtime 继续复用。
- 原生采样阶段使用最新布局目标；数据引用更新销毁旧 transport，尺寸/视口变化立即作废旧任务。队列最多一个运行任务和一个最新待办；纯颜色/图例配置不重复采样。采样结果到达后仅刷新绘制，不产生新的业务 revision；finished/export 等待最新采样落图。
- 测试覆盖乱序数据/视口/尺寸、销毁后结果、迟滞期间保持模式与 120ms 后精确阈值、强制 WASM 无回退/JS 回退、错误去重、诊断节流和后端切换。修复消费者在采样错误/诊断回调中销毁实例后仍继续写入结果、发送后续诊断的问题。
- 全量域与查询服务不依赖显示采样。回归特意让 average 采样丢弃已知极值，再确认全量域、最近点和范围查询仍能找到它。6.3 的原生 hover/标注集成尚未实现，保持未勾选。
- Vue 与原生共用 `AxisLayoutEngine`；`YAxisTextMeasurer` 按原生宿主 ownerDocument 创建惰性 canvas，独立窗口不复用主窗口 context，无 canvas 时保留保守估算。轨道标题对齐也使用同一测量器。
- `nativeVueParity.test.ts` 对照真实 Vue 和原生结果：24 组显示/叠加/布局/尺寸组合、2 组固定域及振幅优先级（含视口变更）、3 组隐藏/全部隐藏/重排/数据引用变化及 2 组时间单位/formatter 场景。比较可见端点、轴域和标签、轨道几何、曲线路径与零线；隐藏节点是否保留不作为结构契约。修复了全部隐藏后原生多轴标题额外消失的差异。
- 已运行三浏览器原生实例检查：真实 50,000 点 typed 数据经 Worker/WASM 采样为 62 个显示点；颜色更新不重复采样。Chromium、Firefox、WebKit 均通过，日志见 `evidence/native-instance-current.txt` 和 `native-instance-browser.json`。这些单次耗时不作为第 6.5 项正式性能验收。

最新完整检查为 171 文件、1419 项通过，statements 92.35%、branches 87.26%、functions 93.77%、lines 94.52%（`evidence/coverage-current.txt`）；定向布局/采样 10 文件、90 项通过（`evidence/layout-sampling-regression-current.txt`）。上方 166 文件/1373 项及 122 模块是前阶段记录。当前原生边界检查通过 137 个传递模块。完整库/声明/demo 构建和 lint:all 通过，packed Vue consumer 浏览器分页、标注、颜色、校验、小容器和清理通过。独立 native ESM/CJS/无框架依赖树、skipLibCheck:false 声明及资产验证通过（`evidence/native-package-verification.txt`）。React/Vue/vanilla 共 9 组浏览器检查通过（`evidence/native-examples-browser.json`），React Strict Mode 重放仍符合预期；示例脚本现等待目标数据和新回调共同生效，避免将旧采样补绘误认作更新完成。typecheck、examples 类型、file-length、native-boundary、lint:all、build、test:package 和 OpenSpec strict 均已实际通过。人工查看最新 Chromium 360px 图层截图，标题、线点/误差条、水印与图例可见。

当前任务完成数为 22/57。标题/图例完整导出、原生动画、手势、标注、分页/工具栏和 Vue 薄适配仍未验收，任务继续保持未完成。

## Pagination Migration

原生新增 `ChartPaginationController` 和 `PaginationView`，委托 `PresentationModel` 维护页码，复用现有 paginationItems 和分页 CSS。按钮按稳定 key 更新，保留焦点和监听资源归属；不新增公共分页 action 或改变旧 handle。

- 对照 Vue 验证默认/edge-compact、800/360px 的分页高度：默认小容器预留 40px，edge-compact 可见分页预留 16px；clean 模式隐藏分页，presentation 模式保留分页。图表计算和渲染使用同一 snapshot。
- 翻页复用原有两个参数的 page-change。独立图框翻页重置视口，共享模式保留共享范围；同页和越界按钮不重复发事件。数据缩减修正越界页，网格/模式变化按旧生命周期规则修正页码；同数量重排保留当前页。
- `nativePagination.test.ts` 覆盖跳页、边界禁用、焦点、受控隐藏 ID、数据缩减、视口行为与 page-change 回调内数据替换/销毁。`nativeVueParity.test.ts` 新增 5 组动态对照，包含空轨道过滤、series 重排、页码修正和事件次数/参数一致性。定向 5 文件/64 项通过（`evidence/pagination-parity-current.txt`）。
- 三浏览器原生检查新增 12 组分页场景（2 宽度 × 2 预设 × 3 浏览器），验证跳页、focus、clean 显隐、可见控件边界和 SVG 高度；结果和截图见 `native-instance-browser.json`、`native-pagination-*.png`。已人工查看 Chromium edge-compact 360px。

已补生产构建下真实 Vue/原生并排视觉基线（`tests/browser/native-pagination-parity.*`、`scripts/test-native-pagination-parity.mjs`）。发现并修复原生将外边框计入绘图区的 2px 迁移差异：尺寸读取现在与 Vue ResizeObserver 的 contentRect 一致，排除边框/内边距并避免 CSS transform 改变绘图像素。新增 content-box 回归；定向 3 文件/59 项通过。最新 Chromium 360px 的标签、分页和 SVG 边界在两个预设下完全一致，脚本强制检查每项差异不超过 1 CSS px（`evidence/pagination-visual-parity.json`）。edge-compact 多页按钮遮挡 X 标题在旧 Vue 与原生中相同，属于已存在的共享布局限制；本迁移保留它而不单独改变一个入口的布局契约。5.5 已完成，当时任务 23/57；下方图层验收后为 24/57。分页的原生 DOM/状态部分完成不代表工具栏、手势取消、动画分页或完整视觉验收完成，8.5/6.4/11.x 仍未完成。

最新完整测试为 172 文件、1429 项通过，statements 92.45%、branches 87.57%、functions 93.81%、lines 94.61%。本轮 build、typecheck（由 build 运行）、lint:all、file-length 和 native-boundary 通过；边界为 141 个传递模块。本轮 packed Vue consumer、独立 native ESM/CJS/声明和依赖树及 React/Vue/vanilla 9 组浏览器检查均通过。content-box 修复后的最终完整检查以下方补充记录为准。

## Visual Layer Parity

5.4 已完成，当前 24/57。对照 snapshot 已扩展到可见点/误差条复合几何、网格坐标与颜色、水印文本/位置和边框样式；默认 SVG 属性与缺省属性按等价显示语义比较，网格浮点坐标保留 8 位小数，避免把 D3 的二进制舍入误差误作行为差异。

新增 4 种 unitDisplayMode 下的样式组合对照，包含 empty track、per-track 网格、frameNumber/frameNumbers、dotted frame、图例位置和受控隐藏/恢复/clean 更新。真实 Vue/原生 40 组场景及旧样式/单位/紧凑边框/零线回归合计 7 文件、87 项通过（`evidence/visual-parity-current.txt`）；标题布局旋转/删除/clean 保留区域由 nativeVisualLayers 和旧 sizingAndTitles 回归覆盖，三浏览器标题与点/误差条 smoke 保持通过。最终自包含标题/图例导出仍属于第 9 阶段，不由图层验收替代。

## Latest Verification

content-box 与视觉矩阵最终回归：172 文件、1434 项通过，statements 92.43%、branches 87.59%、functions 93.77%、lines 94.59%。`build`（含 typecheck/声明/demo）、`lint:all`、file-length、native-boundary（141 模块）、packed Vue consumer 与独立 native ESM/CJS/声明/依赖树均通过。三浏览器原生基础/采样/分页/图层 smoke 通过；React/Vue/vanilla 示例验证改为检查 360px 宿主与 root 内容宽度，而非将边框计入 SVG；本轮最终 9 组示例全部通过。

本轮按类划分页码控制与 DOM view，保留原生实例公共接口；原生动画编排已定位到 Vue hook 的 presentation/reconcile/watch 管道，下一步抽离该编排为共享类。现有 animation controller/core/presets/几何算法继续保留，尚未接入原生视图，不提前勾选 6.4。

## Native Animation Presentation

开始 6.4 的原生视图接入。`TrackView` 使用 `presentationKey ?? series.id` 管理路径视图，使现有 `transitionTrack/projectTrack` 算法生成的旧/新两套不兼容几何同时参与交叉淡入淡出；动画结束后删除旧视图，保留目标路径节点。`SeriesView` 按展示快照更新入场裁剪的 ID、X、宽度和轨道高度，裁剪节点在逐帧更新中复用，完成时移除 defs 与引用，销毁时随所属视图清理。

新增 `nativeAnimationPresentation.test.ts` 直接将共享动画算法生成的展示状态交给原生 renderer，验证不同点数的数据更新不会覆盖旧几何、淡入淡出透明度/终态回收，以及入场裁剪更新/完成/销毁。与原生视觉和 Vue/native 布局对照共 3 文件、48 项通过；与旧入场/更新/分页动画、几何及 controller 回归共 5 文件、103 项通过（`evidence/native-animation-presentation-current.txt`）。typecheck、lint:all、file-length、native-boundary（141 模块）和 git diff --check 通过。本轮未进行真实浏览器动画验收，也未重新运行完整覆盖率或构建。

已核对现有 `Animator` 支持注入 scheduler、controller 支持注入 Animator，可继续复用现有算法并按宿主 ownerWindow 绑定帧/计时器资源。共享动画状态类、原生实例调度和 finished/export 稳定等待尚未接入，6.4 保持未勾选，当前仍为 24/57。

## Shared Pagination Animation Owner

`animation/presentation/PaginationPresentation` 已接管分页/网格动画请求、环境和几何签名、pending/success/fallback/error 取消规则及入场时长。旧 `createPaginationPresentation` 只构造该类，不再保留另一套状态机。`wrapPagination` 使用绑定实例的函数属性，保留 Vue hook 将它直接返回给调用方的用法。页码触发仍为 500ms，网格触发使用配置时长，绘制仍交由既有系列动画管道。

配置解析和动画 context/签名移入同一共享目录，旧路径只显式重导出。共享 context 使用只读 `AnimationValueReader` 结构契约，归一化系列类型直接来自 core；不再导入 Vue Ref/ComputedRef 或 Vue data hook。`chartExportOptions` 的类型来源调整为框架无关 options。边界检查显式包含新分页类及其传递导入，即使尚未接入 native facade 也验证其框架独立性，目前覆盖 145 模块。

新增普通值读取器用例验证脱离 Vue 的分页回调、采样完成后入场和两个 owner 的请求/时长隔离。动画目录、原生展示及旧组件入场/更新/分页回归合计 16 文件、292 项通过（`evidence/shared-pagination-animation-current.txt`）。最终 typecheck、lint:all、file-length 与边界检查通过。初次类型检查发现共享 context 将只读 preparedSeries 声明为可变数组，已改为只读输入并重新验证；初次 lint 的测试变量 prefer-const 已修复。本轮未重新运行完整覆盖率、构建或浏览器动画验收。

6.4 仍未完成：轨道/标注展示状态、环境监听和主 reconcile 编排尚在 Vue hook 中，原生实例尚未连接该类或动画 finished/export 等待。本轮完成共享状态所有权抽离，不代替原生完整行为验收。任务完成数仍为 24/57。

## Shared Waveform Animation Orchestration

主动画 reconcile、入场 clips、轨道更新插值、已见系列、采样等待、分页准备、命令稳定化和分类禁用提交已迁入 `animation/presentation/WaveformPresentation`（404 行）。标注等待、出现/消失、只读退出快照和透明度通道由独立 `AnnotationPresentation` 类持有；原 factory 只构造该类。纯 trackPresentation/geometry/pathBuffer 算法迁入共享目录，旧路径显式重导出，未保留第二套算法或状态机。

Vue `useWaveformAnimations` 缩减为输入 computed/watch、post-flush 网格适配、reduced-motion/visibility 监听和生命周期桥接。共享主类接收结构化只读输入、invalidate、实例 clip 前缀及可选 Animator；不安装全局监听、不导入 Vue。原配置、几何、轨道/系列更新和标注动画回调协议继续沿用。边界检查显式覆盖共享主类及传递依赖，当前 149 模块。

新增 `nativeWaveformPresentation.test.ts` 使用普通输入读取器和可控 Animator 验证 pending 采样不启动 RAF、成功后入场、数据引用替换时几何插值及全量源不变、stabilize 终态、实例 clip 隔离、幂等销毁和销毁后微任务/帧不继续更新。首次组件回归发现抽离时误改字段过滤字符串，将 annotations 纳入布局失效签名；已恢复正确过滤，相关 51 项重新通过，最终完整测试亦通过。

最新完整验证为 175 文件、1440 项通过，statements 92.49%、branches 87.62%、functions 93.81%、lines 94.62%（`evidence/shared-animation-coverage-current.txt`）。最终 typecheck、lint:all、file-length、native-boundary（149 模块）和 build（声明/库/demo，`evidence/shared-animation-build-current.txt`）通过。本轮首次同时执行 coverage/typecheck 时两个 prepare:wasm 生成流程发生冲突，类型检查在准备阶段失败；等待生成流程完成后重新执行 typecheck 通过，生成输出已恢复，不将失败尝试计为通过。本轮未重新执行包消费者或真实浏览器动画验收。

6.4 仍未完成。共享类尚未连接原生 facade；原生 ownerWindow Animator/环境监听、同业务 revision 动画补绘以及 finished/export 等待仍待实现和验证。标注原生视图和第 8 阶段集成尚未实现，不能因共享动画类抽离而提前验收它们。当前仍 24/57。

## Native Animation Wiring

原生 facade 已接入 `NativeChartAnimation`，按宿主 ownerWindow 创建独立 Animator 的 RAF/clock/timer，按 ownerDocument 处理 visibility，按 ownerWindow 处理 reduced-motion；类负责监听注销和 Animator/共享展示状态销毁。动画数据管道仍复用 `WaveformPresentation`，分页动作先记录入场请求，再委托既有 page controller。命令复用原有稳定化规则，回调中销毁后停止执行命令和绘制后续系列。

原生 view 使用目标布局的动画展示投影；全量域、查询和采样继续使用目标布局。只在 options/目标 snapshot/采样状态或签名变化时 reconcile，逐帧展示只 refresh('view')，避免每次 reconcile 产生新补绘导致永久不能稳定。动画刷新保持同一业务 revision，finished 和已有 exporter 稳定检查同时等待采样、字体、动画及最终绘制。

新增 `nativeAnimation.test.ts` 的 6 项实例集成覆盖入场裁剪逐帧推进/最终移除、同 revision rendered/finished、数据更新期间导出等待、分类禁用、多实例隔离、分页 500ms/旧两参数事件、document-hidden 暂停时间与回调内销毁。与旧实例/采样/分页/export 定向合计 5 文件、41 项通过（`evidence/native-animation-current.txt`）。基础实例和导出静态测试显式关闭动画，专门动画用例保留真实启用状态和可控时钟，没有通过缩减默认行为使旧静态断言通过。

新增生产构建浏览器 fixture/script `native-animation-instance.*` / `test-native-animation-instance-browser.mjs`，验证 Chromium/Firefox/WebKit 在 1200/360px 下入场帧推进、数据更新、不同点数交叉淡入淡出、三个业务 revision 各一次 finished、SVG 最终态无入场 clip、旧几何清理及销毁；每个浏览器另验证 reduced-motion 的 360px 静态行为。最终 9 组通过、无 pageerror（`evidence/native-animation-instance-browser.json`），仅记录行为检查，未保存动画截图，也未替代第 11 阶段完整功能/键盘/视觉验收。

本轮完整测试 176 文件、1446 项通过，statements 92.35%、branches 87.44%、functions 93.77%、lines 94.56%（`evidence/native-animation-coverage-current.txt`）。最终 lint:all、file-length、native-boundary（150 模块）、build（含 typecheck/声明/库/demo，`evidence/native-animation-build-current.txt`）通过。浏览器 fixture 初次类型检查发现数组长度被控制流收窄，改用 count reader；finally 中的销毁断言改在正常验证路径执行，最终类型与 lint 重新通过。初次构建失败不计为通过。本轮未重新运行 packed consumer/三种框架示例。

6.4 暂保持未勾选，当前仍 24/57：还需扩大原生快速连续替换/取消、跨窗口监听和回调重入验证，并核对所有原动画兼容项。原生标注 DOM/编辑器尚未接入，共享标注动画不代表第 8 阶段已完成。性能基线和 6.5 仍待按 acceptance 方法测量。

## Animation Cancellation and Stage Acceptance

6.4 已完成，当前 25/57。验收范围为共享主动画编排及原生轨道入场、数据更新、分页、分类禁用/取消、多实例和 finished；原生标注动画接入仍由第 8 阶段验收，6.3 的 hover/标注全量数据验证及 6.5 性能验收均保持未完成。

新增连续数据引用更新用例验证两次旧更新取消、最终几何与最新静态数据一致、仅最新版本一次完成；新增入场回调替换数据用例验证最终只保留最新系列。发现同轨道多系列更新 done/aborted 通知循环在首个回调销毁后仍通知后续系列，已加存活检查；完成和取消两种销毁回归均先复现失败再验证修复。共享类的修复同时用于旧 Vue，完整既有回归通过。

原生方向（left/right/center）、delay/stagger、animationEnabled/enter enabled/threshold（包括等于阈值的禁用）已验证。iframe 用例独立驱动宿主时钟与 RAF，证明父文档 visibility 不影响宿主动画；销毁验证精确注销 media/visibility 回调及取消宿主帧，残留媒体回调不重启调度。Worker 集成新增启用动画用例，验证 pending 保持零宽裁剪、Worker 结果后启动入场、最终绘制后才发 finished。

动画/原生实例/Worker 与旧组件定向合计 19 文件、316 项通过（`evidence/native-animation-completion-current.txt`）。本轮完整覆盖率回归为 177 文件、1460 项，statements 92.43%、branches 87.49%、functions 93.90%、lines 94.61%（`evidence/native-animation-final-coverage.txt`）；该全量运行后新增 Worker 动画用例，已单独及在上述 316 项定向回归中通过，不能将全量计数写成未经运行的 1461。最终 lint:all、file-length、native-boundary（150 模块）通过，test:package 的 prepack 完成 typecheck/库/声明/demo 构建及 packed Vue 消费者浏览器验证（`evidence/native-animation-package-current.txt`）。独立 native ESM/CJS/SSR、skipLibCheck:false 声明、无框架依赖树与资产验证通过（`evidence/native-animation-native-package-current.txt`）。

修复后重新运行原生动画三浏览器 9 组及 React/Vue/vanilla 三浏览器 9 组，均通过（`native-animation-instance-browser.json`、`native-examples-browser.json`，日志分别 `native-animation-instance-browser-current.txt`、`native-animation-examples-current.txt`）。基础示例显式关闭动画，动画行为由独立真实浏览器实例用例证明，不把基础示例成功当作动画证据。未运行新的性能测量或完整手势/标注浏览器验收，也未执行最终根入口切换。

## Native Command Acceptance

7.1 已完成，当前 26/57。原生 `ChartCommandDispatcher` 复用现有 stepZoom、remoteViewport、integerZoom、xDomainStrategy 约束，便捷方法与 dispatchAction 走同一路径，旧数字索引重载继续静默返回 void；同调用栈 setOption→命令→getControlState 使用新归一化数据和布局。工具栏尚未接入，8.5/7.6 的工具栏来源与完整控制状态事件验收不由本项替代。

新增真实 Vue/native 命令对照（14 组），覆盖 independent/separated/compact、多轴分组、fit/set-domain/zoom-in/out/reset 顺序、事件参数元组、最大缩放/最小跨度/最少点数、整数缩放、空/隐藏数据、能力禁用、目标部分成功、非法目标/域和数字重载在能力禁用时的旧行为。Vue 使用 D3 transform 计算域，比较时仅将数值统一到 14 位有效数字，消除 5.5 与 5.499999999999999 的舍入差；字段、参数顺序和数组内容仍完整比较。

对照复现并修复两个原生事件差异：zoom-reset 只保留旧 metadata/identity，不附加起止/Y 域/gesture；共享多轨道命令 yRanges 使用轨道 ID 与主 Y scale，而非完整 series ID 映射。命令先提交全部 viewport/boundary 再重算布局，result.after 由实际布局捕获，fit/reset 返回已清除的 Y zoom 范围，避免把 before 的 Y 域原样带回。模型用例分别验证 fit/reset 的 before/after 与实际状态一致。

新增 `validateChartAction`，在动画稳定化前拒绝非对象/未知动作/非法模式，使用既有 invalid-option 与 action/action.type/action.mode field；目标形状或 trackId 类型非法返回 invalid-target，不回退到所有轨道，域非法继续返回 invalid-domain。新增实例回归证明无效动作不会提前完成正在运行的动画，结果快照不修改模型，非法目标无状态/事件变化。README 和 instance-api spec 同步记录该运行时输入约定，没有新增公开导出或修改动作联合。

定向 4 文件、52 项通过（`evidence/native-command-current.txt`）。最新完整覆盖率为 179 文件、1490 项，statements 92.71%、branches 88.09%、functions 94.05%、lines 94.83%（`evidence/native-command-coverage-current.txt`）。最终 vue-tsc/typecheck（由 build 执行）、lint:all、file-length、native-boundary（151 模块）和 build（库/声明/demo，`evidence/native-command-build-current.txt`）通过。独立 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明及资产消费通过（`evidence/native-command-package-current.txt`）。三浏览器原生基础/采样/分页/图层与已有命令 smoke 通过（`native-instance-browser.json`、`native-command-browser-current.txt`），不把该 smoke 当作完整手势、标注或图片导出验收。本轮没有重新执行 packed Vue consumer 或三种框架示例，它们上轮已通过。

## Native Gesture Acceptance

7.2 已完成，当前 27/57。新增 `InteractionManager`、`WheelZoomController`、`ViewportDragController` 和 `GestureViewport`，以实例宿主 window 管理监听、帧、计时器与指针捕获，复用既有 stepZoom、remoteViewport、integerZoom 与 viewportInteractionState 算法。交互覆盖层按稳定轨道 ID 更新，使用目标业务布局和全量 series，动画展示几何不参与业务缩放。滚轮同帧连续输入合并提交，200ms 静默后每个活动目标一次 zoom-end；框选仅改变 X，平移保留固定 Y 约束、边界与 pan-end 协议，Space 仅在指针所在实例且非编辑控件时启用。Esc、失去捕获、blur、模式/配置变化、命令和销毁取消活动任务，回调更新/销毁后不提交过期状态。数据重绑中的远程视口恢复及滚轮连续性由 7.3 继续验收，本项不替代完整 7.6 事件协议。

新增 `tests/chart/nativeGestures.test.ts` 22 项，对照真实旧 Vue 与原生 independent/separated/compact 的滚轮 burst、X-only 框选、pan 模式与完整事件参数元组，验证整数缩放、最小跨度/点数、最大倍率、模式/能力禁用、Space 多实例/编辑控件、指针 ID 与捕获释放、Esc 取消、待提交滚轮遇到配置/命令/销毁及 zoom-intent 回调替换数据。确定性比较仅统一到 13 位有效数字以消除 D3 transform 舍入误差；没有省略协议字段。手势、命令和动画定向 3 文件、55 项通过。

生产浏览器 fixture `tests/browser/native-gestures.{html,ts}` 和 `scripts/test-native-gestures-browser.mjs` 使用平台鼠标滚轮、拖动与键盘 Space，对照 Vue/原生状态及事件；Chromium、Firefox、WebKit × 1200/360px × 三种布局共 18 组通过（`evidence/native-gestures-browser.json`、`native-gestures-browser-current.txt` 及对应截图）。Firefox 平台指针坐标会取整，因此浏览器数值容许最多 1 CSS 像素对应的十秒原始范围误差，键、参数个数及非数值协议仍完整比较；该容差不用于单元测试。初次 WebKit 平台滚轮无法送达 SVG-only 监听，诊断 document wheel listener 曾改变输入路由；已移除诊断监听，并将生产原生滚轮绑定委托到 HTML 宿主、按 SVG overlay 定位轨道。修复后无诊断监听的全部 18 组重新通过。已人工检查 WebKit 360px 独立布局和 Chromium 1200px compact 截图；未新跑 demo 路由或完整 hover/标注验收。

修复后的完整覆盖率 180 文件、1512 项通过，statements 92.69%、branches 87.98%、functions 94.10%、lines 94.91%（`evidence/native-gestures-coverage-current.txt`）。最终 lint:all、file-length、native-boundary（157 模块）通过；build（含 typecheck/库/声明/demo）通过（`evidence/native-gestures-build-current.txt`）。独立 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明及资产消费验证通过（`evidence/native-gestures-package-current.txt`），OpenSpec strict 与 git diff --check 通过。README 已记录基本手势可用及远程恢复/hover/标注/控件/适配的剩余范围。仍未切换根入口或提交/发布。

## Native Viewport Lifecycle Acceptance

7.3 已完成，当前 28/57。新增 `ViewportRestorer`，在 data 引用替换前捕获业务布局、待提交滚轮域及 Y 状态，替换后复用 `restoreViewportDomain` 恢复并约束窗口。独立布局按可见系列的稳定身份匹配，避免重排后按旧索引恢复到另一系列。未缩放的本地窗口跟随新数据；已缩放、远程边界及 fit 窗口保留绝对范围，并按当前边界约束。initial domain/strategy/显隐改变时清除 fit 边界，模式与整数缩放变化不恢复旧状态；分页、尺寸、能力变化及销毁取消拖动并释放捕获。

有效远程边界下保留空系列身份，因此 0/1/3 点和空响应仍有可操作覆盖层。修复独立轨道 ID 为 `shared` 时自身原始域被聚合域覆盖的问题；空网格占位不参加恢复。滚轮 burst 在回调替换或重排数据时按稳定身份重绑，结束事件读取当前索引/域，移除的身份不继续通知。多轨道一帧先提交全部目标再逐项通知，修复首个 zoom-change 回调更新数据后第二轨道写回旧窗口的可复现问题；zoom-end 回调重排后的后续事件也重新读取当前布局。覆盖层仅在顺序实际变化时移动 DOM，避免无条件重插导致浏览器指针捕获中断。

新增 `nativeViewportLifecycle.test.ts` 31 项及 `nativeInteractionWindow.test.ts` 2 项，覆盖三个布局的远程未加载窗口、快速引用替换、fit 后手势、稳定 ID 重排、回调重入、取消/释放、ownerWindow 键盘/帧/计时器归属和销毁后残留回调；整数缩放下 ms/s 切换维持秒坐标。与手势/命令/动画及旧 Vue 远程/生命周期回归共 9 文件、111 项通过（`evidence/native-viewport-targeted-current.txt`）。完整回归 182 文件、1545 项通过，statements 92.83%、branches 88.16%、functions 94.26%、lines 95.04%（`evidence/native-viewport-coverage-current.txt`）。

生产浏览器 fixture 扩展远程 intent 回调加载及重排、0/1/3/0 点响应和空窗口 Space 平移。Chromium/Firefox/WebKit × 1200/360px × 三布局 × 基础/远程场景共 36 组通过（`evidence/native-gestures-browser.json`、`native-viewport-browser-current.txt`）。浏览器数值容差为原始域跨度对应的 1 CSS 像素，非数值协议及参数结构仍完整比较；单元测试保留 13 位有效数字对照。没有添加全局诊断 wheel 监听，未新验收 demo 路由、hover 或标注。

最终 lint:all、file-length、native-boundary（159 模块）及 build（含 typecheck/库/声明/demo）通过（`evidence/native-viewport-lint-current.txt`、`native-viewport-build-current.txt`）。隔离 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明及资产消费通过（`evidence/native-viewport-package-current.txt`）。本项不代替 7.6 的完整事件协议、6.3 的 hover/标注全量数据验收或第 11 阶段综合性能与生命周期测量；根入口尚未切换。

## Native Hover Acceptance

7.4 已完成，当前 29/57。新增 `HoverController` 持有悬停状态、ownerWindow 帧及指针监听，`HoverView` 持有按轨道裁剪的交叉线，`TooltipView` 持有文本节点、尺寸测量及 ownerWindow ResizeObserver。连续 pointermove 合并到一次帧更新，悬停直接更新所属视图，不创建业务 revision 或新的 rendered/finished 周期。与旧 Vue 一致，查询前稳定正在进行的轨道动画；该稳定化沿用已有 revision 的完成通知。拖动期间阻止悬停，数据/模式/分页/尺寸变化、离开、pointercancel 和销毁清理状态与待提交帧，回调替换数据或销毁后不恢复旧提示层。

原生与旧 Vue 共用 `hoverQuery` 的完整点源端点/最近点与轨道最长范围约束，以及 `tooltipPlacement` 的容器宽度上限、左右翻转、边缘及高度约束。原 tooltip 样式迁至共享 CSS，并加入 native 独立样式入口。独立模式查询当前轨道；共享模式查询当前页所有可见系列，空响应保留“无数据”行，各系列显示自身采样时间。showTooltip 关闭只隐藏交叉线/tooltip，point-hover 仍返回秒坐标快照；presentationMode 禁用悬停。标签使用 textContent，事件点快照与归一化源隔离。远程窗口移出已加载数据时交叉线位置仍指向实际数据端点，通过 clipPath 裁剪，不合成绘图区边缘位置。

新增 `nativeHover.test.ts` 19 项，覆盖三布局 Vue 对照、端点与完整事件点、共享/独立行、隐藏系列、ms 展示与秒事件值、同帧合并、动画稳定化、未进入平均采样 SVG 顶点的 10001 点 typed 最近点、输入快照保护、空响应、多实例裁剪 ID、取消/触摸指针、回调重入、位置/测量变化和无 Observer 降级。iframe 回归新增 ownerWindow 悬停帧与 tooltip Observer、精确 root 监听注销、销毁后残留帧/Observer 回调无效。与既有手势、视口、动画及 Vue hover/tooltip 回归共 9 文件、134 项通过（`evidence/native-hover-targeted-current.txt`）。修复后的完整回归 183 文件、1565 项通过，statements 92.94%、branches 88.28%、functions 94.37%、lines 95.15%（`evidence/native-hover-coverage-current.txt`）。

生产浏览器新增 `scripts/test-native-hover-browser.mjs`，复用双实例 fixture，使用平台 mousemove 对照端点、点事件、标签和值、独立/共享交叉线、隐藏、showTooltip、离开、长标签测量/翻转/容器内定位及远程裁剪。Chromium/Firefox/WebKit × 1200/360px × 三布局共 18 组通过（`evidence/native-hover-browser.json`、`native-hover-browser-current.txt` 及对应截图）。首次远程检查在鼠标已移入 Vue 图表后读取原生交叉线，因正常离开清理导致超时；已将裁剪检查移至原生仍悬停的阶段，三浏览器最终全部重新通过。人工检查 WebKit 360px independent 与 Chromium 1200px compact 截图；真实触摸设备/触摸浏览器输入尚未验收，触摸 pointermove/cancel 和拖动抑制目前由确定性单元测试覆盖，留待第 11 阶段综合输入验收。原生手势接入 hover 后的三浏览器 36 组也重新通过（`native-gestures-browser.json`、`native-hover-gestures-current.txt`）；本轮未新增 demo 路由验收。

最终 vue-tsc、lint:all、file-length、native-boundary（165 模块）、格式检查、build（含 typecheck/库/声明/demo）及隔离 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明和资产消费通过（`evidence/native-hover-lint-current.txt`、`native-hover-build-current.txt`、`native-hover-package-current.txt`）。README 已记录原生悬停及显示开关、时间与版本语义。6.3 的标注吸附/完整业务验收、7.6 的完整事件协议、第 8 阶段标注/编辑控件与第 11 阶段性能仍保持未完成；没有切换根入口、提交或发布。

## Native Controlled State and Event Protocol Acceptance

7.5/7.6 已完成，当前 31/57。`nativeControlledState.test.ts` 新增 12 项，按 independent/separated/compact 对照真实 Vue：受控图例请求保留未知 ID，未回传时曲线、轴、tooltip、aria-pressed 和控制快照保持不变，重复请求不提前生效，回传后才应用。默认隐藏项只初始化；受控操作不写入内部集合，显式 undefined 恢复原内部状态。非受控显隐按稳定 ID 跨重排保留，移除后清除内部旧 ID；全隐藏仍保留可恢复图例，恢复后重算域、轴、覆盖层和命令能力。模式请求、实际模式、解除受控和能力规则分别验证，包含同步回传、payload 修改、旧按钮及回调内销毁。本项不代替第 8 阶段标注、编辑器及工具栏受控 UI 接入。

补齐此前未连接的 `control-state-change`：新增 `ControlStateObserver`，基于完整 getControlState JSON 签名去重，用 ownerWindow 微任务合并同步更新；初始化只记录基线，不发送通知。有效配置、尺寸、视口、模式、显隐或分页改变后检查快照，字体/采样布局回写也可检查；未回传的受控请求、配置改变但有效控制快照相同、更新后同栈回到原快照均不通知。通知前提交签名，使回调更新在后续微任务独立通知；销毁使不可取消的残留微任务失效。读快照异常按现有图表错误报告机制隔离，不污染签名。事件快照不共享模型可变数组，README 同步说明获取初始化快照及通知语义。

`nativeControlStateEvents.test.ts` 新增 11 项，覆盖三布局的 Vue/native 命令、数据替换和能力通知对照、生命周期事件之后通知、无变化/合并、受控回传、当前页/显隐、payload 修改、回调更新/销毁、待通知销毁及失败快照读后恢复。`nativeCommandProtocol.test.ts` 新增 7 项，验证每次 API/toolbar 来源命令单一递增 commandId、多目标 intent/change/end 顺序、fit 无 intent、reset 的 unchanged 通知与精确字段、禁用/空/无效操作无业务事件、旧数字重载静默、回调内替换/重排并执行命令后不写回旧窗口、嵌套命令保留各自身份及 intent 回调销毁停止后续通知。来源为 toolbar 的协议通过直接调用共用 dispatcher 验证，原生 ToolbarView 的实际来源路由仍由 8.5 验收；没有把旧 Vue 工具栏成功当作原生工具栏实现。

上述新增测试与既有原生命令对照、手势、视口/hover 及 Vue 图例/工具栏生命周期回归共 11 文件、155 项通过（`evidence/native-controlled-targeted-current.txt`）。完整回归 186 文件、1595 项通过，statements 92.99%、branches 88.33%、functions 94.43%、lines 95.15%（`evidence/native-controlled-coverage-current.txt`）。静态检查初次失败为命令测试未使用的 vi 导入及浏览器脚本未使用的 document 全局声明，已移除并重新验证；失败尝试不计为通过。

新增 `scripts/test-native-controlled-browser.mjs`，复用生产双实例 fixture 记录完整控制/请求/实际模式/显隐/重置事件，以平台点击图例、宿主回传、重排和 API 命令对照 Vue/native 快照及事件。Chromium/Firefox/WebKit × 1200/360px × 三布局共 18 组通过（`evidence/native-controlled-browser.json`、`native-controlled-browser-current.txt` 及截图）。浏览器仅将数值统一到 12 位有效数字消除 D3 舍入差，其余字段、参数数组和通知次数完整比较；确定性控制快照测试使用 13 位，既有命令对照使用 14 位。人工检查 WebKit 360px independent 与 Chromium 1200px compact 截图，两者图例显隐及曲线与 Vue 一致。接入状态观察后的平台滚轮/框选/Space/远程恢复三浏览器 36 组重新通过（`native-gestures-browser.json`、`native-controlled-gestures-current.txt`）。本轮未新增 demo 路由、真实触摸、原生标注或工具栏 UI 验收。

最终 vue-tsc、lint:all、file-length、native-boundary（166 模块）、格式检查和 build（含 typecheck/库/声明/demo）通过（`evidence/native-controlled-lint-current.txt`、`native-controlled-build-current.txt`）。隔离 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明及资产消费验证通过（`evidence/native-controlled-package-current.txt`）。OpenSpec strict 与 git diff --check 通过。原生 facade 当前 374 行，状态观察独立为 42 行，未将监听状态堆入 facade。后续保持第 8/9 阶段标注/原生控件/完整导出及第 10/11 阶段适配、切换和综合验收门槛；没有切换根入口、提交或发布。

## Native Annotation Model and View Acceptance

完成 tasks 8.1。`src/annotation/` 为独立业务目录：AnnotationModel 通过读取当前 options.annotations 生成受控 CRUD/拖拽请求，不保存第二份已提交标注；AnnotationController 组合草稿、全量候选选择、菜单和生命周期；AnnotationView 按标注 ID 保留 SVG 节点；AnnotationDragController 独占宿主窗口监听、指针捕获、帧合并、临时预览和回传确认。原 annotationLayout/markup/types/serialization 的实现移动到此目录，旧 Vue 路径仅保留显式兼容重导出，原生入口和原生动画直接引用规范路径；序列化函数身份、格式、秒坐标与样式保持。

新增模型 9、控制器 13、原生视图/拖拽 17 项确定性用例；另补宿主 iframe 标注拖拽资源回归，现有 nativeInteractionWindow 共 4 项。创建/编辑先发 update:annotations 替换数组，再按原参数元组发 annotation-create/annotation-update(new, previous)；删除先发替换数组，再发 annotation-delete。拖拽只发 update:annotations，不发 annotation-update。对象和 style、草稿/previous、候选点与所有 replacement 项都隔离消费者输入；宿主不回传不提交业务状态，回传前保留临时视觉预览，同步回传清除预览避免双重位移。连续未确认拖拽以已有预览累加位移，取消恢复拖拽前预览；数据/模式/尺寸/显隐/销毁等取消活动捕获，旧帧和晚到 pointerup 不再提交。标注 SVG marker 使用实例与局部序号，避免用户 ID 清洗碰撞和多实例引用冲突。

全量点源与每个系列自己的 Y 轴服务吸附和投影；三种 displayMode 的标注几何/样式与 Vue 对照通过。第二个独立网格列使用 overlay 本地 X 查询，编辑器锚点才添加轨道全局偏移；10001 个 typed 样本的候选选择仍吸附全量原点，未改原数据。受控菜单删除、稳定 ID 重排、隐藏系列、视口重投影、文本安全、冻结输入、回调内确认/销毁、阈值返回、其他 pointer 与 iframe 帧/监听清理均有用例。

本项 CRUD 创建/编辑通过控制器草稿与确认接口验收，尚未交付原生编辑器界面；菜单编辑/overlay 创建仅建立草稿，DOM 编辑器接线及文本/时间/系列切换交互由 8.2 完成。颜色/透明度交互和标注出现/消失动画仍属 8.3，焦点/Esc 层级与弹窗属 8.4；没有提前勾选这些任务或采样全业务验收 6.3。

浏览器脚本 `scripts/test-native-annotations-browser.mjs` 使用原 native-gestures 对照页，Chromium/Firefox/WebKit × 1200/360px × independent/separated/compact 共 18 组通过，验证第二列标签平台指针拖拽、未回传预览、宿主确认、缩放重投影、隐藏恢复、右键删除请求/确认及卸载。参数元组和通知次数完整比较，SVG 数字统一到 12 位有效数字消除 D3 舍入差；最终截图保存为 `native-annotations-*.png`。人工检查 WebKit 360px independent 与 Chromium 1200px compact，两套图表布局与标注一致。原平台缩放/平移/远程窗口浏览器回归 36 组重跑通过。真实触摸、编辑器、标注动画和综合性能仍待后续阶段，不将本轮浏览器范围扩展声明为完整验收。

针对性回归 10 文件/138 测试通过（`native-annotations-targeted-current.txt`）；最终全量覆盖率 189 文件/1635 测试通过（`native-annotations-coverage-current.txt`），statements 93%、branches 88.22%、functions 94.38%、lines 95.22%。首次全量发现原宿主窗口监听检查仍只期望手势 6 个监听，现已纳入标注监听并逐一核对 remove 的回调身份。另一次同时执行浏览器/构建时两项既有复合 viewport 生命周期测试触及 5s 限制，最终使用 `pnpm exec vitest run --coverage --maxWorkers=2` 全量重跑通过，未增加超时或移除断言；同时消除没有标注草稿/菜单时多余的同步布局求值。

最终 Node 22.23.2 / pnpm 10.32.1 的 vue-tsc、lint:all、file-length（facade 400 行）、native-boundary（173 模块）、格式检查、build 和隔离 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明及资产消费验证通过；对应证据为 `native-annotations-lint-current.txt`、`native-annotations-build-current.txt`、`native-annotations-package-current.txt`、`native-annotations-browser.json`、`native-annotations-browser-current.txt`、`native-annotations-gestures-current.txt`。OpenSpec strict 与 git diff --check 通过，prepare:wasm 的两项已跟踪生成副作用已还原；未切换根入口、提交或发布。

## Native Annotation Editor and Full Data Acceptance

完成 tasks 8.2 与 6.3，当前 34/57。新增 AnnotationDraftController、AnnotationEditor、NumberInputView、ModalController：草稿控制器每次时间/系列变更查询最新全量点源；DOM 编辑器保留本地文本、时间和样式，通过原生 dialog 提供保存、取消、关闭、Ctrl/⌘+Enter。文本沿用 40 个 UTF-16 code unit 限制并在保存时 trim，时间支持秒/毫秒显示、0.001 步进、失焦与保存校验、范围拒绝和最近真实样本吸附。显示单位变更保留未提交时间对应的秒坐标，数据替换后保存重新查询最新来源。样式字段原样保存，尚未提供颜色 UI。

创建候选限定到点击轨道，同时提供轨道全部系列；编辑候选同样来自标注所属轨道，沿用 findClosestTrackAtPointer 的边界归属。独立第二列查询使用 overlay 本地 X，修正旧路径重复扣除 track.left 的问题；此修正作为原生专项验证，不声称与旧错误行为一致。系列切换保留草稿 X 并更新最近 Y，保存再次在所选系列校验和吸附。

新增 nativeAnnotationEditor 30 项用例，覆盖本地编辑不新增业务 revision、受控未确认/同步确认、完整 new/previous 元组、样式和偏移保留、非法/部分输入、数据替换、显隐与候选刷新、跨窗口、失败打开回滚、初始聚焦回调销毁和残留节点静默。ModalController 的 document 私有栈同时服务 Vue/native，复用滚动锁、焦点恢复和基本 Tab/Esc；8.4 仍需颜色浮层接入后的 Esc 层级、多实例和完整浏览器验收。

6.3 的证据包括 RenderSamplingController 平均采样遗漏极值但全量查询/域不变、WaveformDataManager 全量误差指标、原生 hover 回归，以及编辑器新增组合用例：10001 typed 样本中索引 5432 的 Y=100、lowerError=600、upperError=1000 不出现在平均采样几何中，Y 域仍包含 [-500,1100]，hover/tooltip 返回真实点及误差，5432.1ms 编辑吸附到真实样本，源点和误差数组不变。

scripts/test-native-editor-browser.mjs 对照 Chromium/Firefox/WebKit × 1200/360px × 三种模式共 18 组，覆盖真实右键编辑、时间错误与恢复、步进、系列选择、trim、替换数组/更新元组、宿主确认、取消及 overlay 创建；另 6 组原生专项验证独立第二列本地 X。小图表使用 390px 页面视口。创建 ID/时间戳规范化，数值统一 12 位有效数字，其余字段与事件元组完整比较。最终报告 native-editor-browser.json 全部通过；首次 SVG innerText 调用错误已改 textContent 并完整重跑。截图为 native-editor-*.png，已检查 WebKit 360px compact native/Vue；原生缺少颜色区而使弹窗更矮，尚不声明完整视觉对齐。

定向 14 文件/179 项通过（native-editor-targeted-current.txt）；完整覆盖率 190 文件/1665 项通过，statements 93%、branches 88.02%、functions 94.46%、lines 95.33%（native-editor-coverage-current.txt）。build（含 typecheck、库、声明和 demo）通过（native-editor-build-current.txt）；隔离 native ESM/CJS/SSR、无框架依赖树、skipLibCheck:false 声明与资产验证通过（native-editor-package-current.txt）。未执行根入口切换、提交或发布。

## Native Colors and Annotation Animation Acceptance

完成 tasks 8.3，当前 35/57。实现原生 ColorInputView 与 AnnotationStyleEditor，以原生色板、精确 CSS 文本和独立 0–1 alpha 输入编辑边框/文字/背景。未编辑值保留原语法；文本输入接受 hex（含 alpha）、逗号 RGB/RGBA（含小数/百分比）、HSL/HSLA 与命名色。非法或部分颜色/alpha 输入保留编辑内容、报告 aria-invalid/关联错误并阻止保存；颜色修改不产生业务 revision，取消不发请求，受控保存仍沿用替换数组和 new/previous 元组。alpha 使用输入精度，修改 alpha 不经过原生色板的整数 RGB 量化；完全透明 hex/RGBA 保留明确色相。控件显式清理 DOM 回调，无第三方框架色选依赖。

NativeChartAnimation 将共享 WaveformPresentation.presentationAnnotations 投影交给 AnnotationController/View：标注等待系列入场后出现、按既有 fade-in/scale/bounce/slide-in 预设渲染 opacity/scale/offsetY，删除后保留离场快照直到最后一帧，离场节点禁止编辑/拖拽。恢复中的标注复用原 SVG，显隐/clean/隐藏系列即时清理，disabled/reduced-motion 静态降级；finished 等待最后一帧绘制/离场删除，同一业务 revision 不因动画帧增长。

集成回归先复现并修复两个共享编排问题：原生仅更新 annotations 也会重建 tracks 数组，不能仅凭引用差异判为布局变化而提前结束离场；第一项同步标注完成回调销毁后，AnnotationPresentation 必须停止后续启动/取消操作并释放自身状态，避免 animation-disposed。修复同时用于 Vue 编排，既有组件动画回归包含在定向检查中。

nativeAnnotationAnimation 12 项验证四预设、等待系列、删除/恢复、隐藏/禁用、多实例销毁、同步回调销毁与 finished；ColorInputView 10 项验证精确/原语法值、零 alpha 色相、小数 RGB、输入恢复及残留回调；编辑器新增 2 项覆盖完整受控样式元组和取消。定向 7 文件/120 项通过（native-colors-targeted-current.txt）。

浏览器脚本 test-native-colors-browser.mjs 的 Chromium/Firefox/WebKit 各 6 组颜色检查、6 组动画检查与 1 组 reduced-motion，合计 18 组颜色、18 组动画及 3 组静态偏好通过，无 pageerror（native-colors-browser.json）。真实键盘检查 alpha ArrowUp、Tab 到关联透明度字段及 Ctrl+Enter 保存；验证未回传保留旧样式、回传与 Vue 绘制字段一致、卸载清理。原生色板自身的平台弹层尚不属于本轮自动验收，当前仅验证 DOM input 接线，完整 popup/Esc/焦点验收仍留 8.4。

截图 native-colors-*.png 保存三浏览器两尺寸三模式；已检查 WebKit 360px compact 与 Chromium 1200px independent。允许差异：旧第三方 Chrome 色选浮层改为浏览器原生色板和内联精确值/alpha 字段，颜色区较高，输入显示字体与控件外观随平台变化；小图表使用 390px 真实页面视口，弹窗未横向溢出。此次不宣称色选内部像素对齐，不替代 8.4 或第 11 阶段全部键盘/触屏/性能验收。

最终完整覆盖率 192 文件/1689 项通过，statements 93.01%、branches 87.95%、functions 94.52%、lines 95.4%（native-colors-final-coverage.txt）。早期全量在补入同步销毁回归后发现缺陷并中断，native-colors-coverage-current.txt 不作通过依据；最终记录对应修复后代码。最终 Node 22.23.2/pnpm 10.32.1 的 vue-tsc、lint:all、file-length（facade 402 行）、native-boundary（181 模块）、格式检查与 build（类型/库/声明/demo）通过；隔离 native ESM/CJS/SSR、skipLibCheck:false 声明、无框架依赖树和资产验证通过（native-colors-lint-current.txt、native-colors-build-current.txt、native-colors-package-current.txt）。OpenSpec strict 与 git diff --check 通过。prepare:wasm 的两项已跟踪生成副作用还原；8.4/8.5 及后续阶段未完成，未切换根入口、提交或发布。

## Native Export Acceptance

完成 9.1–9.4，当前 40/57。ChartExporter 捕获经过校验的格式、scale、background 和内容区尺寸；有效 revision 或尺寸变化拒绝 stale。字体加载后重新等待 scheduler 稳定，以覆盖保持 revision 的测量、采样与动画补帧；各异步阶段参与取消 race。清理终止轮询，取消后字体晚到不再序列化，5 秒超时后可重试。原生有限动画继续等待最终绘制，保持此前验证的 finished 协议。

SvgExporter 复用既有快照算法，拆分 SvgTitleExporter、SvgLegendExporter 与 svgSnapshotStyles；旧 Vue 路径变为委托。完整 SVG 包含内容区尺寸、背景、标题带和当前绘图，中文标题保留换行/旋转/缩放，隐藏标题不输出；图例 HTML 转为 SVG 标签/色样并保留隐藏状态。绘制属性内联，片段引用脱离宿主 URL，操作层和键盘/弹层属性移除。所有 DOM、样式、矩阵和序列化使用源节点 owner-document/window。

PngExporter 独占解码 Image、临时 URL 与编码 canvas，覆盖 scale/尺寸校验、解码/context/draw/null Blob/编码异常、并发与销毁后的调用。ChartExporter 中止时请求 PNG 取消，晚到解码/编码不再继续业务；URL 撤销、图片 src/handler 清空、canvas 尺寸归零。工具栏接线沿用 ToolbarDownloadController，实例 API 仍只返回 Blob。

定向 8 文件/84 项通过（native-export-targeted-current.txt）；完整 coverage 199 文件/1751 项通过，statements 93.3%、branches 88.18%、functions 94.69%、lines 95.69%，耗时 97.62 秒（native-export-coverage-current.txt）。初次快照测试使用不存在的 grid.currentPage、严格匹配浏览器规范化颜色/URL，改为分页真实按钮和语义属性断言。PNG 测试最初 unstubAllGlobals 意外移除共享 RAF mock，修正为仅恢复本测试替换的全局对象，并排空采样诊断定时器；完整重跑通过，初次失败不作通过依据。

浏览器三引擎两尺寸三模式共 18 组通过（native-export-browser.json），记录引擎版本、独立 SVG 和 2 倍 PNG 解码尺寸/非空绘制。每浏览器另验证编码失败后恢复及两格式真实下载，均成功、URL 计数归零，无 pageerror。导出按实际内容区排除边框，1200/360px 外宽对应 1198/358px 内容区和 2396/716px 的 2 倍 PNG；内容区高 418px 对应 836px PNG。初次脚本误按外宽断言，改为同时核对实际内容区和图像尺寸后完整重跑通过。已检查 WebKit 360px compact 独立 SVG 截图与 Chromium 1200px independent 输出 PNG，中文旋转标题、曲线/误差/标注及隐藏图例显示正常。

Node 22.23.2/pnpm 10.32.1 的 vue-tsc、lint:all、450 行检查（facade 429 行）、native-boundary（189 模块）、scoped 格式、build（类型/库/声明/demo）及 OpenSpec strict 通过。隔离 native ESM/CJS/SSR、skipLibCheck:false 声明、无 Vue/React 依赖树和 CSS/WASM/Worker 资产验证通过（native-export-package-current.txt）。prepare:wasm 的两项已跟踪生成副作用已还原。8.4 仍缺系统原生色板实机证据，第 10/11 阶段及性能基线未完成，不切换根入口、不提交/发布/归档。

## Next Steps

1. 完成 8.4 的系统原生色板弹层实机验收，其余 dialog/菜单行为证据见 Native Floating and Toolbar Acceptance。
2. Vue 薄适配与 /vue 已实现，继续修复第 10.2 的全部旧 chart cases；补齐基线与动画性能测量。
3. 完善三种消费者、完整兼容矩阵和最终包产物，验证 Vue peer 下限。
4. 达到 acceptance.md 的预切换门槛后才调整根入口；任务未完成保持未勾选。

## Vue Adapter Progress

已完成 10.1，当前 41/57。新增 `src/adapters/vue/WaveformChart.vue`、VueChartAdapter、配置快照模块与 `src/vue.ts`，发布映射增加 `/vue` 的 ESM/CJS/声明。原组件路径重导出同一适配组件，根入口仍保持 Vue API。适配层仅拥有 props 差异、事件订阅和生命周期，绘制、数据、交互、控件、动画与导出继续由原生类拥有。

保留原 defaults 与八项 handle 及数字/object 重载；移除可选字段传递 undefined。配置快照读取嵌套 Vue 响应式字段、保留 formatter/回调，data 保留引用且不深度遍历。配置比较避免无变化更新重新归一化。父组件未确认的受控请求不提前生效，事件完整参数元组/对象身份与最新 Vue 监听器均验证；卸载取消订阅、销毁实例、注销 DOM，未完成导出取消。Vue props 对非有限尺寸及非法远程边界保留旧回退，原生 setOption 仍执行显式校验。

`tests/adapters/vue` 验证以上生命周期、差异更新、引用和受控行为，包含全部 21 个事件转发。`vue-adapter-native-regression-current.txt` 记录 25 文件/333 项通过，使用 `tests/support/LegacyWaveformChart.vue` 保存独立旧边界作为对照，避免比较原生实现与其自身包装；这个测试基线不是永久运行时，也仍待 11.4 清理。`vue-adapter-final-targeted-current.txt` 记录 8 文件/93 项原生动画、采样、hover、标注与适配及相关组件测试通过。

`vue-adapter-browser.json` 记录 Chromium/Firefox/WebKit × 1200/360px × 三模式，共 18 组原生 DOM ref 与 Vue 薄适配验证通过：几何/控制状态、受控确认、监听器更新、字段移除、SVG 导出及卸载。它验证两种入口接线，不充当旧版视觉兼容证据；已检查 Chromium 360px compact 和 WebKit 1200px independent 截图。`vue-adapter-package-current.txt` 验证隔离安装 Vue 3.5.40 后 ESM/CJS 根与 /vue 同一组件、无 DOM 的 SSR 渲染和 skipLibCheck:false 声明/handle 重载。`vue-adapter-native-package-current.txt` 验证隔离原生入口无 Vue/React 依赖、ESM/CJS/SSR、严格声明及资产。

兼容回归持续推进：旧 chart cases 完整重跑达到 72 文件、575 项通过/1 项失败，无未处理异步错误（`vue-adapter-chart-cases-current.txt`）；最后一项检查了空的图例/标注外层，改为检查实际图例/标注的可见性后，同文件 8 项全部通过（`vue-adapter-clean-current.txt`）。这些结果之后仍需完整覆盖率重跑。标题测量改用 scrollWidth/scrollHeight 并与绘图区对齐，尺寸未变的 Observer 通知可刷新标题测量；隐藏 X 轴不执行 formatter，恢复轴线隐藏 class 和多轴标题标记，solid dash 移除属性，图例保留误差条元数据。布局专项 9 文件/87 项通过（`vue-adapter-layout-current.txt`），原生实例/视图/适配/导出回归 33 文件/353 项通过（`vue-adapter-native-regression-current.txt`）。

全量检查同时覆盖 demo 和控件：更新帧等待、DOM 容器尺寸与隐藏节点断言，移除对旧 Vue 私有视图树的查询，改观察真实实例。新增原生动画 formatter 回归，修复入场期间仅替换 formatter 导致端点沿用旧展示快照的问题；datetime demo formatter 捕获当前时区/毫秒配置，配置变化生成新函数引用。首次全量覆盖率 201 文件中 14 文件失败，主要包括尚未适配测试和 5 秒超时，不作为通过证据；修复后以 20 秒测试超时重跑，结果记录 `vue-adapter-coverage-final.txt`。

`vue-adapter-browser.json` 已重新运行三引擎两尺寸三模式 18 组，通过；`pagination-visual-parity.json` 对照独立旧实现验证两种 preset 的分页/X 标签/SVG 位置与尺寸误差不超过 1 CSS px。`native-export-browser.json` 三引擎两尺寸三模式导出 18 组、失败恢复和下载重新通过；已检查 WebKit 360px compact 独立 SVG 的中文标题、标注与图例。

公开 Vue 组件现在使用兼容 Vue 3.2 的显式 DefineComponent 类型，避免生成 SFC 声明泄漏构建时 Vue 3.5 泛型；保留 props、handle 与事件参数类型。typesVersions 支持旧 TypeScript 的 native/vue 子入口。隔离包验证 Vue 3.5.40 + TypeScript 6.0.3，以及 Vue 3.2.33 + TypeScript 4.7.4，均执行 skipLibCheck:false、ESM/CJS 入口身份、无 DOM SSR、handle、必需 data 与 page-change 参数数量检查。Vue 3.2.33 + TypeScript 6 的失败定位到 Vue 自身 HostElement 约束，不能宣称该组合通过；旧版本消费证据为 `vue-adapter-minimum-historical-package-current.txt`。

本轮 typecheck、build（库/声明/demo）、lint:all、450 行及 native-boundary（189 模块）已通过；后续修改需继续验证。README 已说明薄适配与迁移状态。10.2、最低 Vue 版本消费、最终根入口与完整覆盖率/性能验收未完成，不声明整体兼容、不切换根入口、不提交或发布。

## Native Floating and Toolbar Acceptance

8.4 已补充 ModalController 与 AnnotationContextMenu 的资源/键盘管理。ModalStack 关闭上层恢复下层原先编辑的字段；字段已删除时回到下层初始焦点，逆序移除传播有效触发节点。滚动锁保存 overflow/shorthand/longhand/padding 的原值、顺序和 priority，锁定使用 important 避免宿主样式覆盖，最后释放恢复原 longhand 与 important，同时保留无关宿主样式变更；滚动条补偿仅在首个弹窗计算。初始焦点必须在自身 dialog 内并可用，防止外部节点聚焦循环。Vue 色选浮层销毁聚焦 input 后原焦点落 body 的问题已复现并修复，dismissPopup 成功后重新聚焦编辑器，下一次 Esc 才取消顶层。

AnnotationContextMenu 现在拥有 menuitem 回调、owner-document 外部 pointer/click 监听、初始焦点与方向键/Home/End/Tab/Esc 导航；关闭恢复仍存活的触发节点，销毁后不可重新打开，残留按钮/按键不再调用旧业务。执行动作前关闭菜单，避免编辑器把已移除菜单按钮当作恢复目标，回调重新打开的菜单也不会被旧操作误关。AnnotationView 给可交互标签 tabindex/role/aria-label/aria-haspopup，Enter/Space/ContextMenu/Shift+F10 打开菜单，离场/不可交互标签退出 Tab 顺序；文本通过 textContent 提供安全标签。

tests/controls/ModalController.test.ts 的 9 项回归覆盖下层精确字段、断开字段/触发节点、padding 补偿、宿主 important/longhand、popup-first Esc/native cancel、外部聚焦回收、监听回调身份和跨 document；AnnotationContextMenu 6 项验证导航、资源和残留回调/重入。旧 Vue/native editor/controller/drag/owner-window 用例继续参与本轮回归。

scripts/test-native-floating-browser.mjs 记录 Chromium/Firefox/WebKit × 1200/360px 共 6 组真实键盘与弹窗验证：Shift+F10/Enter 菜单、方向键、Tab 循环、禁用保存跳过、外部 focus 阻挡、native/native 与 native/Vue 弹窗栈、Vue 色选浮层第一次 Esc 仅关闭色选并恢复编辑器、第二次关闭顶层、原字段恢复、逆序销毁、滚动锁及 important 恢复、无业务请求和卸载清理。报告 native-floating-browser.json 全部通过，无 pageerror；截图 native-floating-*.png。首次 fixture 缺旧色选 CSS 导致等待 popup 失败，补齐消费样式后暴露焦点缺陷，修复后完整重跑通过，首次结果不算验收通过。

系统原生色板实机验证仍缺失：2026-10-15 电脑控制工具返回 Mac 锁定、自动解锁失败；已请求用户解锁并继续其余工作。此次三浏览器 DOM 自动化不能替代 macOS 系统色板的 Esc/关闭恢复验证，8.4 保持未勾选，不标整体完成或阻塞整个迁移。

8.5 新增 ToolbarView 与 ToolbarDownloadController，复用原工具栏 registry/capability/图标/顺序/相邻分组；移除 registry 对 Vue composable 类型的依赖，以结构接口同时支持 Vue 与原生。view 维护稳定按钮/分组节点、实际受控高亮、独立轨道选择、失效选择重置、共享范围、小于 440px 折叠、hover/always/top-left/top-right；事件隔离不触发图表手势，工具栏命令统一走 facade→dispatcher 并携带 source toolbar。分页复用已有 PaginationView/ChartPaginationController 与二参数事件。原生 CSS 全部 namespaced，hidden 常驻菜单/反馈不应使 hover 工具栏永久显示。

ToolbarDownloadController 独占 busy/反馈、下载链接和 URL，失败可重试，销毁后晚到 Blob 不下载/刷新；实例 exportImage 仍仅返回 Blob，完整自包含 SVG/PNG 内容与解码另留 9.1–9.4。tests/chart/nativeToolbar.test.ts 6 项验证顺序/分组/焦点节点、受控确认/解除、source 与轨道范围、分页空占位目标、折叠/menu/事件隔离、presentation 能力与残留按钮。presentation 保留导出按钮可用，与旧 capabilities 一致。ToolbarDownloadController 3 项验证失败恢复、并发/晚到销毁与 URL/link 清理。

scripts/test-native-toolbar-browser.mjs 对照 Chromium/Firefox/WebKit × 1200/360px × independent/separated/compact 共 18 组，按钮顺序/分组/禁用/高亮/有效目标、受控 pan 未确认/确认、键盘与点击 zoom/fit/reset、全部命令/control 参数元组、分页事件/选择重置、Esc 菜单和卸载通过；数值统一 12 位有效数字，其他字段完整比较。toolbar 相对位置及 width/height 差均不超过 1 CSS px；保存 native-toolbar-*.png，已检查 WebKit 360px compact 的 native/Vue 布局一致。每浏览器另运行 390px/hasTouch context 的真实 tap 展开与模式切换，共 3 组通过；不声称物理触屏设备或阶段 11 完整手势验收。首次比较纳入隐藏 select 与 WebKit 非聚焦 root Escape 造成脚本失败，修正为有效 UI/实际聚焦按钮后完整重跑通过。

完成 tasks 8.5，当前 36/57；8.4 因系统色板实机证据缺失仍保持未勾选。定向 12 文件/122 项通过（native-floating-toolbar-targeted-current.txt），之后新增 menu.dispose 残留节点用例纳入最终全量；完整 coverage 196 文件/1713 项通过，statements 93.02%、branches 87.91%、functions 94.45%、lines 95.42%（native-floating-toolbar-coverage-current.txt）。初次单测暴露下层焦点丢失与非法初始焦点，先复现后修复；工具栏最初 fixture 缺 getClientRects、断言使用不存在的 trackId 事件字段/遗漏空占位目标，修正为真实容器和既有事件/布局契约，全部相关回归通过。中途 native-floating-coverage-current.txt 被停止以等待最终工具栏代码，不作通过依据。

最终 Node 22.23.2/pnpm 10.32.1 的 vue-tsc、lint:all、file-length（facade 426 行）、native-boundary（185 模块）、 scoped 格式与 git diff --check 通过；build 类型/库/声明/demo 通过（native-floating-toolbar-build-current.txt）。隔离 native ESM/CJS/SSR、skipLibCheck:false 声明、无 Vue/React 依赖树和资产验证通过（native-floating-toolbar-package-current.txt）。OpenSpec strict 通过，prepare:wasm 的两项已跟踪生成副作用已还原；未进行根入口切换、提交、发布或归档。

## Vue Adapter Compatibility Acceptance

完成 10.2，当前 42/57。最终完整检查 `pnpm test:coverage --maxWorkers=2 --testTimeout=20000` 通过：201 文件/1765 项，statements 90.66%、branches 84.66%、functions 90.74%、lines 93.03%，包括全部 72 个旧 chart cases、demo、旧控件、原生与 Vue 适配测试；证据为 `vue-adapter-coverage-final.txt`，耗时 354.04 秒。早先 `vue-adapter-coverage-current.txt` 的 31 项失败及 suite 收集错误已被修复，不作通过依据。20 秒测试超时为本次命令参数，仓库默认配置没有调整，不能宣称默认 5 秒覆盖率命令已经通过。

当前全部 21 个事件按原元组转发，包含 annotation-update/new-previous、page-change/page-count、原生 rendered/finished；数据引用保持、最新回调、受控确认/解除与销毁均有单测及三引擎浏览器证据。最新 Node 22/pnpm 10.32.1 的 build、vue-tsc、lint:all、450 行检查、native-boundary（189 模块）、scoped Prettier 与 OpenSpec strict 已通过，facade 440 行、展示编排 420 行。冻结锁文件安装（ignore-scripts）通过；完整 release gates、性能与内存检查仍留第 11 阶段。未切换根入口、提交、推送、发布或归档。

完整打包消费者进一步发现二次 tree-shaking 问题：库压缩将配置差异的 Set 遍历合为带 constructor purity 注释的 `new Set(...).forEach(...)`，消费者构建会删除整段有副作用的遍历，导致 props 已更新但原生 options 保留旧值。改为显式 for-of，避免 purity 注释覆盖调用；这个问题只有发布包经过消费者再次构建才显现，源码浏览器与单测不足以证明通过。`verify-package-native-controls.mjs` 同时适配原生精确色值/alpha、等待实际页码与错误内容，保留标注创建/编辑、全量吸附、尺寸与清理断言。最终结果见 `vue-adapter-package-assets-current.txt`，失败的早期运行不作通过依据。

二次 tree-shaking 修复后的 `pnpm test:package` 已完整通过（含 frozen 消费安装、严格类型、ESM/CJS、动画出口、easing tree-shaking、生产浏览器消费），`vue-adapter-package-assets-current.txt` 最后记录分页、标注 CRUD、全量时间吸附、精确 RGBA/alpha、小视口和清理成功。修复后定向 3 文件/34 项通过（`vue-adapter-final-targeted-current.txt`），lint:all、Prettier、OpenSpec strict 与 diff whitespace 检查通过；全量 201/1765 的记录产生于此次等价遍历改写前，最终第 11.3 的默认命令仍需完整重跑。prepare:wasm 的两项已跟踪生成副作用已还原，其余工作区修改保留。

## Complete DOM Ref Examples and Documentation

完成 10.3、10.4，当前 44/57。React、Vue 和 vanilla 示例均使用已构建的 `/native` 公开入口，由宿主保存标注、显隐和模式并回传 `update:*` 请求；包含缩放/重置/fit、标注创建/编辑/清空、SVG/PNG 下载、双实例、尺寸及独立卸载。共享 ExampleImageDownload 类管理下载状态与临时 URL，卸载后不再下载或更新状态。README 补充 DOM ref/SSR 初始化时机、setOption 替换规则、事件元组、取消订阅、Strict Mode 清理和模块副本边界，示例说明链接到通过公开声明类型检查的完整源码。

`native-examples-browser.json` 与 `native-examples-browser-current.txt` 记录 Chromium/Firefox/WebKit × vanilla/React/Vue 共 9 组通过，验证真实 SVG/PNG 下载、受控模式/显隐/标注、数据引用更新和最新回调、React Strict Mode 重放、双实例互不影响、卸载与重新挂载，以及字体等待期间卸载不产生晚到下载或 URL 残留。报告中 pendingExportCancelled 全部为 true；桌面和 360px 截图共 18 张，人工检查 Vue/Chromium 桌面与 React/WebKit 360px 的坐标轴、图例和波形布局。

本轮浏览器验收发现 WebKit 在 foreignObject 内对带 opacity 的隐藏图例按钮错误命中父容器。改用文字颜色 alpha 与 SVG fill/stroke-opacity 表达隐藏状态，避免创建 opacity stacking context；保持真实点击断言，未使用 force click。完整 9 组在修复并重建库后通过。导出器已有 fill/stroke-opacity 样式复制逻辑，继续保持独立 SVG。定向原生图层、SVG 导出与图例几何共 3 文件/14 项通过。

库与声明构建、examples 类型检查、lint:all、450 行检查及 scoped Prettier 通过。首次 examples 类型检查因 build:lib 清空旧声明失败，重建 build:types 后通过；首次 lint 发现浏览器回调内未限定的 requestAnimationFrame，改为 window.requestAnimationFrame 后通过。完整覆盖率、性能/内存、最终打包与入口切换仍未在本阶段验收，不提前勾选对应任务。

## Runtime Validation and License Audit

完成 2.3、3.2，当前 46/57。OptionManager 已有顶层更新、嵌套整体替换、undefined/空数组和候选提交协议；本轮补齐 typed 数据结构漏洞：拒绝 DataView、整数/BigInt TypedArray、非 Float64 X 坐标与非法误差存储，使用 ArrayBuffer.isView 与跨 realm 标签验证 Float32/Float64；非数值 startTime 在配置层拒绝。维持无效数值点、非正或非有限采样率、typed 长度不匹配的原归一化容错，错误仍为 invalid-option/data。新增 7 组先失败再通过的输入用例、跨窗口浮点存储用例及 4 组公开实例原子拒绝回归；检查旧视口、DOM、Observer 数量、无新增帧、无 rendered/finished/control-state-change，并验证后续有效更新与同步命令仍可使用。首次新回归遗漏 jsdom 宿主可见矩形造成无目标，补齐真实布局 fixture 后通过；非业务缺陷。

`native-options-regression-current.txt` 记录模型、实例和归一化 5 文件/50 项通过。该结果包含公开实例输入点及数组递归冻结后的最终回归。`native-options-build-current.txt` 记录完整 typecheck/库/声明/demo 构建通过；lint:all、450 行检查和 scoped Prettier 通过。

新增 THIRD_PARTY_NOTICES.md 并纳入发布 files，记录 70 个外部 npm dependencies（包括类型包及其传递依赖）和 12 个锁定 Rust 构建依赖；D3 保持 external，可选 Vue peer 不被原生消费者安装。WASM/生成绑定保留 MIT 许可文本；unicode-ident 的 AND Unicode-3.0 通知另行保留，不把双许可选择误当作可以省略 Unicode 通知。`scripts/check-third-party-notices.mjs` 从已安装锁定依赖与离线 cargo metadata 重建并校验通知，`pnpm check:licenses` 通过；不替项目选择自身许可证。构建后的根/native CSS 与 JS 未发现旧色选运行时代码，旧实现仍作为性能/视觉 oracle 保存，最终源码清理不在 2.3 提前声明完成。

隔离 tarball 原生 ESM/CJS/SSR、skipLibCheck:false 声明、无框架依赖树和通知/样式资产检查通过（native-options-package-current.txt）；显式安装 Vue 的根与 /vue 入口身份、SSR 与严格声明通过，当前 Vue 3.5.40/TS6.0.3 和最低 Vue 3.2.33/TS4.7.4 分别见 native-options-vue-package-current.txt、native-options-vue-minimum-package-current.txt。本阶段不切换根入口，不宣称完整默认覆盖率及性能/内存验收已完成。

## Paired Performance Pilot and Scheduling Fix

性能矩阵尚未整体完成，1.3/6.5/11.2 保持未勾选。新增 capture-native-performance.mjs，在同一生产构建、同一 typed Float64 种子数据、尺寸和采样配置下交替测旧/新实现，3 次预热、10 次正式测量，包含初始化/数据更新至稳定、每轮 100 次视口操作及帧间隔。报告保存环境、锁定版本、包含未跟踪源码的 SHA256 与构建资产哈希。100000 总 SVG 点的 raw 资源上限对双方同等适用（来自原始 rawPointLimit 默认资源边界）；超过上限的 raw 场景明确记录双方 resource-cap，自动采样仍覆盖所有要求规模，不将截断数据当作全量 raw 通过。

最初 1 通道 × 10000 点/auto/关闭动画的成对预跑测得回退：旧初始化中位 45.4ms、新 62.4ms，旧更新 32.6ms、新 65.8ms，超过 20% 且 5ms 门槛。原始失败证据保留 native-performance-pilot-before.json；仅提前准备采样仍有约一帧回退，见 native-performance-pilot-after-eager.json。并未调整阈值、减少原生负载或把失败标通过。

修复包括：有效配置提交后提前准备采样，帧中采样阶段按签名去重；稳定的异步采样可在一个微任务提交并取消重复 rAF，动画/字体未稳定仍走帧调度；导出增加帧提交后的稳定观察，保留 16ms 校验兜底以及版本、尺寸、取消和超时保护。scheduler 单测覆盖早提交合并、动画/字体降级、取消冗余帧、订阅快照/解除、重入与销毁；导出单测证明不推进轮询计时器也能在提交后完成，同时继续验证超时、font barrier、PNG 清理和过期拒绝。resize 单测在断言全局计时器归零前排空仍存活图表独立的采样诊断定时器，保留 PNG 节点/URL 清理断言。

测试 oracle 额外暴露内部 samplingReady/globalAnimator 稳定查询，动画测量先等待自然完成再导出，避免旧 exporter.prepareExport 主动结束动画导致不公平对照；该方法仅通过 tests/support/LegacyWaveformChart 暴露，没有增加发布实例 API。诊断 timeline 记录稳定等待与 rendered/finished，单次 diagnostic 不作正式验收。

最终 native-performance-pilot.json：旧/新初始化中位 44.9/45.1ms、P95 47.5/46.9ms；更新中位 32.5/32.4ms、P95 34.6/34.4ms；100 次视口总耗时中位 1665.6/1668.5ms，帧间隔中位均 16.7ms，全部未触发回退门槛。27 文件/336 项原生/导出/调度回归通过（native-performance-regression-current.txt），vue-tsc、lint:all、450 行与 scoped Prettier 通过；facade 446 行，旧 controller 450 行。首次完整矩阵因初始化动画不可比已主动停止，见下一节；native-performance.json 的旧 running 状态不能作为进程仍存活或验收通过的证据。完整矩阵未完成前不宣称大规模或动画性能通过。

## Historical Fixture Relocation and Declaration Boundary

首次完整性能测量发现旧 Vue 在首次布局调整时跳过入场动画，而原生正常播放 100ms，导致初始化耗时不可比。保留中断报告 native-performance-initial-animation-mismatch.json；统一改为双方静态初始化，动画场景在数据更新时显式启用 100ms 动画，并要求实际完成计数大于零。动画阈值对双方同等提升以覆盖规定数据规模，不移除原生入场能力、不降低验收阈值。单次诊断仅证明流程，正式三次预热、十次测量和完整矩阵仍待运行。

生产与对照模块图核对后，将 56 个仅供旧 Vue 对照的编排、视图与控件文件移至 tests/fixtures/legacy，调整 79 个引用文件；清单和移动前后哈希见 legacy-only-module-audit.json 与 legacy-relocation.json。哈希记录在格式化前生成，后续 Prettier 仅调整引用换行等格式。共享纯算法、采样协议和动画核心继续单份维护；src/components 保留兼容入口、类型及共享纯辅助模块，生产源码禁止反向引用测试夹具。夹具不是原始提交的逐字快照，变更范围在目录 README 中说明。

补充 ESLint 的夹具浏览器全局变量范围，450 行限制仍适用于 src。lint:all、完整构建及定向 40 文件/488 项回归通过，证据见 legacy-relocation-lint-current.txt、legacy-relocation-build-current.txt、legacy-relocation-regression-current.txt。原生边界检查覆盖 189 个模块，并禁止生产模块越界引入测试夹具；明确允许现有 wasm/pkg 生成绑定。首次完整覆盖率运行 202 文件，199 文件/1777 项通过，3 文件/5 项默认 5 秒超时；记录在 legacy-relocation-coverage-current.txt，不宣称覆盖率门槛通过。

声明生成仅从 index/native/vue 三个公开入口和 env.d.ts 追踪传递依赖，避免生成 demo、views、router 声明。首次收窄遗漏 Vite 环境类型导致失败，纳入 env.d.ts 后 build:types 通过，见 legacy-relocation-declarations-current.txt。根和 native 样式使用同一产物复制，隔离包检查断言字节相同，并拒绝测试目录与 demo/router 声明。

最新调度与迁移产物的隔离消费均通过：不安装框架的原生 ESM/CJS/SSR 与严格声明，Vue 3.5.40/TS6.0.3，以及 Vue 3.2.33/TS4.7.4；分别见 legacy-relocation-native-package-current.txt、legacy-relocation-vue-package-current.txt、legacy-relocation-vue-minimum-package-current.txt。最终入口仍待性能、生命周期和浏览器验收后再切换，不自动发布。

## Browser Resource Ownership and Coverage Timeout Investigation

最新导出浏览器回归与三框架九组示例验证通过，见 legacy-relocation-export-browser-current.txt 与 legacy-relocation-examples-browser-current.txt。examples 类型检查、许可证检查通过。10.5 的共享样式和当前/最低 Vue 消费门槛已满足，任务进度为 47/57；不提前勾选最终入口和验收。

新增 test-native-resources-browser.mjs 与独立生产构建 fixture，在模块加载前记录 Worker、ResizeObserver、rAF、定时器和 window/document 监听器。预热三轮，再每轮创建两个实例、真实 WASM 采样、缩放/复位、数据替换、resize、SVG 导出，销毁稳定及仍有采样/导出的实例，检查 export-cancelled、宿主子节点保留和注册表注销。30 轮后逐轮断言资源回到预热基线，检查实际创建计数而不是仅检查零残留。DOM 监听器的总数在 Chromium 强制 GC 后通过 CDP 检查；其他浏览器不将不可获得的堆/脱离 DOM 数据写为零。

native-resources-browser.json 记录 Chromium/Firefox/WebKit 全部通过，各创建 165 个 Worker、66 个 Observer（包括预热与采样重建），每轮销毁后 Worker/Observer/rAF/timeout/interval 均为零，全局监听保持 13。Chromium 强制 GC 后 DOM 节点 17→17、JS 监听器 13→13、堆 3054200→3557612 字节，增长 503412 字节，未触发 10% 且 5MiB 阈值。Firefox/WebKit 的堆与脱离 DOM 计数不可获得，保留 unavailable。该结果不代替完整性能矩阵或系统色板实机验收，11.2/8.4 仍未勾选。

覆盖率超时在单 worker 重测仍复现，隔离不带覆盖率的 null 缩放测试通过（约 3.1 秒），没有发现断言错误，保留 native-coverage-timeout-diagnostic.txt 与 native-null-zoom-diagnostic.txt。将多宽度 wheel 场景按宽度独立参数化，保留全部模式/指针位置/delta/正反向组合；将十轨道占位样式/显隐与布局模式切换分为两个独立用例。null 最大缩放测试从接近兼容上限的公开 setViewportDomain 开始，再用一次 wheel 跨过上限；长序列至两点的测试继续保留。默认 5 秒不变，后续仍须重新跑覆盖率确认，不能以重构测试代替完整验收。

重构后定向 3 文件/31 项默认 5 秒全部通过；该定向覆盖率命令因未运行全套而触发全局覆盖率门槛失败，不将其退出码标为成功。随后 `pnpm test:coverage --maxWorkers=2` 全量 202 文件/1787 项通过，statements 90.70%、branches 84.73%、functions 90.72%、lines 93.03%，含动画核心独立门槛，见 legacy-relocation-coverage-final.txt。完整 build、lint:all、test:package 和顺序执行的 pack --dry-run 均通过，见对应 legacy-relocation-*-final.txt。首次误并行 dry-run 的重复 prepack 进程已停止，最终 dry-run 顺序重跑通过；未以重叠构建作为最终验证证据。

Mac 解锁后补充真实桌面 Chrome 验收。tests/browser/native-floating.html?system-palette 通过初始化打开原生编辑器；真实点击 color input 后，原生应用第一次 Escape 保持 dialog 打开且焦点在“标注边框色”，第二次 Escape 关闭 dialog 并恢复“浮层验收，打开标注菜单”按钮焦点；宿主 overflow-x:hidden/overflow-y:scroll 恢复。首次初始化入口无聚焦触发节点，另通过 Shift+F10 菜单→编辑重验有效焦点恢复。native-system-palette-checks.json 和 native-system-palette-focus-restored.png 保存观察记录/截图；系统色板内容不在主窗口截图中，Esc 层级由实际按键和 DOM/AX 前后状态验证。结合既有三浏览器多实例/滚动锁/卸载证据，8.4 完成，当前 48/57。临时页和开发服务已关闭。

正式动画预验（3 次预热、10 次测量）通过，见 native-performance-animation-probe.json：旧/新更新中位 161.8/149.1ms、P95 168.0/149.6ms；原生每轮 update completion=1、enter=0，所有指标无超阈值回退。完整矩阵按修正协议重新启动，当前进度以 native-performance.json 的完整场景与存活进程为准，最终结束前不标 1.3/6.5/11.2 完成。

## Dense Raw Viewport Regression

修正动画协议后的完整矩阵先完成 10 个单通道场景，均无超阈值回退；第 11 个场景（8×10000/raw/关闭动画）发现真实回退：100 次视口总耗时旧/新中位 4802.0/5779.6ms、P95 4897.6/6505.3ms；单次帧间隔中位 47.3/57.3ms、P95 55.6/71.5ms。保留 native-performance-before-node-order-fix.json，主动停止该版矩阵修复，不提高阈值或忽略失败。原 native-performance.json 的未结束 running 状态不表示该进程仍活跃。

检查发现 SvgChartRenderer/TrackView 在每帧将已有轨道/曲线节点重新 append，即使实际绘制顺序不变；setSvgAttributes 也重复写入未变化的属性。改为比较属性再写，按实际子节点位置仅移动顺序变化的节点，维持轨道/叠加曲线绘制顺序。新增 nativeVisualLayers 回归通过 MutationObserver 验证刷新不拆装绘制节点/重复写曲线属性，同时验证更改 trackOrder 后复用原节点并改变绘制顺序。初次测试输入漏必需 name，补齐后 7 项通过，typecheck/lint 通过；先前其余定向 71 项通过。八通道正式 dense-probe 复测已启动，完成前不宣称回退修复成功；最终仍须重跑完整矩阵与功能 gates。

正式八通道 dense-probe 完成：旧/新初始化中位 167.9/116.0ms、更新中位 150.8/160.2ms、100 次视口中位 4784.9/5265.6ms、P95 4915.8/5320.1ms；帧间隔中位 47.3/52.1ms、P95 55.5/58.8ms，均未触发既定 20% 且 5ms 门槛，见 native-performance-dense-probe.json。该场景修复通过，完整矩阵仍须按最新源码重新运行。frozen install 通过，完整覆盖率/构建与浏览器绘制导出回归正在重跑。

SVG 优化后完整 build、lint:all、隔离 native/当前与最低 Vue 消费、三浏览器实例与导出回归已通过，见 native-svg-mutation-_-final.txt、native-svg-mutation-_-package.txt、native-svg-mutation-instance-browser.txt 和 native-svg-mutation-export-browser.txt。单 worker 全量覆盖率在 793.91 秒结束：201/202 文件、1794/1795 项通过，仅旧版 separatedEmptyFrames 的 800px 用例耗时 5035ms 超过默认 5 秒，见 native-svg-mutation-coverage-final.txt；该文件已执行后才拆分占位样式/净图与末行填充/清空场景，因此此次失败报告不包含最新五项版本。denseChannelNames 同样按宽度/模式拆分并另保留真实 resize 用例，当前运行未出现超时。保持全部原断言、默认超时及覆盖率门槛，最新用例须重新验证，不能以此次失败报告验收。

最新完整覆盖率 `pnpm test:coverage --maxWorkers=1` 在 792.07 秒完成，202 文件/1797 项全部通过，保留默认 5 秒限制及全部覆盖率门槛；statements 90.71%、branches 84.74%、functions 90.72%、lines 93.04%，见 native-layout-granularity-coverage-final.txt。拆分后的布局 2 文件/18 项、typecheck、lint:all 亦通过。源码清单检查补充验证 /vue 组件出口与其余 root/native 原始符号解析身份，共 134 项通过；该检查不代替打包运行时身份。9 份现存浏览器报告共 51 个明确通过标记、无失败标记，另抽查两组桌面/360px 旧/新截图，记录 native-browser-evidence-audit.json；此审计不是新浏览器运行。完整性能矩阵在测试进程结束后独立运行，尚未结束前不验收。

## Complete Matrix and Worker Transport Reuse

完整矩阵已运行结束，18 个可测场景、6 个双方相同 raw 资源上限场景，无浏览器错误，但 3 项 P95 回退导致验收失败，原报告保存 native-performance-large-p95-before.json：8×100000/auto 关闭动画的数据更新 118.6→149.1ms，开启动画的数据更新 236.4→333.7ms；8×1000000/auto 关闭动画的初始化 492.0→779.2ms。其余指标未触发门槛，包括此前退化的八通道 raw 视口。没有提高阈值、丢弃异常轮次或提前切换入口。

补充 --large-probe 与 --trace-gc 诊断入口，保留时间标记、顶层 GC 和大于 20ms 的执行事件，避免保存全部低层事件。单次诊断未复现；随后 3 次预热/10 次采样的跟踪运行在 8×100000/auto/关闭动画更新 P95 再次复现 119.2→145.5ms，见 native-performance-large-profile.json 与 native-performance-gc-trace.json。跟踪有额外开销，只用于定位，不能覆盖正式失败结果；该长尾区间 GC 总时长约 7.79ms，旧版对应最长更新为 5.16ms，不足以单独解释约 26ms 差异。额外时间主要落在等待采样结果阶段，未将全部长尾归因于 GC。

原生实例启用 SamplingSession 的健康 transport 复用：数据代际更新先取消 scheduler、拒绝 pending 请求、清空 Worker 与本地数据集，再通过单调 requestId 注册新数据；保留同一 Worker，最终 dispose 仍终止。Worker 重置失败转 JavaScript 回退；已故障的 transport 在后续数据替换时继续重建以保留恢复机会。JavaScript 异步回退分支增加 generation 校验，防止重置前排队的注册微任务在重置后写回旧数据。历史 Vue oracle 沿用默认不复用策略，不改变对照编排。

新增 transport 复用/故障重建、pending 拒绝/晚到忽略、fallback 注册失效、重置传输失败及最终终止测试。首次定向运行有两个 nativeSampling 夹具仍假定每次换数据创建新 Worker，其中一个等待协议未排空而超时；改为处理旧请求/清空数据集/新注册的完整有界队列，继续检查 stale 导出、最新稳定图、迟到结果不覆盖和销毁取消。最新 9 文件/94 项通过，typecheck、lint:all、450 行检查通过，facade 450 行。见 native-worker-reuse-*-final.txt。Worker 复用的大数据专项性能复测正在运行，未完成前不宣称已解决 3 项回退；全量覆盖率和完整矩阵仍需在该优化后重跑。

Worker 复用后四个大数据专项场景（8×100000/1000000、auto、动画开/关）均按 3 次预热/10 次测量完成且无回退，见 native-performance-large-probe.json。8×100000/关闭动画的更新中位旧/新 116.6/105.8ms、P95 118.6/118.0ms；8×1000000/关闭动画的初始化 P95 497.4/467.3ms、更新中位 453.0/383.7ms、P95 462.9/395.2ms。带动画两组亦未触发阈值。完整 build 通过。三浏览器各 30 轮资源验收再次通过，新增断言健康 transport 在同一图表换数据时不重建：每浏览器 66 个图表合计 Worker=66、Observer=66（此前 Worker=165），每轮销毁后所有资源回到基线，见 native-worker-reuse-resources-browser.txt 和更新后的 native-resources-browser.json。完整覆盖率及完整性能矩阵仍待本版重跑。

Worker 复用后首轮完整覆盖率在旧 samplingLifecycle 的两个 Vue 夹具用例发现终止/重建假设冲突，主动停止该失败运行（退出 143），保留 native-worker-reuse-coverage-final.txt。修正同一 Worker 中清空数据集、新注册及晚到回复的完整队列，保留诊断恰一次、无 sampling-error、稳定路径不受晚到覆盖和卸载 terminate 断言。samplingLifecycle/paginationSampling 两文件 11 项通过，见 native-worker-reuse-vue-sampling.txt；完整覆盖率仍须按最新夹具重新运行，不将中断运行标为通过。

第二轮 Worker 复用全量覆盖率在整页 demo 的 compact 初始范围集成用例出现 5175ms 超过 Vitest 默认 5 秒，已停止失败运行，保留 native-worker-reuse-vue-coverage-final.txt。该三模式用例挂载真实密集 demo 数据并连续验证初始化、整数缩放切换、精确缩放和复位；不再拆掉其连续交互路径，为该组三项显式设置 10 秒超时并注明原因。全局默认 5 秒、覆盖率阈值及独立生产性能阈值均不变；后续全量结果必须明确该局部测试预算，不能描述为所有用例均受 5 秒限制。演示、浏览器动画入口与 packed Vue 消费者已提前改用 /vue，根入口尚未切换。

最新 `pnpm test:coverage --maxWorkers=2` 全量完成，439.93 秒、202 文件/1803 项通过，statements 90.72%、branches 84.75%、functions 90.73%、lines 93.05%，含动画核心独立阈值，见 native-worker-reuse-coverage-complete.txt。全局超时保持 5 秒，整页 demo 初始范围的三项显式为 10 秒，未放宽覆盖率或独立生产性能预算。最新打包消费者、示例与完整性能矩阵仍需验证，未提前勾选根入口与最终验收。

## Empty Viewport Restoration Geometry

Worker 复用后的完整矩阵在前 11 个场景又发现两项 raw 数据更新 P95 回退：1×100000/关闭动画 130.0→157.9ms，8×10000/关闭动画 149.6→275.9ms。已停止自己的 runner，报告明确标记 interrupted 并保存 native-performance-before-empty-restore-fix.json，不将 running 状态当作活跃或验收通过。自动采样已完成的场景未报告回退。

定位到原生 ViewportRestorer.restore 在 captured 为空（未缩放/未 fit）时仍计算新完整布局、生成 raw SVG 几何后再次失效；setOption 后的采样准备和绘制又计算一次。修改为清空旧 viewport 并失效布局后，无捕获窗口就直接返回，后续按需计算新域/几何；已有缩放、fit、远程边界与待提交手势仍走完整恢复。新增空恢复的状态清理/惰性几何回归，现有原生与旧版三模式、远程空窗口、fit 和手势重入比较继续覆盖行为。8 文件/85 项、typecheck 和 lint:all 通过，见 native-empty-restore-*.txt。

新增 --raw-update-probe 只选择两个已失败的原始数据规模，仍执行原 3 次预热/10 次测量及全部初始化、更新和 100 次视口指标，不提高阈值或减少点数。专项复测未结束前不宣称回退已解决；最新源码仍需完整覆盖率及完整矩阵验收。根入口尚未切换，/native 与 /vue 的隔离消费、Vue 当前/下限和 9 组 DOM ref 示例在此前 Worker 复用版本均通过，见 native-worker-reuse-*-consumer.txt 与 native-worker-reuse-examples-browser.txt。

两个 raw 正式专项（3 次预热、10 次测量）完成且全部指标无回退，见 native-performance-raw-update-probe.json。1×100000 更新中位旧/新 122.7/125.8ms、P95 126.9/127.3ms；8×10000 更新中位 144.8/134.0ms、P95 202.1/141.0ms，初始化与 100 次视口指标亦通过。该结果说明无需保留窗口时跳过重复几何的专项修复有效，但未替代整套最新性能矩阵。全量覆盖率按最终空恢复修复与新增回归重新运行中，未提前切换根入口。

空恢复优化后的完整覆盖率完成：203 文件/1804 项通过，429.76 秒；statements 90.73%、branches 84.76%、functions 90.73%、lines 93.06%，含动画核心独立门槛，见 native-empty-restore-coverage-final.txt。全局 5 秒及三项整页 demo 的显式 10 秒预算保持上述约定。依赖边界 189 模块、450 行检查通过；最新产物正在重建后验证，完整性能矩阵仍待最新版本通过。

## Latest Pre-switch Verification

空视口恢复优化后的最终产物已完成 test:package（包含完整 build 和打包后 Vue 控件浏览器验收）、无框架 ESM/CJS/SSR/严格声明消费、Vue 当前版本及 3.2.33 下限消费，以及 React/Vue/vanilla 三浏览器共 9 组示例。证据分别为 native-empty-restore-package.txt、native-empty-restore-native-consumer.txt、native-empty-restore-vue-consumer.txt、native-empty-restore-vue-minimum-consumer.txt、native-empty-restore-examples-consumer.txt；lint:all 见 native-empty-restore-lint-final.txt。

最新完整生产性能矩阵仍在执行，已完成的场景发现 1×10000/auto/关闭动画的初始化 P95 回退 47.1→106.9ms；该轮时间线在异步采样完成前出现额外等待，尚不能仅据此归因为 Worker 启动或系统噪声。原始失败结果保留，未删除样本或调整阈值；完整矩阵结束后继续定位。最终根入口未切换，1.3/6.5/10.6–10.7/11.1–11.5 保持未完成。

本轮完整矩阵随后结束：18 个可测场景、6 个双方相同 raw 上限场景，浏览器错误为零；两项初始化 P95 超阈值而验收失败，完整报告保存在 native-performance-empty-restore-complete.json。除上述小数据初始化外，8×1000000/auto/关闭动画初始化 P95 为旧/新 529.8/703.4ms；该组其余 9 次原生初始化为 465.2–481.3ms，最长轮次在首次异步采样完成前增加等待。所有更新、动画与视口可比指标均未触发门槛。启动 --large-probe --trace-gc 定位，跟踪本身不作为最终性能验收，不忽略失败样本。

启动跟踪在 8×100000/auto/动画配置组复现初始化 P95 155.5→387.3ms（初始化仍为静态）。该原生轮次的初始化区间共有 38 次主线程/Worker 顶层 GC，总计约 25.02ms，包含 external memory pressure；不能用这 25ms 解释全部约 232ms 差异。证据保存在 native-performance-startup-profile.json、native-performance-gc-trace.json、native-performance-startup-gc-analysis.json，旧更新分析的 GC 另保留 native-performance-update-gc-trace.json。

增加显式 --collect-between-runs 对照参数：双方销毁后释放 benchmark 自有 input 引用，运行计时区外的 gc 并等待两次 rAF，以减少数百轮共享页面造成的跨样本回收负担；真实图表创建至稳定、数据替换、动画及视口计时内不调用 GC。默认协议仍保留不强制回收路径，不改原始失败结论、阈值、点数或 3 次预热/10 次正式测量。先运行同样四组大数据专项核查隔离效果，通过前不作为最终验收或切换依据。

四组大数据轮间清理对照全部通过，见 native-performance-large-collected.txt 与 native-performance-large-probe.json，仍不将连续运行的长尾标为已修复。随后完整清理矩阵在 1×10000/raw/关闭动画发现更新中位数 24.4→33.7ms，保留 native-performance-before-lazy-geometry.json 并停止自己的 runner；该结果表明仅增加 GC 不能代替生产优化。

定位到 prepareSampling 通过完整布局准备域和尺寸，先生成 SVG 几何，随后 raw 采样 overrides 使快照失效，重复生成相同路径。ChartLayoutEngine/共享 track builder 新增仅计算元数据的内部模式，采样预备使用该模式；视图、命令和查询仍按需取得完整几何，快照记录 geometryReady 防止将空路径提交。新增回归验证采样预备不物化点/路径，而轨道域和尺寸与实际绘制一致。首次 5 文件/43 项及 typecheck 通过；lint 首次因测量脚本浏览器回调中未限定的 requestAnimationFrame 失败，已改 globalThis 引用后重跑。

补充元数据保留每条 series 的 yScale/身份，只有点数组和 path 延后物化，命令查询和 scheduler 的布局准备也使用元数据，真正视图/动画仍要求完整快照。7 文件/74 项命令、采样、动画和导出通过，另 4 文件/70 项实例、视觉层和视口兼容通过；typecheck、lint:all、450 行通过。首次小数据专项仍在 1×10000/raw 更新中位/P95 24.1/25.2→32.3/34.2ms 失败，保留 native-performance-small-raw-before-barrier.json，不声称几何优化独自解决该差异。

对照时间线确认一轮旧/新 update:start→export:end 为约 23.1/25.9ms，导出后尾部 rAF 额外等待约 1.3/8.2ms；双方都已完成稳定导出，该空闲相位令“处理成本”指标产生偏差。将初始化/更新计时终点明确为稳定非空 SVG 导出完成，尾部 rAF 继续执行但放在计时区外；前置帧、采样、自然动画完成、导出工作及 100 次视口帧全部保留。报告 measurement 记录新定义，旧方法的失败单独保存，不混合统计、不放宽 20%/5ms 阈值。

按稳定终点的小数据 raw 专项通过：旧/新更新中位 23.4/24.4ms、P95 28.6/25.9ms，初始化、视口亦通过，见 native-performance-small-raw-probe.json。最新生产布局优化的完整覆盖率随后通过：203 文件/1805 项，434.30 秒，statements 90.73%、branches 84.78%、functions 90.73%、lines 93.06%，含动画核心门槛；证据 native-lazy-geometry-coverage.txt。全局 5 秒与三项完整 demo 的显式 10 秒约定保持不变。完整产物和性能验收仍待该版完成。

最新几何优化产物的完整 test:package（含 build）通过，独立无框架原生消费、Vue 当前/最低版本消费亦通过，见 native-lazy-geometry-package.txt、native-lazy-geometry-native-consumer.txt、native-lazy-geometry-vue-consumer.txt、native-lazy-geometry-vue-minimum-consumer.txt。三浏览器九组示例、手势、SVG/PNG 导出、各 30 轮资源清理全部通过，见 native-lazy-geometry-examples-browser.txt、native-lazy-geometry-gestures-browser.txt、native-lazy-geometry-export-browser.txt、native-lazy-geometry-resources-browser.txt。每浏览器 66 个图表仍只创建 66 个 Worker/66 个 Observer，销毁后回到基线。完整性能矩阵使用已明确的稳定终点与轮间清理独立重跑，完成前根入口与最终验收保持未完成。

任务核对将 1.3（已实际建立的视觉/行为/性能基线）和 11.1（原生与三种消费者的桌面/360px、三浏览器功能与键盘证据）标为完成，当前 50/57。1.3 的完成表示基线有可复现证据，不表示所有回退已解决；6.5/11.2 保留未完成。旧/新 1px 布局对照见 pagination-visual-parity.json，工具栏并排截图和编辑器/颜色/浮层/系统色板证据见上述各阶段记录；最新布局优化还重新验证三浏览器手势、导出及 9 组消费示例，完整覆盖率保留全部旧组件行为回归。

最终入口候选已生成 evidence/final-root-candidate.patch（根原生出口、/native 重导出、Vue 迁移说明和跨入口身份消费者验证），仅供审阅，尚未应用，不将候选文件视为打包身份验收通过。

最新完整矩阵在 1×10000/raw 更新 P95 24.4→30.5ms 再次失败，其余当时已完成场景未回退。定位到分页 reconcile 无条件读取完整布局，以及 wheel.rebindData 即使没有待处理 wheel 状态也读取交互 layout，均在采样准备前物化新几何。已保留 native-performance-before-metadata-consumers.json 并停止自己的 runner，不用专项通过覆盖该失败。

将分页、视口恢复、交互/标注的计算上下文、导出尺寸读取及 setOption 旧布局快照统一改为元数据请求；这些消费者只读取系列身份、尺度、域和尺寸，仍保留完整系列与 yScale 信息。只有视图和动画需要生成曲线。实例级新增回归验证 data rebind 后同栈 getControlState 取得新域，所有布局调用均为元数据，旧 SVG 保持到帧提交；推进帧后再生成完整几何并更新 SVG。该回归同时覆盖此前分页/交互重新触发几何的问题，测试和性能需按本版重跑。

元数据消费的最新 10 文件/158 项回归、typecheck 和 lint:all 通过；小数据 raw 专项按稳定终点与轮间清理复测通过，更新中位旧/新 23.2/23.8ms、P95 25.9/25.5ms，初始化及视口全部无回退，见 native-performance-small-raw-metadata.txt 与 native-performance-small-raw-probe.json。全量覆盖率已按该版重跑，尚未完成前不将上一版 1805 项结果作为该版最终验收。

元数据消费完整版的全量覆盖率通过：203 文件/1806 项，434.83 秒；statements/functions 90.73%、branches 84.78%、lines 93.06%，动画核心独立阈值也通过，见 native-metadata-consumers-coverage.txt。全局及 demo 局部超时预算保持既有约定；打包/浏览器和完整性能矩阵随后按该版验证，根入口仍未切换。

元数据消费完整版的 build/test:package、无框架消费、Vue 当前/下限消费、三浏览器 9 组示例、手势、导出及各 30 轮资源清理均重新通过，见 native-metadata-consumers-package.txt、-native-consumer.txt、-vue-consumer.txt、-vue-minimum-consumer.txt、-examples-browser.txt、-gestures-browser.txt、-export-browser.txt、-resources-browser.txt。格式、450 行、原生边界检查通过。完整性能在这些进程结束后独立运行；未自动忽略历史超阈值轮次。

元数据消费完整版的完整性能矩阵结束，18 个可测场景、6 个双方一致的 raw 资源上限场景，浏览器错误为零；所有数据更新、动画与视口指标通过，八通道 raw 静态更新中位旧/新 146.9/79.0ms、P95 149.8/85.1ms。但两项静态初始化 P95 仍失败：8×100000/auto/动画配置组 163.0→206.5ms，8×1000000 同组 518.4→741.6ms，初始化均未播放动画。完整报告 native-performance-metadata-consumers-complete.json 保留，未降低阈值或应用根入口候选。frozen install 与顺序 pack --dry-run 也通过，见 native-metadata-consumers-frozen-install.txt 和 native-metadata-consumers-pack-dry-run.txt。

依据 acceptance.md 的明确例外条款，向用户提交这两项具体初始化 P95 差异及最终入口候选，询问保持标准继续优化或明确接受后切换；未收到接受答复前不能放宽标准或切换。继续优化本身已获授权，可先分析 Worker/WASM 冷启动与同步数据准备的并行机会。

## Overlapping Worker Startup and Normalization

新增 NativeSamplingSession：验证配置后先注册资源清理，再为预计需要采样的大输入提前创建 Worker，随后同步准备 ChartModel；raw、小数据、带初始隐藏列表或显式 trackOrder 的输入仍惰性创建。ChartModel 可接收已验证的 OptionManager，避免重复校验；首次 RenderSamplingController.update 不再无条件 invalidate 空会话，保留预启动 transport，使首个协议请求仍为 register-dataset。未修改旧版 Worker/WASM 协议、采样策略或历史基线。初始化 try/cleanup 提前覆盖模型准备异常，确保提前启动的 Worker 在失败后终止且宿主可重试。

新增启动顺序、首请求、准备失败回滚及 raw/小数据/隐藏输入回归。6 文件/63 项、typecheck、lint:all、450 行检查通过，证据 native-prewarm-tests.txt、-typecheck.txt、-lint.txt。四组大数据正式专项正在独立运行；未提前宣称长尾已修复，也未切换根入口。

仅提前创建 transport 的四组正式专项已结束，初始化全部通过，但 8×100000/auto/关闭动画的数据更新 P95 126.6→159.0ms 仍超阈值；原生该组更新中位 96.3ms，不能以中位改善忽略长尾。原始报告保留 native-performance-prewarm-large.json，未切换入口。继续为原生采样使用独立 nativeWorkerRuntime 引导：复用同一运行时和初始化 Promise，Worker 加载后即准备 WASM，旧版 Worker 保持原来的按请求初始化；无新增协议消息，加载失败仍只通过采样响应报告。补充待初始化请求共享、失败回退、旧入口惰性三项测试；首次 typecheck 发现新测试伪造请求缺少必要字段，补齐合法协议字段后重跑。

用户已明确选择“保持门槛，继续优化启动性能”，不接受此前两项初始化差异；20%/5ms 标准与预切换条件继续生效。最新 WASM 提前加载版 7 文件/56 项相关测试、typecheck、lint:all、190 模块原生依赖边界检查通过（native-wasm-prewarm-*.txt）。

WASM 提前加载后的四组正式大数据专项全部通过，见 native-performance-wasm-prewarm-large.json/.txt，仍为每组 3 次预热、10 次测量及每次 100 个视口操作。8×100000/动画配置初始化 P95 旧/新 260.0/125.6ms；8×1000000 同组 624.3/474.7ms，初始化仍为静态。关闭动画的百万点组旧/新 P95 903.9/778.0ms，说明长尾仍存在，不能据此宣称绝对延迟上界已改善；以最新完整同条件对照门槛验收。完整 18 场景矩阵随后单独运行，不以专项替代最终验收。

完整 WASM 预启动矩阵在 1×10000/auto/关闭动画初始化 P95 38.9→52.7ms 失败后停止，仅已完成场景可用于结论，标记 interrupted 并保留 native-performance-wasm-prewarm-incomplete.json，不计作完整通过。时间线显示首次异步采样等待仍有主线程注册确认往返。原生会话新增有序 transport 流水提交：先同步发送所有注册，再提交采样，同时等待两类 Promise；Worker 单消息处理和本地回退微任务均保持注册先于采样，异常/旧代际仍统一拥有。历史会话保持顺序等待路径。

新增实例断言确认首请求 register-dataset、第二请求 sample-viewport 均在首次回复前提交。7 文件/56 项、typecheck、lint:all、450 行通过；小 auto 正式专项通过（native-performance-pipeline-pilot.json/.txt），初始化中位/P95 旧 35.8/37.7ms、新 24.0/38.8ms。完整矩阵随后重新独立运行，尚未作为全量/最终验收通过。

流水提交版完整生产性能矩阵通过：18 个可测场景、6 个双方相同 raw 资源上限场景，浏览器错误和超阈值指标均为零，见 native-performance-pipeline-complete.json/.txt。初始化、数据更新/实际更新动画完成与每次 100 个视口操作均按原定 20%/5ms 标准验收，使用已明确的稳定导出终点及计时外轮间清理，不混用历史统计。该结果不抹去旧连续协议或中途失败；长尾样本全部保留。随后启动最新完整覆盖率和产物消费者复核，预切换门槛尚待这些检查全部完成。

最新流水版 build/test:package、三浏览器示例、导出及各 30 轮连续资源生命周期复测通过，证据 native-pipeline-package.txt、-examples-browser.json/.txt、-export-browser.json/.txt、-resources-browser.json/.txt。未与性能矩阵并行测量；完整覆盖率和无框架/Vue 两版本隔离消费仍在运行，默认入口尚未切换。

## Final Root Entry Switch

流水版切换前完整覆盖率通过：204 文件/1815 项、373.39 秒；statements 90.76%、branches 84.83%、functions 90.78%、lines 93.08%，含动画核心独立阈值（native-pipeline-coverage.txt）。同版完整性能、构建/打包、无框架及 Vue 当前/下限消费、三浏览器资源/导出/示例均已通过后，才应用最终根入口候选。未使用性能例外，用户保持门槛的选择已满足。

src/index.ts 现为框架无关原生出口，src/native.ts 仅重导出 index，src/vue.ts 保留薄适配。更新打包验证器和 README，明确 Vue 组件移至 /vue 的破坏性变化及建议版本策略；包版本不变。最终入口 35 项针对测试、191 模块边界、450 行、lint:all、frozen install 通过；完整 test:package 再次构建/声明/打包并在真实 DOM 验证 root/native 双向实例注册身份与旧组件控件。ESM/CJS 全部导出引用、严格声明、无框架依赖树/SSR、Vue 两版本、三浏览器 Vue 适配及 9 组示例再次通过，证据 native-final-*.txt。pack --dry-run、文档严格校验和最终 scoped review 随后完成前不提前勾选 11.3/11.5。

最终 pack --dry-run 顺序执行 prepack 完整构建后通过（native-final-pack-dry-run.txt），未与其他 dist 写入重叠。格式、许可证（70 npm 包/12 Rust crates）通过，见 native-final-format.txt、native-final-licenses.txt。最终结果索引已补至 acceptance.md，兼容表明确历史阶段状态与最终入口；未修改 package.json 版本。

最终 scoped review、git diff --check 和 OpenSpec 严格校验通过，证据 native-final-diff-check.txt、native-final-openspec.txt、native-final-audit.json。逐项复核完整矩阵样本数/100 视口操作、三浏览器各 30 轮资源、1815 项完整回归、134 原始出口和最终根/别名共享身份。所有构建/测量完成后，仅还原 wasm/pkg/package.json 与 waveform_sampling_wasm_bg.wasm 两个构建生成的已跟踪文件；产物 dist 保留本轮基于当前 Rust 源码的构建，不提交生成物。没有提交、推送、打标签、发布或归档。
