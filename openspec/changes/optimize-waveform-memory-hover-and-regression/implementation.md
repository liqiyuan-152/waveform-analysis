## Implementation Status

基于 `315c73018a4e3f1aed0a0dbf1e8e0d70a051c04f`，开始时已跟踪文件无差异；既有未跟踪文件保留。使用 Node 22.23.2、pnpm 10.32.1。没有提交、推送、标签或发布操作。

## Baseline

本轮重跑算法测试（28 文件 / 180 测试）、lint:all、check:file-length、check:native-boundary、check:licenses，均退出 0。日志见 evidence/baseline-*.txt。后续新增测试与最终门禁另记，不用基线代替实施验收。

既有 transfer 不采用理由和独立 pack 重建责任仍有效。本轮只增加端到端更新/恢复、实例总保留资源以及同流水线调用计数证据；未证明收益前不启用 transfer 或构建缓存。

## Workloads

输入固定为 x=i/1000、y=sin(i/50+channel+phase)，无需随机种子。对象点、typed x/y、typed-samples 各覆盖 100,000/1,000,000 点；单系列与 8 系列、单实例与 2 实例分别观察，避免一次混合所有上限造成不可解释的峰值。替换 phase=0.5，策略覆盖 peak/min/max/minmax，sum/average 仅作兼容性对照。冷启动从数据就绪到稳定 SVG 屏障，稳定阶段改变视口或替换当前引用；输入生成不计入更新延迟。

索引预算专用探针为 100,000 点 x=i、y=sin(i)，目标 100，依次请求 [0,n)、[1,n)，预算 0/8MiB，预热 5 次、测量 20 次。命令：`node scripts/measure-sampling-index-budget.mjs <output.json>`。

浏览器核心工作负载复用 update-quality-interactive：两系列各 10,000 点、样本率 1000、sin(i/50)+channel；原生/Vue、1280/360 宽、生产构建。悬停预热 5 帧、测量 20 帧，分别固定 X 移动 Y 与跨点移动 X；记录 Tooltip render 耗时、节点构造及布局测量次数。完整浏览器脚本同时覆盖手势、标注草稿、动画、故障恢复、分页、SVG/PNG 和三个 Demo 路由。

## Index Budget

先计算下一层字节，再构造数组；全部构造和填充成功后计入额度。RangeError 使该层及更高层本生命周期内使用后备路径，避免不断重复部分分配；dispose 清除资源与失败标记。其他错误不被吞掉。额度仍表示保留索引，不包括源和输出。

新增 indexAllocationBudget.test.ts 覆盖 extrema/sum 的零、略小、恰好足够预算、复用和第二个数组分配失败。原实现的红测见 index-budget-red.txt（其中两条初始断言还错误比较了参考诊断字段，随后修正为数值输出比较）；最终仓库相关 9 文件 / 47 测试通过，见 index-budget-tests.txt。

前后探针见 index-budget-before.json / index-budget-after.json。零预算两次请求的构造字节：minmax 从 800,800 降至 800；sum 从 2,006,400 降至 6,400。剩余为输出数组。保留索引均为 0；充分预算的保留量不变。耗时存在运行噪声，仅以原始中位数/p95报告，不声称同比提速或全进程峰值改善。

## Tooltip

按稳定 ID 缓存行；只改变化文本/样式，结构仅在增删/重排时提交。同内容移动使用已测尺寸；内容、容器或 ResizeObserver 通知重新测量。隐藏和销毁清除节点、缓存及观察器，保持原定位/溢出行为。

TooltipView 与 nativeHover 共 23 项测试通过，见 tooltip-tests.txt，覆盖行复用、元数据、单位、缺失值、重排删除、超高内容、resize、iframe ownerDocument、多实例与销毁；完整源/事件兼容由既有 nativeHover 回归覆盖。真实浏览器对照见 evidence/hover-comparison.json。旧源码在 git archive 临时副本加载相同测试工作负载（不修改工作区源码），仅禁用新节点/测量优化断言；构建不再包含无关的 legacy 动画入口，避免依赖扫描顺序影响。20 次固定 X 悬停由每次重建 10 节点（累计 200）降至 0；变化 X 也不重建节点。固定内容测量由至少 20 次降至 0。报告明确原始耗时，首次前后测量期间其他诊断可能运行，不以微小耗时差异作为因果提速证明。已人工查看 Chromium 原生 360px 与 Vue 1280px 截图，Tooltip 文本及位置正常。

## Browser Gates

GitHub push/PR 与 GitHub/Gitea 发布工作流加入 test:browser，既有 test:package 保留；Gitea 多行命令显式 set -eu。新 GitHub 每周/手动矩阵执行三引擎完整场景及资源脚本，保留 14 天 CI artifacts。默认本地证据写系统临时目录；只有显式环境变量才写指定长期目录。

