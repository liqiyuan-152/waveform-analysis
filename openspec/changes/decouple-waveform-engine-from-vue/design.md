## Context

动机见 proposal.md。当前 `src/index.ts` 同时导出 Vue 组件、数据工具和动画；`useWaveformChartController` 通过 Vue refs、watchers 和生命周期组合各模块。算法层、动画引擎及不少布局函数可复用，但 `useWaveformData.ts` 混合纯数据准备与 watcher，标注 barrel 混合序列化与 Vue 视图，`waveformId.ts` 使用 Vue 实例 ID。移除直接 import 不足以解除运行时和声明依赖。

前序工具栏、动画和原生控件变更已完成，迁移保留其事件顺序、受控状态、焦点行为、异步导出及动画资源管理。源码文件保持 450 行以内；不修改已有未跟踪证据和其他变更。

通过 gh 参考 Apache ECharts，固定源码版本为 `34f4d927eafe251f26f63afd3aeefa30f2feba30`：

- [实例和动作入口](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/core/echarts.ts)：参考实例门面、DOM 初始化、查询、事件及销毁。
- [配置管理](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/model/OptionManager.ts)：参考配置与运行状态分离。
- [更新调度](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/core/Scheduler.ts)：参考分阶段更新。
- [视图生命周期](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/view/Chart.ts)：参考 init/render/remove/dispose 边界。

ECharts SVG painter 来自 ZRender；本项目继续使用现有 D3/SVG，不引入 ECharts、ZRender、Lit 或新的响应式运行时。

## Goals / Non-Goals

**Goals:**

- 一个 HTMLElement 初始化一个原生实例，React 和 Vue 只负责取得 DOM 与宿主生命周期。
- 有状态、资源和生命周期的模块以类实现；计算算法保留纯函数；优先组合，避免深继承。
- 独立构建入口和声明边界，保持既有波形行为，逐步替换 Vue 编排。

**Non-Goals:**

- 本轮不迁移 Canvas/WebGL，不开发通用图表插件平台、通用响应式框架或撤销重做系统。
- 不实现服务端图表绘制；只保证无浏览器环境下可以导入模块。
- 不要求清除开发 demo 内全部 Vue 依赖，不要求实现 React 组件包装或拆成多包仓库。

## Decisions

### 1. DOM 实例 API 与受控配置

`init(dom, options?, initOptions?)` 返回 `WaveformChartInstance`；DOM 参数为真实 HTMLElement，不接受 Vue Ref、React Ref 或选择器。通过 WeakMap 关联 DOM 与实例；实例类由工厂创建，不公开可绕过注册的构造入口；跨窗口容器使用 ownerDocument/defaultView，不能仅用当前窗口的 instanceof 判断；同 DOM 重复初始化返回存活实例且不应用新的配置，更新必须调用 setOption。dispose 后可重新初始化。全局 dispose 对未注册容器安全无操作；跨窗口容器用所属窗口资源，容器所属文档变更后需要销毁重建。

公开只导出 WaveformChartInstance 接口和 init 工厂；内部 WaveformChart 类不提供 public constructor 出口，避免注册绕过。公开实例提供 setOption、on/off、resize、dispatchAction、zoomIn/zoomOut/fitToData、resetViewport、setViewportDomain、setInteractionMode、getControlState、exportImage、dispose、isDisposed。保留已有 trackId 和数字索引重载语义；新增事件映射显式定义，保留既有业务事件名及载荷。on 返回取消订阅函数。事件监听列表采用当前派发快照，避免监听器增删导致当前事件重复派发。

setOption 使用顶层部分更新：未提供字段保留，数组及嵌套对象整体替换，嵌套对象再按原默认值解析；显式 undefined 按下面的逐字段规则恢复默认或解除控制，data 不接受显式 undefined。清空数组使用 []。初始缺省数据按空图处理。禁止深合并数据数组与自动深度观察。

受控规则按字段定义：

| 字段            | 缺省或显式 undefined          | 从受控切回时                         | 后续默认值变化                                                  |
| --------------- | ----------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| annotations     | 解析为 []，始终由消费者持久化 | 清空显示，不创建非受控标注存储       | 不适用                                                          |
| hiddenSeriesIds | 使用内部隐藏集合              | 恢复内部集合，不将最后受控值复制进去 | defaultHiddenSeriesIds 只在 init 初始化内部集合，之后更新不重置 |
| interactionMode | 使用内部模式，初始为 zoom     | 恢复内部模式，仍遵守能力禁用规则     | 非受控模式只通过有效命令修改                                    |
| 其他可选字段    | 恢复现有默认值或移除可选约束  | 依兼容矩阵执行                       | 保持原默认规则                                                  |

