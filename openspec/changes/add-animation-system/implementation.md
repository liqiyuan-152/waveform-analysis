## Status

2026-10-13 最终收尾：D3 默认字符串候选已归档并撤回，正式路径缓冲逐字节恢复。全套136文件/1107测试及全部门禁通过，最终gzip ESM/CJS增量12,012/11,834 bytes，均满足修订后的 <15,000 bytes 条件。恢复后的生产指纹与完整FPS、物理矩阵和原生Safari证据一致，原始报告审计通过；10.4/10.5按修订条件完成。原物理10/20MB和gzip10KB目标未达的事实保留为已知限制；原生移动端已移出范围。见 evidence/final-acceptance-verification.json。

2026-10-13 性能验收调整（用户授权）：gzip 增量改为每种格式 <15,000 bytes；物理内存 <10/<20MB 保留为非阻塞优化目标，验收改为完整测量披露及资源生命周期约束。原生移动端移出本次范围。历史未达标结果不改写为通过。最后的 D3 默认字符串候选仍未定案，因此本次不勾选 10.4/10.5、不宣称最终源码已完成全部验证。详见 evidence/performance-acceptance-decision.md。

2026-10-13 范围更新：用户明确“不考虑移动端”。原生 iOS/Android 验证移出本次验收范围，10.7 不再是待办或完成阻碍，也不标记为验证通过。桌面浏览器及小容器验证继续有效；历史“暂缓”记录保留，仅描述当时状态。此为当时范围记录；10.4/10.5 后续验收条件以本文顶部更新为准。

现行规格是四份 specs 的行为契约；本文件保留实施算法说明与实际完成记录。基础批次与继续批次
分开记录，不能把历史规划或设计目标当成验证结果。继续批次已落地播放引擎、公共预设/控制器、
Vue 展示层、采样分类、交互与导出接入、Demo 和浏览器运行器；最终命令/证据见文末。

未修改版本、不提交、不发布。FPS、完整内存和 gzip 目标是否达到，以实测报告为准；不可用浏览器
及设备明确列为未验证，不以模拟视口代替真实移动设备。

## Integration Map

| 层       | 接入位置与职责                                                                 | 禁止事项                                          |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| 核心引擎 | 新增 src/animation/core，数值轨道、时钟、调度、D3 easing 适配                  | 导入时访问 window；直接写 DOM                     |
| 图表协调 | useWaveformChartController 调用独立动画 composable，接收准备数据/布局/采样版本 | 把编排塞进 WaveformChart.vue；每帧标准化/重新采样 |
| 系列渲染 | WaveformSeriesLayer 接收展示几何、局部裁剪及最多两组淡化状态                   | D3 selection.attr('d') 与 Vue 模板双写            |
| 标注渲染 | WaveformAnnotationLayer 的展示列表保留只读退场快照                             | 动画直接 remove DOM 或修改消费者 annotations      |
| 交互     | 现有 hover/viewport/annotation/controller 命令入口先稳定目标                   | 查询临时采样或插值点来发出业务数值                |
| 图片导出 | useChartImageExport 在既有超时/版本机制内进入动画抑制区间                      | 新建第二个无界等待；结束其他图表动画              |
| 公共接口 | src/index.ts 显式导出类型、引擎、控制器、预设                                  | 只从内部 index 导出就声称支持包 API               |

每个源文件遵守 450 物理行上限；拆分按时间、轨道合成、调度、预设和 Vue 状态边界进行，不能靠删除说明或堆入单个控制器绕过限制。

## Interface Outline

以下轮廓已经落地于 src/animation；完整接口和行为仍以 ENG-09/API-05 为准：

```typescript
type AnimationValue = number | number[] | number[][]
type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
type AnimationState = 'PENDING' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'ABORTED'
type EasingFunction = (progress: number) => number
// EasingType 为 design.md 列出的 31 个名字的字面量联合
interface AnimationFrame {
  rawProgress: number
  directedProgress: number
  iteration: number
  terminal: boolean
}
interface AnimationTrack {
  target: Record<string, AnimationValue>
  property: string
  from?: AnimationValue // 普通任务省略时捕获当前合成值
  to: AnimationValue
}
interface AnimationConfig {
  initialize?: () => void
  tracks?: AnimationTrack[]
  duration?: number
  delay?: number
  easing?: EasingType | EasingFunction
  loop?: number | boolean
  direction?: AnimationDirection
  force?: boolean
  additive?: boolean
  during?: (easedProgress: number, frame: AnimationFrame) => void
  done?: () => void
  aborted?: () => void
  onError?: (error: unknown) => void
}
interface AnimationHandle {
  readonly id: string
  readonly state: AnimationState
  pause(): void
  resume(): void
  abort(): void
  finish(): void
}
```

from/to 数组在注册时复制，target 为输出位置且数组属性用新数组替换，验证目标当前值、from/to 形状与有限性；整个 config 验证通过后才替换旧任务。同一配置中重复 target/property 拒绝。普通轨道显式 from 仅用于无冲突的新任务；冲突替换必须从当前合成值接续。累加轨道 from 由 baseEnd + committedOffset + sum(activeEndDelta) 自动推导，显式 from 不一致则拒绝，避免把绝对目标错当增量。

`Animator.animate(config, id?)` 返回 AnimationHandle，缺省 ID 自动生成；显式 ID 在同一管理器内替换旧任务（先完整校验新配置）。控制器用 owner token 生成调度器内部 ID，不把用户 series ID 当全局键。standalone Animation 支持注入时间戳的 start/tick/pause/resume 以便测试；句柄方法使用所属 Animator 的时钟。

公共预设、绑定、选项及控制器签名以 waveform-animation-props/spec.md 的 API-05 和引擎规格 ENG-09 为准，类型需要从根入口导出。该章节是规范的一部分，归档后不依赖本实施指南。

预设工厂保留 `createLineDrawingAnimation`、`createStaggeredLineDrawingAnimations`、`createPathTransitionAnimation`、`createYAxisScaleAnimation`、`createAnnotationAppearAnimation`、`createAnnotationDisappearAnimation` 名称；其中路径预设的输入改为已匹配数值几何或交叉淡化状态，不再接受 oldPathData/newPathData 字符串。返回配置/配置数组；控制器提交任务，公共消费者也能显式提交。工厂仅校验/复制/返回配置，不调用 read/write；配置 initialize 在注册事务成功并确认代次后才读取当前态和初始化，节点资源由使用方/Vue 管理。控制器禁用/零时长时跳过初始化，直接提交终帧。完整参数/返回类型以及初始化顺序以公共规格为准。

## Time and Scheduling Algorithm

1. 完整校验配置后，捕获当前值并解决同 ID/属性冲突，再决定同步完成还是注册播放。零时长/无变化/无 RAF 也必须先中止旧任务。新请求登记代次后再调用旧 aborted；该回调重入创建了更晚代次时，外层请求不得继续写值。initialize 仅在正时长任务获得所有权后、延迟前调用；同步分支跳过 initialize，不保留活动任务，依序终态写入 → during → done；若 during 抛错，改为 aborted/onError，不再 done。
2. 注册时记录单调起始时间和首次 delay；PENDING、RUNNING 均可暂停，原因集合非空时保存暂停前状态；只有最后一个原因移除才恢复，暂停时长按集合非空区间累计。手动、批量、页面隐藏原因独立；新任务继承所属批量/后台原因。结束态及 PAUSED 的 tick 不执行 during。
3. 有效时间为 now-start-delay-pausedTotal；小于 0 则保持 PENDING。大于等于 0 后使用除法/余数计算迭代，有限次数末端单独处理为末次进度 1。
4. 自然末帧/finish 设置 frame.terminal=true 且直接使用方向端点，不用 easing 修改终点；路径预设此时发送 settled 并释放旧几何。非末端恰好在周期边界时进入下一迭代进度 0；有限最后边界只提交末次进度 1。先计算方向，再应用 easing，不因跳帧丢失完整周期。
5. 先计算所有轨道值/贡献，完成合成后每属性写入一次；写入完执行 during，再发送终止回调。该帧开始后的新增任务下帧才计算。
6. 普通替换和自然完成回调可取消或替换任务；批量 finishAll/clear/destroy 有终止屏障，重入创建抛 animation-terminating 且无新回调。从 Map 移除前比较保存的任务对象，不能按 ID 直接误删替换项。
7. 无运行任务时取消 RAF；只有延迟任务时保留一个最早截止计时器；全部暂停时取消唤醒。恢复和新增任务重新计算调度。

不要把“任务仍在 Map”当成必须持续 RAF 的条件。测试必须断言取消次数和剩余计时器，不能只断言 map.size。

## Additive Composition

轨道组以对象身份和 property 为键，存储基础普通轨道或固定基值、已固定偏移、活动累加贡献。输出公式：

`value(t) = base(t) + committedOffset + sum(activeDelta(t))`

新轨道起点：`from = baseEnd + committedOffset + sum(activeEndDelta)`，其中终点均考虑 direction。基础值 10、已固定偏移 4、无活动贡献时，新目标 20 的 from 必须为 14、增量为 6，最终是 20 而非 24。全部轨道退出后把输出写回目标并释放轨道组，下一次从目标当前值重新建立固定基值，不能既把偏移吸收到基值又保留偏移。

例如基值 10、增量轨道 10→14 和 14→20 半程贡献分别为 2、3，输出 15。连续两帧同一时间仍为 15。完成把末贡献移入 committedOffset；中止把当前贡献移入，二者同帧先移除活动项再提交偏移，避免重复计算。

普通替换先截取完整当前值，再移除相关基础/累加任务并清空旧偏移；新普通轨道从截取值开始。多属性旧任务整体中止时，把未被新任务接管的属性冻结在当前显示值。任何已有循环基础轨道与累加请求不兼容，不得偷偷停止循环使注册成功。

## Presentation Pipeline

1. data 引用变化先由现有准备数据层生成新版本和真实目标域；当前可见展示几何仅供过渡起点使用。
2. 适配采样请求签名以及 pending/success/fallback/error，不能仅检查 ready()：现有 settled 在 finally 标记，失败也可能 ready。success 且未 skipAnimation 时才创建过渡；fallback/error 静态接受既有策略结果，不修改降级选项。pending 时不形变，交互/禁用标记该请求跳过动画，迟到成功静态落地。没有尺寸/有效点时保持静态占位。
3. 域使用 clamp(easedProgress,0,1) 的凸组合，逐帧检查有限/有序/非退化，非法中间域回退合法目标。对应数据值按原 easedProgress 计算，再用展示比例尺投影。标注锚点从旧/新完整数据各求一次并缓存，同步插值数值后投影；不能仅换比例尺而直接使用最终 Y。
4. 不兼容时保留两组数值几何并共同投影/淡化；标注仅跟随新系列新锚点，随新组淡入，删除旧展示不发受控事件。第三份需求直接提交最新目标，不建立无界队列；旧组不命中、不接受标注交互。
5. 逐帧仅更新局部 shallow 展示状态，不重跑标准化、域扫描、采样和业务事件。
6. 标注删除后展示列表保存退场快照；同 ID 重加撤销旧 leave 并复用样式。布局失效、隐藏及卸载立即移除不再有意义的快照。
7. finishAll 设置当前业务目标的完整可见状态，清空已删除对象和所有动画临时裁剪/透明度/transform（保留原有轨道裁剪）；它不补旧任务 during。先脱离调度，再提交最新目标、清理，最后标记 FINISHED 并通知 done；回调不得在此屏障内续建。分类关闭只提交对应分类，失败流程见 CTL-07。

## Export and Interaction Ordering

交互接管先同步提交最终展示对象，然后按目标布局执行计算，不等待 Vue patch 再计算事件。实际 DOM 在正常更新周期提交，不使用临时屏幕值推导原始数据。

图片导出继续使用已有选项校验、busy 标记、revision、5 秒超时和错误码。通过准备/释放钩子把动画抑制纳入同一次导出 try/finally；捕获业务版本，结束当前图表动画，再等采样、字体和 nextTick。展示帧不计入业务 revision；真实 data、布局、注解/可见性变化仍必须增加版本或使用既有失效机制，禁止为了避免 export-stale 而屏蔽真正更新。

同版本采样完成时检查 exportSuppressed 并静态提交；后台暂停或循环任务不能阻止导出。导出失败也释放抑制，但不重播已完成动画。

## Test and Evidence Plan

| 层级   | 用例                                             | 可观察断言                                      |
| ------ | ------------------------------------------------ | ----------------------------------------------- |
| 引擎   | 延迟暂停、四方向、有限/无限、零时长、长跳帧      | 进度/终点/回调次数正确，无 NaN                  |
| 轨道   | 标量/数组、普通替换、两条累加、停止基础轨道      | 合成值不漂移、不跳变、非法组合零副作用          |
| 调度   | 全暂停、延迟清除、回调重入、异常                 | RAF/定时器数量可控，新同 ID 任务不被误删        |
| 预设   | 三裁剪方向、四标注效果、兼容/非兼容更新          | 最终几何正确，最多两份展示，不测试偶然 DOM 顺序 |
| 组件   | 阈值三边界、偏好变化、两个实例、resize/分页/隐藏 | 静态终态恢复，查询完整数据、秒坐标不变          |
| 导出   | 入场中、后台/无限任务、等待采样、版本变化/超时   | 最终完整快照、原有错误码、抑制释放              |
| 浏览器 | 桌面/小容器、复用组件/Demo、单/多系列            | 视频或截图结合交互轨迹；真实帧耗时/内存证据     |
| 包     | ESM/CJS、类型和预设消费                          | 根入口导入可用，无额外运行时 ECharts/ZRender    |

后续新增 `pnpm test:animation:browser`，使用独立浏览器测试配置/页面，固定 Chromium 与数据种子；具体测量矩阵和重复次数按 design.md。jsdom 只验证行为，不承担真实 FPS 证明。

性能报告须保存环境、采样参数、数据量、显示点数、结果和未覆盖环境。截图不能证明动画时序，需受控进度测试或录制。无真实测量前，55/50 FPS、内存和 gzip 增量均保持目标状态。

## Public Interface Baseline (1.1)

以 ENG-09/API-05 Requirement 中的完整签名为基线；所有列出的符号最终都必须从根入口导出，不存在“可选导出”。本轮的类型消费测试从 src/index.ts 导入，包消费脚本另外验证已实现导出。

| 契约组                  | 本轮落地                                                                                                       | 后续必须实现的运行时/集成                                                                                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENG-09 数值、时间与回调 | AnimationValue/Direction/State/Frame/Track/Config/Handle、EasingFunction/Family/Type、AnimationScheduler       | Animation(config)；state、start(time)、tick(time):boolean、pause(time)、resume(time)、abort、finish                                                                                                                                                                                   |
| ENG-09 管理器           | Animator 结构接口（仅类型，无构造器）；完整方法签名已固化                                                      | Animator(scheduler?)、globalAnimator；animate(config,id?):AnimationHandle、remove/pause/resume(id)、pauseAll/resumeAll/finishAll/clear/getAnimationCount/destroy                                                                                                                      |
| API-05 配置             | LineDrawingDirection、AnnotationAnimationType、预设/组件 options、WaveformAnimationProps                       | WaveformChartProps 扩展 WaveformAnimationProps；组件五个 props 及字段合并/动态策略                                                                                                                                                                                                    |
| API-05 展示状态         | ClipAnimationState、AnimationBinding、NumericGeometry、GeometryTransitionInput/Frame、AnnotationAnimationState | settled 仅携带 to 几何；终帧释放旧几何后才通知完成                                                                                                                                                                                                                                    |
| API-05 控制器           | AnimationScope、AnimationObjectKey、WaveformAnimationControllerOptions                                         | WaveformAnimationController(options)；animate、animateSeriesEnter、animateMultiSeriesEnter、animateDataUpdate、animateYAxisScale、animateAnnotationAppear/Disappear、cancel/cancelAll/finishAll/pauseAll/resumeAll/setEnabled/getActiveAnimationCount/destroy，完整参数/返回见 API-05 |
| API-05 工厂             | 输入/输出相关类型已固化                                                                                        | createLineDrawingAnimation、createStaggeredLineDrawingAnimations、createPathTransitionAnimation、createYAxisScaleAnimation、createAnnotationAppearAnimation、createAnnotationDisappearAnimation；完整参数/返回见 API-05，纯构造、不提前调用 read/write                                |

组件默认开启是未来接入后的可观察时机变化，不是当前已生效能力。README 已区分已实现与规划，并给出未来 `:animation-enabled="false"` 关闭示例、分类开关、阈值/reduced-motion 和最终态导出说明。未给组件添加无行为实现的 props，也未导出虚假的类/工厂值。

本轮未发现四份规格之间的实质行为矛盾。旧的“尚未实现”状态描述已更新；历史参考文档未用于覆盖规格。CTL-06 的取消/登记步骤需与 ENG-06 一起执行：可先脱离旧调度，但旧 aborted 通知必须在新代次登记后，后续替换事务不能按普通取消立即通知。

## Completion Record

### 2026-10-12：基础批次（1.1、1.2、2.1、2.2）

已实现：

- src/animation/core/types.ts 和 src/animation/types.ts 固化 ENG-09/API-05 基础类型；src/index.ts 显式导出类型及 getEasingFunction。类型消费测试约束必填 terminal、settled 不含旧几何、句柄 id/state 只读和数值几何。
- src/animation/core/validation.ts 实现无写入的完整配置预检及轨道 from/to 深复制：默认仅替换 undefined，校验有限非负时间、正整数/布尔 loop、零时长无限循环、枚举/布尔/回调、数值/数组形状、重复 target/property；不执行 initialize/during/终止回调，不调度。累加拒绝循环，并使用只读属性组上下文校验方向终点/固定偏移组成的 derived from 及循环基础。属性组合成/注册事务本身未实现。
- AnimationScheduler 支持 now、成对 requestFrame/cancelFrame、setTimer/clearTimer；注入预检不执行这些函数。tests/support/animationScheduler.ts 提供显式时钟、RAF 帧快照、取消、按截止时间推进定时器及队列/调用计数；无需真实等待。
- src/animation/core/owner.ts 分配 owner 身份，把 owner/kind/id/scope 编码为无分隔符歧义的内部键；同 owner 键稳定，两个 owner 的相同用户 ID 不冲突。此处仅为键方案和支撑验证，控制器任务生命周期、对象占用表、清理与代次仍待 3.4/9.4 实现。
- src/animation/core/easing.ts 完整映射 31 个 D3 缓动，quart/quint 使用 easePoly.exponent(4/5)；自定义函数原样返回、不提前执行、不限制回弹值；未知名称抛 TypeError。执行期间异常/非有限缓动结果的隔离留待 2.7。
- tests/animation 下新增配置/缓动/支撑/根入口类型测试；scripts/test-package.mjs 加入已实现动画类型声明与 ESM/CJS 缓动消费检查。README 记录当前实施状态。

实际环境：Node.js 22.23.2，pnpm 10.32.1（通过 corepack pnpm@10.32.1；宿主默认 pnpm 为 9.15.0，首次探索测试后已切换到指定版本）。

实际验证：

- `corepack pnpm@10.32.1 test tests/animation`：4 个文件、112 个用例通过。
- `corepack pnpm@10.32.1 typecheck`：通过。首轮断言函数引入的类型收窄错误已修复后重跑。
- `corepack pnpm@10.32.1 lint`：通过。首轮测试字符串的无用转义已修复后重跑。
- `corepack pnpm@10.32.1 check:file-length`：通过；所有 src 文件不超过 450 行。
- `corepack pnpm@10.32.1 test:package`：通过；其 prepack 实际执行完整 `pnpm build`（typecheck、ESM/CJS library、declarations、demo），生成临时 tarball，并在隔离消费者中通过 TypeScript 声明、ESM/CJS 根入口消费验证；未发布。
- `openspec validate add-animation-system --strict`：通过。
- `openspec status --change add-animation-system`：4/4 规划 artifacts complete；这不是全部实施任务完成，tasks 仅勾选本轮四项。
- `corepack pnpm@10.32.1 exec prettier --check src/animation src/index.ts tests/animation tests/support/animationScheduler.ts scripts/test-package.mjs` 及 `git diff --check`：通过。
- 验证过程重新生成的受跟踪 wasm/pkg 产物恢复为本轮开始时版本；未保留无关生成物变更。

仍为规划/未验证：Animation 时间状态和插值、Animator 实际注册/冲突/RAF 调度、累加合成、运行时异常隔离、owner 控制器生命周期、所有预设、组件集成/交互/导出、全仓覆盖率、真实浏览器与性能结论。任务 7.1/7.2/7.3/7.4/7.5 及第 8/9 节均未提前勾选；本轮只实现其中与基础批次直接相关的局部约束。

建议下一批：2.3、2.4，连同相关的 8.3/8.7 和 9.2（时间状态、普通轨道、同步/异步替换事务、独立暂停原因、事务初始化），之后 2.5/2.6/2.7 落实累加、调度及终止屏障。尚不进入组件集成。

### 2026-10-13：继续批次（剩余实现与证据任务）

用户随后授权“继续完成剩下的任务”，因此本批次包含组件集成。下列内容已实现，不再是规划：