三引擎各三轮报告见 evidence/{chromium,firefox,webkit}-round-{1,2,3}。每轮覆盖双入口与双尺寸、两种悬停各 5 次预热/20 次测量，以及完整旧质量脚本场景。资源报告见 evidence/resources-*：交替原生/Vue，共 3 预热 + 30 生命周期，每次 2 实例，Worker/Observer 各 66 次创建且释放；无 RAF、计时器、全局监听器等增长。Chromium CDP 强制 GC 后额外检查 JS 堆和 DOM；Firefox/WebKit 仅专属堆指标记 N/A，不跳过资源检查。

macOS WebKit 遵循系统按钮 Tab 偏好，使用 Option-Tab/Option-Shift-Tab 进行真实键盘遍历；Linux 继续 Tab/Shift-Tab。不由 WebKit 推断真实 Safari/iOS 或屏幕阅读器通过。

scripts/browser-performance-budgets.json 保存三轮最大中位数/p95及锁定阈值：max(2倍基线，基线+4ms中位数/+8ms p95)，仅耗时第一次超限重测一次，第二次超限失败；功能与生命周期异常不重试。此为本机 M1 三轮基线及保守跨平台绝对预算，不声称 Linux CI 已有同硬件基线。CI 实际远端运行仍需后续推送，本次不推送。

发布阻断测试读取实际工作流验证块，用本地 pnpm 桩模拟启动/断言/超时非零退出，不执行任何真实发布。browser-workflows 和 quality-workflows 共 7 测试通过，见 browser-gate-tests.txt。性能评估器另覆盖中位数、尾延迟退化和缺失样本；最后一轮带预算执行及最终集成结果见下文。

## Compact Fallback

MultiResolutionSamplingIndex 支持只读 Y 列访问，仅为极值构建层，不展开 X 或 WaveformPoint 对象；对象点仍保留原行为。typed/samples 仓库建立轻量索引所有者，真正分配在首次极值请求。数字输入 sum/average 由于没有 xAt，返回后备路径执行原顺序聚合；none/LTTB 不变。

compactIndex 回归包含异常/乱序/重复 X/稀疏样本、多视口、多策略、替换释放和高动态范围/中间溢出。sum/average 的 [1e16,1,-1e16,1] 回归保留 1/0.25。聚合索引本轮明确不采用，不扩大到对象点算法重写。阶段测试见 compact-index-tests.txt：11 文件 / 56 测试通过。

## Transport Decision: 保留 clone

真实 Chromium 中完成 17 组工作负载，每组 5 次预热、20 次测量，涵盖对象点、typed x/y、等间隔 samples、10万/100万点、8系列及双实例。安全候选在发送前 structuredClone outgoing，再 transfer 该专有副本；生产源与恢复快照不转移。每次执行挂载、替换到稳定帧、在真实 Worker 上注入 error 事件后恢复到稳定帧，验证消费者及快照未 detach。完整数据见 sampling-memory.json，摘要见 sampling-memory-summary.json。

候选没有一致的端到端收益：百万 typed 单实例替换中位数 clone 52.30ms、transfer 58.10ms；百万 samples 八系列替换 341.95ms / 352.45ms，恢复 502.80ms / 514.30ms；百万 samples 双实例替换 78.10ms / 78.30ms，恢复 136.00ms / 136.05ms。少量冷启动收益未延续到主要更新场景。新增 outgoing 复制和所有权复杂度缺少净收益，因此本轮不接入生产 transfer。

主线程 JS 堆仅为三个检查点及销毁后 CDP 采样；Worker 响应记录索引字节，无法观测整个 WASM 线性内存/GPU/进程峰值。探针为了验证所有权保留该轮历史快照引用，因此累计快照字节与主堆检查点不可当作生产同时驻留量。未以这些有限数据宣称总峰值下降。

补充全浏览器进程 RSS 采样见 evidence/sampling-memory-rss.json / sampling-memory-rss-summary.json，命令为 `node scripts/measure-sampling-memory-browser.mjs <evidence-dir> --rss`。在百万 typed 单系列、百万 samples 八系列分别对 clone/transfer 进行 5 次预热及 20 次测量，约每 50ms 通过 CDP 获取进程列表、由 ps 读取 RSS。每轮观测最大值的中位数分别为 typed 536.35/564.95MiB、八系列 samples 1021.64/1031.88MiB；未出现支持 transfer 的稳定内存优势，保持不采用结论。RSS 包含浏览器、渲染器与 Worker/WASM 驻留页，但共享页可能重复计数，采样间隙可能漏掉尖峰，进程复用也受历史高水位影响。这是进程 RSS 合计的采样观测峰值，不是精确物理峰值或生产源副本量；探针保留快照的限制仍适用。

