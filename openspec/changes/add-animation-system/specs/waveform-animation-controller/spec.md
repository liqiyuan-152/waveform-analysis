## Purpose

规定动画与现有图表生命周期、Vue 渲染、交互及导出的连接方式，保证受控数据及完整数据查询不被展示动画改变。

## ADDED Requirements

### Requirement: CTL-01 展示所有权与实例隔离

控制器 SHALL 更新独立展示状态，由 Vue 写 DOM；MUST NOT 与模板竞争路径属性或直接删除标注节点。任务身份 SHALL 包含 owner token、对象类型/ID、scope；组件销毁只清理本 owner。data/annotations/hidden-series 数组和完整查询数据 SHALL 保持消费者所有权。

#### Scenario: 相同系列 ID 的两个图表

- **WHEN** 两个图表同时播放同 ID 系列，其中一个卸载或 cancelAll
- **THEN** 另一个继续播放，共享调度器不被销毁；已卸载图表的监听、任务及展示快照全部释放

#### Scenario: 动画帧不改变业务状态

- **WHEN** 动画逐帧更新路径、展示域或标注样式
- **THEN** 原始数据、目标域及缓存不变，不发出 annotation/visibility/viewport 业务变更事件

### Requirement: CTL-02 数据版本与中断方式

控制器 SHALL 以 data 引用变化启动更新流程，在当前版本采样就绪后获取目标几何，忽略旧版本结果。cancel SHALL 保留当前展示状态；finishAll SHALL 提交最新业务目标并清理临时属性/退场节点；destroy SHALL 仅销毁。禁用 MUST 使用最终状态恢复而不是只停止 RAF。

#### Scenario: 入场中关闭动画

- **WHEN** 裁剪展开到 40% 时 animationEnabled=false
- **THEN** 立即显示完整最新波形，清除临时 opacity/transform/裁剪及退场节点，RAF 不再属于该图表

#### Scenario: 迟到的采样结果

- **WHEN** A 版本请求晚于 B 版本完成，B 已是当前 data
- **THEN** 不用 A 的几何创建动画或覆盖 B；同版本采样在动画中改变几何时直接稳定到该版本最新结果

### Requirement: CTL-03 交互与布局接管

指针查询、标注拖拽、滚轮、框选、平移和外部视口命令 SHALL 在计算前提交目标展示态，使用完整目标布局计算事件。resize/分页/显示模式/可见性/cleanView/presentationMode 布局变更 SHALL 按新布局静态展示，不重播整批入场。恢复 enabled 只影响之后的变化。

#### Scenario: 动画中指针查询

- **WHEN** 波形或展示域过渡中发生 pointer move 或标注拖拽开始
- **THEN** 先稳定到最终态，再从完整数据计算最近点/锚点；timeUnit=ms 仍发出秒单位数值，不查询采样临时点

#### Scenario: 改变容器和页面

- **WHEN** 入场中 resize 或切换分页
- **THEN** 取消旧尺寸裁剪并提交新布局，不存在半条曲线或旧页退场残留，不为新页整批重播

#### Scenario: 后台暂停

- **WHEN** 页面进入后台后再返回
- **THEN** 增加 document-hidden 原因，返回仅移除该原因，其他暂停原因存在时不恢复；期间禁用或导出可直接完成，不被暂停阻止

### Requirement: CTL-04 图片导出最终态

exportImage SHALL 在现有参数/busy/尺寸检查后，在原有 5 秒超时和版本守卫内抑制本图表新动画并结束其已有动画，再等待采样、字体和 Vue 提交，导出最终态。MUST NOT 等待无限循环或导出半裁剪画面。抑制区间 SHALL 在 finally 释放，保持 export-stale/export-cancelled/export-timeout 等已有错误语义。

#### Scenario: 入场或无限任务中导出

- **WHEN** 有效图表入场中或所属无限动画运行中调用 exportImage
- **THEN** 结束该图表动画并得到完整最终态 PNG/SVG，其他图表继续播放；导出后不重播已结束动画

#### Scenario: 导出等待当前采样

- **WHEN** 导出过程中同版本采样结果到达
- **THEN** 静态提交结果再创建快照，不新建更新动画；动画帧本身不制造 export-stale

#### Scenario: 导出版本变化和超时

- **WHEN** 导出等待时替换 data、卸载或超过 5 秒
- **THEN** 分别拒绝 export-stale、export-cancelled、export-timeout，清理抑制标记及临时资源，不输出混合版本图片

### Requirement: CTL-05 采样结果与未就绪接管

动画适配层 SHALL 以 data 版本和采样请求签名区分 pending/success/fallback/error。ready/settled 只表示稳定，不代表成功；只有 success 且当前请求未标记 skipAnimation 才可启动过渡。fallback/error SHALL 静态显示现有采样策略允许的回退/保留几何或占位，不强制更改后端及降级选项。pending 不对不完整几何形变；交互/禁用接管 SHALL 清除临时效果，使用当前版本允许的静态回退展示、完整目标数据查询，并对该请求记录 skipAnimation。之后同请求成功只静态落地；新请求独立判定策略，旧请求不能复活动画。

#### Scenario: settled 但采样失败

