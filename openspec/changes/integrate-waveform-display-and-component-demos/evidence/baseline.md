# 实施基线

- 分析：e8985d7027b37036247cc2d9069a17297bde889b；展示：74135cecaa12636647243c43e0be624827039f8a。
- 开始时分析仅有其他变更的两张已跟踪截图修改，另有未跟踪历史证据和本变更规划；均不覆盖。展示已跟踪工作区干净。
- 分析工具链：Node 22.23.2 / pnpm 10.32.1；展示原项目测试用 Node 20.20.2 及已有锁定依赖。迁入后统一分析工具链。
- 分析公开导出以迁移前 src/index.ts、src/native.ts、src/vue.ts 为基准；展示为 Waveform、defaultOptions，以及 data/options/events/actions/animation 的公开类型。
- 分析 URL：/、/animation、/fixed-y-domain、/wasm-sampling。展示原单页包含原始/科学数据、配置面板、系列配置和动画场景，统一迁往 /display。
- 当前实际架构为原生 SVG + Vue 薄适配；旧动画提案描述 Vue 绘制的部分不作为迁移依据。
- 原始测试输出见 analysis-baseline-tests.txt、display-baseline-tests.txt；结果仅在命令结束后写入 verification.md。
- 性能候选记录见 baseline-performance.json，但 baseline-performance-run.txt 存在 Worker 路径不在 Vite allow list 的错误，本轮不能作为有效验收基线。当前脚本的 RAF 窗口含空闲阶段、堆读数为单次观测，且 SVG 计数发生在删除宿主之后；须按 design.md 修正测量再重跑。保留 performance-budget.json 既定预算，不因失败放宽。baseline-bundles.json 仅为原始 dist 清单，尚不能与生产消费构建作同口径体积比较。


## 有效生产性能复测

baseline-performance-production.txt 与 integrated-performance-production.txt 均完成 27 条正式观测（各 2 次预热、3 次重复）。使用同一 Vite 生产消费构建和脚本，浏览器错误及 HTTP/资源失败断言通过；performance-comparison.json 的有效指标均在原数值预算内。新增 6000 点覆盖展示实际动画，保留原 12000 点场景并明确其展示保留点数预算降级。初始化只衡量构造函数返回，不声称首帧完成；帧指标仅使用发生 presentation 变化的连续帧。performance.memory 为粗粒度观测，重复生命周期的保留堆另由实际包消费浏览器的 CDP GC 测量验证。

bundle-comparison.json 使用相同 Vite 8.1.5 / terser 生产源码消费构建，比较旧新 analysis、display、both 的可达输出；三项均通过原 gzip 数值预算。产物清单包含资源，Worker/WASM 在库模式中被内联为 data URL 时计入 JS。真实 .tgz 的四种入口依赖边界另外由 package-bundles.json 验证，不混用两套体积指标。
