## Purpose

定义无框架图表的更新、尺寸响应、异步任务和资源释放契约，保证快速数据与视口更新、多实例同时工作以及框架挂载卸载时不会出现过期渲染、重复事件或残留资源。

## ADDED Requirements

### Requirement: 合并更新与完成通知

系统 SHALL 同步接收配置和状态变更，并合并同帧可合并的 DOM 更新；rendered({ revision }) SHALL 在有效版本的一帧提交后发出；finished({ revision }) SHALL 在最新采样、测量、有限动画及待刷新工作全部稳定且已绘制后发出，每个版本至多一次，不将过期结果报告为当前完成。不承诺 setOption 返回时 DOM 已更新。

#### Scenario: 连续更新

- **WHEN** 一帧内连续更新数据、样式和视口
- **THEN** 最终渲染符合最新有效状态，不产生多份图表或丢失必要状态变化事件

### Requirement: 尺寸响应和零尺寸恢复

系统 SHALL 默认自动监听容器尺寸，支持通过 initOptions.autoResize 关闭自动监听并调用 resize；环境缺少 ResizeObserver 时 SHALL 降级手动 resize。隐藏或有效尺寸为零时 SHALL 暂停可视绘制且保留配置，不发 rendered/finished，恢复非零尺寸后正常绘制；重新布局 SHALL 保持有效业务状态。

#### Scenario: 隐藏后显示

- **WHEN** 容器从非零变为零尺寸，再恢复可用尺寸
- **THEN** 图表无非法几何或异常，恢复后布局和显示符合当前数据、视口和配置，完成事件不误报隐藏状态为稳定绘制

#### Scenario: 手动尺寸管理

- **WHEN** 初始化关闭自动尺寸监听并在容器变化后调用 resize
- **THEN** 图表采用当前尺寸重新布局，无额外自动监听造成重复更新

### Requirement: 异步结果有效性

异步采样、远程数据相关内部任务和动画更新 SHALL 只写回仍存活实例的有效版本。数据、视口或尺寸改变后过期采样结果 SHALL 不覆盖当前结果；已有 WASM 回退和诊断语义 SHALL 保留。

#### Scenario: 结果乱序到达

- **WHEN** 新旧数据或视口的采样响应乱序到达
- **THEN** 只采用当前有效结果，旧响应不改变几何、诊断状态或导出快照

#### Scenario: 等待期间销毁

- **WHEN** 异步任务未完成时销毁实例，随后任务返回
- **THEN** 不访问已移除节点，不恢复资源，不派发新的业务事件

### Requirement: 幂等销毁与资源隔离

dispose SHALL 幂等，释放本实例创建的节点、监听器、Observer、Worker、动画、定时器、待刷新任务、导出等待和浮层，并注销容器关联。销毁 SHALL 不删除宿主原有节点或破坏其他实例的滚动锁及焦点管理。实例 ID 和 SVG 引用 SHALL 跨实例唯一。

#### Scenario: 多实例独立销毁

- **WHEN** 两个图表同时运行并打开相关浮层，销毁其中一个实例
- **THEN** 另一个图表的交互、动画、SVG 引用及必要滚动锁正常，宿主节点保留

#### Scenario: 销毁后的调用

- **WHEN** 重复 dispose、执行已取得的取消订阅函数，或在已销毁实例调用修改命令、订阅或导出
- **THEN** 清理重复调用安全；修改和订阅明确抛出实例已销毁错误；exportImage 以 export-cancelled 拒绝；isDisposed 返回 true

### Requirement: 有效尺寸与宿主样式保护

显式 width/height SHALL 控制实例内层尺寸，缺省维度 SHALL 按宿主可用尺寸和既有最小高度规则计算；实际 CSS 约束后的测量结果 SHALL 用于渲染。resize SHALL 不改变配置。实例 SHALL 不修改宿主容器内联样式，不删除宿主原有节点，不覆盖宿主运行期间的样式修改。

#### Scenario: 显式尺寸切回自动

- **WHEN** 配置显式 width/height，随后将其设为 undefined 并 resize
- **THEN** 内层从指定尺寸恢复自动尺寸，宿主原有及后续修改的样式保持

### Requirement: 异常隔离与创建失败清理

初始化失败 SHALL 回收已创建资源且不注册失败实例。事件监听器或某个清理步骤抛异常 SHALL 不阻断其他监听或剩余资源释放；错误 SHALL 通过宿主报告渠道报告，不递归触发业务事件。导出稳定等待 SHALL 不仅依赖 finished 事件。

#### Scenario: 初始化中途失败

- **WHEN** 初始化已创建部分节点或监听器后失败
- **THEN** 回收这些资源，容器查询无失败实例，后续初始化可成功

#### Scenario: 监听和清理异常

- **WHEN** 一个监听器或清理函数抛异常
- **THEN** 后续监听或剩余清理继续执行，错误可观察，状态不半提交且 dispose 最终注销实例

#### Scenario: 动画中间帧和稳定版本

- **WHEN** 动画中间帧绘制后新配置取代当前版本
- **THEN** 中间帧可发 rendered，旧版本不发 finished；导出沿用稳定化、取消与超时规则，不因等待 finished 而死锁
