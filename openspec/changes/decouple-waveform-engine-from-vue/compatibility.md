## Native Export Evidence

9.1–9.4 已验收：`tests/export/ChartExporterLifecycle.test.ts` 覆盖字体补帧、选项捕获、超时、尺寸/版本变化与取消后晚到；`ChartExporter.test.ts` 覆盖并发/错误码/resize。`nativeAnimation.test.ts`、`nativeSampling.test.ts` 验证动画与 Worker 采样中更新数据的 stale/重试及最终绘制等待。

`SvgExporter.test.ts` 覆盖完整尺寸、中文标题、内联绘制属性、图例转换、片段引用、隐藏标题、owner-document、当前页/可见系列与标注。旧 chartSnapshot/snapshotTitle 路径委托同一框架无关类，无重复快照业务。`PngExporter.test.ts` 19 项覆盖缩放、非法值、解码/context/draw/编码失败、并发、取消/晚到和 chart resize/timeout/dispose 清理。

`evidence/native-export-browser.json` 的 Chromium/Firefox/WebKit × 1200/360px × 三模式共 18 组 SVG 独立打开与 2 倍 PNG 解码通过；每浏览器另验证编码失败反馈、按钮恢复、SVG/PNG 真实下载和 URL 回收，无 pageerror。实例 API 不自动下载；图片尺寸按真实内容区计算。截图和原始 SVG/PNG 位于 `native-export-*`；此证据不替代系统色板、性能/内存验收或框架入口切换。下文工具栏 8.5 中留到 9.1–9.4 的导出项已由上述证据补齐。

## Purpose

本表追踪既有公共契约及对应测试/浏览器证据。最新实施与验收结果见文末、[implementation.md](implementation.md) 和 tasks.md；历史阶段记录保留原状态，不代表最终入口仍待切换。

原始签名、默认值和序列化快照见 [public-api-baseline.json](evidence/public-api-baseline.json)。全部 134 个原始 symbol 的当前源码及验证关联见 [symbol-inventory.md](symbol-inventory.md)。该索引区分直接测试引用与所属能力/声明检查，不能用类型导入成功代替业务行为验收。

## Props

Vue props 默认解析以 src/adapters/vue/WaveformChart.vue、src/types/options.ts 和各 resolver 为依据；原生 options 保留对应名称。嵌套字段全部以 src/types 与现有 resolver 为基线，不仅核对下表顶层名称。

