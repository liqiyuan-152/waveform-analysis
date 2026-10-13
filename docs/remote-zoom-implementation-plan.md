# 按可视范围远程加载的实施计划

## 目标与依据

借鉴 ECharts dataZoom 的窗口模型，在现有 Vue + D3 组件上实现：稳定的记录全域、
以实际坐标表示的可视窗口、范围事件驱动的异步加载，以及数据更新后保持窗口。
请求、缓存、加载状态和错误处理属于消费组件；图表负责交互、范围约束和渲染。

参考：
- https://github.com/apache/echarts/blob/master/src/component/dataZoom/DataZoomModel.ts
- https://github.com/apache/echarts/blob/master/src/component/dataZoom/InsideZoomView.ts
- https://github.com/apache/echarts-doc/blob/master/zh/option/component/data-zoom.md

ECharts 没有在这里提供内置远程加载器，本计划中的 HTTP 协议与请求调度是业务层设计。

## 当前基础

- `App.vue` 固定 `initialXDomain`，用本地筛选及 80ms 延迟模拟后端结果。
- `DemoChartHost.vue` 仅接入 `zoom-end` 和 `zoom-reset`，没有远程平移加载。
- 组件已有 `zoom-intent`、`zoom-change`、`zoom-end`、`pan-end` 事件。
- `panXDomain` 已参与远程缩放、平移边界和数据回填后的视窗恢复。
- 当前工作区已有相关未提交修改，实施前记录差异并保留这些修改。

## 第一步：固定范围与缩放规则

业务层分别保存：
- 记录全域 `recordDomain`：来自记录元数据，传给 `panXDomain`。
- 初始及重置窗口 `initialDomain`：传给 `initialXDomain`，允许只是全域的一部分。
- 当前视窗 `visibleDomain`：由图表事件更新。
- 已加载覆盖范围 `loadedDomain`：来自响应，允许比当前视窗大。

全域和初始窗口不随每次数据响应变化。所有端点与事件值使用秒。
远程示例使用 `integerZoom: false`、`xDomainStrategy: { type: 'data' }`，避免显示单位
或初始范围取整改变请求窗口；现有默认行为保持兼容。

采用实际跨度限制：`minZoomSpan` 来自固定元数据，而不是当前返回点数。
等间隔采样若最少显示 N 点，则跨度至少为 `(N - 1) * sampleIntervalSeconds`。
不等间隔数据由后端提供最小跨度，或由业务明确配置。
远程示例设置 `minVisiblePoints: 0`，不让后端抽稀密度决定可否继续放大。
`maxZoomScale: null` 可关闭默认倍率上限；有显式倍率限制时保持相对初始域的既有含义。

检查 `useWaveformZoom.ts`、`remoteViewport.ts`、`zoomConstraints.ts` 和
`useWaveformViewportRestore.ts`：未加载窗口仍可缩放；只按记录边界夹紧；回填不重新
根据返回点数收缩 X 视窗。只有回归测试证明存在缺口时才修改组件。

验收：相同目标窗口在返回 3、300 或 30000 个点时保持相同 X 范围；
进入空白窗口后仍可继续缩放、平移和缩小。

## 第二步：定义可替换的数据加载协议

在 demo 层定义 `loadWindow(request, signal)` 注入接口，提供 HTTP 实现和可取消的模拟实现。
真实后端地址通过消费页面配置，不写死到图表库。

请求建议包含：`recordId`、`start`、`end`、`seriesIds`、`maxPoints`。
其中 `maxPoints` 是业务可配置的返回预算；记录及通道标识参与请求与缓存键。
响应包含：记录标识、覆盖范围、带稳定 ID 的系列数据，以及必要的数据版本标识。
允许空结果，验证端点有限、范围有效、系列身份及坐标合法。

若后端抽稀，明确该响应是当前可用的数据精度；前端渲染抽稀继续保留已加载数据的完整
查询能力。精确悬浮、标注或误差范围若需要未返回的原始点，由业务另行加载，不能把
后端聚合点当作完整原始数据。

验收：同一消费逻辑可切换模拟加载器与 HTTP 加载器，不修改图表组件。

## 第三步：实现请求调度与过期保护

新增 demo composable，例如 `src/demo/useRemoteWaveformWindow.ts`，从 `App.vue`
移出模拟请求、序号与合并逻辑，控制文件不超过 450 行。

