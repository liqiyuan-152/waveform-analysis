## Purpose

首次记录采样调度和 Worker 会话的生命周期契约，要求任务失败、数据替换及组件卸载时仍具备确定的取消、清理和最新结果应用行为，避免异步错误阻塞渲染或污染新数据会话。

## ADDED Requirements

### Requirement: 任务失败后继续处理最新请求

调度器 SHALL 最多执行一个任务且只保留最新待执行任务，单个任务 rejection 不得造成未处理的 Promise rejection 或阻塞已排队的最新任务。

#### Scenario: 首个任务失败时已有新任务排队

- **WHEN** 首个任务等待期间连续排入两个任务，随后首个任务失败
- **THEN** 调度器处理失败并继续执行最后一个任务，丢弃被合并的中间任务

### Requirement: 注册和采样统一处理错误

系统 SHALL 覆盖数据集注册和视口采样的异常边界，对正常取消静默处理，对实际失败遵循已有 sampling-error 与 wasmFailureFallback 契约。

#### Scenario: 注册期间替换数据

- **WHEN** 旧数据的 Worker 注册尚未完成时消费者替换 data 引用
- **THEN** 旧请求取消且不会产生未处理拒绝，新数据注册和采样能够完成

#### Scenario: Worker 不可用或消息处理失败

- **WHEN** Worker 创建失败、postMessage 失败或收到 error/messageerror
- **THEN** 系统按照当前模式和回退设置完成 JavaScript 回退或报告失败，不把占位数据误报为 WASM 成功

### Requirement: 会话隔离与资源清理

系统 SHALL 在数据会话更替或组件卸载时使旧结果失效，清理请求、计时器、诊断队列、Worker 与其拥有的数据资源。

#### Scenario: 过期结果迟到

- **WHEN** 新数据已开始处理后旧会话返回采样结果或待发送诊断到期
- **THEN** 旧结果不覆盖新路径，不发送属于旧数据的完成、后端切换或错误事件

#### Scenario: 注册或采样期间卸载

- **WHEN** 组件在请求未完成时卸载
- **THEN** 所有会话资源释放，后续响应和计时器不再更新组件或发出采样事件

### Requirement: 故障验收遵循模式配置

系统 SHALL 按模式和 wasmFailureFallback 判定恢复结果，不将所有故障统一要求为 JavaScript 采样回退。

#### Scenario: 自动模式故障

- **WHEN** auto 模式需要采样但 Worker 或 WASM 不可用
- **THEN** 报告现有错误诊断并使用等价 JavaScript 采样

#### Scenario: 强制 WASM 允许回退

- **WHEN** wasm 模式且 wasmFailureFallback 为 javascript，Worker 或 WASM 不可用
- **THEN** 报告错误并使用等价 JavaScript 采样，不报告 WASM 成功

#### Scenario: 强制 WASM 禁止采样回退

- **WHEN** wasm 模式且 wasmFailureFallback 为 error，Worker 或 WASM 不可用
- **THEN** 报告采样错误并保留已有有效路径或当前同步占位，不要求 JavaScript 等价采样，不把占位输出报为 WASM 成功

#### Scenario: 原始模式

- **WHEN** 模式为 raw
- **THEN** 不创建采样 Worker、不初始化 WASM，不因 Worker 不可用产生采样错误