受控操作只发出请求，不提前修改实际状态；内部分支不跟随受控值写入。恢复隐藏集合时按当前规范化系列解析可见性，不重新按数组索引关联。annotations 与隐藏集合都不修改消费者输入。

setOption 先构造候选配置，完成配置级校验和数据准备后一次提交；失败保持原配置、模型、视口、资源和版本，不发成功事件。保持既有数据归一化容错，不将无效点变成新的配置异常。init 在完成必要创建后注册，失败回收已创建资源；同步错误采用 WaveformChartError：code 为 invalid-container、invalid-option 或 instance-disposed，配置错误包含 field，message 仅作说明，不作为判断条件。浏览器/WebAssembly 异步错误沿用既有回退和导出错误协议，不伪装成同步校验失败。

配置提交后，命令和 getControlState 必须按最新数据、域、尺寸和模式计算，必要时同步准备计算状态，不能读取上一帧布局。DOM 刷新可合并到下一帧；以下连续调用使用 nextData 的边界，查询返回新命令状态：

```ts
chart.setOption({ data: nextData })
chart.setViewportDomain([1, 2])
chart.getControlState()
```

这不要求每次 setOption 都立即生成全部 SVG 路径。回调内 setOption 可以提交新版本；正在派发的业务动作继续使用已捕获的快照，下一次操作采用新版本，禁止递归进入同一渲染阶段。

dispatchAction 使用判别联合：zoom-in/zoom-out/fit/reset/set-domain/set-mode，目标和域/模式参数按动作类型约束，返回 WaveformControlResult；便捷方法委托同一动作处理器。旧数字方法保持 void 和静默规则，不强行改成新命令协议。exportImage 独立异步调用，不混入同步 dispatchAction 联合。

公开事件采用参数元组映射，on<K>(event, handler: (...args: Events[K]) => void) 返回取消订阅函数。保留 annotation-update(annotation, previous) 和 page-change(page, pageCount) 等多参数接口；所有原事件原样转发到 Vue emits，完整映射见 compatibility.md。重复 on 按 handler 身份去重；取消订阅句柄只取消它对应的注册，off 后重新 on 的新注册不被旧句柄误取消；off(event, handler) 删除该监听，off(event) 删除该事件全部监听。监听器异常不阻断其他监听、状态提交或资源清理，派发后通过宿主 reportError（缺省 console.error）报告，不经业务事件递归报告。销毁发生在派发中时停止剩余通知；普通订阅增删仍按派发快照处理。

区分 rendered 与 finished：rendered({ revision }) 表示有效版本的一帧已提交，包括动画中间帧；finished({ revision }) 表示该版本最新采样、必要测量、有限动画和待刷新工作全部稳定并已绘制，每个 revision 至多通知一次。不通知被新版本取代的 finished，零尺寸不通知绘制/稳定完成。revision 在有效配置、尺寸或视口/展示状态变化时递增，动画中间帧与同版本采样回写不递增。hover 不触发 finished。重复无变化更新不生成新的完成周期。

exportImage 保持现有内部稳定化与 5000ms 超时协议，不简单依赖 finished 事件，避免导出暂停动画时死锁。仍返回 Promise<Blob>。

备选：接收框架 ref 会让核心理解框架类型；照搬 ECharts 合并规则则引入复杂配置语义。均不采用。

### 2. 类式组合与设计模式

WaveformChart 使用 Facade；ChartEventEmitter 使用 Observer；init 使用 Factory；采样后端使用 Strategy；交互模式使用 State；ChartCommandDispatcher 使用 Command。API、手势和工具栏复用命令/约束处理，但保留各来源既有事件协议，不能简单把全部动作视为同一事件序列。

模型是状态来源：OptionManager 持有解析后配置；ViewportModel 持有视口；SeriesVisibilityModel 与 AnnotationModel 持有对应状态；PresentationModel 持有分页和展示模式。控制器调用拥有者方法，View 消费只读快照；不持有第二套业务状态。缓存依据输入版本失效。

ChartModel 只组合各状态拥有者，不复制其配置、视口或标注。SvgChartRenderer 只协调根节点/图层及各 View 生命周期，View 独占所属节点的创建和更新。

不建立 Service Locator、依赖注入容器或庞大基类。小接口仅用于实际可替换实现和测试。所有资源有明确的实例拥有者；ChartResources 收集清理函数，不代替业务模块自己的 dispose。

