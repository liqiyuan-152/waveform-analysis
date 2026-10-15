## Purpose

定义波形图表通过真实 DOM 容器创建和操作实例的公开契约，使普通 JavaScript、React 与 Vue 使用同一套配置、命令和类型化事件接口，不依赖框架组件即可更新数据和控制完整图表。

## ADDED Requirements

### Requirement: DOM 初始化和实例查询

系统 SHALL 提供 init(dom, options?, initOptions?)、getInstanceByDom(dom) 和 dispose(domOrInstance)。init SHALL 接收真实 HTMLElement，拒绝无效容器；缺省数据 SHALL 显示空图。同容器重复 init SHALL 返回存活实例且不隐式应用新配置。销毁后 SHALL 可重新初始化并获得新实例。

#### Scenario: 初始化和重复初始化

- **WHEN** 对同一容器先后调用 init，再查询 getInstanceByDom
- **THEN** 返回同一存活实例，仅有一个图表根节点，第二次初始化传入的配置不覆盖第一次配置

#### Scenario: 销毁后重新创建

- **WHEN** 销毁容器关联实例，再对该容器 init
- **THEN** 销毁后的查询返回 undefined，新实例正常创建且无旧状态或事件残留

#### Scenario: 非法容器

- **WHEN** 使用 null、选择器字符串或框架 ref 对象代替 HTMLElement
- **THEN** 类型检查或运行时明确拒绝输入，不留下实例或 DOM 资源

### Requirement: 配置更新规则

setOption SHALL 支持顶层部分更新，未提供字段保持原值；数组与嵌套配置 SHALL 整体替换，替换后的嵌套配置按既有默认值解析。可选字段显式 undefined SHALL 按字段恢复默认或解除控制：annotations 恢复 [] 且仍要求消费者持久化，hiddenSeriesIds 和 interactionMode 恢复既有内部状态，data SHALL 不接受显式 undefined。系统 SHALL 不修改消费者输入，也不依赖数组原地修改刷新。

#### Scenario: 局部配置替换

- **WHEN** 只更新线型或传入新的部分 legend 对象
- **THEN** 未提供的顶层字段保留，legend 采用新对象及默认值，旧嵌套字段不隐式深合并

#### Scenario: 数据引用更新

- **WHEN** 消费者传入新 data 引用，或在同 data 引用下仅修改样式
- **THEN** 新引用刷新数据相关缓存与域并按既有规则处理视口；同引用样式更新不重新归一化或无故重置视口

#### Scenario: 清空和解除控制

- **WHEN** 传入 annotations: [] 或将可选受控字段设为 undefined
- **THEN** 分别清空标注或恢复该字段明确规定的默认/内部状态，且不修改旧输入

### Requirement: 命令和事件接口

实例 SHALL 支持 dispatchAction、zoomIn、zoomOut、fitToData、resetViewport、setViewportDomain、setInteractionMode、getControlState 和 exportImage。现有 trackId 目标、数字索引重载、结果状态、事件载荷与来源语义 SHALL 保持。工具栏和 API SHALL 使用相同约束和动作结果规则。on/off SHALL 按事件名提供类型化订阅，on SHALL 返回对应注册的取消订阅函数，旧句柄不得取消 off 后重建的新注册；多参数事件 SHALL 保留参数顺序，重复同事件/同 handler 订阅 SHALL 去重，off(event) SHALL 删除该事件全部监听。

#### Scenario: 工具栏和外部命令

- **WHEN** 对相同目标从工具栏或 API 执行同一视口动作
- **THEN** 使用相同域约束和结果规则，事件来源正确，既有 intent/change/end 顺序和无变化通知规则保持

#### Scenario: 类型化订阅和取消

- **WHEN** 注册事件后通过 off 或 on 返回的函数取消，再触发对应操作
- **THEN** 已取消回调不被调用；错误事件名和载荷用法由 TypeScript 检查拒绝

#### Scenario: 派发期间修改订阅

- **WHEN** 监听器在事件回调内增加或取消其他监听器
- **THEN** 当前派发使用订阅快照，新增订阅从下一次事件生效，不重复派发当前事件；若回调销毁实例则停止剩余通知

### Requirement: 受控更新请求

系统 SHALL 保持 annotations、hiddenSeriesIds 和显式 interactionMode 的受控语义，通过事件提交替换数组或模式请求，持久化由消费者负责。未回传受控状态时 SHALL 不提前应用变更；默认隐藏项和非受控模式 SHALL 保持当前行为。

#### Scenario: 消费者不回传

- **WHEN** 用户编辑标注、切换受控可见性或请求切换受控交互模式，消费者未更新配置
- **THEN** 发出相应请求，消费者原对象不被修改，图表实际状态和控件高亮不提前改变

### Requirement: 同步计算与原子配置更新

setOption SHALL 在配置校验与必要数据准备成功后一次提交，失败 SHALL 保持原配置、状态及资源，不发成功通知。既有数据归一化容错 SHALL 保留。后续命令和状态查询 SHALL 使用最新有效配置与数据，不能依赖尚未刷新的旧布局。

#### Scenario: 同调用栈更新和命令

- **WHEN** 依次 setOption 新数据、setViewportDomain 和 getControlState，尚未发生下一帧绘制
- **THEN** 命令按新数据边界计算，查询返回新状态，DOM 可延后刷新

#### Scenario: 混合有效和非法配置

- **WHEN** 同一次配置更新包含有效字段与配置级非法字段
- **THEN** 整次更新以包含 code/field 的明确错误拒绝，原配置和状态保持，输入数据容错规则不被改变

### Requirement: 逐字段控制切换

annotations SHALL 不建立非受控存储。defaultHiddenSeriesIds SHALL 只用于初始化内部隐藏集合，后续更新不得重置集合。hiddenSeriesIds 或 interactionMode 从受控切回 SHALL 恢复未被受控操作写入的内部值，而不是复制最后受控值。

#### Scenario: 控制解除和默认项变化

- **WHEN** 更新 defaultHiddenSeriesIds，再将 hiddenSeriesIds 或 interactionMode 设为 undefined
- **THEN** 使用原有内部集合或模式并遵守当前能力规则，既有内部值不被默认项或受控值覆盖

### Requirement: 明确动作与错误类型

dispatchAction SHALL 提供 zoom-in、zoom-out、fit、reset、set-domain、set-mode 的判别联合并返回 WaveformControlResult；异步导出 SHALL 保持独立。同步错误 SHALL 使用 invalid-container、invalid-option、instance-disposed 稳定 code；配置或动作形状错误 SHALL 包含 field。全局 dispose 对未注册容器 SHALL 安全无操作。

#### Scenario: 错误与动作类型消费

- **WHEN** 消费者传入不匹配动作的参数或执行无效初始化/配置/销毁后命令
- **THEN** 类型检查拒绝不匹配参数，运行时按明确 code 报错，不依赖错误文案；未注册容器的全局 dispose 不报错

#### Scenario: 非法动作运行时输入

- **WHEN** JavaScript 消费者传入非对象动作、未知动作类型或非法 set-mode 模式
- **THEN** 在动画稳定化和视口变更前抛 invalid-option，field 分别为 action、action.type 或 action.mode；合法动作的无效目标和范围分别返回 invalid-target 或 invalid-domain，不回退到其他目标