| 字段                                                                                      | 默认/关键契约                                  | 验证目标                                                                                                                        |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| data                                                                                      | Vue 必需；原生 init 可缺省为空；引用替换刷新   | dataLifecycle、typed/空/无效数据                                                                                                |
| toolbar                                                                                   | 默认关闭；boolean/object                       | toolbarControls、toolbarLifecycle                                                                                               |
| displayMode / overlayMode                                                                 | independent / single-axis                      | multiAxisAndPagination、layoutAndDomains                                                                                        |
| unitDisplayMode / layoutPreset                                                            | axis / default                                 | channelLabelLegend、unitDisplayMode、edgeCompactLayout                                                                          |
| width / height                                                                            | 自动容器尺寸，原最小高度 180px                 | sizingAndTitles、隐藏恢复、宿主样式                                                                                             |
| xLabel / yLabel                                                                           | xLabel 可选；yLabel 幅值                       | plotLabelCenter、标签显隐                                                                                                       |
| lineColor                                                                                 | #0960bd                                        | 系列样式与显式颜色优先级                                                                                                        |
| showTooltip / zoomable / integerZoom / pannable                                           | true / true / false / false                    | hover、integerZoom、viewportBoxAndPan                                                                                           |
| panXDomain                                                                                | 可选远程秒坐标边界                             | remotePan、remoteEmptyWindow                                                                                                    |
| minZoomSpan / minVisiblePoints / maxZoomScale                                             | 可选 / 0 / 可选及 null 语义                    | viewportConstraintsAndReset、zoomPointConstraints                                                                               |
| initialXDomain / initialXDomains / xDomainStrategy                                        | 可选 / 可选 / integer-ms                       | xDomainStrategy、viewportLifecycle                                                                                              |
| amplitudeLimits / yDomain / yDomains                                                      | 可选，限制/固定域优先级保持                    | amplitudeLimits、yAxisPaddingLifecycle                                                                                          |
| timeUnit                                                                                  | ms，仅显示                                     | xAxisTicks、fractionalIntegerZoom                                                                                               |
| frameNumber / frameNumbers / frameStyle                                                   | 可选，按 trackId 覆盖水印与边框                | compactFrames、frameGridAndFormatting                                                                                           |
| axes                                                                                      | 可选，嵌套刻度与端点规则保持                   | extremaTicksVisibility、yAxisMinimumTicks、yAxisLabelStyle                                                                      |
| annotations / annotationsVisible                                                          | [] / true；标注始终由宿主持久化                | annotationEditingAndReprojection                                                                                                |
| interactionMode                                                                           | undefined，内部初始 zoom                       | toolbarControls、受控请求/解除控制                                                                                              |
| grid                                                                                      | rowCount 2、columnCount 1、showPagination true | gridFill、lastPageEmptyFrames                                                                                                   |
| rendering                                                                                 | {}，解析采样默认值保持                         | samplingLifecycle、workerSamplingIntegration                                                                                    |
| plotMargin                                                                                | {}，原边距 resolver 保持                       | edgeCompactPlotBudget、layoutAndDomains                                                                                         |
| title / legend                                                                            | title 可选；legend top-right/auto              | sizingAndTitles、legendVisibility                                                                                               |
| hiddenSeriesIds / defaultHiddenSeriesIds                                                  | 受控可选 / [] 且仅初始化                       | legendVisibility、trackOrder、解除控制                                                                                          |
| cleanView / presentationMode                                                              | false / false                                  | presentationMode、presentationAndAxes                                                                                           |
| zeroLine                                                                                  | visible true，其他默认沿用 resolver            | zeroLineRules                                                                                                                   |
| animationEnabled / animation / animationUpdate / animationAnnotation / animationThreshold | true / 各 preset 与 controller 默认            | animationIntegration、paginationAnimation；nativeAnimation/nativeAnimationWindow、三浏览器实例动画（标注动画证据见第 8.3 阶段） |

以上测试目标是现有 chart cases 的文件名或需新增的行为，不是运行结果。原组件声明与矩阵逐字段校验，防止新增 props 漏入矩阵。

## Events

原生事件与 Vue emits 名称一一对应；采用参数元组映射，handler 接收展开参数，适配使用 emit(event, ...args)。所有业务类型保持既有定义，不能改为单个对象后声称兼容。

| 事件                     | 参数元组                                                       |
| ------------------------ | -------------------------------------------------------------- |
| update:interactionMode   | [mode: WaveformInteractionMode]                                |
| interaction-mode-change  | [mode: WaveformInteractionMode]                                |
| control-state-change     | [state: WaveformControlState]                                  |
| point-hover              | [point: WaveformPoint 或 null]                                 |
| zoom-intent              | [payload: WaveformZoomIntentPayload]                           |
| zoom-change              | [domain: [number, number]]                                     |
| zoom-end                 | [payload: WaveformZoomEndPayload]                              |
| pan-end                  | [payload: WaveformPanEndPayload]                               |
| zoom-reset               | [payload: WaveformZoomResetPayload]                            |
| update:annotations       | [annotations: WaveformAnnotation[]]                            |
| update:hidden-series-ids | [ids: string[]]                                                |
| series-visibility-change | [payload: { seriesId, visible, hiddenSeriesIds }]              |
| annotation-create        | [annotation: WaveformAnnotation]                               |
| annotation-update        | [annotation: WaveformAnnotation, previous: WaveformAnnotation] |
| annotation-delete        | [annotation: WaveformAnnotation]                               |
| page-change              | [page: number, pageCount: number]                              |
| sampling-complete        | [diagnostics: WaveformSamplingDiagnostics]                     |
| sampling-backend-change  | [payload: { seriesId, previous, current }]                     |
| sampling-error           | [error: WaveformSamplingError]                                 |
| rendered（新增）         | [payload: { revision: number }]                                |
| finished（新增）         | [payload: { revision: number }]                                |