副本责任：消费者持有原输入；主线程私有源保存归一化查询数据；toWorkerDataset 复制紧凑列成为传输/恢复快照；clone 产生 Worker 消息副本，仓库规范化再拥有数值列，WASM 另持有线性内存副本；索引和输出缓存有独立额度。候选只用额外 outgoing 副本替换跨线程 clone，未移除上述源/恢复/仓库副本。

## Total Budget Decision: 保留现有实例资源策略

比较八个百万点 samples 数据集的每集 8MiB 与实例 8MiB 等分（每集 1MiB）候选，源数据不淘汰；5 次预热、20 个不同视口与 4 个缓存重复，见 total-index-budget.json。当前策略保留索引 63,937,664 字节，输出缓存 96 项 / 384,768 字节；等分预算不足以建立首层，保留索引为 0。两者重复请求均命中 32 个系列结果，但未命中查询中位数由 4.51ms 增至 281.26ms；命中查询约 0.02ms。明显的重采样代价不支持全局降低默认额度，因此不接入此候选，也不新增公共开关或跨实例共享状态。该结论不排除未来按设备/访问局部性设计的其他预算策略。

## Evidence Handoff

本轮长期结论、原始最小数据和截图位于本变更 evidence/；新增脚本默认系统临时目录或要求显式输出路径。GitHub artifacts 保留 14 天，Gitea 将 JSON 摘要写入 job 日志，仓库内本轮摘要和原始最小数据不依赖临时目录或 CI 链接继续存在。既有未跟踪证据未删除、未全局忽略，也未改动 project-optimization-2024 的任务状态。baseline-snapshot-path.txt 仅记录本轮本地对照副本位置，不是长期证据的唯一来源。

## Million Point JavaScript Results

缓存关闭；每种输入/额度 5 次预热、20 次数据集测量，每次 20 个不同连续视口。结果见 compact-million.json；这是直接仓库 JS 路径，不等于浏览器帧耗时。

| 输入    | 索引额度 | 首次采样中位 ms | 连续视口中位 ms |
| ------- | -------- | --------------- | --------------- |
| typed   | 0        | 1.650           | 1.528           |
| typed   | 8388608  | 14.917          | 0.323           |
| samples | 0        | 34.559          | 34.759          |
| samples | 8388608  | 13.576          | 0.321           |

紧凑 typed 的首次建索引成本高于一次直接扫描，收益主要在连续视口查询；samples 同时避免每次展开 X 列。该冷启动取舍保留在报告中，不能只引用稳定阶段提速。WASM 健康路径仍使用原后端；真实 Worker 传输上注入故障后的恢复也由 sampling-memory 工作负载覆盖。

## Final Browser Acceptance

最终 `pnpm test:browser` 在 Chromium、Firefox、WebKit 均退出 0，均启用已锁定预算；命令耗时分别 26.325s、28.114s、24.982s，见 evidence/final-browser-checks.json 和 final-{browser}/browser-verification.json。原生/Vue 的 1280/360px 固定内容悬停均没有新节点或同步尺寸测量；三个 Demo 路由的两个尺寸均补充 5 次预热、20 次指针到下一帧测量、DOM 创建和 Tooltip 测量计数。Demo 的帧延迟包含浏览器调度，不能与内部 Tooltip render 耗时直接比较；其节点计数覆盖整个页面，WebKit 综合 Demo 360px 的 6 个节点不等于 Tooltip 重建。Demo 新指标作为诊断，不宣称已有三轮独立阈值；性能门禁使用先前完成三轮基线的原生/Vue 指标。

最终截图位于各 final-{browser}/；人工复核 Chromium 原生 360px、Vue 1280px、综合 Demo 360px、动画 Demo 1280px，文本、标注及 Tooltip 位置正常。浏览器脚本还验证其余尺寸/路由、缩放、图例、焦点、动画、恢复、分页及 SVG/PNG 导出。

最终资源检查改为 5 次预热 + 30 次测量，每轮双实例、交替原生/Vue，三引擎均通过。每引擎各创建并释放 70 个 Worker 和 ResizeObserver；帧、定时器、观察器、Worker 回到零，全局监听器回到基线。Chromium 强制 GC 后 DOM 节点保持 19，JS 堆增加 333,504 字节且在现有容差内；该值不是零分配证明。见 evidence/final-resources/native-resources-browser.json。Firefox/WebKit 的专用堆指标因缺少 CDP 记 N/A，可移植计数照常验证。

## Build Reuse Decision: 保留独立准备

