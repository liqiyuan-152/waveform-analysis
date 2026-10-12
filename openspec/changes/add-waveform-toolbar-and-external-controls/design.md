## Context

需求范围见 proposal.md。当前分支已有可靠性重构；src/components/WaveformChart.vue 暴露 resetViewport 与 setViewportDomain，后者第二参数是可选数字 trackIndex，不能直接替换成对象。src/types/chart.ts 的 WaveformInteractionMode 仅含 zoom/annotation，平移由 pannable 与 Space 组合触发。useWaveformLayout 从 interactionMode prop 派生模式，需要引入清晰的受控/非受控状态所有权。

已有 full data / sampling source 分离、受控注解与隐藏系列、独立/共享 X 视口和分页；必须复用。当前未提交的部署、niceScale 与 WASM 产物改动不属于本变更。源文件限制 450 物理行。

## Goals / Non-Goals

**Goals:** 内置工具栏与外部调用共用命令层；明确可观察状态、禁用规则、目标选择和导出一致性；保留已有 API 使用者行为。

**Non-Goals:** 不引入 Plotly，不复刻其全部布局；不加入套索/数据点框选、撤销历史、数据下载、跨页拼图或服务端导图；不改变消费者数据和注解所有权；Demo 不增加第二套外部操作按钮。

## Decisions

### 1. 工具栏配置与状态

新增 toolbar?: boolean | WaveformToolbarOptions，省略/false 关闭；true 使用 { visible: true, display: 'hover', position: 'top-right' }。对象缺省 visible=true，display 支持 hover/always，position 支持 top-right/top-left。items 为有序且去重的按钮 ID 集合，默认依次 zoom-box、pan、annotate、zoom-in、zoom-out、reset、fit、export；空数组不渲染空工具栏。export 按钮提供 PNG/SVG 两个入口。

新增 WaveformToolbar 视图模块，消费命令状态而不保存独立的缩放/注解状态。选择独立模块而非在 WaveformChart.vue 填入事件处理，以控制职责和行数。工具栏覆盖在组件内的独立 HTML 层，不改 SVG 数据坐标；顶部紧凑布局/溢出菜单保障 360px 容器可操作，不遮挡标题、分页和图例的主要交互区域。

hover 模式在指针进入、焦点位于工具栏内、菜单打开时显示；触屏按常驻处理。隐藏时无透明区域截获绘图指针，键盘仍有可聚焦的入口。提供 aria-label、aria-pressed、disabled、工具提示与 Escape 关闭菜单/取消当前拖动。visible=false 只隐藏 UI，不改变模式和外部方法。

### 1.1 内部按钮注册表与功能分组

建立类型化的内部按钮注册表，以稳定按钮 ID 为键，集中维护图标、标签/提示、功能分组、命令映射及实际状态选择器。注册表不导出为公共 API，不开放任意回调或自定义按钮注册接口；现有 toolbar.items 仍为扁平有序 ID 列表。命令映射只调用统一命令层，禁用态和高亮从同一控制状态快照派生，不在按钮配置中重复实现约束或保存模式状态。export 为菜单入口，其 PNG/SVG 子项调用相同 exportImage 能力，下载及反馈仍由工具栏负责。

默认分为三组：模式（zoom-box、pan、annotate）、视口（zoom-in、zoom-out、reset、fit）、导出（export）。组间使用间距或装饰性分隔线，不新增公共 groups 配置。先按 items 顺序去重并解析按钮，再把相邻且同组的项目组成显示组；自定义顺序优先，不按默认类别重新排序。比如 [reset, export, pan, zoom-in] 保留原顺序，形成视口/导出/模式/视口四段。空组不渲染，首尾及相邻位置不产生多余分隔线，分隔线不参与键盘焦点；窄容器折叠后仍保留项目顺序、分组辨识与功能可达性。能力禁用仍显示禁用按钮，不借分组删除消费者配置的项目。

注册表和分组不改变受控模式契约：宿主传入 interactionMode 时，点击模式按钮仅经命令层发出 update:interactionMode；requested 期间保持实际模式的高亮和 aria-pressed，宿主回传后统一更新。切换 items、布局或工具栏可见性不写入 interactionMode，不重置视口。

### 2. 命令和模式契约

新增内部命令 composable：解析目标、能力判定、执行、通知均集中处理。内置按钮直接调用命令，外部 defineExpose 使用同一入口，不通过模拟 DOM 点击触发。

