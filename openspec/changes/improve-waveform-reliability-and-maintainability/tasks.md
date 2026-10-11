## 1. 采样正确性

- [x] 1.1 在最窄测试层加入 `(0,0)`、`(10,10)` 与视口 `[2,8]` 的线段丢失回归，覆盖 raw 和 auto-raw。
- [x] 1.2 分离可见统计区间和绘图区间，统一原始、占位、回退和 Worker 输出所需的两侧连接点及点数诊断。
- [x] 1.3 补线性、各阶梯线、空数据、数据域外视口、阈值切换和低采样预算测试，验证主体预算与边界开销；average/sum 仅聚合可见区间，再补外侧连接点，覆盖预算 1/2、空可见区间和 JS/WASM 数值一致性，并更新 README 的边界点说明。
- [x] 1.4 验证域、误差范围、悬浮与注解仍使用完整数据，时间显示切换不改变原始坐标和事件值。

## 2. 异步生命周期

- [x] 2.1 增加调度器失败后继续执行最新任务的回归测试，确保不存在未处理的 Promise rejection。
- [x] 2.2 增加内部错误处理并保持单任务执行、最新任务合并及取消语义。
- [x] 2.3 将 Worker 注册和采样纳入统一异常边界，区分正常取消和实际采样失败。
- [x] 2.4 完善会话 generation/epoch 校验，在数据替换和卸载时清理诊断、计时器、请求与 Worker，忽略过期响应。
- [x] 2.5 使用可控 Worker 覆盖注册延迟、postMessage 异常、error/messageerror、数据替换、卸载和失败回退。

## 3. CI 与 lint

- [x] 3.1 复核当前工作区差异（ci.yml 改动、showcase-release.yml 新增、WASM 二进制改动），在保留无关改动的前提下恢复 CI 的 Rust/WASM target 和 wasm-pack 准备。
- [x] 3.2 恢复 ESLint、Oxlint、覆盖率与 test:package 门禁；保持 Node.js 22、pnpm 10.32.1 和 frozen lockfile 安装。同步 AGENTS.md、eslint.config.js、scripts/check-file-length.mjs 及相关测试，将上限统一为 450 物理行；验证 450 行通过、451 行失败，保持原检查范围。
- [x] 3.3 实现内容摘要校验的内部 WASM 准备入口，按 design.md 记录输入、工具链和产物摘要；让现有开发命令、CI 和嵌套 prepack/test:package 自动调用并复用有效产物，保留 build:wasm 强制重建语义，禁止无校验跳过。
- [x] 3.4 用等价字符码判断修复 embedBridge 控制字符校验 lint 错误，补边界输入测试，将 embedBridge.test.ts 从 src/demo 移至根 tests 目录。
- [x] 3.5 在干净环境验证工具准备及包消费，覆盖缺失产物、Rust/工具链变化、产物被修改、嵌套 prepack 的自动准备和复用。README 说明现有命令自动准备、build:wasm 可手动强制重建；验证同一输入检查链只实际构建一次，输入变化不能复用旧产物。

## 4. 数据源处理重构

- [x] 4.1 按数据源 spec 建立固定种子、每通道 10 万/100 万点、1/10 通道、三种输入的基线；测量 prepareWaveformSeries 真实数据准备路径、匹配 requestId 的 Worker 注册及首次采样，分别记录各线程堆、ArrayBuffer、WASM 内存采样高水位与不可用指标，不能以公共数组归一化或单次快照代替。
- [x] 4.2 记录缓冲区所有权、主线程与 Worker 复制路径及回退数据需求，定义可安全复用的内部归一化输入边界。
- [x] 4.3 逐步让内部渲染及查询直接使用 WaveformPointSource，移除紧凑路径的等长占位数组，保留公共数组适配输出。
- [x] 4.4 为已归一化内部数据减少重复排序和复制，若使用 transfer，保证消费者输入不被 detach 且回退可用。
- [x] 4.5 补等价输入、非有限值、乱序、重复 X、采样缺口、误差值与 data 引用替换的兼容回归。
- [x] 4.6 在同环境预热后至少测量五次，记录前后时间、峰值内存、中位数和波动范围，修正无法解释的性能退化。

## 5. 职责拆分

- [x] 5.1 提取尺寸与标题测量模块，集中 ResizeObserver 和测量生命周期管理。
- [x] 5.2 提取视口状态恢复模块，保持共享/独立模式、分页和稳定 ID 的状态恢复行为。
- [x] 5.3 提取采样会话、请求取消与资源清理模块，使控制器保留装配职责。
- [x] 5.4 在任务 3.2 已同步 450 行规则后验收所有 src 文本文件；按状态所有权评估 repository.ts、useWaveformViewport.ts、useWaveformChartLifecycle.ts 的拆分，内部模块不意外扩展公共导出。

## 6. 测试与验收

- [x] 6.1 执行相关窄层回归和全量测试，验证 Worker 真实路径与 JavaScript 回退路径，不仅依赖 jsdom 回退测试。
- [x] 6.2 在真实浏览器验证可复用组件及相关 Demo 的 1280×800 桌面窗口和约 360px 小容器，记录边界连线、快速缩放、数据替换、卸载及 Worker/WASM 故障恢复。按生命周期 spec 的模式矩阵验收：auto 故障走 JavaScript；wasm/javascript 报告错误后回退；wasm/error 报告错误并保留有效路径或同步占位，不要求等价 JavaScript 采样；raw 不创建 Worker。线段错误断裂、旧会话结果覆盖新数据或未处理 rejection 均失败；预期 sampling-error 事件本身不是测试失败。
- [x] 6.3 回归分页、图例可见性、注解和视口恢复，保存截图或轨迹，记录环境及未执行项。
- [x] 6.4 运行 typecheck、check:file-length、lint:all、test:coverage、build、test:package；重建 WASM 前保留已有修改的二进制内容副本，比对并记录差异。
- [x] 6.5 检查实际 tarball、声明产物及 ESM/CJS 消费，确认公共 props、事件、类型、导出及注解格式兼容。
- [x] 6.6 更新最终实现文档与验证记录，重新运行 OpenSpec 严格校验，仅在实际实现及检查完成后勾选对应任务；归档与发布另行处理。


## Implementation Notes

30 项实现及对应验证已完成，证据与限制见 [implementation.md](implementation.md) 和 evidence/。
内存不可用分项按 spec 明确记录；没有测得总进程峰值。远端 CI、发布与归档未执行。
全量覆盖率 550 项通过；随后新增的直接源等价测试单独通过，共 551 项已执行用例。