### 3. 目标目录与依赖方向

```text
src/
├── index.ts                         # 最终无框架入口
├── native.ts                        # 过渡原生入口，最终保留为别名
├── chart/
│   ├── WaveformChart.ts
│   ├── init.ts
│   ├── ChartRegistry.ts
│   ├── ChartUpdateScheduler.ts
│   ├── ChartEventEmitter.ts
│   └── ChartResources.ts
├── model/
│   ├── OptionManager.ts
│   ├── ChartModel.ts
│   ├── ViewportModel.ts
│   ├── SeriesVisibilityModel.ts
│   └── PresentationModel.ts
├── data/
│   ├── WaveformDataManager.ts
│   └── WaveformQueryService.ts
├── core/                            # 原归一化、点源、采样、WASM 算法
│   └── workerSampling/
├── sampling/
│   ├── SamplingSession.ts
│   ├── NativeSamplingSession.ts       # 原生拥有者与条件预启动
│   ├── LatestTaskScheduler.ts
│   └── WorkerSamplingClient.ts
├── layout/
│   ├── ChartLayoutEngine.ts
│   ├── TrackLayoutBuilder.ts
│   ├── AxisLayoutEngine.ts
│   ├── xDomain.ts
│   ├── yDomain.ts
│   ├── ticks/
│   └── labels/
├── rendering/
│   ├── SvgChartRenderer.ts
│   ├── SvgDom.ts
│   └── geometry/
├── view/
│   ├── TrackView.ts
│   ├── SeriesView.ts
│   ├── AxisView.ts
│   ├── GridView.ts
│   ├── LegendView.ts
│   ├── TitleView.ts
│   ├── HoverView.ts
│   └── ZeroLineView.ts
├── interaction/
│   ├── InteractionManager.ts
│   ├── ZoomController.ts
│   ├── PanController.ts
│   ├── HoverController.ts
│   ├── modes/
│   └── constraints/
├── annotation/
│   ├── AnnotationModel.ts
│   ├── AnnotationController.ts
│   ├── AnnotationView.ts
│   ├── AnnotationEditor.ts
│   ├── annotationLayout.ts
│   └── serialization.ts
├── controls/
│   ├── ChartCommandDispatcher.ts
│   ├── ToolbarView.ts
│   ├── PaginationView.ts
│   └── commands/
├── animation/                       # 复用现有 controller/core/presets
├── export/
│   ├── ChartExporter.ts
│   ├── SvgExporter.ts
│   └── PngExporter.ts
├── types/
├── utils/
├── styles/
└── adapters/
    └── vue/
        ├── index.ts
        └── WaveformChart.vue
examples/
├── vanilla/
├── react/                           # DOM ref + effects，包含 Strict Mode
└── vue/                             # DOM ref 直接接入及兼容组件示例
tests/                              # 按所属模块镜像组织
```

若后续提供 React 组件包装，放入 adapters/react，当前不创建空目录。现有 src/data 是 demo 模拟数据，先移入示例专属数据目录，避免与数据管理层名称冲突。demo 路由阶段性保留；只迁移已接入新实现的文件。

依赖从 chart 协调层指向业务模块；model/core/types/utils 不依赖 DOM、View 或框架。Layout 依赖模型快照和算法；View 依赖布局结果与渲染基础设施；Adapter 只依赖公开 API，过渡期从 native 内部入口接入，不能从仍导出 Vue 组件的根入口反向导入形成循环。src/index.ts 不通过混合 barrel 引入 Vue；内部类型放在所属模块，只有公共/跨模块契约进入 types。

SvgChartRenderer 拥有 SVG 根、defs 和图层集合，View 拥有所属节点，按稳定系列/轨道 ID 更新，避免整棵 SVG 替换破坏手势、动画和焦点。HTML 浮层、菜单和编辑器由各控件/标注模块管理。普通命名空间 CSS 替换 Vue scoped CSS，保留多实例 ID 隔离。

### 4. 更新、采样和清理

ChartUpdateScheduler 合并脏标记，执行数据准备、域/布局、采样请求、几何/视图更新。数据、视口、尺寸和样式标记分别影响对应阶段；相同 data 引用不重新归一化，样式修改不误清空视口。按现有规则处理新数据、分页和模式切换的状态保留/重置。