保持 zoom/annotation 字面值，扩展 WaveformInteractionMode 为 zoom | pan | annotation | none。zoom-box/annotate 只是按钮 ID，分别映射 zoom/annotation。interactionMode 未提供时内部默认 zoom；提供时为受控值，用户/方法请求切换仅发 update:interactionMode，由宿主回传后生效。增加 interaction-mode-change，仅在实际生效模式改变时发一次；增加 getControlState() 和 control-state-change 提供实际模式、可用操作、当前页目标与视口快照，返回值为副本，不暴露内部可变状态。受控请求返回 requested，不提前改变按钮高亮。

setInteractionMode(mode) 返回 applied/requested/unchanged/disabled 状态。zoom 需 zoomable=true，pan 需 pannable=true，annotation 需 annotationsVisible=true；presentationMode 时交互类新命令禁用（导出仍可用）。none 禁用拖动/滚轮缩放与创建注解，不影响悬浮读取。pannable 默认 false 保留；Demo 显式打开。zoom 模式已有 Space 临时平移保留，显式 pan 无须按 Space。切换、禁用、数据替换或卸载取消活动拖动，释放指针，不提交半完成手势。

### 3. 外部接口与目标

新增导出的 WaveformChartHandle、WaveformControlTarget、WaveformControlResult、WaveformControlState 等明确类型，Vue ref 无须 any。

```ts
// 设计签名，所有 X 值以秒计量。
type WaveformControlTarget = { trackId?: string }
zoomIn(target?: WaveformControlTarget): WaveformControlResult
zoomOut(target?: WaveformControlTarget): WaveformControlResult
fitToData(target?: WaveformControlTarget): WaveformControlResult
setInteractionMode(mode: WaveformInteractionMode): WaveformControlResult
getControlState(): WaveformControlState
// 保留原数字参数签名及 void 返回；新增对象重载，不替换旧签名。
resetViewport(trackIndex?: number): void
resetViewport(target: WaveformControlTarget): WaveformControlResult
setViewportDomain(domain: [number, number], trackIndex?: number): void
setViewportDomain(domain: [number, number], target: WaveformControlTarget): WaveformControlResult
exportImage(options?: WaveformImageExportOptions): Promise<Blob>
```

新视口命令返回 { status, targets }；targets 按当前页图框顺序列出 { trackId, status, before, after }，共享范围使用单个 shared 目标。每个目标 status 为 applied | unchanged | disabled | empty-data；before/after 仅在存在有效视口时提供。命令级非法范围/未知目标返回 invalid-domain/invalid-target 且 targets=[]，不进行部分执行。其他情况下整体 status 按 applied > unchanged > disabled > empty-data 汇总：只要一个图框改变便为 applied，通过逐目标结果识别部分成功，不声称所有图框成功。当前页无图框返回 empty-data 与空 targets。模式命令不适用图框结果，使用 targets=[] 并保留 requested；公开结果类型用判别联合区分命令种类。

能力预检与执行使用同一解析/约束规则；至少一个目标可以产生变化时放大/缩小/fit 按钮可用，全部 unchanged/disabled/empty-data 时禁用。reset 是恢复意图，存在合法、非空且允许重置的目标时可点击，即使视口已在初始范围，以便宿主恢复已加载的数据。解析时保留当前页空图框以返回 empty-data，不悄悄遗漏。错误目标不静默改成全局操作。旧数字重载保持原来的边界约束、无效参数忽略、事件和禁用行为，不为了新工具栏重新定义旧接口。新命令和新对象重载遵循统一能力限制。

独立模式不指定 trackId 解析当前页全部图框并逐个判定是否可操作；指定 trackId 只作用于当前页该图框，不通过 DOM 顺序或最后悬浮推断；不存在或非当前页 ID 返回 invalid-target，不翻页。共享 X 模式为一个共享目标，新接口带 trackId 返回 invalid-target。工具栏独立模式显示“当前页全部/图框名称”目标选择，默认全部；翻页、数据变更导致目标消失或切换共享模式时回到全部。合并系列使用 trackId，未显式提供时沿用现有归一化 track.id，不新增身份规则。

模式为组件级互斥状态；指定目标控制按钮/方法视口操作。框选和平移手势沿用用户实际拖动图框的现有目标逻辑，不能因工具栏默认全部而让一次独立子图拖动影响其他子图。

### 4. 缩放、重置与显示全部

zoomIn/zoomOut 第一版调整 X 范围，以各目标当前视口中心为锚点，跨度分别乘 0.5/2；Y 维持现有状态。框选与平移沿用已有 X/Y 手势契约。所有新操作遵守 minZoomSpan、minVisiblePoints、maxZoomScale 等约束，到边界返回 unchanged，不累积越界 transform。