既有事件顺序、次数、静默旧方法路径、受控请求/实际变化差异以工具栏已完成规格及当前测试为基线。Vue 薄适配同时转发 rendered/finished；原有事件名与参数元组保持兼容。

## Methods and Exports

| 公共面                                                                                          | 兼容要求                                                                                 | 验证                                     |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| zoomIn / zoomOut / fitToData                                                                    | 保留 trackId target、结果状态与逐目标快照                                                | controls 命令回归与类型用例              |
| resetViewport / setViewportDomain                                                               | 保留旧数字路径和对象重载的事件/结果差异                                                  | viewportReset、类型重载用例              |
| setInteractionMode / getControlState                                                            | 保留 applied/requested/disabled/unchanged 与快照隔离                                     | 受控模式及快照测试                       |
| exportImage                                                                                     | Promise<Blob>、PNG/SVG、scale/background 与既有错误码                                    | 稳定等待、浏览器解码                     |
| Vue WaveformChart / WaveformChartProps / WaveformChartHandle                                    | 组件移到 /vue；旧 props 类型和 handle 类型保持可获得且无框架类型污染                     | Vue 导入迁移及声明检查                   |
| 当前 src/index.ts 的数据、动画、采样、WASM、格式化、几何、标注序列化及类型出口                  | 根原生入口保留所有既有无框架出口及符号身份，不改公开名称/签名                            | 实施时生成完整 symbol 清单并逐项对比声明 |
| init / getInstanceByDom / dispose / setOption / on / off / resize / dispatchAction / isDisposed | 新增原生 API；initOptions 与业务 options 分离，dispatchAction 为同步控制动作，不包含导出 | 类型、生命周期、跨入口身份测试           |

## Controlled Transitions

测试每种字段的 init 缺省、受控更新、请求未回传、回传生效、显式 undefined、字段移除和数据替换；验证 annotations 永远不自动持久化，hiddenSeriesIds/interactionMode 恢复原内部状态。defaultHiddenSeriesIds 后续更新不重置集合。

## Evidence

Vue 10.2：`tests/adapters/vue` 验证全部 21 个事件完整参数元组、监听器更新、受控请求/确认、移除字段和销毁；旧 chart cases 已全部纳入最终完整覆盖率。`evidence/vue-adapter-coverage-final.txt` 记录 Node 22.23.2/pnpm 10.32.1 的 `pnpm test:coverage --maxWorkers=2 --testTimeout=20000`：201 文件/1765 项通过，statements 90.66%、branches 84.66%、functions 90.74%、lines 93.03%。`vue-adapter-browser.json` 三浏览器两尺寸三模式 18 组适配接线通过；独立旧实现仍由 LegacyWaveformChart 提供，不能将适配器与自身原生内核比较视为旧版视觉证据。标题、隐藏轴、frame dash、图例误差样式、formatter 动态替换差异已经修复；常驻隐藏/空图层属于内部 DOM 差异，兼容断言检查实际内容可见性。

Vue 版本消费：`vue-adapter-package-current.txt` 验证 Vue 3.5.40/TypeScript 6.0.3；`vue-adapter-minimum-historical-package-current.txt` 验证 Vue 3.2.33/TypeScript 4.7.4。均隔离安装 tarball、严格声明、ESM/CJS 入口身份、SSR 和必需 props/handle/事件参数类型。Vue 3.2.33 与 TypeScript 6 的组合失败于 Vue 自身声明，不标通过。最新调度/声明/夹具迁移后的两版本隔离消费亦通过，见 legacy-relocation-vue-package-current.txt 与 legacy-relocation-vue-minimum-package-current.txt；10.5 已完成，最终入口与版本策略仍待 10.6–10.7。

标注 8.1：`tests/chart/nativeAnnotationModel.test.ts` 覆盖受控 CRUD、完整参数元组、输入和事件快照隔离、回调内确认/销毁及序列化重导出身份；`nativeAnnotationController.test.ts` 覆盖草稿、全量 typed 数据候选、独立第二列本地坐标和编辑前值；`nativeAnnotations.test.ts` 对照三模式几何并验证偏移请求、同步确认、重投影、隐藏系列、菜单删除与取消。`nativeInteractionWindow.test.ts` 验证跨窗口标注捕获/帧/监听清理。`evidence/native-annotations-browser.json` 记录三浏览器两尺寸三模式共 18 组平台拖拽/重投影/隐藏/删除对照；此项仅证明模型/视图与拖拽；DOM 编辑器另由 8.2 验收，颜色/透明度、标注动画与完整浮层焦点尚属 8.3–8.4。