- **时间与数值引擎（2.3–2.7、8.2/8.3/8.7、9.2/9.3）**：Animation/Animator/globalAnimator、四方向、延迟、有限/无限循环、跨周期跳帧、零时长、独立暂停原因与区间并集、数组插值、普通替换和累加固定偏移/回收。属性组区分本帧待提交值与最后实际写入值；同帧其他任务的 easing 中止基础轨道时，冻结已写入贡献，避免尚未提交的进度造成跳变。注册先完整校验并确认新所有权，再通知旧 aborted；initialize 只在成功注册后的动态分支执行。管理器屏障阻止无限续建链。空闲/暂停停止 RAF，延迟使用单个唤醒定时器；异常及数值写入失败隔离，SSR 导入不启动副作用，无 RAF 同步终态。无限句柄 finish 在两帧之间也按当前有效迭代确定方向终点。
- **纯预设与 owner 控制器（4.1–4.5、8.1/8.4、9.4–9.6）**：六个工厂只构造配置，裁剪/opacity/域限幅，数值几何兼容插值与整体交叉淡化，terminal 输出单份 settled。WaveformAnimationController 使用对象级占用表和 owner 键，分离取消、分类提交、整图最新目标提交及用户通知。批量操作不补旧 during，commit 错误不虚报 done。真实及结构化注入管理器均保留手动暂停；后台新任务在调度前继承 owner 原因。
- **Vue 集成（3.1–3.4、4.6、5.1–5.4、8.5/8.6）**：src/components/animation 分为配置、数值几何、轨道展示、标注展示和 composable；由既有 controller 协调，WaveformChart.vue 只新增公开默认 prop。源数据/业务域/查询缓存不参与逐帧更新。系列线条/点/误差棒共用内层裁剪，保留外层裁剪；一条轨道时间线同步所属几何、展示域、目标刻度、网格及完整数据缓存锚点，多轴保持各自比例尺。第三份几何需求、空数据、移除系列静态落地。标注退场快照独立冻结、不可交互，不改受控数组；无完整数据锚点隐藏。
- **策略与生命周期**：五个 props 默认开启、字段合并/开发告警、分类开关快照、总 source.length 阈值（含隐藏/非当前页）、动态 reduced-motion、无 RAF、document-hidden、实例卸载。首次 ResizeObserver 的边框尺寸差异不再过早结束入场：首次有效测量前保留零宽裁剪且不调度，尺寸和采样稳定后启动。指针捕获与外部变更命令在业务计算前稳定目标；被动 getControlState 不结束动画。采样适配器传递 pending/success/fallback/error 与签名，缺少结果几何也不冒充 success，pending 接管记录 skipAnimation，迟到结果静态落地，不改后端降级策略。
- **导出**：既有选项/busy/尺寸验证之后进入 owner 抑制，提交最新终态，保持原有采样/字体/Vue 等待和 5 秒上限；finally 释放。新增成功、stale、cancelled、timeout、commit 失败的释放回归，保留 export-render-failed；SVG/PNG 真实浏览器验证，其他图表仍运行。
- **公共面与文档（7.1/7.2/9.1）**：根入口显式导出全部类型、类、单例、缓动和工厂；隔离包消费者编译每个公共预设/控制器签名，ESM/CJS 验证纯工厂、SSR 终态及惰性单例。README 给出关闭、分类、阈值、减少动态效果、零时长、循环/累加/手动时间、纯工厂和 owner 示例；#/animation Demo 有分类及效果/方向选择；release-notes.md 是未发布草案。

实际验证环境仍为 Node 22.23.2、pnpm 10.32.1。先运行最接近的 animation、组件集成、采样和导出测试，然后按下列顺序跑最终门禁；完整退出码在 evidence/verification.json（最后补充的同帧中止回归先通过 8 个文件、196 个针对性用例，再重跑下列门禁）：