默认采用手势结束加载：
- `zoom-intent`：立即使相关目标的旧请求失效并调用 AbortController.abort()。
- `zoom-change`：跟踪当前范围；平移期间使旧结果失效。
- `zoom-end`：按最终范围发起一次请求；复用现有滚轮 200ms 结束防抖。
- `pan-end`：按最终平移范围请求；不依赖 `zoom-end`。
- `zoom-reset`：取消旧请求、恢复初始窗口，并加载初始范围。

暂不增加“交互过程中持续请求”模式，避免同一窗口由 intent/end 重复加载。
AbortController 与请求版本检查同时使用；即使取消未生效，旧响应也不能提交。
版本在用户产生新意图时更新，不等下一次请求真正发出。
检查响应时同时比较记录、目标、请求版本与目标窗口。

独立图框按稳定 seriesIds/track 身份维护请求版本和状态，不能依赖易变的 trackIndex。
共享 X 模式作为一个加载目标；独立图框只替换相关系列。
现有 zoom-change 缺少目标元数据时，第一版可保守使所有在途请求失效，避免错误回填；
不为了优化并发立即破坏现有事件签名。同 commandId 的多目标命令正确收集全部目标。
切换记录、页面销毁和重置时取消请求并清理待提交状态。

验收：A 请求慢、B 请求快，以及 A 请求期间开始新手势但尚未结束时，A 均不能覆盖新状态。
两个独立图框的有效响应可以分别合并；隐藏状态、标注和其他系列保持稳定。

## 第四步：接入可验证的远程 demo

修改 `DemoChartHost.vue`、`src/demo/types.ts` 和 `App.vue` 接入上述事件与全域边界。
展示 loading、错误和重试；错误时保持当前目标视窗，不把旧缓存伪装成新范围的数据。
未覆盖的区域显示空白，空响应也不重置视窗。

首次加载采用记录元数据 + 初始窗口请求，避免浏览器预载整条高密度记录。
模拟加载器支持延迟、乱序、空响应、失败与不同返回密度；HTTP 加载器接真实接口后联调。
第一版仅提供同目标、同窗口、同数据版本和同预算的精确缓存命中；预取与区间合并缓存后续实现。

验收：桌面和小容器中完成滚轮、框选、平移、重置、重试；共享 X 与独立图框均可运行。

## 第五步：回归、文档与交付

组件测试在 `tests/components/waveformChartCases/` 下扩展已有 remotePan、
remoteZoomConstraints、zoomIntentAndDataRebind 和 threePointRemoteZoom 用例。
新增 demo 加载器测试，覆盖取消、乱序、手势开始失效、空响应、失败重试、卸载、记录切换、
多图框合并与 commandId 批次。

重点回归：
- 未加载窗口可以操作；连续回填不累计放大或改变全域。
- 小数秒端点不因 ms/s 显示切换而改变。
- 远程示例最小跨度只取固定元数据；现有本地 minVisiblePoints 行为继续通过。
- 回填不产生额外用户缩放事件或重复请求。
- Y 轴固定范围、框选后的 Y 视窗、标注和隐藏系列状态遵守现有合同。

更新 README 的完整接入例子，解释 initialXDomain 与 panXDomain 的区别，以及事件时机。
若最终确需新增公开类型或事件，同步更新 src/index.ts、类型导出链、文档和测试。

使用 Node 22、pnpm 10.32.1。先运行最近的测试，再运行：
`pnpm typecheck`、`pnpm check:file-length`、`pnpm lint`、`pnpm test:coverage`、
`pnpm build`、`pnpm pack --dry-run`。
覆盖率至少为行/语句/函数 80%、分支 75%。
浏览器核验可复用组件与远程 demo，记录桌面和小容器结果；真实接口联调作为独立验收项。

## 实施顺序与完成条件

按“规则回归 → 加载协议 → 请求调度 → demo → 全量验证”顺序实施。
无需引入 ECharts 依赖，第一版优先复用现有公开 API。
计划制定已完成；尚未执行代码修改、测试或真实后端联调。
只有真实 HTTP 请求按最终视窗加载、过期响应无法提交、回填视窗稳定、相关检查通过后，
才认定远程缩放功能完成。
