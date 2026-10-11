## Context

评审基于 develop 的提交 `c5d9216a1f031b2ffa71a3ac72848a3b84d0b1a4` 及其未提交工作区。任务文档分支为 `codex/plan-waveform-reliability-refactor`，本次只创建文档，所有代码实施任务保持待执行。

已复现的证据：

- `useWaveformRenderSampling` 的 raw/auto-raw 分支只提取 visibleRange。原始点 `(0,0)`、`(10,10)`，视口 `[2,8]` 时，原绘图选择保留两点，但覆盖结果变为空数组，导致穿过视口的线段消失。
- `createLatestTaskScheduler` 在首个异步任务 rejection 后产生未处理的 Promise rejection，已排队的最新任务没有执行。注册数据操作位于采样异常捕获范围之外，而 Worker 客户端销毁会拒绝待处理请求，构成实际触发路径。
- 未提交的 CI 配置移除了 Rust/WASM target、wasm-pack 安装以及 lint、覆盖率和包消费门禁，但 typecheck/test/build 脚本仍调用 WASM 构建。
- 未跟踪文件 `src/demo/embedBridge.ts` 的控制字符正则实际触发 ESLint `no-control-regex`，同目录下存在未跟踪的 `embedBridge.test.ts`。

当前工作区状态：

- `.github/workflows/ci.yml` 已修改（待提交）
- 新增 `.github/workflows/showcase-release.yml`（未跟踪）
- `wasm/pkg/waveform_sampling_wasm_bg.wasm` 已有本地改动
- 实施前需确认这些改动与本任务的关系，避免意外覆盖或遗漏

历史检查基线（创建文档时不重新宣称为本次实施验收）：Node.js 22.23.2、pnpm 10.32.1；vue-tsc 与文件长度检查通过；72 个测试文件、478 个测试通过，语句 87.45%、分支 82.80%、函数 89.27%、行 90.37%；库和 Demo 的 Vite 构建通过，输出到临时目录。未执行浏览器视觉验证、WASM 重建、声明产物及完整发布验证。

当前代码长度现状：3 个文件刚好达到 400 行边界（`src/core/workerSampling/repository.ts`、`src/components/interaction/useWaveformViewport.ts`、`src/components/core/useWaveformChartLifecycle.ts`），重构时需优先考虑拆分。

## Goals / Non-Goals

**Goals:**

- 先修复采样正确性和取消/失败处理，再恢复可靠质量门禁，随后进行数据源和职责重构。
- 以回归测试保护兼容性，以固定数据与环境的前后对比评估性能，记录证据和限制。
- 让提案、四类规格、设计和未勾选任务可直接用于后续实施。

**Non-Goals:**

- 本次不执行代码修复、性能优化、WASM 重建、提交、推送或发布。
- 不整体重写组件，不引入新的公共 API，不改变注解格式、消费者受控状态或原始 X 坐标语义。
- 不将 CodeGraph、部署、IDE 或其他已有工作区改动纳入本次新增文件。

## Decisions

### 1. 分离统计范围和绘图范围

保留 visibleRange 的半开区间语义，统计仅包含视口内部采样点；单独计算绘图范围，将起点向前、终点向后各扩展一个可用源点。原始分支、占位/回退分支与 Worker 最终结果遵循同一规则。Worker 内部协议可扩展以传递或推导绘图范围，但不得改变公开诊断字段的统计含义。

线性和 step-start/step-middle/step-end/step-after 曲线保持现有曲线生成语义，以 SVG clip 裁切超出视口的部分。边界连接点不得在最终选择时被全部丢弃；对于限制输出点数的策略，将必要的连接点作为边界开销，主体采样预算保持现有策略，实际 renderedPointCount 包含最终返回的绘图点。没有数据、视口完全位于数据域之外时不产生伪线段。

对 average/sum 单独规定：仅把可见区间内的源点交给聚合算法，保持原有桶分配、聚合 X 坐标与 Y 值计算；聚合完成后，才在首尾拼接至多一个视口外相邻原始点。这些点仅用于连接，不参与平均值或求和。输出沿 X 顺序拼接，相同源索引的连接点只添加一次；不能按 X 值去重不同的源点或聚合结果。可见区间为空但存在跨越视口的相邻点时，返回两点连接，不构造空桶。主体预算为 1 或 2 时也不截断必要连接点，最终点数最多为主体输出数加 2，renderedPointCount 按实际输出计算。JS 与 WASM 均应用同一规则，并在 README 解释采样目标与边界开销。

### 2. 让采样会话负责异步生命周期

调度器逐任务捕获异常，保证 finally 释放运行状态且继续消费最新 pending 任务；错误交给内部错误回调处理。注册与采样纳入同一异常边界。数据引用更新和卸载通过 generation/epoch 使旧工作失效，并取消计时器、待发送诊断与请求，释放 Worker 和数据集。

取消属于正常生命周期，不上报为实际采样失败；真正的 Worker/WASM 失败继续遵循现有 sampling-error 和 wasmFailureFallback 契约。旧响应、旧诊断和旧错误不得污染新数据会话。保留最近一次有效路径的现有失败行为，不把占位点误报成成功的 WASM 结果。

### 3. 恢复质量门禁并控制构建重复

