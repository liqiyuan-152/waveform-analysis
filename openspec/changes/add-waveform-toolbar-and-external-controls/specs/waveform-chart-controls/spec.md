## Purpose

统一波形工具栏与宿主应用的命令能力，明确模式状态所有权、独立子图目标及视口事件语义；在新增可调用操作的同时保留原有索引接口、秒坐标、数据不可变和消费者受控状态契约。

## ADDED Requirements

### Requirement: 公共操作接口兼容且可从外部调用

组件 SHALL 公开类型化的 zoomIn、zoomOut、fitToData、setInteractionMode、getControlState 和 exportImage。既有 resetViewport(trackIndex?) 与 setViewportDomain(domain, trackIndex?) 的签名、void 返回及原行为 SHALL 保留；新增基于 trackId 的对象重载。工具栏关闭时所有外部接口 SHALL 仍可访问。新视口操作 SHALL 返回 applied、unchanged、disabled、invalid-target、invalid-domain 或 empty-data 状态，模式请求另支持 requested。

#### Scenario: 旧调用继续可用
- **WHEN** 消费者使用原数字 trackIndex 调用设置范围和重置
- **THEN** 类型检查通过，目标范围、无效参数忽略和既有事件行为不变

#### Scenario: 隐藏工具栏后宿主放大
- **WHEN** toolbar=false 且可用的新 zoomIn 命令被调用
- **THEN** 图表改变视口并返回操作结果，无须展示或模拟点击工具栏

### Requirement: 模式受控和非受控状态一致

模式 SHALL 为 zoom、pan、annotation、none；未提供 interactionMode 时内部默认 zoom，方法和内置按钮可直接改变它。提供 prop 时 SHALL 发 update:interactionMode 请求，只有回传值生效后才改变实际模式；实际变化 SHALL 发一次 interaction-mode-change。getControlState 和 control-state-change SHALL 提供不可影响内部状态的模式、可用操作、目标与视口快照。

#### Scenario: 受控模式往返
- **WHEN** 宿主控制 zoom，命令请求 pan 且宿主随后回传 pan
- **THEN** 请求阶段返回 requested 并保留 zoom；回传后实际模式与按钮同步为 pan，实际变化事件只发一次

#### Scenario: 无交互模式
- **WHEN** none 生效
- **THEN** 禁止拖动、滚轮缩放与创建注解，仍允许悬浮查询及独立调用的可用视口命令

### Requirement: 能力限制与手势生命周期统一

新交互命令 SHALL 遵守 zoomable、pannable、annotationsVisible 与 presentationMode；presentationMode 禁用新交互类命令但允许导出。pan SHALL 无须 Space，zoom 模式仍支持已启用的 Space 临时平移。切换模式、禁用能力、替换数据和卸载 SHALL 取消未完成手势并释放指针，不把残留手势提交为新操作。注解和隐藏系列仍由消费者通过既有 props/事件持有。

#### Scenario: 拖动中禁用或卸载
- **WHEN** 平移拖动尚未结束时关闭 pannable 或卸载组件
- **THEN** 指针捕获和待处理交互被释放，不发出迟到的成功操作

#### Scenario: 演示模式导出
- **WHEN** presentationMode=true 且宿主请求导出
- **THEN** 允许导出当前图表；放大/平移等新交互命令返回 disabled

### Requirement: 操作目标使用当前页稳定标识

独立模式新命令 SHALL 默认作用于当前页全部图框（包括返回 empty-data 的空图框）；指定 trackId 时只操作当前页匹配图框，未知或非当前页 ID 返回 invalid-target。共享 X 模式 SHALL 操作共享范围，携带 trackId 的新调用返回 invalid-target。目标错误不得静默退化成全局操作或自动翻页。

#### Scenario: 指定稳定目标
- **WHEN** 当前页图框顺序变化后调用 zoomIn({trackId:'channel-a'})
- **THEN** 仅 channel-a 对应图框改变，与当前数组位置无关

#### Scenario: 指定隐藏页目标
- **WHEN** trackId 存在于数据但不在当前页
- **THEN** 返回 invalid-target，当前页、隐藏页和分页状态不变

### Requirement: 缩放遵守约束并保留完整数据语义

zoomIn/zoomOut SHALL 围绕目标当前 X 中心把跨度乘 0.5/2，遵守现有缩放限制且不改变 Y 视口；边界无可用变化返回 unchanged。框选和平移 SHALL 保留既有 X/Y 手势语义。范围与事件坐标 SHALL 始终为秒，完整数据继续用于域、悬浮和注解。

#### Scenario: 放大达到最小范围
- **WHEN** 当前范围已达到 minZoomSpan 或 minVisiblePoints 等约束
- **THEN** 放大不会越界、修改源数据或产生伪成功事件

### Requirement: 重置与显示全部具有不同语义

reset SHALL 恢复初始视口及已有 Y 重置规则；fit SHALL 基于当前已加载的完整规范化数据中可见系列适配 X 域，遵守 xDomainStrategy，恢复自动 Y 范围且尊重显式固定 Y 域。fit SHALL 能超出较窄的初始窗口；reset 恢复该初始窗口。两者均不改变分页、隐藏系列或注解；无可见有效数据返回 empty-data。

#### Scenario: 初始范围小于数据范围
- **WHEN** 数据域 [0,10]、初始范围 [2,8] 且 xDomainStrategy 为 data
- **THEN** fit 显示 [0,10]，随后 reset 返回 [2,8]；自动 Y 恢复完整可见源范围，固定 Y 配置仍优先

#### Scenario: 宿主只加载局部数据
- **WHEN** 当前 data 只包含一个局部时间段
- **THEN** fit 只适配已加载部分，不宣称恢复未加载历史，不自动请求远端数据