reset 恢复消费者 initialXDomain/initialXDomains 与已有 Y 重置规则；fit 使用当前 data 完整规范化源中的可见系列计算范围，遵守 xDomainStrategy 的显示扩展，恢复自动 Y 域，显式固定 yDomain/yDomains 优先。fit 不读取采样后的 SVG 点，也不恢复宿主尚未加载的数据。没有可见有效系列返回 empty-data。

fit 与初始范围不同，不能简单调用 reset：当初始窗口 [2,8]、完整数据 [0,10] 时 fit 能显示全量。每个独立图框或共享 X 视口分别维护 initialBoundary 与 effectiveBoundary；后者初始等于前者，fit 后等于完整可见数据按 xDomainStrategy 扩展的范围。

所有后续滚轮、框选、平移、新命令、坐标映射、D3 transform 同步、scaleExtent 与 translateExtent SHALL 共用 effectiveBoundary，不能只修改按钮路径。更新边界时用当前数据域重投影 transform，禁止原 transform 直接套用新基础比例尺。maxZoomScale 和未配置约束时的 40 倍兜底均以当前 effectiveBoundary 跨度为基准；例如 maxZoomScale=10，fit 前跨度 6 的最低跨度为 0.6，fit 后跨度 10 则为 1，再与 minZoomSpan/minVisiblePoints 取最严格约束。

reset（新旧入口均如此）恢复 initialBoundary、原初始 X/Y 视口并撤销对应目标的 fit 状态；分页/显示模式切换按既有视口重置规则同时清理相应适配边界。data 引用、可见系列或初始域配置改变时废弃旧 fit 状态和边界，使用新 initialBoundary 约束/重投影此前视口，不沿用旧数据的范围；隐藏页不得保留会污染新页的边界。

旧 setViewportDomain 数字重载仍按旧 initialBoundary 判定请求合法范围；若此前执行过 fit，应用这个旧入口时先退出对应目标的 fit 状态，恢复旧比例尺再换算，保持旧限制。新增对象重载遵循 effectiveBoundary。不配置工具栏且不调用新 fit 时所有既有缩放语义不变。

### 4.1 逐命令事件协议

现有 zoom-change 的 [start,end] 格式不变；原 wheel/box 手势的 gesture 和事件次数不变。为新命令扩展 zoom-intent/zoom-end 的 gesture 联合，增加 'command'，不得伪造 wheel 或 box。新命令的 intent/end/reset 载荷增加 commandId（同次调用、多目标共享）、source: 'toolbar' | 'api'、action: 'zoom-in' | 'zoom-out' | 'set-domain' | 'fit' | 'reset'；字段对旧事件保持可选，原数字重载不新增通知。此联合扩展须记录在 README：穷举 wheel/box 的消费者需要处理 command；包声明测试覆盖此新分支。

| 新命令/状态 | 每个目标的事件顺序 | 宿主处理规则 |
|---|---|---|
| zoomIn/zoomOut/对象 setViewportDomain，applied | zoom-intent → zoom-change → zoom-end，各一次 | intent 用于需要提前加载的宿主；end 表示本次本地视口已提交 |
| fit，applied | zoom-change → zoom-end，各一次，end.action='fit' | 不发 intent/reset；宿主加载器忽略 fit，不因此恢复或请求未加载数据 |
| 对象 reset，合法非空且可用目标，applied 或 unchanged | zoom-reset，一次；不发 intent/change/end | 表示用户恢复初始数据的意图，即使本地视口无变化也必须允许宿主重载 |
| zoom/fit/set-domain 的 unchanged，或 invalid/disabled/empty-data | 不发上述操作事件 | 返回逐目标状态，不触发加载 |
| 模式切换 | 受控请求 update:interactionMode；实际改变后 interaction-mode-change | 不发缩放事件 |

命令先解析全部目标并计算不可变 before/after 快照，一次提交状态，再在同一调用内按当前页顺序逐目标发上述通知；intent 在 Vue 渲染稳定前发出。事件载荷来自同一命令快照，不在事件回调之间重新读可能被宿主替换的数据。旧数字 reset/setViewportDomain 仍保持现有静默行为；双击仍保持原 zoom-reset 行为。

control-state-change 在实际控制状态变化后按 Vue 更新批次合并，包含新的状态快照，不作为额外数据请求入口。applied 指本地状态已提交，不承诺 Worker 已采样结束；导出自行等待稳定版本。

宿主必须选择 intent 或 end 作为单一加载入口，不能同时把两者当作新请求；README 分别提供两种集成。Demo 沿用 zoom-end 加载，忽略 action='fit'，zoom-reset 负责取消在途请求/恢复首次完整数据，避免两次加载。多目标只为 applied 目标发缩放成功事件；reset 例外按其恢复意图规则通知合法可用目标。