1. `pnpm test:coverage --maxWorkers=4`：126 个文件、1031 个用例通过；仓库 lines/statements/functions/branches 和核心覆盖率精确值见 evidence/coverage-results.json。vite.config.ts 持续约束 src/animation/core/** 的 90/90/90/80 门槛。
2. `pnpm typecheck`、`pnpm lint`、`pnpm check:file-length`：通过，全部 src 文本文件不超过 450 行。
3. `pnpm build`、`pnpm test:package`、`pnpm pack --dry-run`：通过。包测试包含真实 tarball 的声明与 ESM/CJS 消费，未发布。
4. `pnpm test:animation:browser`：修复首次尺寸时序后完整重跑 96 个 Chromium 场景，每个 3 次预热、10 次记录、至少 2100ms；活动任务断言保证阈值以下动画真实发生。四页并发的机器/版本/刷新率、帧分位数/长帧/最终坐标数与 20 次装卸 GC 数据见 evidence/browser-results.json。
5. `node scripts/test-animation-smoke.mjs`：Chromium、已安装 Chrome、Firefox 的组件与 Demo 各桌面/小容器，共 6 组通过；包括指针接管、SVG/PNG、兼容/交叉更新和标注。截图与版本见 evidence/browser-smoke.json；已实际查看小视口 Demo 和桌面组件截图。
6. OpenSpec `findSpecUpdates`/`buildUpdatedSpec` 只读构建四份归档合并产物，保留 29 个 Requirements 及 ENG-09/API-05 声明，随后 Validator(true) 严格验证全部通过。产物在 evidence/merged，主 specs 没有写入；记录见 evidence/merge-validation.json。归档预检发现 presets/props Purpose 过短，已补充描述文字，未改行为契约。

**性能限制与未验证项仍然存在，不能写成保证：**

- evidence/performance-report.md 保留全部实测结果；16 个动画场景至少一次记录低于对应 FPS 目标。四页并发与部分同机验证负载会影响结果，不能当作隔离最大吞吐量，也不把中位数接近 60FPS 视为全部通过。
- 同一 vite.lib.config.ts、依赖图和准备后的 WASM，HEAD cedfd5f 基线与最终产物 gzip 实测见 evidence/gzip-results.json；ESM/CJS 增量仍超过 <10KB 目标。未引入 ECharts/ZRender，未修改构建配置伪造对比。
- 每页 20 次装卸后任务/容器元素归零，保存 CDP GC 前后 JS heap；完整 native/SVG/GPU 内存预算未验证，JS heap 不能证明 <10/<20MB 总内存目标或绝对无泄漏。
- Safari 原生 WebDriver 探测确实返回“必须启用 Allow remote automation”，详见 evidence/safari-probe.json，本次未更改该设置；Edge 未安装，iOS/Android 无设备/模拟器。这些环境未验证，小视口桌面截图不代替移动设备。
- 初轮 browser-results-initial-layout-regression.json 仅是尺寸时序问题诊断，已被修复后的完整矩阵取代，不用于当前性能结论。最后的同帧自定义 easing 中止/累加修复由受控时钟回归和全套单元测试验证，浏览器矩阵不含该场景，未因该修复重复整套矩阵。

第 6.2/7.4 项的完成表示已执行并如实记录测量，不表示设计性能预算达到；第 6.3 项按其验收要求保留不可用环境的未验证状态。以上算法/接入已实现；剩余规划是隔离环境性能优化与复测（可用 ANIMATION_BENCHMARK_WORKERS=1）、gzip 压缩优化、完整内存分析以及 Safari/Edge/移动设备复核，不缩减公共功能来满足预算。

不改版本、不提交、不发布、不实际归档 change。验证重新生成的受跟踪 wasm/pkg 文件恢复到本轮开始时内容，避免保留无关生成物。

### 2026-10-13：性能与验证环境收尾批次

用户继续授权完成剩余工作。本批次没有删减接口或降低动画阈值：

- 入场复用已生成路径、数值几何和目标比例尺；只有域确实变化时复制 scale，固定域不会重复驱动轴。几何投影使用弱引用缓存，内部插值/点缓冲只写展示对象，不修改完整输入、旧/新数值端点或业务查询缓存；重入的兼容更新从当前数值快照继续。
- 刻度遮挡检查在同次 Vue patch 后合并为一次 SVG 检查，读取的 text box/stroke width 在检查内复用；域动画复用刻度文本节点，只有标签文本改变才写 textContent。target ticks、网格和标注仍随当帧比例尺定位。
- 路径生成仍运行 D3 linear/step 曲线，仅将其 context 命令一次 join；精度与默认 D3 的 3 位小数、单点闭合逐一比较，新增非有限中间数值拒绝回归。
- 动画类使用真正私有字段，合并数值校验及映射重复实现。最终库构建使用 Terser 3 次压缩并保留 ESM pure annotations；打包后的单独 easing 消费实际 tree shake 掉 UI/图表，globalAnimator 构造标记 pure 且仍惰性。新增 compare-animation-gzip.mjs 将同一最终配置、依赖图和 WASM 复制到 HEAD 基线，保存 SHA256，检查额外 worker 产物没有差异。
- 生产浏览器 fixture 发现手工 framework/UI/vendor 分包的循环引用，真实产物启动报 TypeError: e is not a function。已移除该手工分组，由构建器保留依赖循环；生产组件/Demo 冒烟验证通过。构建现在有 >500KB chunk 提示，未提高警告阈值掩盖它。
- 浏览器/内存运行器默认验证真实生产构建，并保留 ANIMATION_BENCHMARK_BUILD=development 供历史诊断对照。不得混淆此前 dev+四页并发与本次单页 production 的因果收益。
- Edge 155.0.4283.45 通过微软官方产品 API 下载 pkg 并按官方 SHA256 校验，临时展开后运行，没有安装到 /Applications 或修改系统权限。Chromium/Chrome/Firefox/Edge 的 8 个生产桌面/小容器冒烟组通过，记录见 browser-smoke.json。
- 原生 Safari 26.6.2 通过桌面与小容器入场推进、兼容/交叉更新及 SVG/PNG 完整导出；桌面截图已保存，小容器 JSON 已保存。随后 Mac 锁屏，不能继续 native UI，完整 Demo 与当前最终优化产物的原生复核仍待解锁，不启用远程自动化绕过限制。
- WebKit iPhone 13、Chromium Pixel 7 的移动 viewport/UA/scale/touch 仿真通过组件触摸接管及 Demo 标注/两类更新/SVG/PNG；截图已查看，记录见 mobile-emulation-results.json。它们不是原生 iOS/Android 验证。adb devices -l 没有设备，xcrun simctl 不可用，已请求用户提供环境。

实际代码验证：13 个针对性文件、228 个用例通过；完整覆盖率 128 个文件、1042 个用例通过。仓库 lines/statements/functions/branches 为 93.33/91.35/92.59/86.16%；core 为 98.72/97.85/97.30/95.01%。typecheck、lint、450 行检查、build、test:package、pack --dry-run 均实际通过，最终退出码与记录见 evidence/verification.json。源码优化后的生产分包修改再次执行类型/lint/长度/构建/包验证，避免只依据开发服务器。

本批次的独占 FPS 复测、进程物理内存报告和 gzip 精确值见 evidence/optimization-report.md。预算未达项仍为优化工作，不能写成通过。第 10 节将已实现优化、待达到预算、缺少原生环境分开记录；没有把环境不可用或完成测量当作预算验收通过。

收尾实测：24 个独占单页生产场景、240 次记录（18 动画场景/180 动画记录），最低约 59.999 FPS，目标未达记录 0，浏览器错误 0；20 次装卸后任务/容器元素归零。10.3 据此勾选，不扩展成其他设备或完整生产 96 场景保证。物理内存 12 场景各 3 对记录全部保存，最后预热上下文重载保留错误并完整重跑；自然峰值多数超预算，10.4 保持未完成。最终同配置 gzip ESM/CJS 增量 11,550/11,341 bytes，额外 worker 增量 0，10.5 保持未完成。最后 native UI 再次确认 Mac 锁屏、adb 无设备、simctl 不可用；10.6/10.7 保持未完成。

最终证据审计：历史内存矩阵在 mount 与采样之间执行了 GC，且装卸强制关闭动画，因此仅作有限条件下的采样与静态回收证据。运行器 v2 已去掉测量起点 GC，保留独立 retainedAfterGC，并使 20 次装卸等待真实动画启动后卸载；单独生产复测见 evidence/memory-results-unforced-validation.json。10000 点、小容器兼容更新增量 48,087,168 bytes 仍未达预算，20 次动画装卸任务/元素归零，历史失败完整保留。FPS 默认改为单页，显式 workers 参数用于压力测试。原生 Safari 仍报告 Mac 锁屏，adb 无设备，simctl 不可用；不把桌面移动仿真当成原生设备通过。未勾选 10.4–10.7，也未提交、发布或归档。

后续路径优化已实现：D3 曲线遍历配合私有 ASCII 字节缓冲，减少路径片段分配；舍入、极大坐标、缓冲增长/缩短及输入不变回归通过。10000 点小容器兼容更新的三对 v2 生产测量从原 join 的 54.74–57.57MB 降至 32.77–37.85MB，仍未达预算；另外两种编码方案只留对照证据，未采用。全套 128 文件/1043 用例、覆盖率、类型、lint、450 行、构建、包消费和 pack dry-run 再次通过。最新同配置 gzip 增量 ESM/CJS 为 11653/11452 bytes，五组 minifier 和两种分包试验都未使预算达标，没有采用无效配置。字节缓冲后的 24 个单页生产场景共 240 记录、最低 59.5238 FPS、未达记录/浏览器错误均 0；前半段有 SDK 网络下载，背景活动已说明，不称完全无外部负载。

Android 原生环境准备已落地：官方 ARM64 模拟器及系统镜像归档核对校验值并解压到临时目录，两份实际许可保存供用户审阅。SDK 使用须先接受协议，已请求明确确认，当前尚未接受或运行。原生 Android/iOS 验证仍是未完成计划；完整证据和包体/内存剩余目标见 evidence/optimization-report.md，第 10 节未完成项不提前勾选。

### 2026-10-13：轴写入与数值比较收尾

已实现：SVG 属性仅在实际变化时写入/删除，轴元数据和 tick 位置合并更新；遮挡标签仍按原测量流程恢复/隐藏，保留字体与边界判断。数值轨道比较改为递归数字比较，删除 JSON 序列化分配及校验层重复比较函数。新增重复轴输出零 DOM mutation、冻结二维相同轨道同步结束且不启动调度器的行为回归；不改变公共接口或功能。

实际验证：针对性 12 文件/226 用例；全套 128 文件/1045 用例。仓库 lines/statements/functions/branches 为 93.37/91.41/92.64/86.23%，动画 core 为 98.97/98.27/98.18/96.19%。typecheck、lint、450 行检查、build、包消费（含 ESM tree shaking）、pack dry-run 均通过。首次包消费与其他构建并发，因 dist 声明目录被清理报 ENOENT；已串行重跑成功并在 verification.json 保留失败原因。

轴写入方案的三对 v2 生产内存测量为 33,062,912 / 21,233,600 / 35,291,328 bytes（360×300、8 系列、10000 点、兼容更新）；仍超预算且与此前缓冲方案波动重叠，不作统计收益结论。本内存测量早于数值比较去序列化改动，不宣称覆盖该改动。最新同配置 gzip 增量 ESM/CJS 为 11,670 / 11,484 bytes，worker 0，仍未达 <10KB。私有属性名压缩试验亦未达预算，没有采用该配置。

当前产物 Chromium/Chrome/Firefox/官方临时 Edge 桌面及小容器共 8 组组件/Demo 交互、SVG/PNG 导出通过，证据单独保存在 evidence/axis-attributes-smoke/。此前 24 场景 FPS 记录只对应字节缓冲批次，不冒称覆盖本次轴与比较修改。原生 Safari 再次确认 Mac 锁屏；Android SDK 许可未收到接受回复，未运行 SDK；iOS 原生环境仍不可用。10.4–10.7 仍是未完成优化/环境验收，不改变为已实现。

当前产物移动仿真补充：WebKit iPhone 13/Chromium Pixel 7 两组组件触摸接管、Demo 更新/标注、SVG/PNG 通过，见 evidence/axis-attributes-mobile/；已查看当前 Chrome 小容器 Demo 截图，布局和波形正常。移动仿真依旧不替代原生 iOS/Android。

### 2026-10-13：按需几何快照与测量指纹

已实现：按不可变 TrackSeriesPath 弱引用复用几何快照，line/points/errors 数值端点仅在过渡确实读取时复制。静态、入场裁剪和标注刷新继续使用现成路径，不创建不需要的点行副本。真实数据更新仍生成独立新旧端点和插值缓冲，不改变 D3 精度、采样策略或业务查询。新增标注刷新后再更新的端点/输入不变回归。

已验证：针对性 2 文件/31 测试；全套 128 文件/1046 测试。仓库 lines/statements/functions/branches 为 93.38/91.43/92.65/86.27%，core 为 98.97/98.27/98.18/96.19%。typecheck、lint、450 行、build、串行包消费（含 ESM tree shaking）、pack dry-run、源码格式检查通过。当前版本生产桌面/小容器 8 组、移动触摸仿真 2 组组件与 Demo 的更新/标注/完整 SVG/PNG 导出通过；独立截图/JSON 保存在 evidence/lazy-snapshots-smoke/ 和 lazy-snapshots-mobile/，Pixel Demo 截图已实际查看。

内存运行器升级 v3：记录 src、Vite 配置、依赖锁文件、浏览器 fixture 和准备后 WASM 的 SHA256 输入指纹，续跑必须指纹与参数完全匹配。旧版记录续跑实际在启动浏览器前以预期 exit 1 拒绝；相同指纹续跑 exit 0，避免合并不同源码测量。此前同版本 v2 样本完整保留。v3 三对单页生产样本为 28,983,360 / 30,441,536 / 25,673,792 bytes，20 次启用动画装卸后任务与元素归零。仅为 360×300、8 系列、10000 总点数的兼容更新，不扩大为完整矩阵或系统 GPU 保证；仍未达到内存预算。

最终同配置 gzip 增量 ESM/CJS 为 11,714 / 11,521 bytes，worker 增量 0，仍超预算；旧对比保留在 gzip-results-before-lazy-snapshots.json。原生 Safari 本轮复核仍报告 Mac 锁屏；Android SDK 许可未收到确认，未运行；原生 iOS 环境仍缺失。10.4–10.7 不勾选。最终版本 24 场景单页生产 FPS 正在独占复测，完成前不引用此前批次作为当前版本保证。

该按需快照版本的 FPS 复测已完成：24 场景、240 记录，3 次预热/10 次记录，最低 59.5238 FPS，未达到 55/50 FPS 目标的记录为 0、浏览器错误 0、>50ms 长帧 0；20 次装卸后任务/元素为 0，最大活动任务 8。见 evidence/browser-results-lazy-snapshots.json。矩阵期间未运行其他测试/构建/内存测量/下载/模拟器，只有轻量证据读取和文档编辑。

### 2026-10-13：截图发现的标注与数据更新并发回归

核对上述 FPS 运行器的 Demo 小容器截图发现：标注出现途中更新数据，会将样式冻结在半透明/缩小状态。具体违约位置为 useWaveformAnimations.ts 的 dataChanged 分支调用 cancelAll；CTL-06 冲突表要求标注锚点与出现样式可以并发，PRE-04 要求等待对应系列入场，不应在该入场被数据更新中止后永久等待。此前浏览器运行器只断言节点存在，未覆盖最终 opacity/scale，已补强验收。

两条新增回归在修复前均实际失败：出现进度 0.25 被数据更新中止后不能达到 1；等待入场的标注在数据更新后始终为 0。现已将数据更新取消限制为本实例的轨道几何更新与系列入场任务，保留标注样式通道；入场中断后，在新配置/布局协调完成的 microtask 释放对应等待标注。未新增公共接口，不重播已开始的出现样式，不更改受控数据。新增回归验证完成/中止回调和并行更新继续运行。

修复后实际验证：针对性 9 文件/209 用例，全套 128 文件/1048 用例。仓库 lines/statements/functions/branches 为 93.40/91.45/92.66/86.31%，core 仍为 98.97/98.27/98.18/96.19%。typecheck、lint、450 行、build、包消费、pack dry-run 通过；composable 为 441 行。浏览器运行器增加最终 opacity=1、scale=1 断言，桌面/小容器 8 组及移动仿真 2 组通过，独立证据在 annotation-update-smoke/ 与 annotation-update-mobile/。已查看修复后的 Chrome 小容器 Demo 截图，标注恢复完整样式。

上述 24 场景 FPS 和按需快照内存指纹对应并发修复之前的版本，明确保留其范围；不虚称为此修复后的全矩阵证据。修复后预算测量仍在复核，原生 Safari/移动验收限制不变，第 10.4–10.7 项仍未完成。

并发修复后的预算复核已执行：v3 输入指纹单场景三对增量为 24,772,672 / 33,423,360 / 32,129,024 bytes，仍未达到 <10MB；20 次启用动画装卸任务/元素为 0。证据为 memory-annotation-update-fingerprinted.json，仅覆盖 360×300、8 系列、10000 总点数兼容更新，不能扩展为完整矩阵通过。最终同配置 gzip ESM/CJS 增量为 11,753 / 11,558 bytes，worker 增量 0，仍未达到 <10KB；旧值完整保留在 gzip-results-before-annotation-update.json。后续仍需优化 renderer 分配与 gzip、复核修复后的完整 FPS 矩阵以及原生环境验收，不将这些计划写成已实现。

### 2026-10-13：稳定路径生成器与数值点缓冲批次

已实现：将 D3 line/accessor/context 与私有 ASCII 缓冲一起按点数组弱引用复用，曲线和比例尺在每次调用时刷新；数值点缓冲一次初始化四个数值字段，发布前全部覆盖。D3 仍负责路径遍历和曲线算法，坐标字符串继续使用标准舍入/转换。新增冻结点数组的曲线/比例尺连续切换精确对照、线条/散点/误差棒半程坐标同步，以及动态刻度插入/移动/属性变化/删除的遮挡回归。没有改变点数、阈值、输入数据或公共接口。

诊断与预算结论严格区分：HeapProfiler 采样包含已回收分配，且采样/trace 会影响运行，只用于定位分配来源，不能替代物理预算或 FPS。稳定生成器加四字段初始化的诊断采样约 137.40MB（静态约 28.17MB），投影赋值约 14MB 的旧采样条目消失，但不声称物理内存有统计显著改善。当前保留方案 v3 单场景三对自然物理峰值增量为 27,672,640 / 25,133,056 / 27,967,488 bytes；20 次启用动画装卸任务/元素归零，首对 GC 后 DOM 节点/监听恢复 28/14。仅覆盖 360×300、8 系列、10000 总点数兼容更新，仍未达到预算；证据为 memory-numeric-point-fields.json。

未采用：直接数字字节编码虽降低诊断 JS 分配，物理峰值却为 30,752,896 / 32,555,072 / 42,664,000 bytes；叠加 live DOM collections 的方案为 39,436,352 / 44,515,328 / 37,568,576 bytes。两种代码已撤回，证据保留，不把分配下降当作内存验收通过。allocation-diagnostic.json 对应撤回的两种叠加方案，当前采用方案的诊断是 allocation-diagnostic-numeric-point-fields.json。OXC 同配置压缩对照 ESM/CJS 增量为 12,709 / 11,502 bytes，仍超预算，未采用；vite.lib.config.ts 保留 Terser，不压缩公共属性名。

当前 native UI 检查再次报告 Mac locked；原生 Safari 最终产物/Demo 矩阵仍未验证。此前 SDK 两份许可确认未收到回复，未接受或启动模拟器，iOS 原生环境仍缺失。10.4–10.7 保持未完成；后续规划仍是物理分配与包体优化及原生环境验收，没有将测量或环境准备标成目标完成。不提交、不发布、不修改版本。

当前保留方案的最终代码门禁已通过：针对性 4 文件/40 测试，全套 129 文件/1051 测试；仓库 lines/statements/functions/branches 为 93.41/91.46/92.66/86.31%，core 为 98.97/98.27/98.18/96.19%。typecheck、lint、450 行、覆盖率、build、串行 test:package、pack --dry-run 均为实际 exit 0。正式同配置 gzip ESM/CJS 增量为 11,802 / 11,606 bytes，额外 worker 增量 0，旧值保留于 gzip-results-before-stable-generator.json；仍未达到预算。

当前生产桌面/小容器 8 组和移动仿真 2 组的组件/Demo、标注终态、交互接管及完整 SVG/PNG 验证通过，证据独立保存于 stable-generator-smoke/、stable-generator-mobile/。Pixel Demo 截图已实际查看，波形和标注完整。24 场景单页生产 FPS 复核已启动，完成前不宣称通过；构建输入指纹与 memory-numeric-point-fields.json 完全一致，记录见 stable-generator-build-inputs.json。

本轮最终 FPS 的 24 场景/240 记录已完成：最低 59.5294 FPS，55/50 FPS 目标未达记录 0，>50ms 长帧 0，浏览器错误 0；20 次装卸后活动任务/容器元素 0，最大活动任务 8。见 browser-results-stable-generator.json 和 stable-generator-build-inputs.json，仅覆盖 8 系列、1000/10000/49999 总点数、两种尺寸、四种模式，不扩展成完整 96 场景或原生移动保证。

该运行命令最终 exit 1，原因是 FPS 后的第二尺寸 Demo 检查超时，并非 FPS 测量失败。运行器原来在两种尺寸复用同一页面，对同一 hash URL 的 goto 保留组件状态，第二次“增删标注”实际删除了第一轮标注；独立重现确认第二次 toggle 前/后数量为 1/0。已修正为每尺寸新建/关闭页面，未改组件代码。两种尺寸视觉阶段单独重跑 exit 0，标注终态/浏览器错误验证通过，小容器截图已查看；见 stable-generator-visual-retry.json。原始报告的缺少 finished 字段及失败退出码如实保留，不将其改写为整条命令通过，也没有无理由重跑完整 FPS。

### 2026-10-13：直接曲线与字符串缓存对照（均未采用）

为继续定位物理预算，试验直接调用 D3 curveLinear/curveStep/curveStepBefore/curveStepAfter 的 context，绕过 line 包装层，仍逐帧插值数值并按当帧比例尺投影，不自行实现曲线或 SVG 字符串插值。40 个针对性用例、typecheck/lint/450 行通过后，v3 三对单场景物理增量为 25,231,552 / 25,837,568 / 27,967,488 bytes。采样诊断 enabled 分配 136,420,896 bytes，与上一方案接近；未达到预算，也未证明超出波动的收益，因此恢复上一轮完整验证的 line/context 实现。

另外试验按命令位置缓存投影坐标字符串；全 X/Y 缓存三对增量为 39,223,296 / 47,857,664 / 38,928,384 bytes，反而更高，已撤回。仅 X 缓存试验通过相同针对性和静态检查，但两次内存命令均在预热期间因 Execution context was destroyed 失败，报告没有完成场景，不能给出内存数字或预算结论。独立导航/console 诊断也在第三次静态 mount 失败，恢复原实现后同诊断三次成功；只保存观察，不从有限对照推断销毁根因。相关证据为 memory-direct-d3-curve.json、allocation-diagnostic-direct-curve.json、memory-coordinate-string-cache.json、memory-x-string-cache.json、x-cache-context-diagnostic.log 和 restored-context-diagnostic.log。

实际保留的改动仅是新增 5 个行为回归：同一点数组以每种线型在空/单点/双点/1024 点间反复变化，逐字比对 D3 输出并确认输入不变。路径实现与上一轮保留方案一致，未采用额外缓存或 curve 绕过。10.4/10.5 仍未完成，不因试验通过单元测试就勾选预算目标；原生验收限制未改变。后续规划是进一步定位物理峰值及包体构成，不缩减公共功能。

恢复源码后的实际验证：2 文件/40 针对性测试，全套覆盖率 129 文件/1056 测试通过；仓库 L/S/F/B 保持 93.41/91.46/92.66/86.31%，core 保持 98.97/98.27/98.18/96.19%。typecheck、lint、450 行通过。pathBuffer.ts 与试验前备份 cmp 完全一致，geometry.ts 调用恢复带原比例尺参数；没有遗留未验证生产源码。试验初次 typecheck 的错误类型名 exit 2、两次 X 缓存测量 exit 1 均保留在 verification.json，不改写为通过。不重复构建/包/FPS：最终生产源码与上一轮完整验证的版本相同，本轮实际保留变更为测试和证据。

### 2026-10-13：完整产物包体统计及安全压缩选项对照

已实现 compare-animation-gzip.mjs 的递归产物统计：对基线/当前文件集合取并集，新增、删除、改名 chunk 及嵌套资产全部进入记录。每个入口格式的 totals 保守计入其入口、CSS 和所有附加产物，不因名称/扩展名忽略 chunk，也不把删除入口当作收益；缺少 ESM/CJS/CSS 入口明确报错。记录当前依赖 lock SHA256 和 Node 版本。原脚本只读取当前 assets 并要求逐字相等，不能量化不同附加文件；现在可为后续分包试验提供完整成本。新增 3 个针对性测试覆盖改名/新增/删除、嵌套二进制与缺失入口，实际通过；typecheck、lint、450 行通过。未改库源码或构建配置。

正式同配置重建 exit 0：入口 ESM/CJS 增量为 11,801 / 11,606 bytes，CSS -5、worker 0；计入所有产物的 ESM/CJS totals 增量为 11,796 / 11,601 bytes，仍未达到 <10KB。旧记录保留为 gzip-results-before-recursive-accounting.json。基线少量 gzip 波动不作优化收益结论；当前实现未因统计更改而变小。

七组只改变安全压缩/输出选项的同配置试验（关闭 sequences/booleans/conditionals/join_vars、单引号、无分号、ASCII 转义）均超预算，未采用；见 gzip-format-experiments.json。基线与当前使用同一配置和依赖/WASM，各组额外 worker 增量 0，不使用 unsafe 数学/属性变换或删除功能满足预算。

环境再次实际复核：native app inventory 报 Mac locked，adb devices -l 为零设备，xcrun simctl exit 72（工具不存在）。SDK 两份许可未收到确认，未启动模拟器。10.4–10.7 保持未完成。下一步规划仍为物理峰值与完整包体优化、条件恢复后的原生验收，不提交、不发布。

完整覆盖率实际通过：130 文件/1059 测试，仓库 L/S/F/B 为 93.42/91.49/92.70/86.33%，core 保持 98.97/98.27/98.18/96.19%。本轮只有脚本/测试/证据变更，最终库源码与此前 stable-generator 验证版本相同；正式包体重建成功，不把统计脚本改善写成预算达标。OpenSpec 的规划 artifacts complete 也不代表第 10 节剩余验收已完成。

### 2026-10-13：注册时配对和兼容性判定试验（未采用）

试验 createTrackTransition：每次更新建立独立闭包，注册时配对并判定兼容性，逐帧不再扫描同一 X 序列。回归确认五帧仅 1 次判定，第二次更新总计 2 次且从 Y=15 接续到半程22.5。试验版 2 文件/41 针对性测试，全套 130 文件/1060 测试通过；typecheck、lint、450 行、build、串行包消费与 pack dry-run 通过，composable 442 行。

试验版生产桌面/小容器 8 组和移动仿真 2 组通过，Pixel Demo 截图已查看，证据 transition-classification-smoke/ 与 transition-classification-mobile/。单页生产 8 场景（8 系列、10000 总点数、两种尺寸、四种模式）、80 次记录，3 次预热/10 次记录，最低 59.9991 FPS，目标未达、>50ms 长帧和浏览器错误均 0；20 次装卸任务/元素 0、最大活动任务8，视觉阶段两尺寸也通过，整条命令 exit 0。输入 SHA256 与试验内存报告一致，见 browser-results-transition-classification.json 和 transition-classification-build-inputs.json；不扩大为完整矩阵保证。

v3 单场景三对物理增量为 27,295,872 / 28,901,376 / 27,770,880 bytes，仍超预算且与历史范围重叠；完整产物 gzip totals ESM +11,854 / CJS +11,659 bytes（gzip-transition-classification.json），相较此前同口径增加约58 bytes。因此未证明物理预算改善且增加包体成本，最终没有采用此改动，不把减少扫描次数当作目标达标。已恢复之前 stable-generator 的两个生产源码文件和测试文件，删除仅要求试验实现调用次数的用例；可复现补丁保留在 transition-classification-rejected.patch。正式 gzip-results.json、coverage-results.json 恢复为当前源码对应的报告，试验覆盖率独立保存为 coverage-transition-classification.json。

module-size-diagnostic.json 的 Rolldown 模块 metadata 与单模块压缩仅用于定位，不能相加当作最终 gzip 归因。它显示组件协调层、控制器、调度器和配置校验是较大模块，后续规划应针对这些模块的重复逻辑，不能据此删除高级接口或忽略外部 chunk。

原生检查再次确认 Mac locked，SDK 许可尚未收到确认、iOS 原生环境缺失。10.4–10.7 保持未完成，不修改预算或默认功能，不提交、不发布。

恢复后重新验证 2 文件/40 针对性测试、typecheck、lint、450 行全部 exit 0；生产源码与试验前备份 cmp 一致，正式采用方案的完整覆盖率仍为130文件/1059测试，试验1060测试报告独立保存，不混淆二者。模块诊断临时脚本首次因括号错误exit1，修正后exit0，未把失败输出当作metadata证据。

### 2026-10-13：内部字段压缩试验（未采用）

在独立临时副本中用 TypeScript Language Service findRenameLocations 定位38个包内拥有的接口字段（PropertyGroups Entry/Group、controller RecordEntry、TrackPresentation/SeriesGeometry/AnchorValue、annotation Entry 和内部累加上下文），改为专用前缀后只压缩此前缀。没有选择公开配置、句柄或消费者数据字段，原工作区 src 和 vite.lib.config.ts 未修改。基线和候选构建使用相同 Terser配置、依赖/WASM，完整递归统计计入worker/CSS。

自动改名首次typecheck exit2：结构推断的Entry/SeriesGeometry对象及一个上下文测试字面量漏改；首次修正又因已有前缀被重复添加而exit2，随后在候选副本修正并typecheck exit0。首轮未验证构建数字不作有效收益。修正后的9文件/216针对性测试通过，构建后ESM/CJS直接SSR消费检查通过，重建gzip完整totals增量为11,699/11,505 bytes。它仅比正式方案小约100bytes，仍超预算；未执行候选完整覆盖率、包声明/完整tree shaking或原生浏览器验证，不能称生产候选已验收。

最终未采用：微小收益不足以支撑38个内部字段的专用前缀、结构推断修复与额外构建维护；未更改公共功能、预算、压缩配置或正式gzip/覆盖率报告。精确改名清单、初次/修正后结果和输入SHA保存在owned-symbols-experiment.json，可复现源码补丁为owned-symbols-rejected.patch，构建参数为compress passes3、mangle.properties.regex /^__animation_/。此patch只是未采用试验，不是实施接口或规划变更。

后续仍需在协调层、控制器、校验等较大模块寻找可读且保持全部行为的重构，并分析原生分配；没有因此勾选10.4–10.7，不提交、不发布。原生Safari锁屏、Android许可确认与iOS环境限制仍未解决。

### 2026-10-13：控制器数组快照回归修复（已实现）

发现控制器 animate 原第83–85行在 group-aware 预检后仅浅复制轨道，旧任务 aborted 回调可修改调用方新配置的二维 to 数组，导致旧任务已经取消而 Animator 二次预检抛出 RangeError。此实际行为不符合 ENG-06（engine/spec.md:102）、API-04（props/spec.md:59）的预检事务与配置快照契约。不是规格之间的矛盾。新增回归首先实际失败，随后修复为取消旧对象任务前深复制 from/to 数值端点；target 对象身份保留，公开 validate 返回 void、无限循环输入、累加组预检及重入代际规则不变。没有采用 WeakMap friend 接口或绕过第二次校验。

已实现且验证：9文件/217相关测试，全套130文件/1060测试；仓库行/语句/函数/分支93.45/91.53/92.81/86.33%，core98.96/98.27/98.18/96.18%（当前 Vitest 截断口径）。typecheck、lint、450行、build、test:package、pack dry-run、格式及 diff check 通过。OpenSpec strict validate 通过；status 的4/4仅代表规划文档完整。

当前源码浏览器证据：controller-snapshot-smoke/ 中 Chromium/Chrome/Firefox/官方临时Edge各两尺寸，共8组通过；controller-snapshot-mobile/ 中WebKit iPhone/Chromium Pixel两组移动仿真通过。复用组件交互与PNG/SVG导出、Demo标注终态均通过，Edge小容器和Pixel Demo截图已查看。未重跑完整FPS矩阵；此前FPS报告仍是此前源码的历史证据，不能扩写为本次完整性能保证。

同配置/依赖/WASM递归gzip正式重建exit0，完整totals ESM/CJS增量11,824/11,637 bytes，仍超10KB；修复前报告保留为gzip-before-controller-snapshot.json。当前源码v3物理测量exit0：360×300、8系列、10000总点数、compatible、三对为26,738,688 / 34,472,064 / 23,511,104 bytes，仍超该场景10MB预算，没有把功能修复宣称为内存优化。20次enabled装卸任务/元素均0；首对GC后DOM节点/监听恢复28/14。此为单场景证据，非完整矩阵，见memory-controller-snapshot.json。

仍为规划/未完成：10.4内存预算、10.5包体预算、10.6原生Safari最终矩阵、10.7原生iOS/Android验收。CUA本轮再次返回Mac locked，已请求用户解锁；SDK两份许可尚无确认，未运行模拟器，原生iOS环境仍缺失。未勾选预算或设备任务、不缩减功能、不提交或发布。下一步仍需定位物理峰值与较大模块的可读重构；解锁及原生环境可用后执行设备矩阵。精确命令/退出码/输入SHA见controller-snapshot-verification.json。

### 2026-10-13：物理增量归因及紧凑快照反例

已实现 scripts/animation-memory-attribution.mjs：分析已完成、无测量错误的v3报告，按每次运行的全进程总峰值选取同一份sample，不叠加不同时间的各进程峰值。进程类型增量与footprint共享页总量调整项相加，断言逐对恢复原报告animationIncrementBytes。CDP heap字段彼此及与原生内存重叠，仅列诊断值，不相加、不替代预算。记录原报告SHA和生产输入SHA；脚本与报告不改变库源码或测量协议。

实际运行当前memory-controller-snapshot.json并输出memory-controller-snapshot-attribution.json，exit0。三对renderer增量为26607616 / 34521216 / 23511104 bytes；GPU各16,384 bytes，browser/network只有小增量。renderer是主要来源；其中enabled全局峰值时的used JS heap增长约10.81/12.45/14.14MB，embedder增长约10.79/11.25/8.96MB。这些是enabled相对自身基线的诊断字段，不能直接称作动画物理增量，更不能与renderer footprint相加。后续规划优先分析renderer的JS及原生SVG，而非调整GPU策略。

未采用紧凑数值快照试验：仅存line/points的x/y会丢失这些展示点的误差字段。现有animationIntegration.test.ts:95同步线条/散点/误差棒回归实际失败（39通过、1失败）；没有修改回归期望来接受缩水。已恢复geometry.ts，与试验前备份cmp一致；重跑2文件40用例通过，恢复后的typecheck/lint/450行及新增脚本格式、diff check通过。失败候选仅保存在compact-snapshot-rejected.patch。初次保存patch的辅助脚本把diff正常差异退出1误作异常，后改用spawnSync显式接受1，未造成生产改动。

本轮未重跑完整coverage/build/package/FPS：最终库源码与上一批1060测试、构建、包及浏览器验收版本一致，仅新增离线证据归因工具及记录。此前gzip/物理预算仍未达到，10.4–10.7不勾选，原生Safari锁屏、Android许可/iOS环境限制尚未解除。无提交或发布。见memory-attribution-verification.json。

### 2026-10-13：私有Y比例尺复用试验（未采用）

针对renderer分配，试验按原轴对象弱引用保存私有D3比例尺，更新私有domain而不改业务比例尺；X仍按原流程复制。投影缓存增加yDomain数值快照判断，避免比例尺身份不变后错误复用交叉淡化路径。新增保留的回归要求旧/新两份几何在250/750ms按当前展示域精确生成并移动，1000ms只留一份。没有降低点数、精度、阈值或公共功能。

候选9文件217既有相关测试通过，新增回归后2文件41测试通过；候选typecheck/lint/450行通过。v3单场景（三对、360×300、8系列、10000总点数、compatible）物理增量29,016,000 / 28,655,680 / 26,984,256 bytes，仍超10MB并与此前波动范围重叠。候选同配置递归gzip完整totals ESM/CJS增量11,868/11,673 bytes，仍超预算；见memory-private-y-scales.json、gzip-private-y-scales.json。测量启动后只进行等价Prettier格式化，报告SHA对应格式化前候选；没有将其当作最终源码验收。未执行候选完整覆盖率、包装声明、FPS或原生矩阵。

未采用：未证明物理预算收益，额外引入可变比例尺与域缓存复杂度，包体也未改善。已恢复geometry.ts及trackPresentation.ts，与试验前备份cmp一致，正式gzip-results.json恢复当前生产方案报告；候选补丁仅保存在private-y-scales-rejected.patch。保留跨帧交叉淡化回归，该测试也在恢复版2文件41用例中通过。

恢复后全套130文件1061测试通过，仓库行/语句/函数/分支93.45/91.53/92.81/86.33%，core98.96/98.27/98.18/96.18%。首次恢复版build因新测试attributes('d')可返回undefined而exit2；修正测试类型后build（含typecheck、库/声明/Demo）exit0，重建已恢复生产产物。lint、450行、Prettier、diff check通过。未重复包/FPS/完整浏览器：最终库源码与上一批已验证方案相同，新增仅回归及试验证据。候选不能因通过针对测试就标记预算已达。

原生CUA本轮实际复核仍报告Mac locked，未修改自动化/安全设置。10.4–10.7仍未完成，Android两份许可等待确认、原生iOS环境仍缺失。下一步规划继续定位renderer原生SVG及JS分配，并寻找能实际减少包体的重复逻辑；不提交或发布。精确记录见private-y-scales-verification.json。

### 2026-10-13：路径模式快照、标注规则合并及生产原生页面准备（已实现）

公共路径工厂原transitions.ts:35每帧读取input.compatible，允许调用方在已校验/复制端点后把不兼容结构切换为插值，或把插值切成淡化。这不符合PRE-02创建时确定的过渡策略与预检结果。给现有true/false两种用例增加创建后翻转compatible的动作，修复前实际2失败、22跳过；现已快照boolean，并在校验、无变化判定和帧回调共用该值。原端点拷贝/冻结和PRE-07单份终帧协议保留，README补充构造时的快照说明，未修改公共签名或根导出。

Node --expose-gc对照进一步验证留存：仅用构建transform恢复旧input.compatible捕获，不改工作区；保留返回配置并跨job做8次GC，旧实现WeakRef仍指向调用方输入，新实现可释放输入，两者during仍可执行。见preset-input-retention.json。此只证明对象可达性改善，不替代组件物理预算或宣称已达到内存目标。

标注四效果及默认D3 easing已由内部shared模块统一供公共预设和组件解析使用，删去仅用于threshold的冗余完整defaults表，其余默认值未变。新增对象型效果回归：不执行用户toString，回退scale/backOut并开发告警。告警调用在DEV分支内，生产构建可移除诊断文案，非法字段仍逐项回退；API-01要求的开发告警未缩减。独立Vite生产探针验证0/false、自定义warn不在生产调用、非法时长/easing/threshold回退及无对象coercion；首次探针因module eval旗标导致Terser worker require错误exit1，第二次错误假定单个library output而exit1，改为实际脚本和输出数组展开后exit0。不是生产库错误。见config-production-verification.json及可复现probe文本。

正式同配置/依赖/WASM递归gzip完整totals ESM/CJS增量11,703/11,534 bytes，仍超过10KB。中间合并效果映射、尚未DEV guard的报告独立保留为gzip-shared-effects-before-dev-guard.json；改动前报告为gzip-before-compatible-snapshot.json。小幅缩小不勾选10.5，不从字节差异声称显著运行时收益。

最终库版本全套130文件1062测试通过；仓库行/语句/函数/分支93.47/91.53/92.81/86.37%，core98.96/98.27/98.18/96.18%。typecheck/lint/450/Prettier/build/test:package/pack dry-run通过。final-compatible-snapshot-smoke/的8桌面/小容器案例、final-compatible-snapshot-mobile/的2移动仿真通过，Pixel Demo截图已查看。未重跑完整FPS，历史FPS仍不是本次源码完整矩阵保证。

serve-animation-native.mjs现在默认构建临时生产产物并用preview服务原生fixture和Demo；显式development模式保留，回传记录标记buildMode，允许独立证据文件以保留历史Safari记录。首次Chromium生产pilot超时，诊断确认window.animationBenchmark缺失（裸副作用导入被package sideEffects策略删除），且证据GET落到SPA返回200。已改为导出/显式导入基准对象，在configurePreviewServer中于兜底前安装路由。修正pilot两种尺寸通过，真实保存2份production记录，GET405；这是原生页面准备验证，不是Safari/iOS/Android验收。新增fixture变更后typecheck/lint/450/格式通过；不影响已验收库源码。相关server/driver均已停止，未改安全设置。

最终fixture指纹下v3单场景三对物理增量32,309,248 / 25,804,672 / 30,441,472 bytes，仍超10MB；20次装卸任务/元素均0，最大活动任务8。见memory-compatible-snapshot.json；fixture修改前的29,032,512 / 25,673,728 / 24,821,760 bytes独立保存，不混作同一输入报告。此非完整矩阵，未证明物理预算收益。

仍规划/未完成：10.4物理预算、10.5 gzip预算、10.6原生Safari最终矩阵、10.7原生iOS/Android。本轮CUA再次实际报告Mac locked；替代Safari WebDriver探针HTTP500明确远程自动化未开启，没有自行启用。原生UI路径需解锁，Android两份许可未确认，原生iOS环境仍缺失。OpenSpec strict校验通过，status 4/4只表示规划artifacts完整。没有缩减规格、勾选未验收任务、提交或发布。精确命令、失败和输入SHA见compatible-snapshot-verification.json。

### 当前版本 FPS 指纹闭合（2026-10-13）

已实现共享的 scripts/animation-build-inputs.mjs，FPS 与物理内存运行器使用同一构建输入清单及哈希算法。当前 176 个输入的 SHA256 与 memory-compatible-snapshot.json 一致，见 shared-build-fingerprint-verification.json；抽取没有改变内存 v3 的哈希口径或续跑校验。FPS 报告新增输入清单及哈希，避免把历史 FPS 扩大为后续源码保证。本批没有修改库源码，也没有采用未经证明的缓存清理或声称弱引用环泄漏。

实际先运行相关测试：10 文件 / 222 用例通过；随后 typecheck、lint、450 行检查及三个修改脚本的 Prettier 检查通过。生产 24 场景单页复测独立输出 browser-results-final-compatible-snapshot.json，完成结果另行记录；测量期间不并行执行其他构建、测试、内存基准或下载。

本批实际原生环境复核：CUA 返回 Mac locked 且自动解锁失败；adb devices -l 为 0 台设备；xcrun simctl list devices available 退出 72，工具不可用。没有更改安全设置、接受 SDK 许可或运行模拟器。10.4–10.7 仍未完成：当前物理增量与 gzip 预算尚未达标，原生 Safari/iOS/Android 尚无完整验收。未提交、发布、改变版本或归档。

当前版本复测已完整结束，命令退出 0：8 系列、两种尺寸、1000/10000/49999 总点数、四种模式共 24 场景 / 240 记录；3 次预热 / 10 次记录，最低 59.5294 FPS，按 55/50 FPS 判定的目标未达 0、>50ms 长帧 0、浏览器错误 0。20 次启用动画装卸后任务 / 容器元素均 0，最大活动任务 8。Demo 两种尺寸的标注终态通过，两张截图保存，小容器截图已实际查看。完整报告、摘要及 stdout 分别为 browser-results-final-compatible-snapshot.json、final-compatible-fps-summary.json、final-compatible-fps.txt。本次整条命令包括视觉阶段均通过；历史 stable-generator 的视觉阶段 exit 1 及独立重跑证据仍保留。

此为当前指纹下的 24 场景生产 Chromium FPS 证据，不扩展为设计完整 96 场景或其他引擎、设备的性能保证。它不测量全部原生内存，也不改变同指纹内存三对增量 32,309,248 / 25,804,672 / 30,441,472 bytes 或完整 gzip ESM/CJS 增量 11,703 / 11,534 bytes 的未达预算结论。仅更新已经完成的 10.3 证据；10.4–10.7 不勾选。库源码及包配置不变，本批未重复完整 coverage/build/package/pack，上一批结果保留其实际范围。

### 终态句柄释放修复（2026-10-13，已实施）

真实构建产物的 Node --expose-gc / WeakRef 对照确认：仅保留已完成的 Animator 句柄，会保留轨道目标和管理器；控制器句柄还会保留控制器。丢弃句柄的对照均可回收。本批添加内部 createAnimationHandle，管理器和控制器共同使用可释放的访问上下文；终止时、用户通知前保存 ID/状态并断开任务、时钟及 owner 控制闭包。没有清空任务配置或改动错误回报、deferred aborted 通知及终态提交顺序。保留句柄的修复后对照均回收目标/管理器/控制器，仍可读取 FINISHED；详细对象可达性证据和复现脚本分别为 _-handle-retention-before/after.json、_-handle-retention-probe.txt。这是公共托管句柄的可达性修复，不推断手动 Animation 实例或组件物理预算。

新增五种终止方式的两类句柄回归：finish、abort、自然完成、同 ID 替换和同步完成后，重复 pause/resume/finish/abort 不改变终态，也不取消/重新请求存活 peer 的 RAF。原版五个用例全部失败，修复后 10 个用例通过。最终相关 10 文件 / 229 用例通过；typecheck、lint、450 行通过。全套 131 文件 / 1072 测试及覆盖率通过，仓库 lines/statements/functions/branches 为 93.48/91.53/92.82/86.38%，core 为 98.98/98.09/98.26/95.94%。build、test:package、pack --dry-run 均 exit 0。最初新 helper 的 Prettier 检查 exit 1，格式修复已落实。

当前同配置、依赖及 WASM 的递归 gzip 完整 ESM/CJS 增量为 11,825/11,662 bytes，仍超 10KB，比上一方案略大；不把正确性修复写作包体优化收益。旧正式报告另存 gzip-before-handle-release.json。v3 当前源码指纹下的 360×300、8 系列、10000 总点数 compatible 单场景三对物理增量为 29,818,880 / 30,310,528 / 28,229,696 bytes，测量错误 0，20 次装卸任务/元素均 0、最大活动任务 8。预算仍未达，与此前波动范围重叠，不能从 WeakRef 回收或这三个样本声称组件物理峰值优化已证明；完整矩阵仍待达标。

当前生产 Chromium/Chrome/Firefox/官方临时 Edge 两尺寸组件/Demo 回归共 8 组通过，见 handle-release-smoke/；Firefox 小尺寸 Demo 截图已查看。本批未重跑完整 FPS，上一批 browser-results-final-compatible-snapshot.json 的 24 场景报告保留其原源码指纹，不能用作当前修改的完整 FPS 保证。

仍是规划/未完成：10.4 物理预算、10.5 gzip 预算、10.6 原生 Safari 最终矩阵、10.7 原生 iOS/Android。CUA 实际复核仍为 Mac locked 且自动解锁失败；SDK 许可仍未接受，无新原生移动环境。没有自行启用远程自动化、缩减规格、提交、发布、改版本或归档。精确检查及证据见 handle-release-verification.json。

补充最终生产移动仿真：iPhone/WebKit 与 Pixel/Chromium 的组件触摸接管、Demo 标注终态及 SVG/PNG 导出两组均通过，错误 0；见 handle-release-mobile/。Pixel Demo 截图已查看。这是桌面引擎移动仿真，不计为原生 iOS/Android 验收。

### 候选诊断与原生 Safari 闭合（2026-10-13）

三种候选均未采用，生产源码恢复至终态句柄释放版本。grid v-memo 三对物理增量 28,655,680 / 30,818,368 / 30,294,080 bytes，gzip 11,943 / 11,757 bytes；D3 索引投影为 28,196,992 / 34,340,928 / 23,805,952 bytes，gzip 11,925 / 11,769 bytes；刻度 visibility 差分为 39,370,752 / 29,704,256 / 24,248,256 bytes。均未证明稳定物理收益或预算通过；visibility 候选没有完整回归/视觉验收，其临时测试与源码共同恢复。补充 5 个保留的 D3 oracle 用例覆盖不规则 X、极值、舍入、反向/无限比例尺及复用数组变更。恢复版相关 2 文件 / 29 测试通过。

source-map 分配采样用于诊断：启用动画的采样分配总量原版 135,904,572 bytes、索引候选 131,786,148 bytes，线生成分配主要转移至 pathBuffer，D3 linear 成本仍存在。该工具加入源码映射和 HeapProfiler，函数入口/最近映射祖先的归因不是准确分配点或对象类型，也不是物理内存/FPS 预算证据。SVG 隐藏探针确认 display:none 的原生度量为零、visibility:hidden 保持原生度量；Firefox client rect 与 transformed BBox 并不等价，不能以 BBox 静默替代原契约。脚本、原始报告和未采用 patch 保留于 evidence，见 candidate-diagnostics-verification.json。

用户解锁后，原生 macOS Safari 26.6.2 已完成生产组件 1280×720 / 360×300：入场实际推进、compatible/crossfade 各出现活动任务且终态 0，SVG/PNG 导出成功并去除动画裁剪。Demo 桌面 1324px 与窄窗口 574px 实际操作重新入场、振幅/点数更新、标注增删、scale/bounce、禁用/恢复，以及入场时框选接管；截图看到完整波形、受控标注及改变后的 X 视口。Safari 最小窗口不等同 360px Demo，360px 组件由独立 fixture 验证；不声称 Safari FPS 或移动设备证明。六张截图已保存并查看，原始组件结果见 native-handle-release-safari.json，完整范围见 native-safari-verification.json。10.6 按实际验收勾选；未启用远程自动化或修改安全设置。

恢复后完整覆盖率 131 文件 / 1077 测试通过，lines/statements/functions/branches 为 93.48/91.53/92.82/86.38%，animation core 为 98.98/98.09/98.26/95.94%。typecheck、lint、450 行检查、生产 build 均通过。同源码正式 gzip 对照为 11,830 / 11,667 bytes：对比基线的小幅字节变动不作为优化收益。10.4 物理预算、10.5 gzip 预算和 10.7 原生移动验证仍是未完成规划；既有 FPS 报告保留原源码指纹，不扩大为本次完整性能验收。Android SDK 两份许可仍未收到明确接受，未运行；原生 iOS 环境缺失。不提交、不发布、不改版本或归档。

最终包消费、pack --dry-run、OpenSpec strict/status、格式整理及 git diff --check 均 exit 0。status 4/4 仅表示规划文件齐全；本批实际门禁见 native-final-verification.json。恢复仅本任务生成的两个 WASM 文件，保留用户已有改动。下一批仍需物理内存与包体优化，并在获得 SDK 许可明确接受/原生 iOS 环境后执行移动矩阵。

### D3 输出 X 字节缓存试验（2026-10-13，未采用）

候选继续使用完整 D3 line/curve 及三位精度，按当前实际输出的 rounded X 比较并缓存固定 ASCII 字节槽，不保存调用方数组或仅按比例尺身份判断，不减少点数。相关 2 文件 / 46 回归、typecheck、lint、450 行检查通过。360×300、8 系列、10000 总点数 compatible 三对物理增量为 42,402,048 / 37,863,680 / 26,902,528 bytes，仍超 10MB，未证明比恢复版稳定改善；一次 enabled 测量执行上下文被销毁，运行器重试后完成，原始错误保留，不描述为零错误。

没有继续增加缓存：候选已撤回至原 pathBuffer，未采用补丁、原始物理报告和日志保留，见 x-byte-cache-verification.json。未对该候选声称 gzip/FPS/完整覆盖率/原生视觉通过。正式物理/gzip/Safari 证据保持之前已验收源码的范围，10.4/10.5/10.7 不勾选。原生环境再次实际检查 adb 为 0 设备，simctl exit 72 工具不存在；SDK 许可尚未收到明确接受，未运行模拟器。未修改行为规格、公共功能、阈值或点数，未提交或发布。后续继续定位 renderer 瞬时物理分配及较大模块的重复逻辑，而非扩大该失败候选。

恢复后的 2 文件 / 46 测试、typecheck、lint、450 行检查均 exit 0。本批没有保留生产源码或测试更改，因此未重复完整 coverage/build/package/FPS；上一轮 1077 测试及产物验收保持其实际范围。

### Deadline 遍历及投影缓存对照（2026-10-13，均未采用）

构建产物实际保留原生私有字段，不存在可以移除的动画类兼容层。调度器以直接遍历取代每帧的数组复制/map/Math.min 展开，9 文件 / 207 测试及 typecheck/lint/450 行通过；同配置重建 gzip 对照候选完整增量 11,830 / 11,661 bytes，但动画产物自身 ESM/CJS 比旧产物增加 9/3 字节。基线的小幅变化不作收益，未采用，恢复原 Animator。没有宣称物理改善；详见 deadline-loop-verification.json。

另一候选缓存全部点的 X 原始投影及 Y 三位小数投影，相同投影复用 SVG 字符串；step 中间 X 始终比较原始值，改变投影仍通过 D3 line/curve，不减点数或跳过进度/域更新。2 文件 / 46 D3 等价和组件回归、typecheck/lint/450 行通过。单场景三对物理增量 24,543,296 / 29,196,224 / 25,952,320 bytes，错误 0，仍超过 10MB 且与此前样本重叠，不能证明稳定预算收益，因此同样撤回。没有 candidate gzip、完整覆盖率、FPS 或原生视觉通过的结论。原始报告、源码指纹及未采用 patch 保留于 projection-cache-verification.json。

本批不保留运行实现或测试变更；正式源码与上一轮 1077 测试、构建/包及 Safari 验收版本一致。10.4/10.5/10.7 保持未完成，正式 gzip 报告恢复之前已验收源码的记录。后续仍规划定位 renderer 峰值与较大模块重复逻辑，并在原生移动条件可用后完成矩阵。不提交、发布、改版本或缩减规格。

恢复后的 10 文件 / 234 测试、typecheck、lint、450 行检查均 exit 0，两个运行文件与试验前备份逐字节相同。

重新 build exit 0，恢复 dist 正式源码产物；OpenSpec strict/status exit 0，4/4 为规划 artifacts，不表示预算完成。没有重复 coverage/包消费/FPS/原生矩阵；沿用上一轮相同正式源码的实际验收范围。

### 公共预设几何形状校验复用（2026-10-13，已实施）

createPathTransitionAnimation 已先 copyGeometry 并校验/冻结端点，再为形状检查构造临时 target/track 配置、重复复制端点。现改为复用核心 sameShape 对已验证数值直接比较；同通道要求、标量/一维/二维形状、TypeError 消息、输入快照及只读输出行为保持。sameShape 仅内部导出，不加入 src/index.ts 公共入口。相关 9 文件 / 207 测试、typecheck/lint/450 行均通过。同配置递归 gzip 完整增量 ESM/CJS 为 11,820 / 11,655 bytes；相对于上一正式产物本身减少 7/9 bytes，基线字节小幅变化不作优化收益。10.5 仍未满足 10KB，不能把小重构写作预算完成或组件物理改善。

发现系统自带 iPhone Mirroring，但实际打开为尚未启用欢迎页，说明启用会转发通知/实时活动并访问 iPhone App。未点击继续、未建立新访问；已明确请求用户选择移动授权范围。Android 两份 SDK 许可也仍待明确接受，未运行。原生 iOS 环境新增这条待授权路径，仍未验收；不是原生移动矩阵完成。此前原生 Safari/FPS/物理证据保留原源码指纹，不能扩展为本次完整性能证明。10.4/10.5/10.7 不勾选，不提交、发布、改版本或归档。

用户明确回复“暂不在移动端验证”：10.7 本次暂缓，未接受 Android 许可、未继续 iPhone 镜像首次设置，不勾选移动任务；本次继续工作的范围为 10.4/10.5 预算及相关验证。

当前共享形状校验版本全套 131 文件 / 1077 测试与覆盖率通过，lines/statements/functions/branches 为 93.48/91.53/92.82/86.38%，core 为 98.98/98.09/98.26/95.94%。build、test:package exit 0；生产 Chromium/Chrome/Firefox/官方临时 Edge 两尺寸共 8 组组件/Demo、交互及 SVG/PNG 通过，Firefox 小尺寸 Demo 截图已查看，见 shape-sharing-smoke/。未重跑完整 FPS、物理或原生 Safari 矩阵；历史证据保留原指纹与范围，不能用作此次性能预算证明。具体证据见 shape-sharing-verification.json。

最终 pack --dry-run、OpenSpec strict/status 均 exit 0；status 4/4 为规划 artifacts，不表示 10.4/10.5 达标。恢复仅本任务生成的两个 WASM 文件，保留原有工作区改动，无提交或发布。

### 当前物理复测与生命周期归因（2026-10-13）

共享形状校验版本的 v3 生产实测完成，360×300、8 系列、10000 总点数 compatible 三对物理增量为 24,707,136 / 33,030,144 / 30,113,856 bytes，错误 0；20 次启用动画装卸后任务/元素均 0、最大活动任务 8。仍超 10MB，范围与历史波动重叠，不能宣称公共预设小重构改善组件物理预算。最新报告为 memory-shape-sharing.json，源码/fixture SHA 已记录；只更新单场景，不扩展为完整矩阵。

归因脚本现分别输出 before、同一时刻 globalPhysicalPeak、afterForcedGC、afterTwentyUnmountCycles，带 activeTasks/unfinished。历史及当前 GC 后样本仍有活动任务，不能当作终态或卸载泄漏证据；只有卸载后独立样本可用于相应观察。V8 usedSize/totalSize/embedder/backing 字段重叠物理内存，既不相加，也不从物理预算中扣除容量或回收值。所有归因产物明确 validForBudgetAcceptance=false。历史三对终态句柄报告的 afterForcedGC 均仍有 8 任务；第 1 对卸载后为 0 任务、28 DOM nodes，其余对没有 afterCycles 物理样本，不能扩大为三对全部卸载内存证明。

为区分线条 native d 更新成本，本批临时诊断拦截每个线条后续 d 写入，计算仍完整。它故意违反可见动画契约，绝不是生产候选：三对增量 25,509,888 / 29,786,112 / 24,903,680 bytes，测量错误 0，观测期实际略过 729/730/764 次写入。与正常范围重叠，不能证明 native path 写入是主要瓶颈，也不能精确归因其他 DOM 工作。没有采用拦截、冻结或减少点数；生产源码不变。临时脚本首次因 /tmp 无法解析 playwright exit 1，改用已安装包绝对 import 后 exit 0，失败日志保留。原始诊断、源码指纹、脚本见 memory-frozen-svg-diagnostic.json、frozen-svg-diagnostic-probe.txt 和 memory-lifecycle-verification.json。

typecheck/lint/450 行检查与三份离线归因命令均 exit 0。本批仅诊断脚本及记录变更，不重复全套 tests/coverage/build/package/FPS/原生矩阵，上一批 1077 测试和产物门禁保持其范围。10.4/10.5 仍未完成，10.7 依用户要求暂缓；下一步继续分析数值、比例尺及轴分配，不以冻结 SVG 或 heap 替代物理验收。不提交、发布、改版本或缩减规格。

### 路径计算及刻度遮挡隔离对照（2026-10-13，仅诊断）

进一步用临时 Vite pre-transform 隔离工作，生产源码未改。每份报告除正式 source/fixture 指纹外记录实际 transform 脚本 SHA，明确 diagnosticOnly=true、validForBudgetAcceptance=false，临时 runner/server 原文保存为 evidence 文本，不纳入公共流程。第一组在 pathBuffer 首次计算后直接复用旧路径，三对物理增量 29,343,744 / 29,294,720 / 29,769,856 bytes，错误 0，每对观测期实际跳过 800 次计算。结果表明仅去除路径计算不足以去除本场景物理峰值；它冻结可见波形，违反行为契约，没有采用。

第二组单独跳过 updateMaximumTickVisibility，三对增量 20,824,192 / 23,625,856 / 21,676,160 bytes，错误 0，实际跳过 106/105/106 次检查。较本轮正常样本低，但三对测量及历史波动不足以证明精确或稳定因果收益，仍超过 10MB；它会保留重叠标签/网格，违反原轴可读性契约，绝不是可交付优化。此前冻结 d 写入对照仍保留为不同诊断，不能混同忽略计算。继续方向是保留碰撞结果、字体与 native client rect 契约的轴格式/布局优化，而非删除检查。原始报告、transform、计数和归因见 compute-isolation-verification.json。

正式源码 geometry 1 文件 / 19 测试通过；正式生产实现和上一批 1077 测试、构建/包、跨桌面浏览器版本相同。临时 transform 不通过正式 TypeScript/单元测试验收，也不冒充规范实现。10.4/10.5 不勾选，10.7 继续按用户要求暂缓，不提交、发布、改版本、缩减点数或改变阈值。

正式 typecheck/lint/450 行及两份离线归因命令 exit 0。本批不重复全套 coverage/build/package/FPS/原生矩阵，历史证据保留其实际源码指纹。

### 单次刻度检查内查询复用（2026-10-13，未采用）

候选只在 updateMaximumTickVisibility 一次调用内复用 maximum labels、普通 labels 及 axis tick labels 两次格式化的查询结果；不缓存跨帧 DOM 或原生 client rect，不改变避让/精度/字体规则。3 文件 / 32 相关回归及 typecheck/lint/450 行通过；360×300、8 系列、10000 总点数 compatible 三对物理增量为 33,325,120 / 29,884,416 / 27,230,272 bytes，运行器 exit 0。减少 query count 没有证明物理预算收益，结果仍超 10MB 且重叠此前范围，已恢复原 yAxisTickVisibility；没有继续 gzip 或将候选作为生产验收。

未采用 patch、原始指纹/报告与实际错误列表见 call-cache-verification.json。正式源码保持共享形状校验版本，不勾选 10.4/10.5；10.7 依用户暂缓。本批不提交、发布、改版本或修改现行行为规格。后续应重点分析 native text/axis 写入与数值域投影，不能把减少查询次数或隔离试验低峰值当作已达标。

恢复后的正式源码与候选前备份逐字节一致；6 文件 / 50 项轴、端点、最小刻度及动画集成回归通过，随后 typecheck、lint、450 行检查均 exit 0。原始日志见 call-cache-restored-*.txt，汇总见 call-cache-verification.json。本批没有保留运行时代码修改，不重跑未变化产物的全套覆盖率、构建、包消费或 FPS；现有证据继续按各自版本和范围解释。移动端依据用户“暂不在移动端验证”保持规划/暂缓，不能勾选 10.7。

### 有界 Y 数字文本缓存（2026-10-13，未采用）

候选仅缓存舍入后的 Intl 中文数字文本，最多 256 项，元数据仍按当前域、可见最大刻度和单位生成，碰撞与字体测量未改。4 文件 / 57 回归及独立格式化对照测试（600 数值、重复/逆序、科学缩放、单位/顶部变化）通过；typecheck/lint/450 行通过。360×300、8 系列、10000 总点 compatible 三对物理增量为 31,506,496 / 27,000,896 / 27,836,544 bytes，exit 0、测量错误 0，仍超预算且重叠历史范围；撤回缓存及候选专用测试，原源码逐字节恢复。恢复后 4 文件 / 57 回归及 typecheck/lint/450 行均通过。没有候选 gzip/FPS/原生结论，10.4/10.5 不勾选，10.7 按用户暂缓。原始报告、patch、日志见 number-cache-verification.json。

### 内部已提交数值快照复用（2026-10-13，已实现）

PropertyGroups 的 entry.value、group.base 是经过数值校验、仅被替换且不暴露给消费者的内部快照；committed 直接保留它们，不再重复复制。插值、合成的有限值检查及目标赋值的独立复制保留，目标 setter 异常仍在已提交状态更新前处理。新增普通/累加两项嵌套数组隔离回归：中止其中一个写入者、外部修改此前输出数组后，活动 peer 继续使用内部提交值，原输入不变。9 文件 / 209 动画测试通过；完整 131 文件 / 1079 测试通过，行/语句/函数/分支覆盖率 93.48 / 91.53 / 92.82 / 86.38%，核心 98.98 / 98.09 / 98.26 / 95.94%。随后 typecheck、lint、450 行、构建、包消费、dry-run 打包均 exit 0。

同配置/依赖/WASM 递归 gzip 完整 ESM/CJS 增量为 11,810 / 11,646 bytes；本身产物减少 7 / 6 bytes，基线 gzip 同时漂移 +3 / +3 bytes，不能将增量变化 10 / 9 bytes 全归为源码收益。仍未达到 10KB。Chromium/Chrome/Firefox 两尺寸组件及 Demo/交互/导出共 6 组生产冒烟通过，Firefox 小尺寸 Demo 截图已查看。未重跑原生 Safari/Edge、完整 FPS 或移动原生，各历史指纹及范围保留。最新360×300、8系列、10000总点 compatible 三对物理增量为 25,198,656 / 33,030,272 / 23,740,416 bytes，exit 0、错误0，20次动画装卸任务/元素0。组件使用回调驱动的空 tracks，不能由公共数值轨道复制减少推断组件内存收益。10.4/10.5 保持未完成，10.7 按用户暂缓。原始日志、当前指纹与局限见 committed-sharing-verification.json。未提交、发布、改版本或缩减规格。

### 数值 X 投影缓存及缓动家族表（2026-10-13，均未采用）

数值 X 候选只缓存 D3 数值投影，保留原 D3 curve/context/舍入；比例尺引用、domain、range、clamp、unknown、插值工厂或逐点 X 变化会失效，自定义插值工厂绕过缓存。候选精度/集成 2 文件 / 47 测试及 typecheck/lint/450 行通过；360×300、8 系列、10000 总点 compatible 三对生产物理增量 27,426,688 / 29,622,464 / 31,260,736 bytes，exit 0、错误0。结果仍超预算且重叠已知范围，未证明峰值改善，撤回缓存及其专用 D3 oracle 测试；没有候选 gzip/FPS/原生结论。

缓动家族表候选保持静态 D3 导入、31 种映射及 pure factory，以固定家族/方向数组生成映射；9 文件 / 209 动画回归通过。同配置/依赖/WASM 递归 gzip 实测候选完整 ESM/CJS 增量 11,825 / 11,671 bytes，但不能把基线漂移混为源码效果：候选自身产物实际增加 14 / 24 bytes。撤回候选，恢复原显式映射及正式 gzip-results.json；没有为已知包体积倒退的候选继续 typecheck、包消费或完整覆盖率。

三份恢复源码与试验前备份逐字节一致。恢复后 10 文件 / 236 动画及集成回归、typecheck/lint/450 行通过；当前正式源码仍为上一批内部提交快照复用版本，完整 1079 测试及构建/包/6 组浏览器证据保留其原范围，不重复未变化运行时的完整门禁。正式物理预算仍为 memory-committed-sharing.json 的三对超限，正式 gzip 增量仍 11,810 / 11,646 bytes。10.4/10.5 不勾选，10.7 按用户暂缓；原始报告、指纹、patch 和日志见 numeric-x-family-verification.json。未提交、发布、改版本或缩减规格。

### 独立过渡源快照（2026-10-13，未采用）

候选在注册轨道更新前独立复制旧数值几何，旧渲染元数据移除完整查询 source/points，旧轨道引用替换为当前轨道；保持四列误差数据、样式、域及基于完整数据缓存的标注锚点。原有 2 文件 / 46 测试及 typecheck/lint/450 行通过；其后新增的候选专用 2 项绘制 oracle 也通过，覆盖兼容/点数变化淡化在 0/0.25/0.5/1 的线、点、误差棒、样式、透明度及标注锚点，未再为该专用测试运行 typecheck。360×300、8系列、10000总点 compatible 三对生产物理增量为 33,407,104 / 25,624,576 / 35,193,088 bytes，exit 0、错误0。减少源码引用图不等于证明实际 GC 或自然物理峰值下降；所有样本仍超预算，没有采用。

两个运行时文件与试验前备份逐字节恢复，专用 oracle 移至 evidence 文本供审阅。恢复后 10 文件 / 236 回归、typecheck/lint/450 行均通过。未为已拒绝候选继续 gzip、完整覆盖率、包消费、FPS 或原生验证；正式源码仍为内部提交快照复用版本。当前正式内存及 gzip 数值和任务10.4/10.5未完成状态保持，10.7继续按用户暂缓。原始报告/指纹/patch/日志见 detached-source-verification.json。

### 当前正式源码完整 FPS 矩阵（2026-10-13，进行中）

原完整96场景是开发模式/并行页面，后续生产证据只覆盖较早源码的24场景。本轮在独立单页上启动当前正式源码96生产场景，3次预热、10次记录，不同时构建或测内存。已观察5场景/50记录，最低59.5322 FPS、阈值内目标未达/长帧/错误0；进程仍运行，没有退出码、完整矩阵、视觉阶段或20次装卸结论。实际源码/fixture/WASM指纹和运行句柄记录见 full96-live-progress.json，原始阶段报告见 browser-results-final-committed-full96.json。不将阶段数据勾选为完整通过，不更新物理预算或移动原生验收。

### 当前正式源码完整96场景生产FPS验收（2026-10-13，已验证）

同一原进程正常完成、exit 0，未重启或缩减场景。核对完整笛卡尔矩阵：1280×720/360×300、1/8系列、1000/10000/49999/50000/50001/100000总点、static/enter/compatible/crossfade，共96场景，逐场景3预热/10记录，960条观测均>=2100ms。当前正式源码/fixture/WASM指纹15a5861c31815e6170e5a12c68d61b5077a12f70f33d43fb59b99170fa37d4bd；最低59.529433997918574 FPS，阈值内55/50目标未达0、>50ms长帧0、浏览器错误0，每条观测结束任务0。50k及以上各模式maxActiveTasks0，36组静态降级对照保留中位FPS差及显示坐标集合，微小差异不解释为“绝对无性能损失”。20次动画装卸任务/元素0、maxActiveTasks8。两尺寸Demo视觉阶段通过、标注settled，两张截图已实际查看。

见 browser-results-final-committed-full96.json、final-committed-full96-summary.json、final-committed-full96-stdout.txt；原live progress记录现标记completed，不冒充仍有运行作业。10.3现证据扩大到当前源码完整Chromium生产矩阵，历史开发并行和24场景证据保留各自范围。本轮等待期间没有修改源码、并行构建或测内存。此证据仅headless Chromium FPS，不代表原生其他浏览器FPS，不把JS heap装卸记录替代物理内存预算；10.4/10.5仍未达，10.7依用户暂缓。不提交、发布、改版本或缩减规格。

### SVG Text 节点复用（2026-10-13，未采用）

候选在已有且唯一Text子节点时只改nodeValue，其他内容继续textContent替换；对轴定位文本和两次compact格式化应用同一内部函数。不改变文本内容、可见性、字体或原生client rect。6文件/51回归及typecheck/lint/450行通过，含节点身份、空文本和混合tspan回归。360×300、8系列、10000总点compatible三对生产物理增量28,885,056 / 24,297,536 / 22,413,376 bytes，exit0、错误0，仍超预算且重叠既有范围；未证明峰值收益，撤回候选及专用测试。

三文件恢复后与备份逐字节一致，6文件/50测试及typecheck/lint/450行通过。没有候选gzip/FPS/原生结论，正式源码仍为内部提交快照复用版本，完整96场景FPS证据仍适用原正式指纹；不重复未变化运行时的全套覆盖率/构建/包门禁。10.4/10.5保持未完成，10.7按用户暂缓。原始报告、patch、日志和指纹见text-node-verification.json。未提交、发布、改版本或缩减规格。

### 当前正式源码完整12场景物理矩阵（2026-10-13，预算未通过）

v3生产同一指纹15a5861c31815e6170e5a12c68d61b5077a12f70f33d43fb59b99170fa37d4bd的1280×720/360×300、8系列、10000/49999总点、enter/compatible/crossfade，共12场景36对，原命令exit0。完整报告memory-final-committed-full12.json，逐组汇总final-committed-full12-summary.json。桌面10k compatible/crossfade发生11次execution context destroyed失败尝试并自动重试，原错误保留，不能把exit0当作无错误验收；归因工具要求errors0，未强行绕过。

36对成功测量20次装卸任务/元素均0，max8，但每场景只有第一对保存afterCycles物理样本，其余只有资源计数；GC后仍可能活动任务，不当作终态泄漏证明。预算仍未达：桌面49999淡化83.35–87.24MB、小容器49999淡化53.41–55.20MB；10k兼容分别22.89–23.02MB和27.82–30.16MB。小容器入场各三对低于对应目标，不扩大为全部模式通过。下一步补充失败phase/导航/pageerror诊断，复测出错两组，再针对淡化的投影/DOM成本优化。10.4/10.5不勾选，10.7按用户暂缓；未修改运行时、规格、版本或提交发布。

运行器现记录失败phase、主frame导航、pageerror/crash及stack，成功浏览器也保存诊断；不改变测量时钟、样本/点数、进程计数或GC位置。此前出错的1280×720/10000 compatible/crossfade各3对复测exit0、错误0，每浏览器只有初始导航且pageerror/crash0，原异常没有复现，不声称历史错误已修复。兼容增量24,035,328 / 28,639,360 / 25,083,904 bytes；淡化64,143,552 / 54,952,000 / 48,185,536 bytes，仍超10MB。原完整报告不被拼接/覆盖，11错误保留，独立复测只证明其自身范围。错误0复测的离线同一峰值进程归因exit0，诊断仍validForBudgetAcceptance=false；见memory-phase-verification.json及memory-final-committed-error-scenes-attribution.json。

本批诊断脚本lint、正式typecheck、450行检查均exit0；完整FPS/1079测试及产物门禁仍按未变化运行时的上一批范围，不重跑。后续重点处理交叉淡化双份几何投影成本，原数据/标注查询及最多两份几何契约不变。

### 累加插值单遍历（2026-10-13，未采用）

候选合并插值和累加相减到一次combineValues遍历，保留原乘加/相减顺序与最终copyAnimationValue有限值校验及输出隔离；9文件/209测试、typecheck/lint/450行通过。首次gzip在恢复后的WASM输入下exit0，虽单次基线/候选使用相同WASM，但指纹不同于正式已准备WASM报告，不能横比实际产物。准备WASM后指纹与正式报告一致，递归ESM/CJS完整增量11,821 / 11,659 bytes；候选产物实际增加6 / 9 bytes，基线同时漂移-5 / -4 bytes，未将漂移误归源码收益。公共累加数组分配减少并不能推断组件空轨道回调路径的物理收益，因此未保留候选。

两源码逐字节恢复、正式gzip报告恢复；恢复后9文件/209测试及typecheck/lint/450行exit0。没有候选组件物理内存、完整覆盖率/包/FPS/原生结论，正式源码及96场景FPS指纹保持。10.4/10.5未完成，10.7按用户暂缓。原始两个gzip输入/报告、patch和日志见fused-additive-verification.json。未提交、发布、改版本或缩减规格。

### 交叉淡化分配归因及网格节点复用（2026-10-13，已实现）

桌面1280×720/8系列/49999总点crossfade的production+sourcemap V8采样静态48,370,088/启用240,313,536 bytes；包括已回收对象和最近映射祖先归因，不是物理峰值、精确对象类型或FPS验收。D3曲线/line、Vue仍主要，背景网格约6.83MB分配差。临时构建省略整个Backdrop三对物理增量53,854,400 / 50,446,336 / 53,837,888 bytes、错误0；它违反背景/网格/水印视觉契约，只隔离诊断，未写入运行时。脚本/transform指纹、原始profile和报告见crossfade-allocation-summary.json与memory-omit-backdrop-diagnostic.json。

正式优化在Backdrop保留背景/水印Vue渲染，四组网格依数值刻度复用独立SVG line，保持data-grid-direction、minor/major样式、逐线避让与clip；仅改变的坐标/颜色写入，节点重排/移除一致，不缩减点数或双份几何。首轮5文件/46测试通过但typecheck因可省略stroke颜色exit2，修正undefined删除属性后6文件/48测试及typecheck/lint/450行通过。新增两方向回归覆盖节点身份、坐标域变化、顺序、移除、无stroke颜色及既有display遮挡标记。

同场景候选三对57,065,536 / 59,588,672 / 60,768,256 bytes，其间恢复原源码对照80,183,424 / 83,935,360 / 75,661,504，再恢复候选三对54,313,024 / 59,408,448 / 57,081,856；两轮候选错误0，原源码对照保留1次execution context destroyed重试（warmup-3-mount）；三轮成功运行的装卸任务/元素0。此机器上复现方向性改善，不声称精确因果幅度或全矩阵达标，仍超20MB。完整同配置/依赖/已准备WASM gzip ESM/CJS增量12,010 / 11,833 bytes，候选产物实际增加197 / 184 bytes（基线漂移-3/-3），接受小包体积代价换取较大、复现的淡化物理改善，10.5仍需继续达标。

完整132文件/1081测试、覆盖率（行/语句/函数/分支93.51/91.57/92.81/86.45%）、build/包消费/dry-run打包通过；core覆盖率98.98/98.09/98.26/95.94%。Chromium/Chrome/Firefox桌面/小容器6组生产组件与Demo/交互/SVGPNG通过，Chromium桌面组件及Firefox小Demo截图实际查看。见grid-dom-verification.json。正式源码现在为网格节点复用版本，历史96场景FPS、原生Safari/Edge保留旧指纹；最终新源码复验仍规划，10.3/10.6重置未完成，10.4/10.5未达，10.7依用户暂缓。不提交、发布、改版本或缩减规格。

最新网格版本10000点compatible两尺寸各三对exit0/错误0：1280为25,673,728 / 22,249,344 / 23,920,512 bytes，360为25,182,208 / 31,785,088 / 26,869,824 bytes。仍超10MB，没有稳定兼容模式收益结论；淡化方向性改善与兼容预算分开。见memory-grid-dom-compatible.json。

网格正式源码96场景生产FPS复验现已启动，exec session75542、单页、3次预热/10次记录，输出browser-results-grid-dom-full96.json，日志/tmp/animation-grid-dom-full96.log。进程未完成，不填退出码或声称通过。复验期间不并行构建/内存负载或改运行时。

### 网格节点复用最终版本验证闭合（2026-10-13）

原FPS session75542正常结束exit0，完整96场景/960记录，逐场景3预热10记录、每条>=2100ms；最低59.529433997918574 FPS，阈值内55/50目标未达0、长帧0、错误0、观测结束任务0。阈值及以上任务0，36组与静态基线的显示坐标一致；20次装卸任务/元素0、最大任务8。两尺寸Demo截图实际查看，波形/网格/标注完整。当前指纹8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526，见grid-dom-full96-summary.json及原始报告/日志。10.3按实际证据勾选，不把JS heap等同物理预算。

原生Safari26.6.2当前生产组件1280×720/360×300入场推进、兼容/淡化任务与SVGPNG终态导出通过。桌面1324×965、窄窗口578×859 Demo实际验证标注并发更新、点数变化、入场框选接管、禁用更新、恢复/bounce/重新入场及受控删除；七张截图保存并查看。当前Chromium/Chrome/Firefox/官方临时Edge各两尺寸8组生产冒烟exit0，Edge小Demo截图已查看。见native-grid-dom-verification.json和grid-dom-final-smoke/。10.6勾选；原生服务已停止（主动SIGINT exit130是服务清理，不是验收失败），未启用远程自动化或改变安全设置。

修正文档一处错误：此前“三轮错误0”不准确，原源码内存对照实际保留1次warmup-3-mount上下文销毁重试；两轮候选错误0，失败不删除。物理预算10.4、gzip预算10.5仍未达，10.7按用户暂缓；现行规格、版本及公共功能不缩减，不提交或发布。

### 默认双端点比例尺数值计算诊断（2026-10-13，未采用）

临时Vite pre-transform在pathBuffer中为默认双端点有限数值D3比例尺使用同运算顺序的数值投影，保留D3 line/curve、精度、图表视觉及所有动态几何；多端点、自定义插值和非有限域回退原scale。384组路径oracle涵盖四种曲线、正反/退化/极端/多端点域与range、clamp、自定义interpolateRound，实际exit0。工作区运行时源码未改，transform/server/runner及其哈希单独保存。

360×300、8系列、10000总点compatible三对物理增量35,307,648 / 29,605,952 / 42,860,672 bytes，exit0、错误0，仍超10MB且未证明收益。没有采用，不为诊断宣称完整单元/包/FPS/原生验收，也不改正式gzip或浏览器报告。见affine-projector-verification.json，validForBudgetAcceptance=false；诊断进程已正常结束。正式1081测试、完整96场景FPS、Safari/四桌面引擎验收保持原指纹适用范围。10.4/10.5仍为未完成优化，10.7按用户暂缓；下一批应继续关注renderer实际分配与协调/验证模块重复逻辑，不重复这个无收益候选。

最终收尾验证先跑相关4文件/34测试exit0，再typecheck、lint、450行检查全部exit0；OpenSpec strict/status与diff check通过（status4/4仅规划文档完整）。此次只改记录/诊断文件，未重复未变化运行时的1081全套覆盖率或build/包消费。核对prepare:wasm后共享输入SHA恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526，与最终FPS/内存一致；恢复受跟踪WASM后SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，差异仅来自生成WASM。保留用户原有工作区改动，不提交或发布。见grid-dom-final-verification.json。辅助文档追加命令首次因stdin编码报SyntaxError，显式UTF-8后已成功，未修改运行源码。

### 轴构造、模板复用、网格变换及压缩选项复验（2026-10-13，均未采用）

按正式网格节点复用版本继续优化，未调整现行规格或点数。惰性构造 D3 axis 候选仅在刻度结构/range/devicePixelRatio 变化时创建轴；3 文件 / 33 测试及 typecheck/lint/450 行检查通过。360×300、8 系列、10000 总点 compatible 三对物理增量 34,750,464 / 35,045,440 / 30,097,472 bytes，exit0、错误0，未显示收益，三文件逐字节恢复；恢复后 3 文件 / 32 测试通过。见 lazy-axis-verification.json。

轴 Vue 模板 v-memo 候选保留当帧 D3 域写入，仅复用结构/标签/样式未变化的模板。7 文件 / 76 测试及 typecheck/lint/450 行通过；同场景三对物理增量 35,799,104 / 26,689,600 / 48,037,888 bytes，exit0、错误0，未显示收益，撤回。见 axis-template-verification.json。

网格数值组变换候选保留逐线避让、裁剪、非缩放描边及不适用比例尺的原路径回退。4 文件 / 44 测试及 typecheck/lint/450 行通过；同场景三对物理增量 44,154,944 / 42,860,608 / 43,728,896 bytes，exit0、错误0，报告完整结束，未显示收益。候选四文件逐字节恢复，新增 helper 删除，patch 与原报告保留。没有为这些已拒绝候选继续完整覆盖率、gzip/FPS/原生验收；不能把减少属性写入当作物理峰值收益。见 grid-transform-verification.json。

独立临时构建测试非 unsafe 的 Terser inline:false、reduce_funcs:false、collapse_vars:false 及组合，工作区配置/源码/正式产物未改。相同配置、依赖及已准备 WASM，递归并集完整 gzip ESM/CJS 增量分别为 12,018/11,822、11,995/11,771、12,005/11,806、12,007/11,780 bytes，命令 exit0。全部超过 10KB，未采用，不将基线漂移解释为源码压缩收益。见 gzip-inline-experiments.json 及原脚本/日志。

正式已实现内容仍为网格节点复用、引擎/预设/组件及公共接口；预算优化候选仅为试验，不是已实现功能。10.4/10.5 继续未完成，10.7 依用户“暂不在移动端验证”延期。下一批建议先对 renderer 的原生 SVG path 更新成本做有界隔离归因，再检查配置校验与生命周期协调中的重复逻辑；任何候选都需先验证精度/契约，再复测物理预算和完整 gzip。未提交、发布或改版本。

候选撤回后的正式源码先运行4文件/42测试，再依次typecheck、lint、450行检查，全部exit0；OpenSpec strict/status通过。已准备WASM输入指纹恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526，与已验收正式FPS/桌面浏览器版本一致；因此不重复未变化运行时的1081测试、构建或浏览器矩阵。仅恢复任务生成的受跟踪WASM文件，保留其他已有改动。原始恢复验证日志见grid-transform-restored-*.txt。

### 完整刻度标签缓存与连续四列几何快照（2026-10-13，均未采用）

完整标签缓存试验按轴弱引用保存最多两种指数/最高可见刻度/单位/轴侧组合，每种最多64值；域指数改变、可见最高刻度改变或单位/左右轴变化重新格式化，native字体/碰撞测量原样保留。6文件/71测试及typecheck/lint/450行通过，包含跨科学指数边界、缓存上限和原地tick/domain变更对照。360×300、8系列、10000总点compatible三对物理增量33,390,656 / 30,916,544 / 44,433,536 bytes，exit0、错误0，仍超10MB，没有证明收益。撤回两源码和新增helper/test，未为候选宣称gzip/完整覆盖率/FPS/原生验收。见axis-label-cache-verification.json及patch/原始日志。

连续Float64几何候选只改变组件私有快照存储，保留X/Y/上下误差四列、double精度、逐帧数值插值及D3路径生成；公共AnimationValue/NumericGeometry数组接口未改。10文件/236测试、typecheck/lint/450行通过，误差同步和替换端点隔离回归通过。相同物理场景三对27,295,808 / 32,964,672 / 26,148,864 bytes，exit0、错误0，仍超10MB并重叠正式范围，未证明收益。同配置/依赖/已准备WASM的递归完整gzip ESM/CJS增量12,044 / 11,862 bytes；候选产物自身增加36/31 bytes，基线漂移+2/+2，不能混为源码收益。三源码/测试逐字节恢复，未采用。见packed-geometry-verification.json及两份原始报告。

当前网格版本额外复验Oxc和不压缩两种构建，临时输出目录、工作区配置/源码/正式产物不变；同输入完整ESM/CJS增量分别12,995/11,762、17,436/17,362 bytes，exit0。较早Oxc结果仍保留其原源码范围，不说这次是首次测试Oxc；两种方式均未达10KB，不采用。见gzip-oxc-experiments.json与原脚本/日志。

已实现正式源码仍为网格节点复用版本；缓存和Float64只属于未采用的优化试验。10.4/10.5保持未完成，10.7依用户暂缓，当前完整FPS/桌面浏览器证据仍按正式指纹解释。下一批需针对布局/格式/渲染协调的真实分配或可验证的重复代码收敛继续优化，避免重复已失败候选，不缩减点数、精度、功能或调整测量预算；未提交、发布、改版本。

本批恢复后先运行14文件/278相关测试，再typecheck、lint、450行检查，全部exit0。OpenSpec strict/status通过，status4/4仅代表规划文档完整。已准备WASM输入指纹恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；不重跑未变化正式运行时的全套覆盖率/包/FPS/桌面矩阵。仅恢复任务生成WASM，保留其他工作区改动。见两候选verification.json中的restoredValidation与label-packed-restored-*.txt。

### 稳定变量名及仿射 SVG 投影隔离（2026-10-13，仅诊断，未采用）

Terser变量名缓存试验先从临时未压缩产物生成仅变量名缓存；基线与当前构建分别使用相同初始缓存的独立副本，初始缓存SHA一致，不压缩公共属性名。两种module设置的递归并集完整gzip结果均为ESM11,947/CJS11,737 bytes，exit0，仍超10KB。工作区配置/源码/正式产物未改，不采用；缓存、脚本、日志见gzip-name-cache-experiments.json和terser-variable-name-cache.json。

临时Vite pre-transform对不变的线条数值快照使用D3全精度基路径，并从当前默认线性比例尺计算数值矩阵，由Vue绑定路径transform及non-scaling-stroke；非双端点、clamp、自定义插值、非有限或动态几何回退原路径。固定投影oracle114组exit0，与未舍入D3最大差1.1368683772161603e-13，但与正式三位小数路径最大差0.0005000000000592308。它不是保持现行路径精度的正式候选：tasks.md任务10.1要求D3路径精度不变，当前诊断不满足；没有修改这一验收或四份specs，也不把oracle当作原生SVG几何/描边/裁剪视觉验收。

1280×720、8系列、49999总点crossfade三对物理增量43,909,184/41,615,296/37,437,568 bytes；间隔正式源码对照96,977,024/63,946,816/100,810,752；同一诊断复测47,530,048/43,941,952/42,172,480，三次命令均exit0、错误0，20次装卸任务/元素0。实际每个动画样本建16条基路径、复用1744–1944次，静态样本0，确认transform确实应用。支持本机下降方向，不宣称精确因果幅度或20MB预算通过，正式对照大幅波动完整保留。复测首对读取计数时已有8条带transform线条（开始16条）；没有断言自然完成/导出时transform清理，不把装卸资源0当作终态视觉效果均清除。

扩展隔离对动态数值几何每帧检查所有线点当前投影与矩阵结果（绝对误差<=1e-9），不满足仿射关系即回退。184组oracle包含五种曲线、动态X/Y/域、非仿射扰动及不适用比例尺，exit0，与未舍入D3最大差1.7053025658242404e-13；仍与正式三位小数路径最多相差约0.0005。360×300、8系列、10000总点compatible三对物理增量21,790,720/38,535,232/38,240,192 bytes，exit0、错误0，建8条/复用840–848次，实际数值检查最大误差5.684341886080802e-14，装卸任务/元素0，仍超10MB。此诊断未改变点数或查询/标注完整数据，但不能因代数等价就忽略原生SVG浮点/描边行为与现行精度差异，没有采用。

运行时工作区源码未改。两个诊断的报告均diagnosticOnly=true、validForBudgetAcceptance=false，正式源码/fixture/WASM SHA为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526，实际helper/server/runner的不同SHA另存affine-svg-projection-verification.json。没有候选完整覆盖率/包/gzip/FPS/原生视觉结论，正式1081测试和96场景FPS/桌面矩阵继续按正式源码解释。10.4/10.5仍未达，10.7按用户延期，未提交、发布或改版本。后续应优先找保持现行精度的布局/生命周期及重复逻辑优化，不直接采用本诊断来绕过10.1。

本批收尾先运行正式3文件/49相关测试，再typecheck、lint、450行检查，全部exit0；OpenSpec strict/status通过，status4/4仅规划文档完整。库运行时和配置均未改，不重复正式1081全套覆盖率、构建/包/FPS/桌面矩阵。仅恢复任务生成的受跟踪WASM，保留其他工作区改动。验证日志见affine-svg-formal-*.txt。

### 原生文字边界与延迟遮挡提交（2026-10-13，未采用）

先用 Chromium/Firefox/WebKit 各270组文字尺寸、锚点、内容与变换对照原生 getBoundingClientRect。缓存局部 getBBox 后投影不能保持原生边界：double 最大差分别0.23657、1.15278、0.09734px，因此没有采用近似边界。另810组对照确认 visibility:hidden 不改变原生文字边界，hiddenMismatches 全部0；这些是诊断，不是预算或原生Safari验收。

候选保留原生测量、字体及避让算法，先计算整次隐藏集合再提交DOM差异；文字使用visibility:hidden保留边界，线条仍display:none，边界刻度线单独处理。3文件/40测试、typecheck/lint/450行检查通过。两尺寸、兼容/淡化、三个headless引擎的120次状态观测及12组SVG截图与正式实现完全一致；小尺寸Firefox候选截图实际查看。该功能对照注入手动RAF/时钟，不测FPS；报告缺少每轮浏览器版本/构建指纹，不能事后以oracle版本补记，不能当最终组件/Demo/导出或原生Safari验收。

360×300、8系列、10000总点compatible的生产三对物理增量40,681,536 / 51,707,968 / 42,025,088 bytes，运行exit0、错误0；20次动画装卸任务/元素0、max8。结果仍超10MB且未证明收益，候选未采用，两份源码/测试逐字节恢复；恢复后3文件/40测试、typecheck/lint/450行通过，已准备WASM的正式输入SHA恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。未继续候选gzip、完整覆盖率、包、FPS或原生验收；正式完整1081测试及96场景FPS/桌面矩阵仍仅按其原指纹解释。原始oracle、probe、patch、日志、报告指纹见evidence/visibility-layout-verification.json。

本轮新增的是诊断证据与实施记录，没有新增已交付运行时优化。10.4物理预算和10.5完整gzip预算仍未完成；10.7依用户“暂不在移动端验证”延期。后续规划是重新按renderer原生分配定位可保留精度的优化，再收敛配置/生命周期重复逻辑并复测完整gzip；不重复已失败候选，不改规格/版本，不提交或发布。

### 预计算兼容性与私有过渡对象复用（2026-10-13，均未采用）

先通过 CodeGraph 定位配置/协调模块，发现组件 transitionTrack 每帧重复扫描端点 X 判定几何兼容。首个候选把判定移至一次性过渡工厂，保留插值、淡化、锚点及域计算；连续替换先取消旧时间线，固定端点不再随其旧帧变化。新增三项回归覆盖端点扫描次数、几何/锚点/域同步、淡化两份及终态单份、下一次计划重新判断、被替换半程端点不变。首轮新增测试对getter次数预期错误，实际三次而非四次；改为比较稳定后续帧的读取增量后3文件/49测试通过，原失败日志保留，不把首次运行记通过。typecheck/lint/450行均通过。

360×300、8系列、10000总点compatible生产三对物理增量45,105,152 / 32,063,552 / 31,883,392 bytes，exit0、错误0；同配置/依赖/已准备WASM递归完整gzip ESM/CJS增量12,035 / 11,855 bytes。相对正式报告，实际产物增加24/21bytes，基线同时漂移-1/-1，不能把增量变化全归为源码收益。未达到任一预算，未采用。

第二变体在同一私有时间线内复用系列Map、系列展示对象、锚点Map/对象；逐帧只更新数值、透明度和展示域，终帧仍返回目标单份，真实查询/公共帧对象/点数/D3精度不变。3文件/49测试及typecheck/lint/450行通过。相同生产场景三对物理增量36,831,232 / 37,978,176 / 44,400,512 bytes，exit0、错误0；完整gzip ESM/CJS增量12,053 / 11,872 bytes，实际产物增加45/41bytes、基线漂移+2/+2。也未证明预算收益，未采用。两候选20次动画装卸任务/元素0、max8；资源0不能代替自然峰值预算或视觉终态证明。

两个运行时源码逐字节恢复，新候选测试移至evidence文本，未留下生产重构。恢复后2文件/46相关回归通过；其他恢复门禁及指纹见transition-planning-verification.json。两个构建在临时目录完成，未覆盖正式dist或gzip-results.json。不为未采用候选宣称完整覆盖率、包消费、FPS、组件/Demo/导出或原生矩阵验收。原始报告、patch、探针、测试及成功/失败日志均保留。

正式已交付运行时仍是网格节点复用版本。10.4/10.5继续未完成；10.7按用户暂缓。下一批规划应继续针对原生renderer分配和可复现的包体重复代码，不再重复此次兼容性/私有对象复用试验；不改规格、点数、阈值、版本，不提交或发布。

### 完整自然观测窗与逐次装卸物理样本（2026-10-13，测量工具已实现，预算未通过）

审阅原v3测量发现其固定6次样本常在2秒动画结束前开始强制GC，且20次装卸物理样本只保存每场景第一对。现v4扩展到挂载返回后至少duration+100ms并观察任务归零才结束自然采样；窗内无强制GC。每次运行均记录settled GC留存、20次装卸后未经GC和GC后的物理样本，保存footprint采样时间及runner SHA；不会把GC后值替换自然峰值。旧v3原始报告保留，v4不与它们直接比较推断优化收益。它仍是挂载完成后的离散采样峰值，不证明挂载中或采样间的真实最大值；包括SystemInfo所列browser/renderer/GPU/network进程，不包含无法归因到这些进程的驱动/系统分配。

归因器支持历史v3；对v4核验观测时长、采样时间顺序/范围、终态任务0及每次装卸前后样本/资源。新增7项CLI回归验证相同总峰值进程分账、峰值与GC值分离、历史版本不暗示完整窗，以及短窗、未settle、缺少装卸样本、错误峰值和未完成报告拒绝。与gzip核算测试共2文件/10测试通过，typecheck/lint/450行及node语法检查通过。只有脚本和脚本测试改变，库运行时未改，正式已准备WASM输入SHA仍8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；此前完整1081测试、包/FPS/原生桌面证据保留其实际源码范围，本轮不重复声明这些门禁重新运行。

v4首两组各三对、exit0/错误0：360×300/8系列/10000总点compatible增量35,438,848 / 37,093,440 / 43,253,824 bytes；1280×720/8系列/49999总点crossfade增量84,590,720 / 87,359,488 / 87,490,560 bytes。严格归因exit0，主要增量来自renderer，GPU/browser/network差值小；均超预算。10000兼容组settled强制GC后的配对物理增量约3.47–3.82MB，装卸后GC约3.47–5.65MB，不能以这些留存数字代替35–43MB自然峰值。

另起独立完整12场景（两尺寸×10000/49999×入场/兼容/淡化）、36成功对，命令exit0，72成功浏览器运行覆盖2109–2355ms且末尾任务0。每次20循环任务/根元素0，所有循环后GC DOM计数回到各运行挂载前基线。只有7对低于对应预算、29对超标；小容器入场两场景三对均低于目标，八个更新/淡化场景全部超标，不扩大为预算通过。完整报告保留桌面49999compatible的1次enabled=true、warmup-2-mount execution context destroyed失败尝试，初始导航后无其他记录导航、pageErrors0；归因器按原严格规则exit1拒绝，未删失败或绕过。

独立复测这个出错场景，三成功对65,617,984 / 63,144,064 / 52,559,936 bytes，命令exit0；但enabled=false、warmup-2-mount又发生1次同类失败，重试后完成，严格归因同样exit1。它不能证明异常修复，不拼接为完整无错误报告。成功数值依然超20MB，错误/phase/stack/导航列表原样保留。完整数据的描述性汇总明确diagnosticOnly=true、validForBudgetAcceptance=false；峰值、settled及循环前后GC分列，不将新数据改变成已完成10.4。

本轮已实现的是完整窗测量及逐运行装卸证据/核算回归；性能/包体优化仍规划。10.4内存、10.5完整gzip保持未完成，10.7按用户暂缓。下一批先捕获Runtime执行上下文生命周期与renderer进程变化，定位重复的第二次静态预热异常；再独立试验不改变精度/裁剪的SVG合成层，验证原生视觉、物理峰值及完整gzip。未提交、发布、改版本或缩减规格。原命令、exit码、runner/probe指纹、四份报告及限制见physical-memory-full-window-verification.json。

### 上下文生命周期、SVG 合成层与压缩格式复测（2026-10-13，诊断及未采用候选）

生命周期诊断在导航前订阅Runtime/Page事件，并在每次静态预热前增加SystemInfo查询。30个全新Chromium浏览器、90次49999点预热均成功，未观察到预热中的上下文销毁、导航或崩溃，exit0；额外协议调用改变时序，不能证明此前完整物理报告的间歇失败已修复。未改生产测量器，旧失败记录继续保留。见context-events-summary.json。

SVG合成层初试发生实现错误：字符串全局替换污染了overlay选择器，改变pointer/cursor策略。该初试物理及LayerTree数据无效，不作为优化证据；原patch和日志保留。修正后仅在原SVG规则后添加一次动画class，恢复全部overlay规则。57项相关测试及typecheck/lint/450行均exit0；三个headless引擎两尺寸兼容/淡化120次标签/网格状态观测、60次class生命周期检查及60个CSS模式样本一致，共204条检查、错误0。CSS模式是样式模拟，不是公共平移交互；注入手动时钟，不测FPS。12组SVG截图8组逐字节相同，4组Chromium存在轻微像素差，最大通道差4，不能说截图全部一致。

修正候选LayerTree静态无SVG节点层、动画task8时有、SVG导出task0后消失；浏览器返回RootScroller/OverflowScrolling原因，没有明确3D-transform原因。总层数4/6/5，不据此声称导出后全部资源等于静态。生产v4小尺寸10000点compatible三对物理增量36,716,736 / 34,422,976 / 43,253,824 bytes，运行及严格归因exit0、错误0，仍超10MB，未证明收益，候选撤回。未为候选运行完整覆盖率、包、gzip、FPS、原生Safari或Demo验收。四源码逐字节恢复；恢复后先3文件57测试，再typecheck/lint/450行均exit0。证据及原始文件SHA见compositing-verification.json。

临时同配置/依赖/已准备WASM构建四种压缩变体，递归并集包含CSS及额外输出：不混淆变量名ESM/CJS增量15,125/14,961bytes，仅局部变量名12,009/12,230，换行分隔12,021/11,838，格式化但保留压缩/混淆14,198/13,982。均超10KB，未采用，正式配置/dist/gzip-results不改；1byte差异不构成已验证源码收益。见gzip-name-format-experiments.json。

正式实现仍为网格节点复用版本，10.4/10.5保持未完成；10.7按用户决定暂缓。下一批规划优先验证原生实时CSSStyleDeclaration弱引用复用能否保持样式变更语义，再决定是否形成物理预算候选；尚未实现或证明收益。不改规格/版本，不提交或发布。

本批文档格式化、OpenSpec strict/status及git diff --check均exit0；status 4/4仅表示规划文档齐备。任务生成WASM已恢复，恢复输入SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余工作区改动保留。

### 实时 CSS 声明、原生分账及跨帧 DOM 查询复用（2026-10-13，诊断及未采用候选）

三个headless引擎Chromium141.0.7390.37、Firefox142.0.1、WebKit26.0对text/line共60次检查：既有CSSStyleDeclaration随属性、内联、继承、样式表插入/删除、媒体查询、移除/重连同步，差异0。它不是全部CSS环境/原生Safari验收。候选弱引用复用声明而非数值，保留原生文字边界读取；jsdom不实现实时声明，两项窄测试显式提供标准实时getter，不改全局测试支撑。3文件34测试通过；候选typecheck/lint/450行日志无诊断，顺序shell最终exit0，但早期各命令退出码未单独保留，不能补造。原生手动时钟144次标签/网格/样式/截图检查，12组SVG PNG逐字节相同，不测FPS。生产v4物理增量37,830,592 / 35,569,664 / 39,960,704bytes，运行/严格归因exit0、错误0，仍超10MB，未采用。源码和测试恢复，恢复后32测试及各自typecheck/lint/450行exit0。见live-style-verification.json。

正式恢复源码的两个全新Chromium浏览器分别静态/启用动画，用Tracing memory-infra详细dump记录baseline、挂载后、400ms后、自然settled。所有dump成功，动画中间task8、末尾task0；自然阶段不强制GC，仅基线GC。Blink GC静态1,753,088→6,815,744bytes，动画1,753,088→25,296,896；V8静态7,120,876→26,231,796，动画7,137,260→39,564,244。分账路径互相重叠，不能相加，也不等于物理footprint。单对且Tracing改变时序/开销，不作为预算或因果证明；没有保存同时构建输入SHA，不事后补记为正式验收。原始trace字节SHA、chronological phase mapping及局限见native-memory-dump-summary.json；trace id从0开始，CDP请求GUID从1开始，按顺序对应，未直接假设id相等。

第二候选弱引用保留跨帧选择器结果，MutationObserver在元素增删/选择器归属属性变化时失效；同步takeRecords和异步回调两种情况均覆盖，文字内容变化不重新发现节点，坐标/样式/原生边界仍每次读取。新增回归验证网格vertical/horizontal切换、line替换、tick标记变化以及双SVG隔离，既有插入/移除/坐标移动回归保留。3文件34测试及typecheck/lint/450行各自exit0。三个headless引擎144次手动时钟状态/样式对照无快照错误，12组截图10组逐字节一致，两组Firefox桌面有差异（compatible 29,662像素最大通道差149，crossfade 11,299像素最大差58），实际查看compatible两张，未解释差异，不宣称完整视觉一致或FPS验收。

该候选生产v4三对物理增量33,767,488 / 44,908,544 / 35,078,144bytes，运行/严格归因exit0、错误0，仍超10MB，未证明收益。撤回两源码/测试变更和新增helper，patch/源码/原始日志保留，见collision-discovery-verification.json。未追加候选gzip、全套coverage、包、Safari、Demo或导出验收。正式实现仍是网格节点复用版本；本批增加的是诊断证据，没有新增已交付运行时优化。

10.4/10.5未完成，10.7按用户暂缓；不改规格、精度、点数、阈值、版本，不提交或发布。下一批规划应直接检查逐帧路径属性更新的Blink原生对象分配/生命周期，避免再次把DOM/CSS缓存当作预算收益；包体仍需有实际可验证的功能等价重构，此处没有提出已实现的压缩改善。

本批全部候选恢复后，先运行3文件32相关测试，再逐个typecheck/lint/450行检查，均exit0；OpenSpec strict/status和git diff --check通过。已准备WASM输入SHA恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；仅恢复任务生成WASM后输入SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c。未变化正式运行时不重复全套coverage/包/FPS/桌面矩阵，不把旧结果写成本轮重新运行。

### 原生变换精度及 Blink 池化容量澄清（2026-10-13，仅诊断，未进入生产候选）

先核对历史实验：冻结线条d写入和跳过路径计算已经做过，未证明它们是主要物理来源，本批不重复。此前native-memory-dump中Blink size应解释为堆容量，不能写成存活对象大小。动画settled主线程Blink committed_size为24,510,464bytes，pooled_size为16,121,856，allocated_objects_size为6,709,208；静态对应6,029,312 / 393,216 / 1,500,376。字段重叠，不能相加或从物理预算扣除；fragmentation单位是objects，不能误读bytes。仅原始trace的离线再解释，无新的物理测量或分配类型归因。见native-memory-dump-pool-analysis.json。

新隔离对照检查复用SVGTransform/setTranslate是否与原transform字符串解析一致；没有修改正式源码。Chromium141.0.7390.37、Firefox142.0.1、WebKit26.0每引擎144组矩阵/原生文字边界检查，分别23/0/23项差异，命令exit1。极大坐标123456789在Chrome/WebKit字符串解析成123456784，IDL浮点转换成123456792；部分原生文字边界也不同。第二次固定seed=42的随机矩阵对照每引擎20000组，分别9299/115/9331项差异，exit1；普通小数坐标也存在反例，不能仅按极大坐标回退就声称精度相同。随机对照只检查矩阵，不扩大为20000组原生边界/视觉验收。

直接native setter替换在生产候选前即被否决，未减少精度或修改规格；没有候选物理/gzip/FPS/包/Safari/Demo/导出验收，也没有加入公共接口。原始成功/失败判定、probe、文件SHA见svg-native-transform-verification.json。另一种由离屏SVG解析后再写数值的路径仅准备了临时oracle脚本，尚未执行或实现，不能宣称它保留语义或减少分配。

正式5文件34项测量/几何/轴相关测试先运行通过，随后typecheck/lint/450行分别exit0。为解决先前完整v4矩阵保留失败尝试、严格归因拒绝的问题，启动同正式源码、同v4方法的独立12场景复测，原报告和全部失败记录继续保留；在它实际结束前不记录为通过，不合并报告、不称间歇失败已修复。

随后完成离屏原生SVG解析再setTranslate的隔离对照：每引擎144组矩阵/文字边界以及20000组随机矩阵均差异0，两命令exit0。它仅保持实时数值，序列化后的字符串仍需验证。原生getter字符串重新解析的144组对照，每引擎均108组矩阵差异，exit1；直接复制它进入生产并不足以保留终态序列化精度。这不是正式图表导出已发生的回归（源码未改），也没有实际执行组件导出验收。未实现候选；只在动画中的展示比例尺上采用原生变换、终态/导出恢复原始字符串是下一批规划，必须另行实现并验证，不能把单独实时oracle通过当作导出契约闭合。原始报告/probe见svg-native-transform-verification.json新增parsedAlternative。

独立正式v4完整12场景复测已实际结束，运行及严格归因均exit0，36对/72浏览器运行、失败尝试0，采样窗2105–2427ms、末次任务0、20次装卸任务/元素0。7对低于预算、29对超过预算，八个更新/淡化场景的24对全部超标；本次桌面10000点入场3对也略超10MB。见memory-full-window-v4-formal-repeat12-summary.json及原始报告。它补足独立无错误完整矩阵及可通过归因的数据，不证明之前上下文销毁已修复；旧两份带失败报告原样保留，不拼接数据或移除错误。相同正式源码/runner指纹分别为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526 / f0c302754e529ea9a263efbffc200fa4460f919c175c098222a36be10a63d35c，不把跨报告波动写成优化收益。

正式运行时与构建配置未改，10.4物理预算和10.5完整gzip预算仍未达到，10.7按用户暂缓。本批增加完整复测和精度/池化诊断；全套coverage/包/FPS/原生桌面证据仍按此前实际源码范围解释，不写成本批重新运行。不改规格、版本，不提交或发布。下一批应验证展示期变换复用与终态字符串恢复能否同时保留实时/导出语义，再决定是否进行物理候选；该方案目前仅规划。

本批OpenSpec strict/status、文档格式化及git diff --check均exit0，status4/4仅代表规划文档齐备。仅恢复任务生成WASM后输入SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余既有工作区改动保留。

### 展示期原生轴变换与终态字符串恢复（2026-10-13，未采用）

本批实施私有候选：仅为临时复制域比例尺加WeakSet标记，轴渲染在展示期通过离屏SVG原生解析目标字符串，再更新既有SVGTransform；真实比例尺走原字符串渲染。自然终态和导出commit恢复真实比例尺，从而恢复完整原始刻度字符串。解析节点由轴弱引用拥有，静态渲染删除解析节点缓存，避免Document持有长期解析节点；没有新增公共类型/导出或引擎DOM写入。新增两项回归覆盖临时域不改变真实比例尺、终态精确字符串恢复以及缺少原生API时普通字符串回退。5文件63测试及typecheck/lint/450行各自exit0。

第一轮加入波形path的组合原生快照，在Firefox桌面compatible进度0失败，exit1；详细失败快照未落盘，不能证明具体字段或根因，初次probe、部分报告和日志保留。另一个受控oracle先调用SVG导出稳定初始采样，再启动数据更新，两版本执行相同步骤；不能把它当成原始性能fixture或宣称修复初次问题。收紧轴节点所有权后，尝试用逗号/空格判断原生执行次数又在Firefox误报未执行，exit1；改为临时直接计数后确认Firefox确实调用了原生setter，原无效计数失败日志保留。

最终受控生产oracle为Chromium141.0.7390.37、Firefox142.0.1、WebKit26.0，两尺寸兼容/淡化共192检查、快照错误0：波形d/透明度、标签边界/可见性、网格一致；12组SVG截图逐字节相同，小尺寸Firefox候选图已实际查看。每引擎四页面在500ms时实际原生调用96/240/96/112次，自然终态累计144/360/144/168次，证明候选执行，不是仅测试回退。12对最终SVG刻度transform字符串和波形路径完全一致，48次SVG/PNG导出返回成功、末尾task0；PNG导出仅核验receipt，没有比较导出PNG像素。此oracle注入手动时钟/RAF及临时计数，不测FPS、不算原生Safari、Demo、完整设备矩阵或包验收。探针/源快照/patch及scope见native-axis-owned-verification.json。

之后用未改变的生产benchmark和v4物理运行器测量，没有初始SVG导出稳定步骤或计数。360×300、8系列、10000总点compatible三对增量34,144,256 / 31,457,216 / 34,766,912bytes，命令及严格归因exit0、错误0，仍超10MB并重叠正式范围，未证明收益。20次装卸任务/元素0、max8；各自GC后DOM counters回到baseline的documents1/nodes28/listeners14，仅说明这些观测，不证明无泄漏，也不能代替自然峰值。候选撤回，两原源码逐字节恢复，两新增helper及新测试归档为evidence文本；没有候选gzip/全套coverage/包/FPS/原生Safari或Demo验收。

恢复后先4文件61相关测试，再typecheck/lint/450行检查，各自exit0。正式实现仍是网格节点复用版本，完整无错误v4复验及96场景FPS/桌面矩阵保留各自正式源码范围，不写成本批重新运行。10.4物理预算和10.5完整gzip预算仍未完成；10.7按用户暂缓。不改规格、精度、点数、阈值、版本，不提交或发布。本批交付的是实验/验证记录，没有新增正式运行时优化。下一批规划应转向配置/生命周期重复逻辑的可证明等价收敛，不继续以更多DOM缓存或原生变换层假定能达到预算。

本批文档格式化、OpenSpec strict/status及git diff --check均exit0；status4/4仅表示规划文档完整。恢复后的已准备WASM输入SHA为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526，仅恢复任务生成WASM后的SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c；其余既有工作区改动保留。

### 共享数值遍历与数组隔离回归（2026-10-13，候选撤回，测试已实现）

将普通数值遍历与组件私有几何缓冲收敛为同一递归遍历，保持端点分支/凸组合及有限性检查，公共帧仍分配新数组，私有缓冲复用。初版使用 undefined 初始化几何通道导致 typecheck exit2；该版本的 gzip 报告独立保留，不作为已验证代码。修正为 own 属性空数组初始化后，10文件238测试及 typecheck/lint/450行分别exit0，原型命名通道不触发对象 prototype setter。

修正版本同配置/依赖/已准备WASM三临时构建，完整递归并集包括CSS及所有额外chunk：正式ESM/CJS增量12,011/11,834bytes，候选11,996/11,806bytes；同次候选产物仅减少15/28bytes。正式数字与历史12,010/11,833相差1byte，属于基线/构建差异，不宣称为源码收益。原始旧报告与新报告均保留，未覆盖正式dist/config/gzip报告。

未改变的生产v4测量器在360×300、8系列、10000总点compatible场景完成三对，物理增量34,357,184 / 36,094,080 / 35,356,672bytes，运行及严格归因exit0、失败尝试0，仍全部超10MB，没有证明预算收益。自然观测窗2104–2354ms、末尾任务0；自然窗不强制GC，另列settled及20装卸前后GC样本。它仍不覆盖挂载中/采样间未知最大峰值，不用GC留存替代物理预算。

候选两份生产源码逐字节恢复，patch、源码、探针及全部日志归档。保留两项有独立价值的回归，验证公共帧与后续帧/输入数组隔离，以及私有缓冲行复用、own **proto** 通道和输入端点不变；它们在正式实现上通过。恢复后先10文件238测试，再完整133文件1090测试覆盖率、typecheck/lint/450行分别exit0。总体L/S/F/B为93.51/91.57/92.81/86.45%，核心98.99/98.10/98.26/95.94%；不宣称候选通过完整覆盖率、FPS、包消费、原生Safari/Demo或导出验收。

正式运行时仍为网格节点复用版本，10.4物理预算、10.5完整gzip未完成，10.7用户暂缓。不改规格、精度、点数、阈值、版本，不提交或发布。已实现的是回归测试及验证记录，预算优化仍待完成；下一批应选取能消除实质重复的配置/生命周期边界，并在同次对照确有收益后再运行完整门禁，不以这15/28bytes标记目标完成。证据见shared-numeric-verification.json。

本批 OpenSpec strict/status、文档格式与 git diff --check 通过。仅恢复任务生成的两份 tracked WASM，正式输入指纹恢复 8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c；已准备WASM正式指纹仍为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。构建/包消费/96场景FPS/原生桌面矩阵未在本批重跑，沿用旧证据的实际范围。

### 预检快照收敛与原生分配调用栈（2026-10-13，未采用候选及诊断）

CodeGraph 及产物确认动画类使用原生私有字段，没有可移除的兼容层。控制器预检已复制轨道端点，随后又复制一次；候选复用 group-aware 预检的轨道副本，但保留原始 loop/配置字段，并在旧回调后重新校验管理器属性组。新增预检副本隔离、零初始化/调度与布尔无限循环回归，10 文件 / 240 测试通过。候选未运行 typecheck/lint/450 行或完整门禁，不能称已静态验收。

同配置、依赖及已准备 WASM 三临时构建：正式 ESM/CJS 完整增量 12,008/11,832 bytes，候选 11,991/11,816 bytes，同次候选产物只减少 17/16 bytes。基线微小漂移不算源码收益，递归并集包含 CSS 和全部额外 chunk。收益不足以扩展辅助 validate 的返回接口，候选撤回；管理器、控制器、测试逐字节恢复，README 试验说明撤回。patch、源快照、测试和原始 gzip 报告保留。恢复后先 10 文件 / 238 测试，再 typecheck/lint/450 行，各自 exit0。见 preflight-snapshot-verification.json。

原生调用栈诊断先使用默认 Playwright 启动、memlog=all/native-with-thread-names、16KiB 采样及 page CDP Memory 域。静态/动画四阶段均返回空样本，trace 无 heaps_v2，不能解释为零原生分配。切换到同版本完整 Chromium 可执行文件后取得非空样本。另一次 browser-level CDP 启动诊断报 Memory.startSampling 不支持（exit1）；正确采样使用 page session。完整 Chromium 探针首次因 self-hash 文件名重复 full 后缀在启动前失败，修正后独立成功运行；记录生成器的 UTF-8 错误及首次格式检查缺失报告也保留。未猜测默认 shell 空样本的根因。

完整 Chromium 141.0.7390.37 两次新浏览器生产 fixture 运行完成，八次 detailed dump 成功，页面错误0，动画 active 任务8、settled0。page Memory 采样估计静态 baseline/挂载后/active/settled 为 163,840/4,947,968/4,866,048/4,866,048 bytes；动画为 229,376/11,747,328/10,174,464/9,699,328 bytes。这是采样分配估计，不是 footprint 或全部存活 GC 对象，不用于物理预算；完整 Chromium 诊断不同于正式 headless-shell 环境，Tracing/采样改变时序和开销，不能跨报告推断优化效果。

trace 的 heaps_v2 来自 browser/GPU/network/storage/tracing 服务，没有 renderer 堆快照；renderer 数值仅来自独立 page Memory 域。已知模块地址按偏移归一化，未知/JIT 地址保留。atos 只得到最近导出 ChromeMain 及偏移，不能精确归到函数或对象类型；未将最近符号当真实调用点，不相加重叠 allocator 字段。完整原始 trace 经 gzip 无损归档，逐字节 round-trip 与原始/归档 SHA 均核验。浏览器 stderr 的 GCM 注册错误保留，pageErrors0 仅指页面错误。见 native-stack-profile-verification.json、native-stack-profile-analysis.json 及无损归档清单。

本批新增原生采样证据和未采用候选记录，正式运行时不变，10.4/10.5 未达标，10.7 用户暂缓。未运行候选物理/FPS/完整 coverage/包/Safari/Demo/导出或移动验收；不改规格、点数、精度、阈值、版本，不提交或发布。下一批可利用完整 Chromium 的非空样本进行保留功能的分配路径对照，但须取得具体符号或建立受控因果证据，不从未解析 PC 直接写优化结论；包体仍需实质的等价收敛。

### ASCII 路径解码对照（2026-10-13，候选撤回，长路径回归已实现）

候选保持完整 D3 line/curve、坐标三位精度和点数，只将私有 Uint8Array 的惰性 TextDecoder 解码改为每块 8192 字节的 String.fromCharCode。新增五种线型的 10000 点精确 D3 对照，覆盖超过 65536 字符的长路径、冻结点对象及同一数组缩至单点后的无残留输出。候选 2 文件 / 53 测试、typecheck、lint、450 行及局部格式检查均 exit0。

同配置/依赖/已准备 WASM 三临时构建的递归并集包含 CSS 和全部额外 chunk：正式 ESM/CJS 增量 12,004/11,826 bytes，候选 12,028/11,854 bytes，同次产物增加 24/28 bytes。继承探针的 accounting 文案误写两文件，已更正为实际仅虚拟恢复 pathBuffer.ts；数值未改，探针原文保留。

生产 v4 物理测量在 360×300、8 系列、10000 总点 compatible 场景完成三对/六次运行，增量 38,780,992 / 65,323,136 / 43,548,800 bytes，全部超过 10MB。运行及严格归因 exit0、错误0；自然观测窗 2114–2377ms、终态任务0，20次装卸后任务/元素0、动画 max8。自然窗未强制 GC，另存终态及装卸 GC 前后样本；离散采样仍不覆盖挂载中或采样间未知最大值，不将 GC 留存作为预算。没有证明 TextDecoder 原生调用是内存根因或候选带来预算收益。

运行时代码逐字节恢复，保留五项回归，patch/源/测试/探针及全部日志归档。恢复后先 10 文件 / 243 测试，再完整 133 文件 / 1095 测试覆盖率，全部通过；总体 L/S/F/B 为 93.51/91.57/92.81/86.45%，核心为 98.98/98.09/98.26/95.94%。候选未运行完整 coverage/包消费/FPS/原生 Safari、Demo 或移动验收，正式运行时仍为网格节点复用版本；旧完整矩阵保留各自源码范围。

已实现的是五项长路径回归及对照证据，10.4 物理预算、10.5 完整 gzip 仍待实现/验收，10.7 依据用户“暂不在移动端验证”暂缓。下一批规划应先建立 renderer 分配路径的具体因果对照，以及配置/生命周期逻辑的实质等价收敛；不继续假设解码、缓存或未解析原生 PC 就能解决预算。见 ascii-decode-verification.json。不改规格、精度、点数、阈值、版本，不提交或发布。

恢复后 typecheck/lint/450 行检查各自 exit0。

本批记录格式、OpenSpec strict/status 和 git diff --check 通过；status 4/4 仅表示规划文档齐备。仅恢复任务生成的 tracked WASM 两文件，运行时输入指纹恢复 8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c；其余既有改动保留。

### CSS 平移与系列 SVG 视口（2026-10-13，诊断及候选撤回）

未重复此前缓存/原生 transform 候选。先在 Chromium 141.0.7390.37、Firefox 142.0.1、WebKit 26.0 比较 SVG transform 属性和行内 CSS 平移，24 个矩形/样式检查中，12 个宿主 CSS 覆盖检查全部不等价；Chromium 另有一项边界高度微小差异。行内 CSS 改变作者样式优先级，不能作为兼容替换，因此未改生产轴源码，也未测此诊断的性能。

系列视口候选仅把绘制层容器 g 改成同尺寸 SVG，overflow=visible，保持数值坐标、D3 路径、裁剪和点数。首个相关命令包含不存在的 rendering.test.ts，因此实际只有 2 文件 / 38 测试；随后针对正确 renderingStyles.test.ts 补跑 1 文件 / 4 测试通过。候选 typecheck/lint/450 行检查通过。

受控生产对照在三个 headless 引擎、两尺寸、兼容/淡化中共 192 条检查，路径/透明度/路径原生 client rect/标签边界与可见性/网格一致，快照错误0，12组SVG视口截图逐字节一致；小尺寸Firefox候选图已查看。48次SVG/PNG导出receipt成功、终态task0，最终SVG刻度transform字符串与波形路径一致；未比较导出PNG像素。此fixture注入手动clock/RAF并先用SVG导出稳定初始采样，不是原生Safari、Demo、入场/点和误差符号/指针查询/FPS或完整候选验收。探针/server SHA、每轮引擎版本及实际构建输入均保存于 series-viewport-layout-browser/comparison.json。

之后使用未修改的生产 v4 runner，按候选→正式→候选复测顺序独立构建/启动，360×300、8系列、10000总点compatible各三对：首轮候选 27,901,952 / 28,442,624 / 29,737,024 bytes；正式对照 35,209,280 / 34,209,792 / 28,573,824；第二轮候选 36,896,768 / 33,177,664 / 22,626,432。三份报告运行和严格归因exit0、错误0，所有九对超过10MB。复测范围重叠，首轮低值不能证明稳定物理改善；没有采用候选。自然窗与20装卸逐运行样本完整保存，GC后留存不替代自然峰值，离散采样仍不覆盖挂载中/采样间未知最大值。

候选运行输入SHA为527600c552724079e9a3bc469b569183c4ae149f468ce3446925fcfe8c558591，正式对照为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。候选源/patch、原始报告/脚本/日志保留；系列层逐字节恢复。gzip探针仅准备，未执行；未运行候选完整coverage/包/FPS/原生Safari或Demo/移动验收，不扩大历史正式证据的范围。

本批已实现的是受控等价检查、两轮候选及同期正式物理对照证据；没有新增正式运行时优化。10.4物理预算、10.5完整gzip仍未完成，10.7按用户暂缓，不勾选。下一批仍需取得具体renderer分配路径的因果证据并寻找实质包体收敛；CSS优先级不等价和SVG视口不稳定收益已排除，不重复这两条候选。不改规格、精度、点数、阈值或版本，不提交或发布。见 series-viewport-verification.json。

恢复后先3文件/42项相关测试，再typecheck/lint/450行，各自exit0；正式运行时仍为网格节点复用版本。本批未重复未改变运行时的全套coverage/构建/包/FPS/原生桌面矩阵，既有结果保留原范围。

本批记录格式、OpenSpec strict/status及git diff --check均通过；status4/4仅表示规划文档齐备。仅恢复任务生成的两份tracked WASM后输入SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余工作区改动保留。

### 终止与分类关闭编排收敛（2026-10-13，候选撤回，回归已实现）

CodeGraph 和调用点确认 AnimationTask.settle 的延迟通知只由 Animator 替换事务使用，控制器 private bulk 的 finish/commit 标志始终成对。首版将 task 终止统一为分离后由调用方执行通知、移除关联 commit 标志，复用累加初始零偏移。新增回归验证延迟的二维累加任务在首帧前取消、重复取消仅通知一次、后续任务从剩余普通轨道终点派生，输入数组不变且终态与任务清理正确。首版10文件/244测试以及typecheck/lint/450行通过。

同配置/依赖/已准备WASM三临时构建的递归并集包括CSS和全部额外chunk：正式ESM/CJS完整增量12,013/11,836bytes，首版12,003/11,831bytes，同次产物仅减少10/5bytes。另四个虚拟源码子集构建使用该次同一formal/baseline产物：单独终止路径减少17/11、单独commit标志减少3/3、初始零值复用增加7/8、终止+commit减少18/12bytes。虚拟子集未各自执行测试/静态验收，不能写成四个已验收优化；不把绝对基线漂移当源码收益。

进一步恢复原初始零值，移除settle已涵盖的重复ended守卫，提取四个分类关闭watcher的共同流程，保持注册顺序、谓词、提交函数及入场关闭后标注释放时机；没有扩展公共接口。11文件/255测试、typecheck/lint/450行通过。另一次同配置三构建正式完整增量12,006/11,830、候选11,995/11,835bytes，同次ESM减少11bytes而CJS增加5bytes。没有解决完整<10KB预算，也没有候选物理收益证据，运行时全部撤回。

五份运行时源码逐字节恢复，新增行为回归保留；首版/收敛版source、patch、测试、探针及日志完整归档。恢复后先11文件/255测试，再全套133文件/1096测试覆盖率，各自exit0；总体L/S/F/B为93.51/91.57/92.81/86.45%，核心98.98/98.09/98.26/95.94%。未运行候选完整coverage/包/物理内存/FPS/原生Safari或Demo/移动验收，不扩大既有正式证据的源码范围。见terminal-consolidation-verification.json。

本批已实现的是回归及配置/终止编排的等价对照证据；未新增正式运行时优化，10.4物理、10.5完整gzip预算仍待完成，10.7依用户暂缓。不改规格、精度、点数、阈值或版本，不提交或发布。下一批规划应检查轴post-flush watcher中额外nextTick是否可在保证Vue DOM更新/字体及卸载时序后消除，并建立当帧轴/网格/路径原生对照；这是尚未实施的假设，须先相关回归再测物理预算，不能从少一个Promise直接推断收益。不重复此次仅减少几个字节的终止/分类候选。

恢复后typecheck/lint/450行检查各自exit0，正式运行时保持原网格节点复用版本。

本批文档格式、OpenSpec strict/status和git diff --check通过；status4/4仅表示规划完整。仅恢复任务生成的tracked WASM两文件后，输入SHA恢复8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余既有工作区改动保留。

### 轴 post-flush 时序对照（2026-10-13，候选撤回，三项回归已实现）

尝试移除轴 mounted/post-flush watcher 内额外 nextTick，保留字体监听与遮挡检查。原正式实现也通过三项新增生命周期回归，因此没有证明卸载后 formatter 的既有缺陷；中间 disposed 守卫在最终候选验证前撤回。新增测试覆盖立即卸载、DOM patch 后显示轴使用当前比例尺/formatter、字体 ready/loadingdone 重测并在卸载后停止。首版 fixture 缺少 waveform-track 导致三项未捕获错误、exit1，已修复并保留失败日志。

候选五文件/41测试、typecheck/lint/450行通过。三个引擎两尺寸兼容/淡化受控对照192检查、错误0，12组SVG视口截图逐字节一致，48次SVG/PNG导出receipt成功；未比较导出PNG像素。手动时钟/RAF及初始SVG导出用于稳定采样，此结果不替代原生Safari、Demo、入场或FPS验收。

未修改的生产v4 runner在360×300、8系列、10000总点compatible完成三对物理测量，增量33,570,880 / 34,783,232 / 29,081,728bytes，均超过10MB；严格归因exit0、错误0，窗口2121–2380ms，终态任务0、20次装卸任务/元素0。离散自然峰值不覆盖挂载中/采样间未知最大值，GC后留存不替代预算。同配置三构建正式完整gzip增量12,005/11,828bytes，候选11,992/11,818bytes，同次产物仅减少13/10bytes，仍超10KB。未证明物理预算收益，轴运行时逐字节恢复。

保留三项测试，恢复后五文件/41测试通过；全套134文件/1099测试覆盖率通过，总体L/S/F/B为93.51/91.57/92.81/86.47%，核心98.98/98.09/98.26/95.94%。最终测试区间断言改为不依赖DPR的坐标差；typecheck发现其SVG属性可能undefined（exit2），补测试非空断言后重跑相关测试、typecheck/lint/450行，各自exit0。全套coverage在最后非空断言前执行，不声称此后再次全跑。

本批已实现三项回归和候选对照证据，正式运行时未新增优化。10.4/10.5未达标、10.7按用户暂缓。未运行候选完整coverage/包消费/FPS/原生Safari或Demo/移动验收。下一批规划先建立具体renderer DOM wrapper分配与Blink留存池的因果归因，再寻找足以弥补约2KB差额的等价包体收敛；这些尚未实施，不能从少一个Promise推断预算收益。不改规格、精度、点数、阈值或版本，不提交或发布。见axis-postflush-verification.json。

本批记录格式、OpenSpec strict/status及git diff --check通过；status4/4只表示规划齐备。仅恢复任务生成的tracked WASM两文件，正式输入SHA恢复8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余工作区改动保留。

### V8 / DOM 包装对象留存诊断（2026-10-13，仅诊断）

前批三项回归及证据收尾属于实际进展。本批不重复仅几个字节的配置/生命周期候选；CodeGraph检查当前配置校验调用路径，随后对正式网格节点复用生产源码进行两个独立Chromium141.0.7390.37场景（静态/动画，360×300、8系列、10000总点compatible）。每组3次静态预热，baseline/active-request/settled/20次装卸后共八份CDP堆快照。输入SHA为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；快照触发GC及执行暂停，不属于自然物理峰值/FPS/预算验收。

动画active-request快照前后task8，settled为0，20装卸task/element0、max8；静态各阶段task0。两组页面及运行错误0。挂载后的SVG元素包装对象清单完全相同，均有24 SVGPathElement、200 SVGLineElement、196 SVGGElement、89 SVGTextElement等；20装卸后快照均无SVG元素，DOM counters回到1 document/28 nodes/14 listeners。只证明此场景GC后观测，不宣称不存在全部泄漏或瞬时原生分配。

active-request动画相对静态object/array/number self-size分别增加716,272/792,916/473,616bytes，合计1,982,804bytes；native增加260,105bytes，主要为外部字符串128,905及ArrayBufferData131,072bytes。settled object/array增加77,888/211,012bytes；20装卸后object增加704、array减少15,728bytes，代码增加235,196bytes。快照字段为V8 self-size，不是footprint，不能用来相加/扣减此前物理预算，也不能从编译代码增量推导泄漏。

平面路径字符串标签截断到1024字符，统计漏掉拼接/切片字符串以及Blink路径段，不作为完整路径成本。快照只表明SVG包装对象数相同，没有取得Blink renderer具体分配器类型/原生池容量归因；下一批应针对未覆盖的原生路径存储/分配器容量进行具体因果诊断，尚未实施，不能据此宣称内存根因已确定或预算达标。

八份原始快照gzip无损归档，生成时round-trip相等；独立Python读取归档重新核验原始/压缩SHA、node_count及所有type/native计数和self-size，exit0。探针、分析器、环境/输入、错误与全部日志保留。相关预算报告脚本2文件/10测试、typecheck/lint/450行均通过；本批未改生产源码、未重跑完整coverage/包消费/FPS/原生桌面或移动验收，也没有新的gzip/自然物理预算结果。10.4/10.5仍未完成，10.7依用户暂缓，不改规格、阈值、点数、精度或版本，不提交或发布。见heap-retention-verification.json及heap-retention-analysis.json。

本批格式、OpenSpec strict/status和git diff --check通过；status4/4仅表示规划齐备。只恢复任务生成的两份tracked WASM，输入SHA恢复8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余既有工作区改动保留。

### 已回收 JS 分配采样与坐标十进制编码（2026-10-13，候选撤回，回归已实现）

上批堆快照/独立核验是实际进展，但只反映GC后留存。本批先检查配置校验/错误处理调用路径，没有实施错误消息缩减，也没有改异常类型或消息。原生xcrun无法找到xctrace开发工具，未安装Xcode或改变开发者目录。改用CDP HeapProfiler.startSampling，samplingInterval16384，请求包含minor/major GC已回收对象的统计，正式/候选各独立静态及动画浏览器一次；这是统计性累计JS分配估计，不是footprint/留存峰值或预算证明。

每次使用隐藏source map临时生产构建，全部非map输出名称/字节与对应无map生产构建一致；映射源码及输入SHA、引擎版本、参数、任务计数/错误和产物SHA保留。源码最近祖先只表示调用上下文，不代表精确原生分配点。正式两组观测2324/2316ms、tasks max0/8，页面错误0、卸载task/element0；tree selfSize静态28,153,272、动画136,128,960bytes，sample总量是独立协议视图，不相加或强制相等。路径生成调用链为最大采样热点，String叶节点静态2,032,844、动画20,525,944bytes。

候选保留D3 line/五种曲线、点数、Math.round(value*1000)/1000语义和TextDecoder；仅对abs(rounded)<=1e9的坐标直接写ASCII十进制整数/小数，超范围及非有限仍使用原String转换。新增五种线型精确D3对照，覆盖正负零/半舍入/进位/±1e6边界/科学计数回退、细分小数及固定随机数，并检查长数组缩至单点。候选3文件/55测试以及typecheck/lint/450行通过。

候选分配观测2326/2320ms、max0/8、错误0及卸载资源0；tree selfSize静态24,700,132、动画108,328,584bytes，String叶节点0/410,080bytes。两种实现各仅一次统计采样，不据此宣称稳定性能改善或物理根因确定。原始四份profile及所有map经gzip无损归档；独立Python核验原始/压缩SHA、node selfSize/sample累计/group selfSize，并核对map中pathBuffer sourcesContent与实际测量源码，exit0；独立核验没有重新实现VLQ解码，不夸大映射验证范围。

未修改生产v4物理runner，360×300、8系列、10000总点compatible三对增量43,433,984 / 44,974,144 / 58,523,840bytes，全部超10MB；运行/严格归因exit0、错误0，自然窗2117–2363ms、terminal task0，20装卸task/element0、max8。无当窗强制GC，单独保留GC留存；离散峰值不包含挂载中/采样间未知最大值。没有同批正式物理对照，不能断言候选因果恶化，也没有证明物理收益。临时同配置/依赖/已准备WASM三构建递归并集包括CSS及全部额外产物：正式完整gzip增量12,011/11,832、候选12,168/11,980bytes，同次候选产物增加157/148bytes。

候选因全部物理对超标且包体增加而撤回；pathBuffer逐字节恢复，保留五项回归及全部源/patch/脚本/日志。恢复后先5文件/65测试通过。本批未运行候选完整coverage/包消费/完整FPS/原生Safari或Demo/移动验收，不把分配采样替代预算。10.4/10.5未完成、10.7按用户暂缓；不改规格、阈值、精度、点数、版本，不提交或发布。下一批规划应对剩余D3调用链的数值装箱和Vue逐帧对象更新建立因果证据，并寻找足够的等价包体收敛；尚未实施。见decimal-coordinate-verification.json、js-allocation-reconciliation.json。

恢复后的全套135文件/1104测试覆盖率通过，总体L/S/F/B为93.51/91.57/92.81/86.47%；随后typecheck/lint/450行各自exit0。正式运行时仍为网格节点复用版本，本批没有新增已采用的运行时优化。

本批记录格式、OpenSpec strict/status及git diff --check通过；status4/4仅表示规划齐备。仅恢复任务生成的两份tracked WASM，正式输入SHA恢复8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余工作区改动保留。

### V8 优化/上下文日志及舍入命令缓存（2026-10-13，诊断及候选撤回）

上一批五项D3回归及分配采样为实际进展。本批CodeGraph与历史记录确认，冻结路径计算、直接D3曲线和仿射SVG诊断未解决正式预算，未重复这些候选。生产Chromium141.0.7390.37开启V8 trace-opt/deopt/file-names，一组静态/动画浏览器各3静态预热，再各3次挂载。首轮exit1：静态3次完整，动画第三次mount发生execution context destroyed；原始report只记录完整静态组，日志中保留动画前两次unmounted标记，不将失败写成完整通过。

增强探针另一次独立复测补充phase、main-frame导航和CDP Runtime execution context事件，并在开始时保存partial run。该次exit0、两组6次挂载完成，静态max0、动画max8、terminal task0、卸载task/element0、page errors0；每浏览器仅初始导航，context创建/clear只在初始navigate阶段。未复现不等于间歇失败已修复，不合并或替换首轮失败。

分析按launch PID+URL+SFI分组，避免压缩名称碰撞；首轮/独立复测完整观察事件1557/1691，各有1条关闭浏览器时的截断尾行，未计为完整事件。每个浏览器日志中point标签的同一SFI各有wrong call target/wrong map eager deopt一次、TURBOFAN completed optimizing一次，没有取得精确SFI源码定位，也不以缓冲stdout接收时间赋予逐帧时间。只说明日志观察，不声称具体D3函数已精确归因、无分配或预算改善。见jit-diagnostic-verification.json。

随后试验舍入命令缓存：D3仍逐次计算全部moveTo/lineTo/closePath，把实际命令和三位小数坐标保存在私有Float64缓冲；只有所有命令/坐标及数量一致才复用SVG字符串，任何变化完整重新序列化。没有舍入端点后自行计算step中点，没有跳过比例尺/几何计算或缩减点数。新增3项回归覆盖舍入边界、step中点/命令变化/单点Z/空输出、自定义插值器每次生成均被调用。4文件/58测试及typecheck/lint/450行通过。

候选独立静态/动画JS采样各一次，hidden map非map产物与对应无map生产构建逐字节一致；观测2339/2325ms、max0/8、页面错误及卸载task/element0。tree selfSize为27,235,584/141,933,676bytes，未证明比此前正式采样28,153,272/136,128,960改善；统计采样不构成严格因果或物理峰值证据。四份formal/candidate profile及map的独立SHA/累计/源码内容核验exit0，VLQ映射由trace-mapping完成，独立核验未另行实现解码。

未改生产v4 runner，候选只运行360×300、8系列、10000总点compatible一对初步物理测量，增量37,240,832bytes超10MB；命令/严格归因exit0、错误0，窗口2113/2337ms、终态task0、20装卸task/element0、动画max8。单对不证明复现性或完整矩阵；自然窗无强制GC，独立留存样本不能替代离散自然峰值。三临时同配置/依赖/已准备WASM构建递归并集包括CSS及全部额外产物：正式完整gzip12,006/11,828、候选12,157/11,976bytes，同次产物增加151/148bytes。

候选未证明分配/物理收益且包体增加，已撤回，pathBuffer逐字节恢复；保留三项回归及源/patch/原始脚本/日志。恢复后6文件/68相关测试通过。候选未运行完整coverage/包消费/完整FPS/原生Safari或Demo/移动验收，不扩大旧证据范围。10.4/10.5未完成，10.7按用户暂缓；不改规格、精度、点数、阈值或版本，不提交或发布。下一批仍需保留功能的实质包体收敛及renderer因果诊断；持续反优化和完整舍入路径缓存尚无收益证据，不继续把它们当已确定根因。见rounded-path-verification.json。

恢复后的全套136文件/1107测试覆盖率通过，总体L/S/F/B为93.51/91.57/92.81/86.47%；typecheck/lint/450行各自exit0。正式运行时仍为网格节点复用版本，本批未采用新的运行时优化。

本批记录格式、OpenSpec strict/status及git diff --check通过；status4/4仅表示规划齐备。仅恢复任务生成的两份tracked WASM，正式输入SHA恢复8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余工作区改动保留。

### 2026-10-13：修订验收最终收尾（已验证）

保留正式路径缓冲而撤回最后D3默认字符串候选：候选只节省183/161bytes，三对物理仍53.4–56.6MB，没有足够收益支持替换已经完整验证的源码。候选源及测量保留，不作同期物理对照收益推断。恢复后的生产输入SHA与完整96场景FPS、12场景物理独立复测、原生Safari记录逐一匹配；独立读取原始报告并核验内存报告SHA、全部960次FPS、36对物理/20次装卸和8组桌面冒烟。未重复运行浏览器矩阵，明确复用同源码证据，不冒称本轮新测。

本轮实际重新运行：12文件/252项相关测试；完整136文件/1107项覆盖率；typecheck、lint、450行、build、隔离tarball公共类型/ESM/CJS/SSR消费及packed easing tree shaking、pack dry-run，全部通过。覆盖率L/S/F/B为93.51/91.57/92.81/86.47%，引擎核心聚合98.99/98.10/98.26/95.94%。最终gzip对比exit0、ESM/CJS增量12,012/11,834bytes，满足修订预算。完整日志/覆盖率/指纹审计保存于evidence/final-acceptance-*，任务10.4/10.5仅按修订条件勾选。

已实现及验证：全部行为规格和本次桌面验收。仍属非阻塞规划：原10/20MB物理及10KB包体目标的进一步优化、间歇上下文销毁的根因诊断；并不保证绝对无泄漏或所有设备性能。原生移动端依用户指令不在范围，不标验证通过。未改版本、提交、发布或归档change。

最终交接检查：OpenSpec严格校验及status通过（4/4仅代表规划文档），git diff --check通过。仅恢复本任务生成的两份受跟踪WASM文件；工作区指纹8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，生产验证准备后WASM指纹8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。其余已有改动保留。

### 2026-10-13：分页淡入增强（已实现并验证）

依据用户批准的分页方案修订 CTL-03/API-04、design 和 README：显式切页只淡入新页波形、点、误差棒及标注，轴/网格/分页立即更新；复用 animationUpdate（默认300ms、cubicInOut），没有新增公共 prop。自动页码重置、resize及其他布局变更保持静态。新增内部分页请求代次和展示模块，采样/布局就绪后只启动最新页；等待期间隐藏内容，fallback/error静态显示，旧结果不能重启动画。快速翻页取消旧任务，关闭类别/全局降级/交互/视口命令/导出提交最终态，分页控件上的指针移动不接管。后台暂停、卸载清理和双图隔离已有回归。

透明度作为独立内部响应式值传递至系列层，不逐帧重建轨道数据或点/误差棒路径；标注采用同一透明度。动画Demo新增三页系列和每页标注，并提供“更新 / 切页”控制。新增调度层、组件及真实Worker仓库的受控回归。初轮误差棒测试夹具未提供error而失败，已补充真实误差数据，之后相关16文件/281测试和完整139文件/1130测试通过；保留失败日志，不将其称为通过。

实际验证：完整coverage（L/S/F/B=93.58/91.68/92.9/86.58%）、typecheck、lint、450行检查、build、隔离包消费及pack dry-run均exit0。生产Chromium/Chrome/Firefox各在1280px、360px完成组件及Demo六组验收，检查中间透明度、标注同步、静态轴、快速翻页、控件指针与绘图区接管、PNG/SVG导出、卸载和类别关闭，页面错误0；人工查看桌面/小容器组件淡入及Demo四份截图。完整动画功能相对原始基线cedfd5fed18fd86c6a68160ef870f97c7407bc9f的gzip增量为ESM12,657/CJS12,513bytes，满足每格式15,000bytes修订预算，统计包括CSS及额外产物。详见evidence/pagination/verification.json和原始报告/日志。

本批11.1–11.5已实现及验证。仍属规划：可选原生Safari分页专项验收和更广分页FPS/物理内存测量，本批没有重跑历史完整矩阵，不把历史同源码验收套用于新指纹。移动端依用户要求排除，不标通过。未改版本，未提交或发布；历史证据及已有工作区内容保留。

### 2026-10-13：0.1.75 发布准备

依用户授权更新README及根目录RELEASE_NOTES.md，说明动画默认启用、分类配置、静态降级、公共引擎和分页淡入。package版本由0.1.74升级至0.1.75；锁文件无需版本项修改，frozen安装通过。GitHub/Gitea发布正文读取根版本说明。发布Oxlint检查暴露三项既有警告，添加局部豁免并说明定长分配/回调可变集合快照语义，未改运行行为。

最终版本实际重新通过相关15文件/275测试、完整139文件/1130测试及覆盖率、typecheck、450行、Oxlint、ESLint、build、隔离包消费和pack dry-run；最终源码生产Chromium/Chrome/Firefox桌面及小容器六组分页验收通过。初次Oxlint失败日志保留于evidence/release-0.1.75。提交前仅恢复生成WASM两文件，保留历史未跟踪诊断证据。发布由v0.1.75注解标签触发现有流水线，本记录为发布准备，不将尚未完成的远程发布写成已成功。