同步配置更新保持帧调度合并；初始化和有效配置提交后可提前准备采样，帧内采样阶段按签名去重。
异步采样在帧间稳定时可合并到一个微任务提交，取消重复的待绘制帧，避免比原 Vue 微任务提交多一帧延迟；
字体或动画仍未稳定时继续使用帧调度。阶段顺序、revision、回调重入和 finished 至多一次协议保持一致。
导出在阶段提交后直接检查稳定状态，同时保留取消/超时及版本/尺寸校验的轮询兜底。

LatestTaskScheduler 独立负责异步队列；结果校验实例存活及数据/视口/尺寸版本。样式或系列配置影响采样输入时也使对应缓存失效；只有纯表现样式不改变采样版本。保留 WASM 回退、诊断和 Worker 失效语义；异步结果回写再触发更新，不等待过期任务才能显示当前结果。

原生实例在数据代际更新时复用健康的 Worker transport，先拒绝旧 pending 请求、清空数据集并递增代际，再注册替换数据；单调 requestId 和代际校验共同隔离晚到结果，JavaScript 回退微任务也必须校验代际。实例销毁时终止 Worker；故障 transport 在后续数据替换时重建，以保留恢复机会。历史对照保持其原有重建策略，不以更改旧编排获得性能通过。

原生初始化先验证 OptionManager 并注册 SamplingSession 的清理，再为预计需要采样的大输入启动
Worker，使模块加载与主线程归一化重叠；raw、小数据及需要归一化后判断显隐/顺序的情况保持惰性。
原生 Worker 引导复用共享运行时并提前加载 WASM，同一个初始化 Promise 服务后续请求，错误仍在
采样响应中报告，不添加预热协议消息；历史 Worker 保持按请求初始化。模型准备失败也必须终止
预启动 transport，第一次提交不能将尚未注册数据集的预启动会话当作旧数据代际清空。
原生会话利用所拥有 transport 的有序消息处理，将首次数据注册与紧随的采样连续提交，统一等待
两类结果，避免确认注册后再往返一次；JavaScript 回退也按微任务顺序注册后采样。失败拒绝和
代际校验保持在共同等待边界，旧版会话保留原来的逐阶段等待。

初始化专属选项采用 initOptions: { autoResize?: boolean }，不混入波形业务 options，缺省 true。ResizeObserver 缺失时自动降级为手动 resize 并记录环境提示，不导致 init 失败。

原生实例不修改宿主容器 width/height/position 等内联样式，创建一个命名空间内层根节点作为尺寸/定位和样式拥有者。显式 width/height 控制内层尺寸，未指定维度填充宿主并测量实际可用尺寸；保留原高度缺省最小值 180px、显式高度最小值及宽度下限处理。已连接容器 display:none 时暂停绘制，不用 180px 绕过隐藏状态；解除隐藏后重新测量；无 Observer 环境通过手动 resize 恢复。内层实际测量结果受 CSS 约束时以实际尺寸为准，与现有组件行为对照测试。

resize() 测量有效内层尺寸，不改配置；尺寸变化仅在数值不同且实例存活时触发调度，避免 Observer 自激循环。width/height 显式 undefined 恢复自动维度。Vue 适配层保持原组件容器样式，由组件控制外层宽高并按原规则传入配置，不修改宿主其他节点。销毁只移除实例创建的根节点和浮层，不覆盖宿主在运行期间修改的样式。

所有 DOM 创建、全局监听和测量延迟到 init，模块导入无浏览器副作用。

清理按阶段全部尝试，即使某个清理函数失败也继续释放其他资源并注销实例，清理异常通过同一宿主错误报告渠道处理。dispose 幂等：取消手势、任务、rAF/定时器、动画、导出等待，释放 Worker、Observer、事件、浮层和本实例创建的 DOM，注销 DOM 关联并恢复焦点/滚动锁。查询 isDisposed 仍合法，重复 dispose 无副作用；销毁后的修改/命令/订阅抛明确的实例已销毁错误，exportImage 以既有 export-cancelled 拒绝，off 和已取得的取消订阅函数保持安全。

### 5. 发布边界和兼容策略

过渡期根入口保留现有 Vue API，新增 waveform-analysis/native 独立构建与声明；最终根入口与 native 导出原生实例和已有无框架工具/类型，Vue 组件从 waveform-analysis/vue 导出。采用该同包子入口方案以避免先做多包改造，Vue peer 改为 optional；原生消费不能被传递依赖强制安装 Vue，Vue 入口消费者显式安装兼容 Vue。