从实际命令日志提取调用次数，见 evidence/build-call-counts.json。按当前 GitHub 验证链 typecheck → coverage → build → test:browser → test:package，共执行 4 次库构建、5 次声明生成、2 次 Demo 构建。其中 coverage 的一次库构建使用非压缩/sourcemap 配置，不能当作发布产物；test:package 内 pack/prepack 仍完整构建。浏览器入口的 prepare:demo 确保独立运行时有可消费的库和声明。

本机完整 build 18.545s，包消费者链 34.346s（含重建），coverage 530.330s。跳过一个完整重复 build 的潜在节省约为该次 build 耗时，而不能把整个包消费者链都算作可节省时间。这不足以支持本轮引入源码/配置/锁文件/工具链身份、产物哈希及失效恢复协议；保留直接 pack 与独立命令的可靠准备，不新增复用缓存，因此过期/篡改缓存测试不适用。

新增 .nvmrc 固定 CI 的 Node 22.20.0，README 说明 Node 22 与 pnpm 10.32.1。实际本机使用已安装的 Node 22.23.2，未声称已在 22.20.0 本地运行。冻结安装和独立 build、typecheck、test:package、test:browser 均已执行通过，锁文件无需变化。

## Final Integration

完整日志及命令/退出码/耗时见 evidence/final-checks.json：冻结安装、lint:all、check:file-length、typecheck、check:native-boundary、check:licenses、typecheck:examples、test:coverage --maxWorkers=2、build、test:package 全部退出 0。覆盖率测试共 238 文件、2140 测试通过，包含紧凑数据 deadline、Worker 故障回退、替换和销毁回归。覆盖率持久摘要见 evidence/final-coverage-summary.json：statements 90.52%、branches 85.10%、functions 90.75%、lines 93.24%，各门槛通过。真实 tarball 的 ESM/CJS/types/CSS/WASM 及 Chromium 消费者通过。

没有公开 API、依赖或 lockfile 变更。未验证远端 CI、真实 Safari/iOS 和屏幕阅读器；未发布或推送。资源与性能测量仅代表所记录的本机、浏览器和负载，不能推广为所有设备的速度或峰值上限。新增诊断脚本后的 lint、定向脚本测试及 OpenSpec 严格校验另留 final-document-checks.txt。

## Release Preparation: 0.2.2

用户后续授权提交、推送及发布，替代本轮实施阶段的不发布限制。版本从 0.2.1 升为兼容性补丁 0.2.2，发布说明更新到 RELEASE_NOTES.md。GitHub 浏览器诊断上传已移至产生该证据的 release job，并增加 job 归属回归测试。

发布准备执行 prepare:wasm 成功，并对 0.2.2 运行冻结安装、格式检查、lint、发布流程定向回归和实际 tarball 消费者验证。WASM 源未变，重建的本地产物不提交；保留仓库既有生成资产。结构化检查记录见 evidence/release-0.2.2-local-checks.json。发布前等待 main 的完整 CI 验证；标签、npm 和演示站结果以远端实际状态为准。

提交保留结构化 JSON 测量与最终三引擎截图；文中引用的原始 .txt 日志、中间轮次截图和临时副本路径留在本地，不加入版本控制。历史未跟踪文件未删除。

## Release Result: 0.2.2

2026-10-17 已按用户授权完成提交、推送与正式发布。发布提交为 `6ae94c4f699d787251bf0e5c8d5433a8d39291b0`，附注标签 `v0.2.2` 已推送。

- [发布前完整 CI](https://github.com/liqiyuan-152/waveform-analysis/actions/runs/38991376623) 通过；结构化结果见 evidence/release-0.2.2-ci.json。
- [正式发布工作流](https://github.com/liqiyuan-152/waveform-analysis/actions/runs/38992860095) 的 release 与 deploy-demo 两个 job 均成功；结果见 evidence/release-0.2.2-result.json。
- [GitHub Release v0.2.2](https://github.com/liqiyuan-152/waveform-analysis/releases/tag/v0.2.2) 已发布，包含 tarball 和 SHA256 文件。
- npm 查询确认 `version=0.2.2`、`latest=0.2.2`，`next` 仍为 `0.2.0-rc.1`。下载的 GitHub tarball 与 SHA256 文件匹配，且 SHA1 与 npm 元数据一致；见 evidence/release-0.2.2-package.json。
- [演示站](https://lqycustomsite.online/waveform-analysis/) 的 version.txt 最终返回 `6ae94c4f699d787251bf0e5c8d5433a8d39291b0`，确认切换至本次发布提交。部署核验经历等待后成功，未将中途返回旧版本的状态误记为最终失败。

GitHub 是当前配置的唯一 Git remote，本次通过其现有发布工作流发布 npmjs 与演示站，未额外向 Gitea 创建标签或声称其 registry 已同步。历史未跟踪文件保持原样。