- **WHEN** wasm/error 模式采样失败且 ready=true
- **THEN** 静态保留既有策略的错误占位或合法回退结果，不当成成功几何播放，也不擅自切换 JavaScript；导出可导出该稳定结果

#### Scenario: pending 时交互或禁用

- **WHEN** 当前采样尚未返回时发生指针查询或动画关闭
- **THEN** 不同步展开全部数据伪造目标路径；清理动画并以完整数据查询，当前请求随后成功时静态提交，不突然开始过渡

#### Scenario: 导出等待未稳定结果

- **WHEN** 导出时采样 pending，之后进入 success/fallback/error 或一直 pending
- **THEN** 三种稳定结果均按既有策略静态导出；一直 pending 仍在原 5 秒上限拒绝 export-timeout

### Requirement: CTL-06 对象级预设冲突

控制器 SHALL 在引擎数值轨道冲突之外维护对象级占用表，回调型预设也适用；scope 不同不代表可同时写同一展示通道。冲突表如下，替换均先保存当前展示快照、取消旧任务、登记新代次，随后才初始化新任务；跨 owner 不冲突。

| 对象/通道                     | 互斥与并发规则                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 同 annotation 的出现/退场样式 | enter 与 leave 互斥，新任务取消旧任务；重新出现取消退场，不等待旧 done                                          |
| 同 series 的几何更新          | 一次仅一个 update；已有 enter 时先完成裁剪并取消其旧任务，更新不被残留裁剪遮挡                                  |
| 同 series 的新 enter          | 取消该系列旧 enter/update 并使用新初始化态；已有 update 不得随后覆盖                                            |
| 同 axis 的展示域              | 仅一个 domain 任务；调用方用轨道身份与 Y 轴身份组成轴 ID，不按系列各建一条                                      |
| annotation 锚点与出现样式     | 可并发，锚点属于 update 通道，opacity/scale/offset 属于样式通道；系列淡化透明度与标注自身透明度相乘，不互相覆盖 |
| custom                        | 相同 AnimationObjectKey 替换；不同 key 的任意 during 外部副作用无法自动识别，调用者负责不竞争同一状态           |

#### Scenario: 无 tracks 的标注退场被重加替换

- **WHEN** leave 使用 force/during 写 opacity，尚未结束即同 ID enter
- **THEN** 对象级占用表取消 leave，新任务从当前样式接续，即使 tracks 为空也不会两任务同时写入或旧回调删除新节点

#### Scenario: 入场中更新及共享轴

- **WHEN** 裁剪未展开完就替换同系列数据，且多个系列共用一条 Y 轴
- **THEN** 先解除旧入场裁剪，再执行一次几何更新；共享轴只保留一条 domain 任务，不因多个系列调用重复写域

### Requirement: CTL-07 批量终态与通知顺序

控制器 SHALL 将终态提交和用户通知分离，所属批量操作期间开启 owner 屏障，重入 animate 抛出 animation-terminating 且不触发新回调；递归批量结束为无操作，其他 owner 不受影响。被拒绝的新请求从未创建，不适用“已创建任务 done/aborted 一次”规则。批量操作固定已有任务快照，不收集回调产生的新任务。

| 触发方式                                              | 写入与状态                                                                                              | 用户通知                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 自然完成、单任务 finish                               | 提交任务终帧并清理其临时资源，标记 FINISHED                                                             | 然后 done/onComplete 一次                                              |
| 替换、cancel/cancelAll                                | 保留当前展示，取消调度并标记 ABORTED                                                                    | 然后 aborted/onAbort 一次，不发 done                                   |
| 分类关闭                                              | 仅提交该分类最新目标、清理该类任务，标记 FINISHED                                                       | 全部提交完后依创建顺序发送该类 done，其他类继续                        |
| finishAll、全局禁用、阈值/reduce、交互/布局接管、导出 | 移除所属调度任务，不调用旧预设 during；commitFinalState 提交最新目标并清理资源，再标记快照任务 FINISHED | 完整目标状态提交后依创建顺序发送 done，不能先通知再更新目标            |
| destroy/卸载                                          | 移除调度、快照、监听，标记 ABORTED；不补终帧、不调用 commitFinalState                                   | 清理后 aborted 一次；期间新请求拒绝，销毁完成后拒绝 animation-disposed |

这里“状态提交”是同步展示数据完成，不承诺 Vue DOM 已 patch；用户需要 DOM 时 await nextTick。终止回调抛错只报告并继续后续通知。commitFinalState 抛错 SHALL 将本次未完成的任务标记 ABORTED、发 aborted 并报告错误，抛回调用方但 finally 释放屏障；不虚报 done，导出继续沿用既有失败处理。分类关闭使用内部分类提交函数，不以整图 commitFinalState 误结束其他分类。

#### Scenario: 完成回调观察终态

- **WHEN** 全局关闭或导出结束一组过渡，onComplete 同步读取展示数据
- **THEN** 已是最新目标且没有旧几何/裁剪/退场快照；DOM 查询需等待 nextTick，旧目标不被补帧覆盖

#### Scenario: 完成回调递归续建

- **WHEN** finishAll 的 onComplete 尝试再创建同 owner 动画，或递归调用 finishAll
- **THEN** 前者抛 animation-terminating 且没有新回调，后者无操作，原操作有界返回，其他图表动画不受影响