CI 显式准备 Node.js 22、pnpm 10.32.1、锁定 Rust/WASM target 和 wasm-pack；恢复 ESLint、Oxlint、覆盖率与包消费检查，保留已有安全的 action 固定版本及无关流水线功能。新增内部 WASM 准备入口，由现有 typecheck、test、test:coverage、build 和嵌套 prepack/test:package 自动调用；不要求开发者手动执行 build:wasm 才能正确使用这些命令。准备入口以 Rust 源码、Cargo.toml、Cargo.lock、构建参数和工具链版本的内容摘要，以及生成文件摘要共同判定产物是否有效，成功后才写入忽略的本地准备记录；缺失、源码变化、版本变化或产物被修改均须重新构建。显式 build:wasm 保留强制重建语义。CI 在检查前调用同一准备入口，后续命令和 prepack 校验记录后复用：同一输入的一条检查链仅实际构建一次；输入变化则重新构建，不能用无校验的跳过环境变量。prepare 只负责 WASM，不递归调用 build 或 pack；prepack 继续保证 JS、CSS 和声明产物来自当前源码。

控制字符检查改为等价的字符码判断，保留现有路由、来源和消息校验语义，不全局关闭 lint 规则。相关测试归入根 tests 目录。

### 4. 数据源渐进迁移

先按 waveform-data-source-processing 规格建立基线：对象点、typed-points、typed-samples，每通道 10 万和 100 万点，分别 1 和 10 个通道。测量真实 prepareWaveformSeries 数据准备路径、Worker 注册和首次采样，区分主线程/Worker JS 堆、ArrayBuffer 和 WASM 内存。使用固定种子、机器、浏览器版本、1000px 绘图区、peak 策略和 maxPointCount=1000，区分冷启动与预热轮次；各场景预热一次后至少五次独立数据会话，记录中位数、范围及采样高水位。不可用指标显式标记，不将快照或单线程堆当作总内存峰值。

逐步让内部渲染和查询直接消费 WaveformPointSource，把公开返回数组的工具保留为兼容适配层。移除紧凑输入路径上与点数等长的占位数组，复用统一的有效性、排序与范围语义。对已归一化内部数据增加快速路径，避免重复排序/复制；外部或未验证消息仍须校验。

先明确缓冲区归属再采用 transfer：不得 detach 消费者输入，不得破坏 JavaScript 回退所需数据。性能验收同时检查内存和耗时；超出同环境基线波动范围的退化必须解释并修正，不能仅依据代码形式宣称优化成功。

### 5. 按状态所有权拆分

把尺寸/标题测量、视口状态恢复、采样会话与取消从聚合编排中提取为内部模块，返回明确的状态和方法。控制器保留装配职责，避免为满足行数限制而任意拆分工具函数。所有 src 文本文件目标上限为 450 行，这是用户明确选择的新约束；实施前的工具与 AGENTS.md 仍为 400 行。任务 3.2 须先同步 AGENTS.md、eslint.config.js 的 max-lines、scripts/check-file-length.mjs 的 maximumLines 及对应测试，保留物理行计数规则和原检查范围，验证 450 行通过、451 行失败。任务 5.4 再按新约束验收，不把放宽上限当作替代职责拆分的手段；Rust 内核的全面拆分不在本任务必需范围内。

### 6. WASM 产物管理

当前 `wasm/pkg/waveform_sampling_wasm_bg.wasm` 已有本地改动。实施阶段 SHALL：

1. 在首次重建 WASM 前备份现有二进制文件到临时位置
2. 比对重建前后的差异并记录到实施文档
3. 如差异来自未提交的 Rust 源码改动，先决定是否纳入本次任务或独立处理

## Risks / Trade-offs

- 添加视口连接点会使绘图点数与可见点数不同；必须明确诊断含义并测试端点预算，不能调整完整数据域掩盖问题。
- Worker 数据复制减少可能削弱回退和所有权保障；以不可变输入及回退测试作为先决条件。
- 重构与正确性修复混在一起会增加定位成本；按任务顺序逐阶段验证，禁止顺带改变公共接口。
- 当前工作区包含其他功能改动；实施前重新检查状态，仅编辑与本任务直接相关的部分，重建已有修改的 WASM 产物前先保留其内容副本。
- 已有 3 个文件达到 400 行边界，职责拆分时需优先处理这些文件，避免在重构中超出新的 450 行约束。

## Implementation Order

编号用于追踪，不代表必须按编号串行完成。以完整修复阶段作为验收单位：

1. 先执行任务 3：记录工作区基线并备份现有 WASM，再恢复工具与质量门禁、修复已知 lint 错误、同步 450 行规则。
2. 执行任务 1 和 2，按“失败回归 → 修复 → 相关测试通过”的完整闭环推进，不在刚写出失败回归时强制运行全部门禁并禁止继续修复。
3. 任务 1-2 的相关回归通过后，执行任务 4；性能基线必须先于数据源实现改动。
4. 执行任务 5，最后通过任务 6 完成浏览器、覆盖率和包消费验收。

迭代时运行最窄相关测试；每个完整阶段结束运行受影响的质量门禁。历史基线失败须记录，不能误报为本阶段回归或无限阻塞无关修复；新引入的失败须在进入依赖它的下一阶段前修复。完整 typecheck、check:file-length、lint:all、test:coverage、build、test:package 集中在最终验收执行，全部通过才可完成变更。

## Validation Strategy

先运行最窄回归测试，再执行 typecheck、文件长度检查、lint:all、test:coverage、build 和 test:package，检查实际 tarball。通过声明消费和 ESM/CJS 消费验证包兼容性。

真实浏览器验证可复用组件和相关 Demo 路由，覆盖 1280×800 桌面窗口与约 360px 宽的小容器；验证实际 Worker/WASM 启动、错误回退、缩放边界、快速替换数据和卸载，保存截图或轨迹。未执行的检查明确记录，不能以 jsdom 测试代替浏览器验证。

本次文档交付仅运行 OpenSpec 严格校验、状态和列表检查，并比对已有文件内容以确认未被修改。文档齐全不代表代码任务已完成；不提前归档变更。