标注 8.2：`tests/chart/nativeAnnotationEditor.test.ts` 的 30 项用例覆盖文本限制/trim、秒与毫秒时间校验、全量吸附、系列选择、最新数据与未提交输入保留、受控替换/new-previous 元组、跨窗口和销毁。`evidence/native-editor-browser.json` 记录三浏览器两尺寸三模式 18 组 Vue/native 编辑/创建对照及 6 组原生第二列修正验证；此时颜色 UI 尚未接入，完整颜色与动画另由 8.3 验收。

采样 6.3：`tests/sampling/RenderSamplingController.test.ts`、`tests/data/WaveformDataManager.test.ts`、原生 hover 用例与 `nativeAnnotationEditor.test.ts` 的 10001 样本组合用例证明几何未绘制的极值仍服务域、hover/tooltip、误差和标注；验证原输入与误差数组不变。完成依据见 `evidence/native-editor-coverage-current.txt`（190 文件/1665 项），构建/声明与无框架消费见 `native-editor-build-current.txt`、`native-editor-package-current.txt`。

标注 8.3：`tests/chart/nativeAnnotationAnimation.test.ts`、`tests/controls/ColorInputView.test.ts` 与编辑器新增样式用例验证颜色/alpha、原值保留、零 alpha 色相、小数 RGB、四预设、等待系列、离场快照/恢复、finished 与同步回调销毁；`evidence/native-colors-browser.json` 记录 18 组颜色/18 组动画/3 组 reduced-motion。允许控件内部外观变化：原生色板 + 内联精确色值/alpha 替代旧第三方弹层，平台字体/控件尺寸不同；截图 `native-colors-*.png`。平台色板 Esc 层级与多弹窗的补充验收见下文 8.4。

实施阶段逐项追加测试位置、运行命令、结果或浏览器截图路径。阶段切换前不得留未映射公共字段/事件/方法；没有证据的条目仍为未完成。

浮层 8.4 的已验证部分：`tests/controls/ModalController.test.ts`（9 项）、`AnnotationContextMenu.test.ts`（6 项）、旧 Vue/modal 与原生 editor/owner-window 回归覆盖下层精确字段恢复、逆序销毁、文档隔离、宿主 overflow longhand/important 与滚动条补偿、popup-first Esc、监听与残留按钮清理。`evidence/native-floating-browser.json` 的三浏览器两尺寸 6 组验证 native/native 与 native/Vue 栈、Vue 色选 popup Esc 层级、菜单键盘操作、Tab/禁用项、焦点/滚动锁与卸载。Mac 解锁后已补验真实 Chrome 色板：第一次 Esc 保持编辑器且焦点回到颜色输入，第二次 Esc 关闭编辑器并恢复标注按钮焦点、宿主滚动样式；见 native-system-palette-checks.json 与 native-system-palette-focus-restored.png。8.4 已完成。

工具栏 8.5：`tests/chart/nativeToolbar.test.ts` 及 `tests/controls/ToolbarDownloadController.test.ts` 验证顺序/分组、受控实际高亮、source toolbar、目标重置、disabled 与小容器折叠、busy/失败恢复和 URL/link 清理。`evidence/native-toolbar-browser.json` 的三浏览器两尺寸三模式 18 组完整比较命令/control 参数元组、按钮能力/目标和分页，toolbar 边界差均不超过 1 CSS px；另 3 组 hasTouch 的 tap 展开/切换通过，未替代物理设备验收。截图 `native-toolbar-*.png`；完整导出内容、PNG 解码与失败浏览器恢复仍留 9.1–9.4。

DOM ref 示例 10.3/10.4：React/Vue/vanilla × Chromium/Firefox/WebKit 共 9 组完整示例通过，证据见 `evidence/native-examples-browser.json`。覆盖最新回调、Strict Mode、受控模式/显隐/标注、真实 SVG/PNG 下载、双实例和导出中卸载；桌面及 360px 截图已保存。WebKit 隐藏图例的 opacity hit-testing 问题已修复，采用文字/图形 alpha 保持真实点击可用。README 补齐事件元组、配置替换、SSR 和资源清理说明；完整示例通过公开声明类型检查。

