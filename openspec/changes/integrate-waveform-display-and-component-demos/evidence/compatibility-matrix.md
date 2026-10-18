# 兼容矩阵

| 能力 | 分析策略 | 展示策略 | 验证位置 |
| --- | --- | --- | --- |
| 数据 | kind/TypedArray；替换引用，秒坐标 | 点/系列数组；复制快照，保持 X 单位 | tests/core、迁入 tests/display/data |
| 配置 | 顶层覆盖；undefined 回默认 | 嵌套显式合并与回默认 | tests/model、tests/display/model |
| 系列身份 | 重复 ID 分配唯一后缀 | 可见性状态用 ID+出现次数或 index；动画匹配另按下述规则 | normalization、WaveformModel、SeriesDiff 测试 |
| 事件 | 同回调去重，快照发射 | 独立订阅、跳过发射中取消的条目 | ChartEventEmitter、Waveform.events |
| 动画 | 现有任务/owner/循环/方向/累加 | 入场与更新类别各自完成/中止 | tests/animation、tests/display/animation、Waveform.animation |
| 暂停 | owner 与环境原因 | manual/hidden，恢复单原因不覆盖另一个 | 动画契约和迁入 Animator 测试 |
| 导出 | 异步稳定屏障及 stale/cancelled/timeout | 同步终态 SVG、完成回调微任务、销毁后空串 | tests/export、Waveform.animation/lifecycle |
| 点大小 | π(size/2)² | 4size² | seriesStyle 与展示 line 测试 |
| 点划线 | 8 5 1.5 5 | 8 4 2 4 | 样式测试及浏览器 |
| 降级 | 原分析阈值、无 RAF、减少动态效果 | 原展示阈值、无 RAF、减少动态效果 | 公共内核与适配层测试 |

每次迁移保留原测试并添加跨组件契约测试。更具体的回调时序以原项目测试和当前源码为准，不将两个类别合并为单通知。

## Demo 与依赖迁移

统一采用 ant-design-vue 4.2.6（仅 demo/test workspace），保留展示现有 Segmented/theme API；分析 Demo CSS 改为 v4 reset.css，原有分析控件行为由原 demo 测试覆盖。展示原 45 文件 / 502 用例迁入后全部通过。

## 动画协议

公共引擎沿用 AnimationConfig/AnimationHandle/AnimationScheduler。展示通过 ElapsedTimeline 将公共引擎的 iteration/rawProgress 转为有效经过毫秒数；start/stop/pause(reason)/resume(reason) 全部委托 Animator，不拥有第二套状态机。展示控制器保留 prepare（创建 presentation）、frame（提交上下文）、finish（终态及类别通知）、destroy（先释放资源再通知）职责。分析已有 NativeChartAnimation 保留同一引擎和低分配路径。

## 场景级验收定位

以下是测试中的明确预期，最终执行结果另见 verification.md（不能仅凭用例存在视为通过）。

| 场景 | 测试路径与用例名 | 预期 |
| --- | --- | --- |
| 多暂停原因 | tests/display/animation/Animator.test.ts — owns at most one frame and excludes overlapping pause reasons | 同时最多一个帧请求，恢复一种原因后仍受其他暂停原因约束，暂停耗时不进入进度 |
| 替换重入 | 同上 — allows replacement from a frame without resurrecting the old run | 回调创建的新任务保留，旧任务不恢复调度 |
| 类别分别完成 | tests/display/integration/Waveform.animation.test.ts — finishes categories independently and disables only the selected category | 关闭更新类别时 update 完成 1 次、enter 为 0；后续入场结束 enter 为 1、update 仍为 1 |
| 终止回调重入 | 同上 — drops remaining old category notifications when the first abort submits a third target | enterAbort 为 1；旧批次剩余通知失效，新批次可中止一次，updateAbort 总计为 1；无遗留帧 |
| 完成回调中销毁 | 同上 — drops the second completion when the first callback destroys the chart | 首类别回调销毁实例后，不再发出旧批次第二类别完成通知 |
| 同步导出、微任务通知 | 同上 — exports the target synchronously and defers completion callbacks；initiates downloads before completion callbacks and permits callback replacement of data | 同步字符串或下载使用终态，通知在微任务执行，回调允许安全更新数据 |
| 销毁使导出通知失效 | 同上 — suppresses deferred export callbacks after destroy and tolerates recursive export | 销毁使待发通知失效，递归导出不重复完成通知 |
| 分析导出稳定性 | tests/export/ChartExporterLifecycle.test.ts — times out unstable sampling/animation and allows a stable retry without timers；rejects a new business revision while waiting without an explicit invalidate hook | 等待未稳定时 timeout；版本变化时 stale；稳定后允许重试 |
| 分析导出取消 | tests/export/ChartExporter.test.ts — rejects concurrent exports and cancels waiting exports on disposal | 并发导出被拒绝，销毁使等待中的导出取消 |
| 减少动态效果 | tests/display/integration/Waveform.animation.test.ts — finishes on reduced-motion changes and removes its environment listener | 偏好改变时按原策略提交终态，销毁移除监听 |
| 跨文档时钟 | tests/chart/nativeAnimationWindow.test.ts — uses only the host clock/frames and ignores visibility changes in the parent document；展示 Waveform.animation.test.ts — cleans foreign-window RAF and document subscriptions without using the parent clock | 两边均使用宿主时钟，销毁取消宿主帧及监听 |
| 共享尺寸工具 | tests/display/integration/unifiedComponents.test.ts — owns both components observers and animation frames in the iframe window | 销毁一个仍保留另一实例的 observer；全部销毁后 iframe 仍挂载、SVG/observer/RAF 均为 0 |
| 同 ID 与外部任务 | 同上 — shares the task engine while keeping chart state, IDs and consumer tasks independent | 销毁展示不影响分析及消费者 Animator；不修改原始数据，无重复 SVG ID |

展示的状态身份与动画匹配必须区分：WaveformModel 用 ID+出现次数/index 保存隐藏状态；SeriesDiff 只对唯一明确 ID 或双方单条匿名系列匹配，歧义多系列退回静态终态。PointDiff 使用全体明确 ID，否则使用精确 X；混合/重复 ID、重复 X 或匹配顺序冲突不能几何插值，沿用交叉淡入淡出。对应回归用例为 Waveform.animation.test.ts 的 `crossfades ambiguous points but falls back for ambiguous series identities`。
