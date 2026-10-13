## Context

现有 `WaveformSeriesLayer.vue` 通过 Vue 的 `:d` 渲染线条、散点和误差棒；`WaveformAnnotationLayer.vue` 通过受控布局数组渲染标注。`useWaveformChartController` 协调准备数据、布局、采样、交互及导出。动画必须适应这一所有权划分，不能直接用 D3 selection 修改这些节点。

输入 data 必须以引用替换触发更新；原始坐标始终为秒。完整规范化数据用于域、查询、标注及误差范围，采样仅影响显示几何。规范化系列 ID 用于关联，新动画标识还必须包含图表实例身份。

## Goals / Non-Goals

**Goals:** 完整的时间和属性动画能力；默认开启的入场/更新/标注预设；可中断且无残留的生命周期；明确降级与导出；可测试的公共 API。

**Non-Goals:** 引入 ECharts/ZRender 依赖、替换 Vue/D3 渲染架构、修改数据格式、实现视频录制或独立时间轴 UI。保留循环、方向、累加和暂停恢复，不把它们缩减为未来能力。

## Upstream References

调研日期：2026-10-12，通过 `gh api` 读取。以下链接固定提交，结论仅针对这些版本；参考架构不等于完整复制上游 API。

| 固定源码                                                                                                                                                                | 核对到的行为                                                                         | 本项目采用方式                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [ECharts basicTransition.ts](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/animation/basicTransition.ts)                          | enter/update/leave 作用域；新入场/更新停止离场；禁用或零时长直接写最终属性并通知回调 | 分类配置、静态终态、离场取消                            |
| [ECharts lineAnimationDiff.ts](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/chart/line/lineAnimationDiff.ts)                     | 数据差分后构造 current/next 坐标数组                                                 | 在可靠对应条件下插值坐标，不插值 SVG 字符串             |
| [ECharts LineView.ts](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/chart/line/LineView.ts)                                       | 停止旧更新；同步符号坐标；大几何差异时跳过过渡                                       | 同步系列几何及明确回退；不照搬其 3000 像素判断          |
| [ECharts createClipPathFromCoordSys.ts](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/chart/helper/createClipPathFromCoordSys.ts) | 从坐标区域创建裁剪，按方向展开，处理描边边界                                         | 在轨道局部坐标裁剪整个系列，保留已有外层裁剪            |
| [ECharts Series.ts](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/src/model/Series.ts)                                                | 动画受环境和系列点数阈值限制，源码比较为 `>`                                         | 本项目另行规定全图有效总点数 `>= 50000`，不是上游默认值 |
| [ZRender Animation.ts](https://github.com/ecomfe/zrender/blob/349111033fba0fa08cee745b72dd2ea66dc6fcaa/src/animation/Animation.ts)                                      | 调度 Clip，支持调度器暂停，遍历前保存 next 防回调修改                                | 共享 RAF、帧快照及任务身份检查                          |
| [ZRender Animator.ts](https://github.com/ecomfe/zrender/blob/349111033fba0fa08cee745b72dd2ea66dc6fcaa/src/animation/Animator.ts)                                        | 管理属性轨道；兼容类型才能累加；拒绝循环累加；stop 可前进至末帧                      | 数值轨道合成、组合校验和显式终止方式                    |
| [ZRender Clip.ts](https://github.com/ecomfe/zrender/blob/349111033fba0fa08cee745b72dd2ea66dc6fcaa/src/animation/Clip.ts)                                                | 计时、暂停累计、缓动和循环余数                                                       | 单调时钟、跳帧计算，不丢失周期余数                      |
| [ZRender Element.ts](https://github.com/ecomfe/zrender/blob/349111033fba0fa08cee745b72dd2ea66dc6fcaa/src/Element.ts)                                                    | scope、force、additive、setToFinal；force 用于无属性变化也运行                       | force 不绕过禁用策略；业务目标和展示状态分离            |
| [ZRender zrender.ts](https://github.com/ecomfe/zrender/blob/349111033fba0fa08cee745b72dd2ea66dc6fcaa/src/zrender.ts)                                                    | 每个 ZRender 实例持有 Animation；静止帧计数触发休眠                                  | 共享调度器是本地选择；无运行任务时直接停止 RAF          |

### Responsibility Mapping

| 本地名称                    | 本地职责                           | 上游近似职责                          |
| --------------------------- | ---------------------------------- | ------------------------------------- |
| Animation                   | 一个任务的时间、方向、状态和轨道   | Clip 的计时 + Animator 的部分属性逻辑 |
| Animator / globalAnimator   | 创建任务、合成属性、RAF 管理       | Animation 的调度职责                  |
| WaveformAnimationController | 图表作用域、预设、版本、终态和资源 | ECharts 过渡协调 + 图形实例生命周期   |

保留本地名称，但不能写成与上游同名类一一对应。模块导入不访问 window、不创建 RAF；globalAnimator 惰性启动，各图表使用独立 owner token。显式创建的 Animator 有独立队列，互不销毁。

## Decisions

### 1. 时间引擎与属性轨道

核心不依赖 DOM。`AnimationConfig` 包含 initialize、duration、delay、easing、loop、direction、force、additive、tracks、during、done、aborted、onError。通用默认值为 1000ms、0ms、linear、1 次、normal、force=false、additive=false。

轨道描述 `target`（对象身份）、`property`（属性名）、`from`、`to`，支持有限 number、number[]、number[][]；数组每层形状必须相同且不修改调用者提供的 from/to 数组；target 属性是显式授权的输出位置，数组写入采用新数组替换，不原地改写旧数组。读取/写入目标属性使用同一数值类型，路径字符串不是轨道值。每个目标属性先完成合成，统一写一次；during 在本帧所有写入后调用，可通知 Vue 展示状态失效。

`during(easedProgress, frame)` 的 frame 包含 rawProgress、directedProgress、iteration、terminal。rawProgress 在 [0,1]，iteration 从 0 开始；先施加方向再缓动。允许 back/elastic 产生越界 easedProgress；预设对 opacity/裁剪进度限幅 [0,1]，scale 限制下界 0、保留上界回弹。缓动名为 linear 和 quad/cubic/quart/quint/sine/expo/circ/back/elastic/bounce 的 In/Out/InOut，共 31 个，映射 D3 对应函数；quart/quint 使用 easePoly 的 exponent(4/5) 变体，不新增公式。也允许自定义函数。

duration/delay 必须有限且 >=0；loop=false 等价 1，true 为无限，数字必须为正整数。非法配置在注册前抛 TypeError/RangeError，无任务和回调副作用。普通不变轨道且 force=false 同步完成；无轨道的计时回调任务须 force=true 才实际计时。force 不覆盖图表级 disabled、阈值或无 RAF 降级。

状态为 PENDING、RUNNING、PAUSED、FINISHED、ABORTED。delay 仅在首次播放前生效；PENDING 也可暂停，暂停延迟与有效时间一起冻结。每帧用绝对有效经过时间计算周期和余数，不能仅 currentLoop++。有限次数最后一帧按最后一次方向取终点；无限循环不自动 done。零时长忽略 delay，同步提交方向对应终点且 done 一次；零时长无限循环拒绝。有限零时长多循环直接取最后迭代终点。

引擎单任务显式 `finish()` 提交末次迭代终点并 done；无限循环取当前迭代终点。`abort()` 保留当前值并 aborted；destroy 中止且不补帧。结束态 tick 无效。done/aborted 互斥且只通知一次。during/缓动异常中止该任务并调用 onError；终止回调异常仅报告，不改变终止状态、不阻断其他任务。onError 缺省使用 console.error，onError 自身异常也隔离并报告。

### 2. 累加、替换与调度

普通轨道独占目标属性；多属性任务若与新普通任务有任一属性冲突，旧任务整体 abort。先捕获当前合成值作为新任务 from，冻结旧任务其他属性的当前值。无冲突的任务可并行。所有 animate 请求（包括 duration=0、无变化和无 RAF）均先完整校验，再捕获当前合成值并解决同 ID/属性冲突，最后才选择同步终态或注册播放；同步分支也必须取消旧任务。处理替换时先登记新一代身份，再通知旧 aborted；旧回调重入创建的更晚一代任务优先，已被取代的新请求不得再写值。

累加只用于兼容数值轨道且 loop 为 1/false，依赖的基础普通轨道也不得循环；from = baseEnd + committedOffset + sum(activeEndDelta)，即创建时基础轨道方向对应终点（无基础轨道则固定基值）、已固定偏移及仍活动累加轨道的方向对应终点贡献之和，to 为调用者期望的新目标。每条累加轨道贡献 `interpolate(from,to,p)-from`。每帧输出是基础轨道当帧值（无基础轨道则为固定基值）加 committedOffset 及所有活动贡献；不能读取上一帧输出再累加。

累加任务完成时把最终贡献折入持久偏移；中止时把当前贡献折入持久偏移；移除任务不产生跳变。基础任务结束/中止时冻结其最终/当前基础值，其他贡献继续。普通替换捕获完整合成值，终止该属性关联累加任务并清空旧偏移后接续，避免重复应用。累加维度变化、与循环组合、字符串值均在注册前拒绝。

调度采用单调时钟（默认 performance.now，可注入测试时钟）。每帧快照遍历，删除时比较任务对象身份而非仅 ID；回调中新任务下帧执行，取消任务不再写入。全部暂停/无任务时停止 RAF；仅延迟任务用最早截止时间的单个定时器唤醒，唤醒后再请求 RAF；恢复、取消、销毁同步维护该定时器。

无 RAF 的环境下，animate 直接提交目标并完成，不模拟无限循环、不安装 polyfill；模块导入和配置解析仍可用于 SSR。组件销毁只释放本 owner 的任务，不能调用共享 globalAnimator.destroy()。

### 3. Vue 展示状态与预设

新增组件动画 composable，接收已规范化系列、布局、采样结果及数据版本，创建独立的展示域、几何、裁剪和标注动画状态。输入、目标布局及缓存不参与逐帧修改。通过 shallowRef/显式失效批量提交展示快照；D3 仍生成几何，Vue 负责 DOM 属性及节点生命周期。公共预设接收数值状态和更新回调，不暴露 D3 selection。工厂是纯配置构造，不调用 binding.read/write；initialize 在事务校验和冲突处理通过、确认代次所有权后同步捕获并初始化状态，发生于延迟前。静态分支跳过 initialize。所有预设终帧由 frame.terminal 判断，路径输出 {kind:"settled",values:to}，释放旧几何再通知用户。

**入场：** 系列子组包裹线条、点和误差棒，新增内层动画裁剪，保留外层轨道裁剪。裁剪 ID 由实例 token 与内部递增 token 构造，不直接拼原始用户 ID。局部矩形覆盖轨道高度，处理描边边界但不得越过外层裁剪；宽度从 0 展开至 track.width。三方向为 left-to-right/right-to-left/center-out。首次有效非空显示及 data 引用更新中新增加的系列执行入场；空数据不调度。delay/stagger 开始前已写初态，不闪现最终路径。交错索引仅取当前页可见系列。

**更新：** data 引用变化触发，不监听数组内部修改。等待当前版本采样达到稳定结果后处理；只有成功取得目标几何才创建过渡，迟到版本丢弃。相同规范化系列 ID、lineType、路径分段/命令结构、各几何的渲染点 X 序列、点型和误差棒结构相同才可插值。复用现有生成器，从对应数值坐标生成每帧路径，不解析/插值 SVG 字符串。未改变的数据或纯采样同版本补全不重复启动更新；动画期间同版本采样几何变化则稳定到最新结果。

结构不兼容时旧/新系列整体交叉淡化，线条、点和误差棒共同参与。旧组不可交互。空到非空执行入场，非空到空立即清除；移除系列立即清除，不另承诺系列退场。连续兼容更新从当前展示坐标接续；交叉淡化中再更新需要第三份几何时，清理两份旧几何并直接显示最新目标。本规则优先于连续平滑承诺，每系列最多两份展示几何。

目标真实域立即提交；展示域从当前域向目标插值。域专用进度 q=clamp(easedProgress,0,1)，只限制域而不取消标注回弹。使用凸组合 (1-q)*old+q*new 计算上下界，每帧检查有限且下界<上界；目标域先经现有域工具正规化，若仍非法则保留最近合法域并报告错误，不向比例尺写非法值。浮点舍入导致中间域退化时直接提交合法目标域。自定义 easing 返回非有限值视为任务错误；图表控制器随即静态提交最新合法目标。同一个轨道的所有系列、轴、网格和标注锚点共享一条域时间线；overlay 独立 Y 轴按轴分组。固定域不做域动画。数据对应关系可插值时插值显示数据值并用当帧展示比例尺投影，避免坐标和域二次插值；坐标空间独立变化时保持数值不变、仅投影。交叉淡化两组均用当帧展示比例尺投影。刻度集合使用目标域的刻度，按展示比例尺定位，不每帧重新选择刻度。

**采样状态：** 动画适配层区分 pending、success、fallback、error 四种结果，身份包含数据版本及采样请求签名。现有 ready() 只表示任务稳定，不能当成成功凭据；需在采样适配层同时传递结果状态。fallback/error 保持现有采样策略产出的回退/保留几何或占位并静态展示，可正常导出稳定结果，不强行启用 JavaScript 回退、不等待不存在的成功路径。pending 时保留最新业务布局允许的静态回退展示，不对不完整几何做形变。交互接管或禁用先清除动画临时效果，使用当前版本允许的回退展示并以完整目标数据计算事件，同时为该请求签名记录 skipAnimation；随后同请求成功也静态落地。布局/视口变化产生的新请求重新遵循策略，旧请求不能恢复动画。导出仍等待 settled（包括 fallback/error），未稳定则沿用 5 秒超时。

**标注锚点：** 为本轮可见标注从新旧完整规范化数据分别求锚点，缓存这两个数值点（不逐帧扫描完整数据，也不查询采样点）。兼容过渡时以与波形相同的 easedProgress 插值锚点值，再用当帧展示域投影；固定域同样插值锚点。连续更新从当前展示锚点接续。交叉淡化中只保留一份当前标注：使用新数据锚点，整个标注随新系列 opacity 淡入，旧标注展示立即移除，不伪装成受控删除。任一端无有效锚点则不做锚点形变：新端有效时按新端淡入，新端无效时隐藏；受控删除仍走退场快照。标签偏移保留消费者值，标签框/引线按当帧锚点重新定位。未发生数据变化的标注内容编辑不重播出现。

**标注：** 默认 scale；fade-in 为 opacity 0→1；scale 为以标签框中心缩放 0→1 并淡入；slide-in 为相对最终布局向下偏移 8px→0 并淡入；bounce 为缩放 0→1 并使用 bounceOut。scale 默认 backOut，fade-in/slide-in 默认 cubicOut。显式 easing 覆盖效果默认；退场按相同 easing 从当前展示值到隐藏值。外层组保留锚点/布局，内层标签组承载 transform，避免覆盖拖拽和定位；引线/锚点只淡化。

删除标注建立只读退场布局快照，Vue 渲染到完成后从展示列表移除；快照不参与命中、事件或序列化。相同 ID 重加取消 leave，从当前展示样式转向出现终态；同 ID 内容更新不重播入场。初始标注仅在对应系列入场结束后出现；系列动画关闭时无需等待。annotationsVisible=false、隐藏系列、分页切换和 cleanView 立即清除不再可见的快照，不把隐藏误判成受控删除。具有有效已渲染布局且启用标注动画时方可建立退场快照，静止图表删除标注同样支持退场；pending/错误占位或无有效布局时直接清除。

### 4. 控制器、交互与导出

对象级冲突独立于 tracks 检测：同标注 enter/leave 样式互斥，同系列 update 独占几何；入场中更新先取消旧 enter 并展开裁剪；共享轴用轨道/轴 ID 保持唯一 domain 任务。锚点与样式是不同通道可并发，系列和标注透明度相乘。custom 不同 key 的任意外部副作用由调用者保证不竞争。完整矩阵见 CTL-06。

批量终止采用 owner 屏障和固定任务快照：重入创建抛 animation-terminating，不同步完成、不发新回调，递归批量终止无操作。finishAll/降级/交互接管/导出先移除所属调度，不补旧任务 during，再 commitFinalState 最新业务目标，最后标记 FINISHED 并依创建顺序发 done。分类关闭仅提交该类；cancel 保留当前值并 aborted，destroy 清理后 aborted。commitFinalState 失败不发 done，改为 aborted/报告并抛回调用方，finally 释放屏障。完成通知保证展示数据已提交，不保证 Vue DOM 已 patch。完整触发矩阵见 CTL-07；管理器批量清理同样有管理器屏障，但图表不得阻塞其他 owner。

任务键使用 owner token + object kind + object ID + enter/update/leave/domain scope。控制器维护最新目标、版本和所属句柄；同 ID 任务替换不能误删新任务。取消旧动画不代表完成最新业务目标：`cancel` 保留当前展示；`finishAll` 提交最新目标；`destroy` 只释放。setEnabled(false) 调用 finishAll，清除动画专用裁剪、透明度、临时 transform 和退场快照，保留原有轨道裁剪。

鼠标/触摸指针查询、标注拖拽、滚轮、框选、平移以及外部 viewport/control 命令执行前同步稳定到最新业务目标。事件计算直接使用完整目标布局，不等下一次 DOM patch；随后 Vue 更新画面。动画帧不发送 viewport、annotation、hidden-series 变更事件。timeUnit 不改变任何数值坐标。

resize、显示模式、可见性、自动页码重置及 clean/presentation 布局切换结束当前动画，按新布局静态展示，不整批重播。用户显式切页使用独立请求代次和 owner 的 custom/update 透明度任务，复用 animationUpdate 默认300ms/cubicInOut，不保留旧页几何。等待最新页成功采样和有效布局时隐藏新页内容；fallback/error 直接完整显示。轴与网格立即更新，波形/点/误差棒及标注只乘共享透明度，基础几何投影与标注布局计算不依赖逐帧淡入透明度。快速翻页中止前一请求，旧页采样仍沿用现有版本守卫；数据、环境或自动页码变化取消请求。分页控件指针移动不稳定当前分页淡入，绘图区交互及命令/导出仍同步提交终态。设置恢复 enabled 只影响后续变化。暂停采用原因集合：单任务 manual、管理器 manual-all、控制器 manual-all、document-hidden 独立持有；任一原因存在即暂停。pause/resume 只增删自己的原因，resumeAll 不撤销单任务手动暂停。页面进入后台增加 document-hidden，返回只移除此原因；新建任务继承所属管理器/控制器及页面原因。有效暂停累计时间按原因集合非空的时间区间并集计算，不重复扣除。后台新任务不启动 RAF/延迟唤醒。finish、abort、禁用和导出不受暂停阻止；已有终止任务不会在恢复时复活。

exportImage 先验证参数、busy 和尺寸，再在既有 5 秒超时/版本守卫下开启当前图表的动画抑制区间，finishAll，等待采样、字体和 Vue 提交后创建最终态快照。在导出等待中到达的同版本采样结果静态提交，不新建动画；数据或布局版本改变仍为 export-stale；卸载仍为 export-cancelled。finally 释放抑制，恢复后只为后续变化启动动画。共享调度器其他图表不受影响。

### 5. 配置与公共接口

| Prop                | 默认                                                                                               | 规则                                      |
| ------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| animationEnabled    | true                                                                                               | 全局布尔开关                              |
| animation           | enabled=true, duration=1000, delay=0, easing=cubicInOut, staggerDelay=100, direction=left-to-right | 入场配置；duration=0 跳过该阶段延迟与交错 |
| animationUpdate     | enabled=true, duration=300, easing=cubicInOut                                                      | 数据和展示域共享更新时间                  |
| animationAnnotation | enabled=true, duration=300, type=scale                                                             | easing 按效果默认，可覆盖                 |
| animationThreshold  | 50000                                                                                              | >= 阈值即静态；0 表示始终静态             |

嵌套配置仅 undefined 使用默认，按字段合并；0 和 false 不得被 `||` 覆盖。组件配置中的非法数值或枚举回退该字段默认并在开发环境告警；通用引擎配置非法则抛错。threshold 接受有限非负整数，不用 Infinity 表达关闭阈值。统计全部有效规范化系列点数，含隐藏和非当前页，不统计采样后的点数；压缩/数据源表示通过规范化 source.length 获取，不为计数展开所有点。

播放中的 duration/delay/easing/direction/type/staggerDelay 在任务创建时快照，修改只影响后续任务；分类 enabled 关闭立即结束该类任务，update 包括其域和锚点联动，annotation 不包括仍随数据更新的锚点投影。关闭 enter 释放等待标注，若标注仍启用且有合法布局则开始出现；关闭 annotation 则立即显示合法当前标注并清除退场，不改变系列裁剪。全局禁用/阈值降级/reduce 才结束全部类别。分类恢复也不重播。同一 Vue 提交批次同时修改 data 和配置时，先合并最新配置，再处理新版本；这样关闭分类并换数据不会短暂创建动画。

有效开关为 global && category && 有RAF && !reducedMotion && totalPoints<threshold && !exportSuppressed。matchMedia 缺失视为无减少动态效果偏好；动态变为 reduce 时立即结束。首次渲染前解析有效开关，避免 watch 未 immediate 导致大数据入场。组件动画适配器卸载时清理 media/visibility 监听并 destroy 控制器；公共控制器本身不安装浏览器监听。

根入口明确导出 AnimationConfig、AnimationTrack、AnimationValue、AnimationFrame、AnimationState、AnimationDirection、AnimationHandle、EasingType/EasingFunction、公共配置、预设状态、绑定和选项类型（完整签名见 API-05 与 ENG-09 Requirement）、Animation、Animator、globalAnimator、WaveformAnimationController、缓动解析和预设工厂。实例暴露 start/tick/pause/resume/abort/finish；管理器 animate/remove/pause/resume/pauseAll/resumeAll/finishAll/clear/getAnimationCount/destroy；控制器暴露各预设、cancel/cancelAll/finishAll/pauseAll/resumeAll/setEnabled/getActiveAnimationCount/destroy。remove/clear/cancel 采用 abort 语义；全局单例 destroy 后允许后续 animate 惰性重新使用。组件 expose 不新增通用引擎控制方法，高级用户显式实例化控制器。实际类型声明须通过包消费测试，不支持未声明的深路径导入。

## Risks / Trade-offs

共享调度器减少重复 RAF 但要求严格 owner 隔离；Vue 逐帧失效需要局部展示状态，不能使完整标准化或采样每帧重跑。交叉淡化最多双份几何增加瞬时内存；在高频更新时允许直接最新态以限制资源。默认开启是可感知行为变化，README/发布说明必须说明关闭方式和减少动态效果。

2026-10-13 按用户“不能解决就把条件放宽”的授权调整性能验收，理由见 evidence/performance-acceptance-decision.md。保留 10k 点 >55 FPS、10k–50k 点 >50 FPS 的既有验证目标及静态对照，不声称跨设备保证或“无性能损失”。

- 包体：相同配置、依赖和 WASM 下，与既定无动画基线比较，ESM/CJS 每种格式的完整 gzip 增量均须 <15,000 bytes（十进制）。包括 CSS、所有额外 chunk 和资源，保留 SSR、公共 API 和 tree shaking。原 <10KB 作为非阻塞优化目标；15,000 bytes 是基于约 12KB 实测值留约 25% 余量的工程预算，不是用户感知临界点。
- 内存：取消 <10/<20MB 物理峰值作为本次交付硬门槛，保留为非阻塞优化目标。最终源码须保存静态/动画配对的完整 12 场景测量及错误，区分自然采样峰值、终态、GC 后留存和 20 次装卸；记录进程范围、观测窗口和源码指纹。失败记录不能混入成功验收，独立复测必须保留历史错误。
- 资源生命周期仍须满足现行 specs：每系列最多两份展示几何；settled 释放旧几何；卸载后所属任务、RAF、定时器和监听清理，20 次装卸后任务/容器元素为零。单元/组件回归与浏览器记录分别验证这些约束。实际资源残留或可重复的持续增长仍需修复；不以 GC 后单点或任务归零宣称绝对无泄漏。进程占用较高作为已知限制披露，不增加未经论证的新 MB 上限。

## Validation Strategy

单元和组件行为使用可注入时钟、fake RAF 与 Vitest/jsdom，不在 jsdom 宣称绘制 FPS。引擎新增模块覆盖率目标 >=90%（lines/statements/functions，branches >=80%），仓库总体保持已有门槛。测试包括循环边界、长时间跳帧、回调重入、所有终止方式、两图相同 ID、降级和导出。

真实浏览器基准固定种子数据、1280×720 与 360×300 图表容器、1/8 系列、总点数 1000/10000/49999/50000/50001/100000。固定 sampling 配置并记录最终显示点数；分别测静态、入场、兼容更新及不兼容交叉淡化。预热 3 次、采集 10 次，每次动画观测至少 2 秒；报告实际刷新率、FPS、帧间隔 p50/p95/p99、>50ms 长帧及重复装卸 20 次后可回收内存。内存测量不支持时标记未测，不用浏览器堆总量直接等同动画泄漏。

性能脚本使用独立 headless Chromium 页面及浏览器运行器，不复用 jsdom mount；提供 pnpm test:animation:browser 命令（后续实现任务添加）。固定浏览器版本和硬件条件，不把跨设备 FPS 做普通 CI 硬门槛。Chrome/Firefox/Safari/Edge 执行视觉/交互矩阵，缺少环境明确未验证。用户已将原生 iOS/Android 验证移出本次范围。复用组件与 Demo 同时验证桌面和小容器。

## Migration Plan

先实现引擎和独立状态层，再接预设/生命周期，最后根导出、README、Demo 和打包。没有数据迁移，关闭方式为 `:animation-enabled="false"`。不会自动发版；实现完成后再根据实际行为和包验证准备发布说明。首批基础类型、配置校验、缓动和测试支撑，以及继续批次的播放、预设、控制器、组件集成与验证工具已落地。实际命令和浏览器/包体测量见 implementation.md 与 evidence；本节的性能目标仍是目标，不因实现完成改写为保证。