Worker transport 复用及空视口恢复优化后的全量覆盖率使用两个 worker，203 文件/1804 项通过；statements 90.73%、branches 84.76%、functions 90.73%、lines 93.06%，见 native-empty-restore-coverage-final.txt。全局超时仍为 5 秒，整页 demo 初始范围的三项集成用例显式为 10 秒，覆盖率与生产性能门槛不变。资源销毁三浏览器各 30 轮在 Worker 复用后再次通过，66 个图表各只创建一个 Worker、最终资源回到基线，详见 native-resources-browser.json；Firefox/WebKit 的堆指标不可获得，不标为零。完整性能矩阵的失败与专项复测见 implementation.md，最新完整矩阵仍待通过。

采样预备改为布局元数据、绘制按需生成几何后，最新全量覆盖率为 203 文件/1805 项通过；statements/functions 90.73%、branches 84.78%、lines 93.06%，见 native-lazy-geometry-coverage.txt。该版完整构建/打包、无框架 ESM/CJS/SSR/严格声明、Vue 当前及最低版本、三浏览器 9 组示例、手势、导出和 30 轮资源生命周期均通过（native-lazy-geometry-*.txt）。完整性能的新方法与历史失败分别记录在 acceptance.md/implementation.md，不能将不同稳定终点或轮间清理方法的统计混算；最终根入口仍未切换。

元数据消费完整版另补数据重绑/同步查询回归，最新已完成全量为 203 文件/1806 项，覆盖率 statements/functions 90.73%、branches 84.78%、lines 93.06%（native-metadata-consumers-coverage.txt）；对应构建、隔离消费、三浏览器示例/手势/导出/资源均通过，见 native-metadata-consumers-*.txt。该版完整性能仍有两项大数据初始化 P95 超阈值，见 native-performance-metadata-consumers-complete.json；入口未切换。后续 Worker 提前启动优化的全量验收须另行记录，不能沿用本条结果。

## Final Native Entry Verification

最终根入口已切换为原生 API；/native 仅重导出根入口，Vue 组件从 /vue 导入。symbol-inventory.md 重新生成并确认 134 个原始出口：Vue 组件迁至 /vue，其余 133 个工具/类型在 root 与 /native 解析为同一 TypeScript symbol。原生运行时/声明/CSS 边界 191 模块通过；历史 Vue 业务实现仅存于测试夹具，不进入公开产物依赖图。

切换前同一内核的完整覆盖率为 204 文件/1815 项，statements 90.76%、branches 84.83%、functions 90.78%、lines 93.08%，动画核心独立阈值通过，见 native-pipeline-coverage.txt；全局 5 秒与三项完整 demo 的显式 10 秒约定不变。完整性能 18 场景通过，6 个双方一致的 raw 资源上限场景另记，未降低 20%/5ms 门槛，见 native-performance-pipeline-complete.json。三浏览器资源生命周期、导出、示例均复测通过，见 native-pipeline-*-browser.json。

入口切换后 5 文件/35 项公共类型、实例及 Vue 适配测试、完整 build/test:package、ESM/CJS 根入口与别名全部运行时导出身份、严格声明/无框架依赖/SSR、Vue 3.5.40 与 3.2.33 消费、三浏览器 Vue 适配及 9 组 React/Vue/vanilla 示例均通过，见 native-final-entry-tests.txt、native-final-package.txt、native-final-native-consumer.txt、native-final-vue-consumer.txt、native-final-vue-minimum-consumer.txt、native-final-vue-browser.txt、native-final-examples-browser.txt。真实 DOM 打包测试验证双向初始化/查询/销毁共享注册表；同格式同包实例保证不扩展至 ESM/CJS 混用或多包副本。

README 已说明破坏性组件 import 迁移、原生 DOM 用法及 0.2.0-rc.1→0.2.0 建议；package.json 保持 0.1.77，不自动发布。浏览器系统色板差异与 Firefox/WebKit 不可获得的堆指标保留既有验收边界。