native 入口开始接受隔离安装验收前就处理包级依赖：Vue peer 改为 optional，vue-router 和旧色选组件移入 devDependencies 并在过渡旧入口中打包色选实现，其 Vue import 保持 external，非 Vue 运行时传递依赖随旧 UI 实现打包，核查包内许可证与 NOTICE；不通过新的 optionalDependencies 强制安装 Vue UI。过渡根 Vue 入口仍需消费者显式安装 Vue。构建根/vue/native 的共同运行模块只生成一份，防止不同入口拥有独立 DOM 注册表和资源管理；最终 native 作为根原生实现的重导出。身份保证限定于同一包安装、同一模块格式的入口；ESM 与 CJS 混合加载或重复安装不同包副本不承诺共享注册表，文档明确避免混用。

过渡期 native/style.css 只含原生样式，原 style.css 保留旧入口所需完整样式；迁移完成后两者指向同一不含 Vue UI 样式的共享 CSS。多入口构建一次清理 dist，声明 native/vue 分开检查；禁止后续构建 emptyOutDir 擦除已生成入口。

vue-router、Vue 色选组件和 demo UI 库限定开发/适配范围；原生标注编辑器用原生 DOM 实现，颜色/透明度能力保持。共享 style.css 不导入 Vue 色选样式。原生声明无需解析 Vue/React 类型；Vue 声明也不能让根入口反向引用适配层。React 仅用于示例开发和消费验证。

Vue 适配层按原 props 默认解析规则生成配置差异；字段移除传显式 undefined，不能仅传仍存在字段。只在 data 引用真正变化时提交 data，其他 props 更新不重新提交或克隆数据；配置变化可合并一个同步提交。Vue 监听器由 emits 路径转发，不反复绑定核心订阅。DOM ref 示例的 React 回调以稳定转发函数读取最新回调或正确取消重订阅，不能要求核心自动识别闭包变化。

WaveformChart 是内部实例类名称，原 Vue 组件在 /vue 保留；README 明确 import 变化。入口切换是兼容风险，必须提供迁移表和版本策略，不伪装成无破坏性内部重构，不在本任务内自动打标签或发布。

发布策略：当前 0.1.77 是回退基线，根入口切换不得作为 0.1.x 补丁发布；后续发布采用
0.2.0（建议先 0.2.0-rc.1 验证消费者），并在变更记录明确 Vue import 迁移。版本号、
发布提交、标签及 registry 发布由独立发布流程处理，本次迁移验收不自动执行这些动作。
原始公共工具与类型继续保留，Vue 组件改从 waveform-analysis/vue 导入，既有组件 ref handle
保持兼容；直接 DOM ref 用户从根入口使用 init，/native 只重导出同一实现。回退时使用
0.1.77 的原根组件入口和对应 CSS，不将两版实例混用于同一容器。

## Risks / Trade-offs

- [Vue 隐式更新顺序变成显式调度后行为变化] → 先记录事件与状态基线，使用可控调度测试覆盖重入、批更新和稳定导出。
- [类数量膨胀、门面超限] → 按真实资源和状态边界建类，纯函数保留，450 行检查持续执行。
- [采样结果过期或销毁后回写] → 三类版本校验、取消测试和最新任务队列复用。
- [样式/浮层迁移引起视觉与键盘差异] → 保留原生控件契约，桌面和约 360px 容器截图及交互验证。
- [主入口移除 Vue 组件影响已有消费者] → 先用 native 子入口迭代，再迁移组件到 /vue，提供迁移文档及版本边界。
- [前序未归档提案与本次职责重叠] → 以当前源码/测试和已完成规格为基线，不同时修改同一能力定义，实施记录列出兼容来源。

## Migration Plan

1. 记录当前公共 API、默认值、事件、视觉与性能基线；明确各模块迁移位置。
2. 抽取纯算法和类型，先解除包级必需框架/UI 依赖，新增独立 native 构建和样式，不改变旧 Vue 使用路径。
3. 落实实例/模型/调度和基础 SVG，先用 vanilla、React、Vue DOM ref 验证完整生命周期。
4. 按布局、交互、采样、标注、控件、动画、导出补齐功能，每阶段复用既有回归。
5. 旧 Vue 组件改为薄适配，完成三种消费者和包装兼容检查，补迁移文档。
6. 三种消费者预切换验收通过后切换最终入口；再次完成 CI、声明和打包验证，交付实施记录。阶段验收及阈值见 acceptance.md。

过渡期问题可回到原 Vue 实现，新增原生路径不改变旧路径；切换前记录可恢复基线，切换后通过受控代码回退恢复入口和实现，不保留两份长期业务逻辑。任何回退保留无关工作区改动，不执行 destructive reset。