### 5. 图片导出

exportImage({ format: 'png' | 'svg', scale?: number, backgroundColor?: string })，默认 PNG、scale=1、背景使用当前图表解析后的背景。scale 仅影响 PNG 像素尺寸，不重新采样或改变坐标，限定有限正数且不超过 4；SVG 不接受非默认 scale。返回 Blob，不自动下载。工具栏调用该接口后下载 waveform.png/svg，释放 URL；不增加文件上传或服务端依赖。

导出当前页当前视口、可见系列、标题、坐标轴、图例、网格、误差条和注解。工具栏、分页、hover、选区蒙层、菜单及编辑弹窗不导出。通过图表 SVG 的专用快照层注入计算样式并自包含；图例使用 SVG 可序列化元素重绘，避免依赖 foreignObject 在 PNG 中的浏览器差异，不对整个页面截图。动态文本按文本节点处理，不拼接消费者 HTML。字体等待 document.fonts.ready；无远端图片抓取，不添加依赖前先验证原生 SVG→Canvas 路径。

捕获调用时 data 引用/视口/可见性/注解/布局版本，等待该版本的采样和 Vue 渲染稳定后生成图片；已有 wasm/error 同步占位路径属于可导出画面。等待期间状态改变则拒绝 export-stale，而不是混用新旧状态；卸载为 export-cancelled；采样/字体等待总超时 5s 为 export-timeout。无有效曲线但尺寸有效时允许导出空坐标系；零尺寸/无 DOM 为 export-unavailable，非法选项为 export-invalid-options，Canvas 编码失败为 export-render-failed。错误为含 code/message 的 Error；工具栏显示失败反馈且恢复可用，不产生未处理 rejection。单次只执行一个导出，重复调用拒绝 export-busy；所有路径释放临时节点、Canvas、Blob URL 和监听。

### 6. Demo、文档和验证

在现有综合 Demo 的 DemoChartHost 中保留 interactionMode 受控状态，显式接入 update:interactionMode 回写 App 的 ref（或等价 v-model 链路），不只打开 toolbar 而保持原单向绑定；点击后必须观察到实际模式/高亮改变。WASM 示例若未绑定模式 prop，使用非受控模式。两个示例显式启用所需 pannable/annotationsVisible，保留既有注解更新回传。

移除 DemoViewControls 中重复的外部“重置视图”按钮，以及与工具栏重复的交互模式操作入口（若存在）；保留底层 resetWaveformViewport 数据恢复处理与其 zoom-reset 绑定。不得新增独立外部放大、平移或导出按钮。Demo 参数区保留工具栏 visible 开关，显示方式可在该区配置；参数配置不算第二套操作栏。README 解释 toolbar 默认关闭、受控模式、稳定目标、返回值、导出异常及 ref 外部调用示例；同步 src/index.ts 与组件入口声明。

选择“UI + 命令共用层”而非只提供 UI 或只提供 ref 方法，满足两种集成且便于无 DOM 测试。新增模块按交互、工具栏呈现和导出职责分离，不依赖未提交的 niceScale 或部署改动。

## Risks / Trade-offs

- [受控模式无法立即生效] → 明确 requested 与实际状态，宿主回传前不改高亮，不产生循环事件。
- [初始边界挡住 fit] → 分离 fit 边界，覆盖初始范围小于/大于数据域、reset 和数据替换。
- [多图框误操作] → 当前页目标可见、稳定 ID，未知目标显式失败；旧索引重载保留。
- [SVG/PNG 样式或图例丢失] → 导出层自包含，浏览器实际解码 PNG/单独打开 SVG 并比对，而非仅检查 Blob 大小。
- [高密度采样尚未稳定或图片尺寸过大] → 版本校验、超时、scale 上限和清理测试；不宣称跨浏览器像素完全相同。
- [工具栏遮挡与误触] → 360px 容器和 1280×800 浏览器验收、指针隔离、键盘与触屏行为测试。

## Migration Plan

先冻结类型/兼容测试，再实现命令和目标、模式、工具栏、导出，最后 Demo/README 和完整验收。既有数字方法和默认界面无需迁移；省略 toolbar 不出现 UI。穷举 interactionMode 或 gesture 联合的类型消费者需适配新增字面值，README 须给出迁移说明。新类型与文档随功能同批交付。回退时删除新配置/调用即可恢复旧使用方式，不改变数据或注解格式。

本次仅交付文档；任务保持待执行。实施前记录工作区差异，保留无关改动，不自动提交、推送、发布或归档。验收通过后再讨论归档。