### Requirement: 多目标结果明确表达部分成功

新视口命令 SHALL 返回 { status, targets }，targets 按当前页顺序包含各目标的 trackId、status 及有效视口存在时的 before/after 快照；共享范围使用单个 shared 目标。逐目标状态 SHALL 为 applied、unchanged、disabled 或 empty-data。整体状态 SHALL 按 applied > unchanged > disabled > empty-data 汇总，不将部分成功表达为全部成功。命令级 invalid-domain/invalid-target SHALL 返回空 targets 且不执行任何目标；当前页无图框返回 empty-data 和空 targets。模式命令 SHALL 使用空 targets，结果类型按命令种类区分。

#### Scenario: 当前页部分图框可以放大
- **WHEN** A 可放大、B 已达到最小跨度、C 无有效数据，调用当前页 zoomIn
- **THEN** 总状态为 applied，按页顺序返回 A=applied、B=unchanged、C=empty-data，仅 A 改变且发出缩放事件

#### Scenario: 无变化与禁用混合
- **WHEN** 所有目标分别为 unchanged、disabled 或 empty-data，且至少一个为 unchanged
- **THEN** 总状态为 unchanged，逐目标原因完整保留，不发出缩放事件

### Requirement: fit 后所有交互使用统一有效边界

每个独立图框或共享范围 SHALL 维护 initialBoundary 和 effectiveBoundary，fit 将后者设置为完整可见数据按 xDomainStrategy 计算的范围。滚轮、框选、平移、命令、坐标映射和 D3 transform/scaleExtent/translateExtent SHALL 共用 effectiveBoundary，边界变化时按数据域重投影 transform。maxZoomScale 及无约束时默认 40 倍限制 SHALL 以 effectiveBoundary 跨度计算，并与 minZoomSpan/minVisiblePoints 取最严格约束。

新旧 reset SHALL 清除对应 fit 状态并恢复初始 X/Y；分页或显示模式切换 SHALL 按既有视口重置规则清理相应边界。data 引用、可见系列、初始域改变 SHALL 废弃旧 fit 边界，以新 initialBoundary 约束和重投影视口。旧数字 setViewportDomain SHALL 退出对应 fit 状态并沿用初始边界约束；新对象重载 SHALL 使用 effectiveBoundary。

#### Scenario: fit 后滚轮和拖动不跳回旧窗口
- **WHEN** 初始范围 [2,8]、数据范围 [0,10]，fit 后执行滚轮、框选或平移
- **THEN** 以 [0,10] 为有效边界连续操作，坐标映射与 transform 一致，不跳回 [2,8]

#### Scenario: 倍率限制随有效边界变化
- **WHEN** maxZoomScale=10，初始跨度为 6，fit 后跨度为 10，且没有更严格限制
- **THEN** 最小跨度由 0.6 变为 1；reset 后恢复 0.6，旧数字设置接口恢复初始边界语义

#### Scenario: 数据或可见系列更新
- **WHEN** fit 后替换 data、改变可见系列或初始域
- **THEN** 清除旧 fit 边界，按新初始边界约束和重投影，不将旧数据范围带入新会话

### Requirement: 新命令事件不重复且兼容旧调用

zoom-change SHALL 保留 [start,end] 载荷。zoom-intent/zoom-end 的 gesture SHALL 扩展为 wheel、box、command，新命令不得伪造手势；新命令 intent/end/reset SHALL 携带 commandId、source（toolbar/api）、action（zoom-in/zoom-out/set-domain/fit/reset）与既有目标标识。同次多目标调用 SHALL 共用 commandId；新增字段对旧事件可选。README 和类型测试 SHALL 明确旧 gesture 穷举需要适配 command 分支。

每个 applied 的 zoomIn/zoomOut/对象 setViewportDomain SHALL 依次发 zoom-intent、zoom-change、zoom-end 各一次。applied fit SHALL 只发 zoom-change、zoom-end，end.action=fit，不发 intent/reset。对象 reset 对合法、非空且允许操作的目标 SHALL 在 applied 或 unchanged 时发一次 zoom-reset，不发 intent/change/end；unchanged reset 表达宿主恢复数据的意图。其他 unchanged 及 invalid/disabled/empty-data SHALL 不发操作事件。原数字方法保持静默，原 wheel/box 和双击事件行为保持。

命令 SHALL 先计算全部目标不可变快照、一次提交状态，再在同次同步调用中按当前页顺序逐目标通知，intent 在 Vue 渲染稳定前发出；回调之间不得重读可能已被宿主替换的数据。applied 仅表示本地状态提交，不代表异步采样完成。control-state-change SHALL 按 Vue 更新批次合并，不作为加载入口。宿主 SHALL 选择 intent 或 end 中一个作为加载入口，end 加载器 SHALL 忽略 fit；README 提供两种集成示例。

#### Scenario: 外部与内置放大等价
- **WHEN** 同一初始状态分别通过按钮和新外部 zoomIn 调用
- **THEN** 目标范围、结果与 intent → change → end 次数一致，source 区分 toolbar/api，gesture 为 command

#### Scenario: 初始视口仍可请求恢复数据
- **WHEN** 当前视口已为初始范围且合法非空目标允许重置，调用对象 reset
- **THEN** 返回 unchanged 并仅发一次 zoom-reset，宿主可以取消请求并恢复初始数据

#### Scenario: fit 不触发加载
- **WHEN** 宿主选择 zoom-end 加载且用户 fit
- **THEN** end.action=fit 被加载器忽略，不请求远端或恢复未加载数据

#### Scenario: 事件回调替换数据
- **WHEN** 当前页多目标命令的首个事件回调替换 data
- **THEN** 本次后续事件仍使用原 commandId、目标顺序和已捕获范围，不混入新数据目标
