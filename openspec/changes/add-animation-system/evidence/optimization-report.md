# 优化与收尾验证记录

2026-10-13 最终收尾：D3 默认字符串候选已归档并撤回，正式路径缓冲逐字节恢复。全套136文件/1107测试及全部门禁通过，最终gzip ESM/CJS增量12,012/11,834 bytes，均满足修订后的 <15,000 bytes 条件。恢复后的生产指纹与完整FPS、物理矩阵和原生Safari证据一致，原始报告审计通过；10.4/10.5按修订条件完成。原物理10/20MB和gzip10KB目标未达的事实保留为已知限制；原生移动端已移出范围。见 evidence/final-acceptance-verification.json。

2026-10-13 性能验收调整（用户授权）：gzip 增量改为每种格式 <15,000 bytes；物理内存 <10/<20MB 保留为非阻塞优化目标，验收改为完整测量披露及资源生命周期约束。原生移动端移出本次范围。历史未达标结果不改写为通过。最后的 D3 默认字符串候选仍未定案，因此本次不勾选 10.4/10.5、不宣称最终源码已完成全部验证。详见 evidence/performance-acceptance-decision.md。

2026-10-13 范围更新：用户明确“不考虑移动端”。原生 iOS/Android 验证移出本次验收范围，10.7 不再是待办或完成阻碍，也不标记为验证通过。桌面浏览器及小容器验证继续有效；历史“暂缓”记录保留，仅描述当时状态。此为当时范围记录；10.4/10.5 后续验收条件以本文顶部更新为准。

当前正式源码为网格节点复用版本：132文件/1081测试及typecheck/lint/450行、构建、包消费、dry-run打包通过，Chromium/Chrome/Firefox两尺寸6组生产冒烟通过。桌面49999淡化两轮物理增量57.07–60.77MB及54.31–59.41MB，低于其间正常源码对照75.66–83.94MB，仍超20MB；原源码对照保留一次上下文销毁重试，两轮候选错误0。gzip ESM/CJS完整增量12,010/11,833 bytes，增加约0.2KB换取已复现的本场景物理改善，仍超目标。当前网格版本完整96场景/960记录FPS复验exit0、最低59.5294、长帧/错误/目标未达0，20次装卸任务/元素0，两尺寸Demo截图已查看；Safari26.6.2原生两尺寸组件与桌面/窄窗口Demo已验收，四桌面引擎各两尺寸8组生产冒烟exit0（含官方临时Edge）。见grid-dom-full96-summary.json和native-grid-dom-verification.json。旧报告保留各自指纹。原生移动依用户暂缓。临时省略背景诊断不作为交付或预算证据。下文保留各批次实际范围。

## 测量范围

源码没有降低阈值、删除公共能力或缩减几何；新增内部弱引用投影缓存、复用私有展示缓冲、刻度 DOM/text 复用和 SVG 遮挡检查合并。D3 路径语义及 source/from/to 不变的测试通过。

此前完整 96 场景矩阵是开发服务器、四页共享负载；本次针对原来出现低 FPS 的 8 系列、1000/10000/49999 点、两种尺寸、四种模式，共 24 场景，使用生产构建、单页、3 次预热、10 次记录。测试/构建/内存测量均在该独占 FPS 复测开始前结束。两种模式的绝对数字不能直接用来归因代码收益。正式结果见 browser-results-optimized-isolated.json。

## 进程物理内存

12 个场景，各 3 对独立浏览器运行，固定 2000ms 动画，六次物理内存采样；静态对照执行相同 data 变化。该历史运行在 mount 返回后、六次采样前额外执行了一次 GC，采样之间没有 GC，因此不能覆盖那次 GC 前的分配峰值。增量=(动画采样峰值−动画预热基线)−(静态采样峰值−静态预热基线)，另保存 GC 后留存。macOS footprint 覆盖 browser/renderer/GPU/network 进程，包含其 native/DOM 分配；不能覆盖未归属于这些进程的驱动/系统分配，因此仍不能保证全系统 GPU 预算。采样峰值只是所记录时刻的最大值。部分前期内存场景与构建/冒烟同机运行，机器负载和进程 allocator reserve 会造成噪声。

| 容器     |  点数 | 模式       | 自然峰值增量范围 MB | GC 后留存增量范围 MB | 预算 MB |
| -------- | ----: | ---------- | ------------------: | -------------------: | ------: |
| 1280×720 | 10000 | enter      |         13.63–15.16 |            1.56–3.26 |      10 |
| 1280×720 | 10000 | compatible |         46.38–63.95 |          13.06–17.58 |      10 |
| 1280×720 | 10000 | crossfade  |         90.41–97.71 |          16.35–19.89 |      10 |
| 1280×720 | 49999 | enter      |         12.21–16.70 |           -0.26–4.93 |      20 |
| 1280×720 | 49999 | compatible |         81.30–91.98 |          17.19–24.69 |      20 |
| 1280×720 | 49999 | crossfade  |       125.22–130.89 |          23.02–27.87 |      20 |
| 360×300  | 10000 | enter      |           8.39–8.62 |            0.88–1.85 |      10 |
| 360×300  | 10000 | compatible |         61.00–63.65 |          11.03–16.33 |      10 |
| 360×300  | 10000 | crossfade  |         88.77–93.91 |          16.60–19.37 |      10 |
| 360×300  | 49999 | enter      |         11.08–13.80 |           -0.03–2.74 |      20 |
| 360×300  | 49999 | compatible |         69.01–80.07 |          13.81–18.07 |      20 |
| 360×300  | 49999 | crossfade  |       106.66–126.57 |           8.42–25.26 |      20 |

多数更新/淡化场景和部分入场场景即使在测量前 GC 后仍未达到 <10/<20MB 预算，不能因 GC 后留存数值较低宣称通过。历史内存运行的 20 次装卸强制关闭动画；全部任务/容器元素归零，但这部分只能证明静态对照回收，不能据此声称动画装卸验证通过。独占 FPS 运行另有开启动画的装卸记录；它们仍不证明绝对无泄漏。

第 12 个场景预热首次出现 execution context destroyed，未记录缺失数值；错误保留在 memory-results.json.errors，随后新浏览器重跑完整三对记录。运行器今后最多重试 3 次，失败不静默跳过。初版开发模式、10 秒压力诊断存于 memory-results-before-axis-text-optimization.json，仅用于分配分析，不能与本表直接作为效果比例。

最终审计修正运行器为 methodologyVersion=2：只在预热基线前和单独留存采样前 GC，mount 与六次峰值采样之间不强制 GC；装卸沿用 enabled 参数，每轮等待异步采样完成并观察到活动动画后才卸载。360×300、8 系列、10000 点兼容更新的一对独立生产复测增量为 48,087,168 bytes，仍超过 10MB；动画开启的 20 次装卸观察到最多 8 个任务，最终任务和元素均为 0。证据单独保存为 memory-results-unforced-validation.json，不替代历史完整矩阵，不扩展为全部场景预算通过。首次三次尝试发现原装卸脚本在异步更新注册前就卸载，失败均保留在 errors；修正等待后完整重跑。未来基准默认单页，显式设置 workers 才执行多页压力测试。

## 包体积与生产产物

构建采用 Terser 3 passes，保留 ESM pure annotations，并通过打包后的 easing-only tree shaking 消费检查。compare-animation-gzip.mjs 实际重建 HEAD 基线，复制同一最终配置/依赖/WASM，保存 SHA256；额外 worker 字节完全相同，增量 0，没有排除额外 chunk 来伪造结论。以下是路径缓冲前的历史结果，保存在 gzip-results-before-path-buffer.json；最新结果见本页末尾。

- index.js：92816 → 104366 gzip bytes，增量 11550 bytes。

- index.cjs：93332 → 104673 gzip bytes，增量 11341 bytes。

- style.css：9550 → 9549 gzip bytes，增量 -1 bytes。

ESM/CJS 均仍超过 <10KB 目标，10.5 保持未完成。构建器报 >500KB demo chunk 提示；为修复真实生产初始化循环，已移除旧手工 framework/UI/vendor 分组，未调整警告阈值隐藏它。

## 浏览器与设备

Chromium、Chrome、Firefox、官方 pkg 临时展开的 Edge 155.0.4283.45：8 个生产桌面/小容器组件与 Demo 组通过，指针接管、SVG/PNG、两类更新及标注通过，browser-smoke.json 明确 buildMode=production。Edge 来源/hash 见 edge-artifact.json；没有安装到系统目录。

Safari 26.6.2 原生 UI 已执行桌面/小容器入场、两类更新与导出验证，桌面截图可见通过；小容器 JSON 保存在 native-browser-results.json。其时运行开发 fixture。Mac 后续锁屏阻止继续 UI，最新生产优化及完整 Demo 原生复核尚待解锁。没有改远程自动化设置。

桌面 WebKit iPhone 13 与 Chromium Pixel 7 的生产触摸仿真通过，保存组件/Demo截图并实际查看，mobile-emulation-results.json。这不是 iOS/Android 原生浏览器；adb 没有设备，simctl 不可用。真实设备验收保持未完成，已询问可用环境。

## 实際门禁

128 个文件、1042 个用例通过；typecheck、lint、450 行、build、package consumer（包括 tree shaking）、pack dry-run 通过。覆盖率和具体退出码见 coverage-results.json、verification.json。OpenSpec strict validate 通过，status 仍仅代表规划 artifacts complete。

## 独占 FPS 复测结果

| 容器     |  点数 | 模式       | 最低 FPS | 最坏 p99 ms | >50ms 帧 |
| -------- | ----: | ---------- | -------: | ----------: | -------: |
| 1280×720 |  1000 | static     |    60.00 |       16.80 |        0 |
| 1280×720 |  1000 | enter      |    60.00 |       16.80 |        0 |
| 1280×720 |  1000 | compatible |    60.00 |       16.80 |        0 |
| 1280×720 |  1000 | crossfade  |    60.00 |       16.80 |        0 |
| 1280×720 | 10000 | static     |    60.00 |       16.80 |        0 |
| 1280×720 | 10000 | enter      |    60.00 |       16.80 |        0 |
| 1280×720 | 10000 | compatible |    60.00 |       16.80 |        0 |
| 1280×720 | 10000 | crossfade  |    60.00 |       16.80 |        0 |
| 1280×720 | 49999 | static     |    60.00 |       16.80 |        0 |
| 1280×720 | 49999 | enter      |    60.00 |       16.80 |        0 |
| 1280×720 | 49999 | compatible |    60.00 |       16.80 |        0 |
| 1280×720 | 49999 | crossfade  |    60.00 |       16.80 |        0 |
| 360×300  |  1000 | static     |    60.00 |       16.80 |        0 |
| 360×300  |  1000 | enter      |    60.00 |       16.80 |        0 |
| 360×300  |  1000 | compatible |    60.00 |       16.80 |        0 |
| 360×300  |  1000 | crossfade  |    60.00 |       16.80 |        0 |
| 360×300  | 10000 | static     |    60.00 |       16.80 |        0 |
| 360×300  | 10000 | enter      |    60.00 |       16.80 |        0 |
| 360×300  | 10000 | compatible |    60.00 |       16.80 |        0 |
| 360×300  | 10000 | crossfade  |    60.00 |       16.80 |        0 |
| 360×300  | 49999 | static     |    60.00 |       16.80 |        0 |
| 360×300  | 49999 | enter      |    60.00 |       16.80 |        0 |
| 360×300  | 49999 | compatible |    60.00 |       16.80 |        0 |
| 360×300  | 49999 | crossfade  |    60.00 |       16.80 |        0 |

24 场景共 240 次记录，其中 18 个动画场景的 180 次记录全部达到 >55/>50 FPS 目标（未达记录 0）。此次单页生产构建复测没有同时运行其他测试/构建/内存分析，browser errors 为 0。20 次装卸后活动任务/容器元素归零。它不构成其他硬件、原生移动端或全部 96 场景的生产性能保证。原始 96 场景证据保留，不改写其 16 个场景未达结果。

## D3 路径缓冲后续优化

在不改变显示点数、线型、D3 三位小数精度或单点闭合的前提下，复用点数组弱引用关联的私有 ASCII 字节缓冲。D3 仍负责曲线遍历，只有最终 SVG 属性生成一个完整字符串。缓冲增长和复用后的短路径、负零、舍入边界及极大坐标均与 D3 默认输出逐字比对；输入点和端点快照不变。

同一 v2 生产测量方法、360×300、8 系列、10000 点兼容更新，每个策略 3 对新浏览器记录，依次运行，没有同时运行测试或构建。这里是采样峰值增量，不是全系统 GPU 峰值保证：

| 路径输出策略          | 采样峰值增量范围 MB | 处理                                                                               |
| --------------------- | ------------------: | ---------------------------------------------------------------------------------- |
| 原字符串片段数组 join |         54.74–57.57 | 基线，memory-path-join-baseline.json                                               |
| D3 默认字符串输出     |         45.65–47.96 | 对照，memory-path-d3-comparison.json                                               |
| 复用 ASCII 字节缓冲   |         32.77–37.85 | 已采用，memory-path-byte-buffer-comparison.json                                    |
| 进一步逐字节编码数字  |         26.38–39.06 | 未显示超出波动的收益且代码更大，未采用；memory-path-numeric-buffer-comparison.json |

字节缓冲的三次结果都低于原 join 基线，但仍超过 10MB；这只验证一个场景，10.4 不勾选。新增用例后全套 128 文件、1043 用例通过；仓库 lines/statements/functions/branches 为 93.35/91.37/92.59/86.17%，引擎覆盖率保持此前结果。typecheck、lint、450 行、build、package consumer、pack dry-run 均再次通过。

最新同配置重建基线：ESM 92819→104472 gzip bytes，增量 11653；CJS 93333→104785，增量 11452；CSS 9552→9549，worker 增量 0，见 gzip-results.json。路径内存收益增加少量代码，包体目标仍未达。五组 Terser 参数试验见 terser-experiments.json，都未达到目标；动画独立分包计入额外 chunk 后 ESM/CJS 增量 12114/12324，WASM 独立分包为 11640/11582，两种试验均未采用。分包试验使用临时 D3 默认字符串输出版本，基线目录也与最新正式基线不同；不能把各自的绝对大小当成跨方案精确收益，没有排除额外 chunk。

字节缓冲后的单页生产复测同样完成 24 场景、240 次记录，最低 59.5238 FPS，18 动画场景的目标未达记录为 0，浏览器错误 0；见 browser-results-byte-buffer.json。观测前半段有官方 SDK 归档网络下载，但没有同时测试、构建、物理内存采样、SDK 解压或执行；背景活动已写入 JSON。它仍不是完整生产 96 场景或原生移动性能保证。

当前实现再次完成生产桌面冒烟 8 案例（Chromium/Chrome/Firefox/官方临时 Edge × 桌面/小容器）和 WebKit/Chromium 移动仿真 2 案例，组件与 Demo 的交互、两种更新、SVG/PNG 和标注通过，浏览器错误 0。新证据独立保存在 path-buffer-smoke/ 与 path-buffer-mobile/，没有用移动仿真替代原生验证；实际查看移动 Demo 最终截图，标注正常显示。后续 FPS 运行器为自定义报告隔离截图文件名，并等待 Demo 默认动画结束再截图。

Google 官方 Android Emulator 37.2.12 和 Android 13 Google Play ARM64 镜像已下载到临时目录、核对官方 SHA-1 并保存 SHA-256、解压，见 android-emulator-preparation.json。SDK 许可 1.1 明确是有法律约束的协议，2.1 要求使用前接受；已向用户请求两份许可确认，尚未接受、启动模拟器或验证 Android Chrome。原生 iOS 环境和 Mac 解锁仍待提供，10.6/10.7 不勾选。

## 轴属性与数值比较批次

条件写入 SVG 属性和合并 tick metadata 遍历已实现，MutationObserver 回归确认相同输出不再重复写入。数值相等判断使用逐项数字比较，输入仍先验证为有限稠密数组；正负零沿用既有相等语义。128 文件/1045 测试及类型、lint、长度、构建、串行包消费/pack 门禁通过。

`memory-axis-attributes-comparison.json` 的三对 v2 自然峰值增量为 33.06、21.23、35.29MB；仍超预算，不能从与旧样本重叠的范围宣称内存改善。该测量在去除数值 JSON 比较前完成。最新 `gzip-results.json` 为 ESM +11670、CJS +11484 bytes；`gzip-results-before-axis-attributes.json` 保留前值。`owned-properties-experiment.json` 是未采用的私有属性压缩对照，未改变公共字段。

最终 8 组生产桌面/小容器组件与 Demo 冒烟保存在 `axis-attributes-smoke/`。历史 FPS 24 场景对应上一缓冲版本。Safari 本次重试仍锁屏；原生移动环境/许可条件未解决，没有新增原生通过结论。预算与原生验收任务保持未完成。

当前 WebKit/Chromium 移动仿真两组通过，独立证据为 `axis-attributes-mobile/`，未归类为原生移动验证。Chrome 小容器 Demo 截图实际查看通过。

## 按需快照与源码指纹批次

TrackSeriesPath 弱引用缓存和按需数值端点已实现；静态/入场不会提前复制未使用的几何，数据更新仍保留独立端点。128 文件/1046 测试及类型、lint、长度、构建、串行包消费/pack 均通过；当前生产桌面 8 组、移动仿真 2 组证据单独保存于 `lazy-snapshots-smoke/` 与 `lazy-snapshots-mobile/`。Pixel Demo 截图已查看。

内存 v3 新增构建输入 SHA256，旧版或不同源码拒绝续跑，且拒绝发生在启动浏览器前；实际验证旧版 exit 1（预期），同指纹 exit 0。`memory-lazy-snapshots-fingerprinted.json` 单场景 3 对物理进程测量增量为 28.98、30.44、25.67MB，仍超预算；20 次启用动画装卸任务/元素归零。此前 `memory-lazy-snapshots-comparison.json` v2 三对为 30.74、25.80、30.90MB。样本与此前轴属性方案区间重叠，不宣称统计显著收益。只描述消除不需要的副本，不把 JS heap 数据替代物理内存结论。

最新同配置 `gzip-results.json` 为 ESM +11714 / CJS +11521 bytes，worker +0，仍未满足预算。最终版本 24 场景 FPS 独占复测尚在运行。原生 Safari 本轮复核仍锁屏，SDK 许可及原生 iOS 环境未解决。10.4–10.7 保持未完成。

按需快照版本的 24 场景独占单页生产复测已完成：240 次记录，最低 59.5238 FPS，未达目标记录 0、浏览器错误 0、>50ms 长帧 0。20 次装卸任务/元素 0，最大活动任务 8；见 `browser-results-lazy-snapshots.json`，含输入指纹、两种尺寸的 Demo 截图。该运行期间没有其他测试/构建/物理内存采样/下载/模拟器负载，只有轻量文档与证据读取。

## 标注与数据更新并发修复

本批次截图审查发现标注样式冻结：dataChanged 的 cancelAll 中止了与锚点独立的出现样式，等待入场的标注也未释放，违反 CTL-06/PRE-04。两条新增回归先运行并失败，修复后 209 个针对性用例与全套 1048 用例通过。改为只取消几何更新/入场任务，保留标注样式，协调新布局后释放被中止入场的等待标注；公共 API 不变。

运行器增加最终 opacity=1、scale=1 的 DOM 断言，避免仅有节点却是半透明/缩小态的截图误判。修复后 `annotation-update-smoke/` 的 8 组生产桌面/小容器和 `annotation-update-mobile/` 的 2 组移动仿真均通过；Chrome 小容器截图已查看且样式完整。类型、lint、450 行、构建、包消费、pack 门禁通过，composable 441 行。

上述 24 场景 FPS 和按需快照内存记录对应此次并发修复之前的版本，不能扩大为修复后全矩阵保证。预算与原生验收仍未通过，继续保持 10.4–10.7 未完成。

并发修复后单场景 v3 三对测量已完成，`memory-annotation-update-fingerprinted.json` 为 24.77、33.42、32.13MB，20 次启用动画装卸任务/元素 0；只覆盖 360×300、8 系列、10000 总点数兼容更新。最新同配置 `gzip-results.json` 为 ESM +11753 / CJS +11558 bytes，worker +0；旧值保存于 `gzip-results-before-annotation-update.json`。两项预算仍不通过。后续计划是 renderer 分配/压缩优化、修复后的完整 FPS 复核，以及待环境可用的原生验收。

## 稳定生成器与数值字段诊断

当前采用 `pathBuffer.ts` 保存 D3 line/accessors/context；调用时替换比例尺、线型，保持 D3 三位舍入和闭合语义。点缓冲初始化全部数值字段后，发布前覆盖每个字段。新增冻结点数组重复生成和线条/散点/误差棒同步回归。

`memory-numeric-point-fields.json` 的 v3 单场景三对物理峰值增量为 27.67 / 25.13 / 27.97MB，20 次启用动画装卸任务/元素归零，首对 GC 后节点/监听恢复 28/14。预算未达，且不能从与旧方案重叠的样本范围声称统计改善。`allocation-diagnostic-numeric-point-fields.json` 是有采样/trace 开销的诊断，不作为性能证明。

直接数字编码、live DOM collections 两项试验已撤回：物理增量分别为 30.75–42.66MB、37.57–44.52MB。诊断虽显示 JS 分配下降，物理预算未改善；`allocation-diagnostic.json` 对应撤回的叠加方案，不能标作当前实现。所有方案测量文件独立保留。

`gzip-oxc-experiment.json` 同配置 OXC 对照为 ESM +12709、CJS +11502 bytes，未达 <10KB，因此未采用；正式配置仍为 Terser。原生 Safari 重试继续锁屏，SDK 许可回复和原生 iOS 环境仍缺失。10.4–10.7 保持未完成。

当前代码门禁：129 文件/1051 测试，覆盖率、typecheck、lint、450 行、build、串行包消费与 pack dry-run 全部 exit 0。正式同配置 `gzip-results.json` 更新为 ESM +11802 / CJS +11606 bytes，worker +0，仍未达预算。8 组桌面/小容器和 2 组移动仿真组件/Demo 通过，独立证据为 `stable-generator-smoke/`、`stable-generator-mobile/`，Pixel Demo 截图已查看。

最终 24 场景单页生产 FPS 复核正在进行，当前输入 SHA256 与 `memory-numeric-point-fields.json` 相同，见 `stable-generator-build-inputs.json`。完成前不扩展旧版本的通过结论。

最终 FPS 测量已完成：24 场景/240 记录，最低 59.5294 FPS，目标未达 0、>50ms 长帧 0、浏览器错误 0。20 次装卸任务/元素 0、最大活动任务 8。`browser-results-stable-generator.json` 对应当前源码指纹；仅覆盖所列 24 场景。

该命令最终 exit 1：在全部 FPS 完成后，第二尺寸 Demo 视觉检查超时。同一页面访问相同 hash URL 保留 Demo 状态，第二次增删标注删除上一轮标注。独立重现数量 1→0 后，运行器改为每尺寸新页面。视觉阶段单独重跑 exit 0，两种尺寸标注终态通过、错误 0，小容器截图已查看，证据 `stable-generator-visual-retry.json`。保留原始失败、不把后续视觉通过伪装为完整命令 exit 0。

## 未采用的直接曲线与坐标字符串缓存

直接 D3 curve context 单场景 v3 物理增量 25.23 / 25.84 / 27.97MB；诊断采样 enabled 136.42MB，未达预算且无明确统计收益。全 X/Y 字符串缓存反而达到 39.22 / 47.86 / 38.93MB，已撤回。仅 X 缓存的两次物理测量在静态预热阶段执行上下文销毁，0 个完整场景；不报告虚构数字。独立诊断第三次 mount 失败、恢复原源码后三次成功，只保留观察，不断言根因。

三种实现均未采用；恢复此前 stable-generator 生产验证的源码。新增 5 个路径复用/长度变化/D3 精确对照回归保留。当前正式 gzip、物理内存与 FPS 仍对应 stable-generator 源码及其记录，试验不能替代预算验收。证据文件 `memory-direct-d3-curve.json`、`allocation-diagnostic-direct-curve.json`、`memory-coordinate-string-cache.json`、`memory-x-string-cache.json` 及两份 context diagnostic log 独立保存。

## 递归产物统计与安全压缩选项

`compare-animation-gzip.mjs` 已改为递归清单并集，新增/删除/改名的 JS、WASM 与嵌套资产都计入成本。每种入口的 totals 包含该入口、CSS 和全部其他产物；缺失入口报错。新增 3 个脚本回归、typecheck/lint/450 行通过，库源码和压缩配置未变。

正式同配置重建：ESM/CJS 入口 +11801/+11606 bytes，CSS -5、worker 0；完整 totals +11796/+11601 bytes，仍超预算。旧报告独立保留，微小基线波动不作为优化收益。

七组安全 Terser/输出选项对照均未达预算，证据 `gzip-format-experiments.json`，没有采用，也没有使用 unsafe 数学/公开属性压缩。最新环境复核仍为 Mac locked、adb 0 设备、simctl 不可用，原生验收未完成。

## 未采用的注册时系列配对试验

试验版一次判定兼容性而不逐帧扫描 X；回归验证5帧仅1次判定，下一次更新总计2次、Y=15接续到半程22.5。130文件/1060测试、覆盖率、类型、lint、长度、构建、包消费、pack通过。生产8组桌面与2组移动仿真通过；10000点的8场景单页FPS（3预热/10记录）80记录、最低59.9991FPS、无未达目标/长帧/浏览器错误，20次装卸任务/元素0，视觉阶段也通过，整条命令exit0。证据全部带 transition-classification 名称，不冒充当前采用方案。

物理增量27.30/28.90/27.77MB仍超预算；完整gzip totals +11854/+11659 bytes，比此前增加约58bytes。因此最终未采用，两个生产源码和测试已恢复，补丁为 transition-classification-rejected.patch。正式报告恢复当前源码对应值，试验报告为 gzip-transition-classification.json、coverage-transition-classification.json。减少扫描次数不等于物理预算收益。

module-size-diagnostic.json 的模块metadata/独立代码压缩不可相加为最终gzip归因；较大模块包括组件协调层、控制器、调度器和配置校验。下一步仍需在保留行为契约下重构重复逻辑、分析物理分配。当前原生检查仍Mac locked，预算与原生验收项未完成。

## 未采用的内部字段压缩对照

独立副本通过TS符号引用定位38个内部字段，改为专用前缀，只压缩该前缀。自动改名漏掉结构推断的对象，最初两次类型检查exit2，修正后exit0；首轮未验证构建不作收益依据。候选9文件/216测试及构建后ESM/CJS直接SSR检查通过，完整gzip totals增量11699/11505 bytes，仍超预算、只少约100bytes。

未采用这一字段/构建变换；原工作区库源码、公共接口与压缩配置未改，正式报告不变。`owned-symbols-experiment.json` 包含全部字段、输入和退出码，`owned-symbols-rejected.patch` 保存源码变换。候选未做完整声明/tree shaking/原生验证，不把有限检查写成生产验收。

### 控制器数组快照修复（2026-10-13，已采用）

修复旧aborted回调修改调用方二维to数组后导致新注册失败的问题；新增先失败后通过的回归。9文件217相关测试、全套130文件1060测试及typecheck/lint/450/build/package/pack通过。此为ENG-06/API-04正确性修复，不是预算优化。

当前gzip完整增量11,824/11,637 bytes；当前单场景三对物理内存增量26,738,688/34,472,064/23,511,104 bytes，两项预算均未达。8组桌面和2组移动仿真通过，原生Safari锁屏及原生iOS/Android限制仍在。10.4–10.7不勾选；完整记录见controller-snapshot-verification.json及implementation.md最新批次。

### 物理增量归因与紧凑快照反例（2026-10-13）

新增离线归因脚本按当前三对测量各自全局峰值比较，不把独立进程峰值或重叠CDP字段相加。renderer增量26607616/34521216/23511104 bytes，GPU每对16,384 bytes；shared-page调整项显式保留并断言恢复总物理增量。预算结论不变，下一步应优先定位renderer的JS/原生SVG成本。

紧凑line/point二维行试验被现有误差坐标同步回归否决，已恢复源码且2文件40用例、typecheck/lint/450通过；未采纳、无生产变更，不修改测试期望。对应patch与具体失败/成功记录见compact-snapshot-rejected.patch和memory-attribution-verification.json。

### 私有Y比例尺复用（2026-10-13，未采用）

候选按原轴弱引用复用私有D3 scale，并让投影缓存比较域快照；不改业务比例尺。三对物理增量29.02/28.66/26.98MB，完整gzip增量11,868/11,673 bytes，均未达标且未证明超出波动的物理收益。已撤回两个生产文件，保留双份交叉淡化随域移动的回归。

恢复版130文件1061测试、覆盖率、类型/构建、lint及450行通过；首次构建测试可空属性类型错误exit2已修正，失败如实记录。当前正式gzip报告恢复此前生产方案；不将候选结果称为最终源码验收，不勾选10.4–10.7。详见private-y-scales-verification.json及未采用patch。

### 路径输入快照与配置规则合并（2026-10-13，已采用）

路径模式在工厂构造时快照，避免运行中切换已预检策略；两个先失败后通过的回归覆盖true/false翻转。WeakRef对照证明新配置不再持有调用方输入；不把GC可达性对照称为组件物理预算通过。统一四种标注效果/default easing，严格拒绝对象名称coercion；生产DEV guard删除诊断文案、仍保留字段回退与开发告警。

同配置完整gzip增量11,703/11,534 bytes，较上一方案小幅下降，仍未达10KB。最终fixture三对物理增量32.31/25.80/30.44MB，任务/元素清理0，仍未达10MB。130文件1062测试、门禁、构建/包/pack通过，8桌面和2移动仿真通过。默认生产原生fixture的2个Chromium pilot及证据路由通过，真实Safari仍锁屏，WebDriver禁用远程自动化；原生移动限制仍未解决。10.4–10.7不勾选。详见compatible-snapshot-verification.json。

### 当前源码 FPS 证据闭合（2026-10-13）

当前版本复测已完整结束，命令退出 0：8 系列、两种尺寸、1000/10000/49999 总点数、四种模式共 24 场景 / 240 记录；3 次预热 / 10 次记录，最低 59.5294 FPS，按 55/50 FPS 判定的目标未达 0、>50ms 长帧 0、浏览器错误 0。20 次启用动画装卸后任务 / 容器元素均 0，最大活动任务 8。Demo 两种尺寸的标注终态通过，两张截图保存，小容器截图已实际查看。完整报告、摘要及 stdout 分别为 browser-results-final-compatible-snapshot.json、final-compatible-fps-summary.json、final-compatible-fps.txt。本次整条命令包括视觉阶段均通过；历史 stable-generator 的视觉阶段 exit 1 及独立重跑证据仍保留。

此为当前指纹下的 24 场景生产 Chromium FPS 证据，不扩展为设计完整 96 场景或其他引擎、设备的性能保证。它不测量全部原生内存，也不改变同指纹内存三对增量 32,309,248 / 25,804,672 / 30,441,472 bytes 或完整 gzip ESM/CJS 增量 11,703 / 11,534 bytes 的未达预算结论。仅更新已经完成的 10.3 证据；10.4–10.7 不勾选。库源码及包配置不变，本批未重复完整 coverage/build/package/pack，上一批结果保留其实际范围。

### 终态句柄释放修复（2026-10-13，已实施）

真实构建产物的 Node --expose-gc / WeakRef 对照确认：仅保留已完成的 Animator 句柄，会保留轨道目标和管理器；控制器句柄还会保留控制器。丢弃句柄的对照均可回收。本批添加内部 createAnimationHandle，管理器和控制器共同使用可释放的访问上下文；终止时、用户通知前保存 ID/状态并断开任务、时钟及 owner 控制闭包。没有清空任务配置或改动错误回报、deferred aborted 通知及终态提交顺序。保留句柄的修复后对照均回收目标/管理器/控制器，仍可读取 FINISHED；详细对象可达性证据和复现脚本分别为 _-handle-retention-before/after.json、_-handle-retention-probe.txt。这是公共托管句柄的可达性修复，不推断手动 Animation 实例或组件物理预算。

新增五种终止方式的两类句柄回归：finish、abort、自然完成、同 ID 替换和同步完成后，重复 pause/resume/finish/abort 不改变终态，也不取消/重新请求存活 peer 的 RAF。原版五个用例全部失败，修复后 10 个用例通过。最终相关 10 文件 / 229 用例通过；typecheck、lint、450 行通过。全套 131 文件 / 1072 测试及覆盖率通过，仓库 lines/statements/functions/branches 为 93.48/91.53/92.82/86.38%，core 为 98.98/98.09/98.26/95.94%。build、test:package、pack --dry-run 均 exit 0。最初新 helper 的 Prettier 检查 exit 1，格式修复已落实。

当前同配置、依赖及 WASM 的递归 gzip 完整 ESM/CJS 增量为 11,825/11,662 bytes，仍超 10KB，比上一方案略大；不把正确性修复写作包体优化收益。旧正式报告另存 gzip-before-handle-release.json。v3 当前源码指纹下的 360×300、8 系列、10000 总点数 compatible 单场景三对物理增量为 29,818,880 / 30,310,528 / 28,229,696 bytes，测量错误 0，20 次装卸任务/元素均 0、最大活动任务 8。预算仍未达，与此前波动范围重叠，不能从 WeakRef 回收或这三个样本声称组件物理峰值优化已证明；完整矩阵仍待达标。

当前生产 Chromium/Chrome/Firefox/官方临时 Edge 两尺寸组件/Demo 回归共 8 组通过，见 handle-release-smoke/；Firefox 小尺寸 Demo 截图已查看。本批未重跑完整 FPS，上一批 browser-results-final-compatible-snapshot.json 的 24 场景报告保留其原源码指纹，不能用作当前修改的完整 FPS 保证。

仍是规划/未完成：10.4 物理预算、10.5 gzip 预算、10.6 原生 Safari 最终矩阵、10.7 原生 iOS/Android。CUA 实际复核仍为 Mac locked 且自动解锁失败；SDK 许可仍未接受，无新原生移动环境。没有自行启用远程自动化、缩减规格、提交、发布、改版本或归档。精确检查及证据见 handle-release-verification.json。

补充最终生产移动仿真：iPhone/WebKit 与 Pixel/Chromium 的组件触摸接管、Demo 标注终态及 SVG/PNG 导出两组均通过，错误 0；见 handle-release-mobile/。Pixel Demo 截图已查看。这是桌面引擎移动仿真，不计为原生 iOS/Android 验收。

### 候选诊断与原生 Safari 闭合（2026-10-13）

三种候选均未采用，生产源码恢复至终态句柄释放版本。grid v-memo 三对物理增量 28,655,680 / 30,818,368 / 30,294,080 bytes，gzip 11,943 / 11,757 bytes；D3 索引投影为 28,196,992 / 34,340,928 / 23,805,952 bytes，gzip 11,925 / 11,769 bytes；刻度 visibility 差分为 39,370,752 / 29,704,256 / 24,248,256 bytes。均未证明稳定物理收益或预算通过；visibility 候选没有完整回归/视觉验收，其临时测试与源码共同恢复。补充 5 个保留的 D3 oracle 用例覆盖不规则 X、极值、舍入、反向/无限比例尺及复用数组变更。恢复版相关 2 文件 / 29 测试通过。

source-map 分配采样用于诊断：启用动画的采样分配总量原版 135,904,572 bytes、索引候选 131,786,148 bytes，线生成分配主要转移至 pathBuffer，D3 linear 成本仍存在。该工具加入源码映射和 HeapProfiler，函数入口/最近映射祖先的归因不是准确分配点或对象类型，也不是物理内存/FPS 预算证据。SVG 隐藏探针确认 display:none 的原生度量为零、visibility:hidden 保持原生度量；Firefox client rect 与 transformed BBox 并不等价，不能以 BBox 静默替代原契约。脚本、原始报告和未采用 patch 保留于 evidence，见 candidate-diagnostics-verification.json。

用户解锁后，原生 macOS Safari 26.6.2 已完成生产组件 1280×720 / 360×300：入场实际推进、compatible/crossfade 各出现活动任务且终态 0，SVG/PNG 导出成功并去除动画裁剪。Demo 桌面 1324px 与窄窗口 574px 实际操作重新入场、振幅/点数更新、标注增删、scale/bounce、禁用/恢复，以及入场时框选接管；截图看到完整波形、受控标注及改变后的 X 视口。Safari 最小窗口不等同 360px Demo，360px 组件由独立 fixture 验证；不声称 Safari FPS 或移动设备证明。六张截图已保存并查看，原始组件结果见 native-handle-release-safari.json，完整范围见 native-safari-verification.json。10.6 按实际验收勾选；未启用远程自动化或修改安全设置。

恢复后完整覆盖率 131 文件 / 1077 测试通过，lines/statements/functions/branches 为 93.48/91.53/92.82/86.38%，animation core 为 98.98/98.09/98.26/95.94%。typecheck、lint、450 行检查、生产 build 均通过。同源码正式 gzip 对照为 11,830 / 11,667 bytes：对比基线的小幅字节变动不作为优化收益。10.4 物理预算、10.5 gzip 预算和 10.7 原生移动验证仍是未完成规划；既有 FPS 报告保留原源码指纹，不扩大为本次完整性能验收。Android SDK 两份许可仍未收到明确接受，未运行；原生 iOS 环境缺失。不提交、不发布、不改版本或归档。

最终包消费、pack --dry-run、OpenSpec strict/status、格式整理及 git diff --check 均 exit 0。status 4/4 仅表示规划文件齐全；本批实际门禁见 native-final-verification.json。恢复仅本任务生成的两个 WASM 文件，保留用户已有改动。下一批仍需物理内存与包体优化，并在获得 SDK 许可明确接受/原生 iOS 环境后执行移动矩阵。

### D3 输出 X 字节缓存试验（2026-10-13，未采用）

候选继续使用完整 D3 line/curve 及三位精度，按当前实际输出的 rounded X 比较并缓存固定 ASCII 字节槽，不保存调用方数组或仅按比例尺身份判断，不减少点数。相关 2 文件 / 46 回归、typecheck、lint、450 行检查通过。360×300、8 系列、10000 总点数 compatible 三对物理增量为 42,402,048 / 37,863,680 / 26,902,528 bytes，仍超 10MB，未证明比恢复版稳定改善；一次 enabled 测量执行上下文被销毁，运行器重试后完成，原始错误保留，不描述为零错误。

没有继续增加缓存：候选已撤回至原 pathBuffer，未采用补丁、原始物理报告和日志保留，见 x-byte-cache-verification.json。未对该候选声称 gzip/FPS/完整覆盖率/原生视觉通过。正式物理/gzip/Safari 证据保持之前已验收源码的范围，10.4/10.5/10.7 不勾选。原生环境再次实际检查 adb 为 0 设备，simctl exit 72 工具不存在；SDK 许可尚未收到明确接受，未运行模拟器。未修改行为规格、公共功能、阈值或点数，未提交或发布。后续继续定位 renderer 瞬时物理分配及较大模块的重复逻辑，而非扩大该失败候选。

恢复后的 2 文件 / 46 测试、typecheck、lint、450 行检查均 exit 0。本批没有保留生产源码或测试更改，因此未重复完整 coverage/build/package/FPS；上一轮 1077 测试及产物验收保持其实际范围。

### Deadline 遍历及投影缓存对照（2026-10-13，均未采用）

构建产物实际保留原生私有字段，不存在可以移除的动画类兼容层。调度器以直接遍历取代每帧的数组复制/map/Math.min 展开，9 文件 / 207 测试及 typecheck/lint/450 行通过；同配置重建 gzip 对照候选完整增量 11,830 / 11,661 bytes，但动画产物自身 ESM/CJS 比旧产物增加 9/3 字节。基线的小幅变化不作收益，未采用，恢复原 Animator。没有宣称物理改善；详见 deadline-loop-verification.json。

另一候选缓存全部点的 X 原始投影及 Y 三位小数投影，相同投影复用 SVG 字符串；step 中间 X 始终比较原始值，改变投影仍通过 D3 line/curve，不减点数或跳过进度/域更新。2 文件 / 46 D3 等价和组件回归、typecheck/lint/450 行通过。单场景三对物理增量 24,543,296 / 29,196,224 / 25,952,320 bytes，错误 0，仍超过 10MB 且与此前样本重叠，不能证明稳定预算收益，因此同样撤回。没有 candidate gzip、完整覆盖率、FPS 或原生视觉通过的结论。原始报告、源码指纹及未采用 patch 保留于 projection-cache-verification.json。

本批不保留运行实现或测试变更；正式源码与上一轮 1077 测试、构建/包及 Safari 验收版本一致。10.4/10.5/10.7 保持未完成，正式 gzip 报告恢复之前已验收源码的记录。后续仍规划定位 renderer 峰值与较大模块重复逻辑，并在原生移动条件可用后完成矩阵。不提交、发布、改版本或缩减规格。

恢复后的 10 文件 / 234 测试、typecheck、lint、450 行检查均 exit 0，两个运行文件与试验前备份逐字节相同。

重新 build exit 0，恢复 dist 正式源码产物；OpenSpec strict/status exit 0，4/4 为规划 artifacts，不表示预算完成。没有重复 coverage/包消费/FPS/原生矩阵；沿用上一轮相同正式源码的实际验收范围。

### 公共预设几何形状校验复用（2026-10-13，已实施）

createPathTransitionAnimation 已先 copyGeometry 并校验/冻结端点，再为形状检查构造临时 target/track 配置、重复复制端点。现改为复用核心 sameShape 对已验证数值直接比较；同通道要求、标量/一维/二维形状、TypeError 消息、输入快照及只读输出行为保持。sameShape 仅内部导出，不加入 src/index.ts 公共入口。相关 9 文件 / 207 测试、typecheck/lint/450 行均通过。同配置递归 gzip 完整增量 ESM/CJS 为 11,820 / 11,655 bytes；相对于上一正式产物本身减少 7/9 bytes，基线字节小幅变化不作优化收益。10.5 仍未满足 10KB，不能把小重构写作预算完成或组件物理改善。

发现系统自带 iPhone Mirroring，但实际打开为尚未启用欢迎页，说明启用会转发通知/实时活动并访问 iPhone App。未点击继续、未建立新访问；已明确请求用户选择移动授权范围。Android 两份 SDK 许可也仍待明确接受，未运行。原生 iOS 环境新增这条待授权路径，仍未验收；不是原生移动矩阵完成。此前原生 Safari/FPS/物理证据保留原源码指纹，不能扩展为本次完整性能证明。10.4/10.5/10.7 不勾选，不提交、发布、改版本或归档。

用户明确回复“暂不在移动端验证”：10.7 本次暂缓，未接受 Android 许可、未继续 iPhone 镜像首次设置，不勾选移动任务；本次继续工作的范围为 10.4/10.5 预算及相关验证。

当前共享形状校验版本全套 131 文件 / 1077 测试与覆盖率通过，lines/statements/functions/branches 为 93.48/91.53/92.82/86.38%，core 为 98.98/98.09/98.26/95.94%。build、test:package exit 0；生产 Chromium/Chrome/Firefox/官方临时 Edge 两尺寸共 8 组组件/Demo、交互及 SVG/PNG 通过，Firefox 小尺寸 Demo 截图已查看，见 shape-sharing-smoke/。未重跑完整 FPS、物理或原生 Safari 矩阵；历史证据保留原指纹与范围，不能用作此次性能预算证明。具体证据见 shape-sharing-verification.json。

最终 pack --dry-run、OpenSpec strict/status 均 exit 0；status 4/4 为规划 artifacts，不表示 10.4/10.5 达标。恢复仅本任务生成的两个 WASM 文件，保留原有工作区改动，无提交或发布。

### 当前物理复测与生命周期归因（2026-10-13）

共享形状校验版本的 v3 生产实测完成，360×300、8 系列、10000 总点数 compatible 三对物理增量为 24,707,136 / 33,030,144 / 30,113,856 bytes，错误 0；20 次启用动画装卸后任务/元素均 0、最大活动任务 8。仍超 10MB，范围与历史波动重叠，不能宣称公共预设小重构改善组件物理预算。最新报告为 memory-shape-sharing.json，源码/fixture SHA 已记录；只更新单场景，不扩展为完整矩阵。

归因脚本现分别输出 before、同一时刻 globalPhysicalPeak、afterForcedGC、afterTwentyUnmountCycles，带 activeTasks/unfinished。历史及当前 GC 后样本仍有活动任务，不能当作终态或卸载泄漏证据；只有卸载后独立样本可用于相应观察。V8 usedSize/totalSize/embedder/backing 字段重叠物理内存，既不相加，也不从物理预算中扣除容量或回收值。所有归因产物明确 validForBudgetAcceptance=false。历史三对终态句柄报告的 afterForcedGC 均仍有 8 任务；第 1 对卸载后为 0 任务、28 DOM nodes，其余对没有 afterCycles 物理样本，不能扩大为三对全部卸载内存证明。

为区分线条 native d 更新成本，本批临时诊断拦截每个线条后续 d 写入，计算仍完整。它故意违反可见动画契约，绝不是生产候选：三对增量 25,509,888 / 29,786,112 / 24,903,680 bytes，测量错误 0，观测期实际略过 729/730/764 次写入。与正常范围重叠，不能证明 native path 写入是主要瓶颈，也不能精确归因其他 DOM 工作。没有采用拦截、冻结或减少点数；生产源码不变。临时脚本首次因 /tmp 无法解析 playwright exit 1，改用已安装包绝对 import 后 exit 0，失败日志保留。原始诊断、源码指纹、脚本见 memory-frozen-svg-diagnostic.json、frozen-svg-diagnostic-probe.txt 和 memory-lifecycle-verification.json。

typecheck/lint/450 行检查与三份离线归因命令均 exit 0。本批仅诊断脚本及记录变更，不重复全套 tests/coverage/build/package/FPS/原生矩阵，上一批 1077 测试和产物门禁保持其范围。10.4/10.5 仍未完成，10.7 依用户要求暂缓；下一步继续分析数值、比例尺及轴分配，不以冻结 SVG 或 heap 替代物理验收。不提交、发布、改版本或缩减规格。

### 路径计算及刻度遮挡隔离对照（2026-10-13，仅诊断）

进一步用临时 Vite pre-transform 隔离工作，生产源码未改。每份报告除正式 source/fixture 指纹外记录实际 transform 脚本 SHA，明确 diagnosticOnly=true、validForBudgetAcceptance=false，临时 runner/server 原文保存为 evidence 文本，不纳入公共流程。第一组在 pathBuffer 首次计算后直接复用旧路径，三对物理增量 29,343,744 / 29,294,720 / 29,769,856 bytes，错误 0，每对观测期实际跳过 800 次计算。结果表明仅去除路径计算不足以去除本场景物理峰值；它冻结可见波形，违反行为契约，没有采用。

第二组单独跳过 updateMaximumTickVisibility，三对增量 20,824,192 / 23,625,856 / 21,676,160 bytes，错误 0，实际跳过 106/105/106 次检查。较本轮正常样本低，但三对测量及历史波动不足以证明精确或稳定因果收益，仍超过 10MB；它会保留重叠标签/网格，违反原轴可读性契约，绝不是可交付优化。此前冻结 d 写入对照仍保留为不同诊断，不能混同忽略计算。继续方向是保留碰撞结果、字体与 native client rect 契约的轴格式/布局优化，而非删除检查。原始报告、transform、计数和归因见 compute-isolation-verification.json。

正式源码 geometry 1 文件 / 19 测试通过；正式生产实现和上一批 1077 测试、构建/包、跨桌面浏览器版本相同。临时 transform 不通过正式 TypeScript/单元测试验收，也不冒充规范实现。10.4/10.5 不勾选，10.7 继续按用户要求暂缓，不提交、发布、改版本、缩减点数或改变阈值。

正式 typecheck/lint/450 行及两份离线归因命令 exit 0。本批不重复全套 coverage/build/package/FPS/原生矩阵，历史证据保留其实际源码指纹。

### 单次刻度检查内查询复用（2026-10-13，未采用）

候选只在 updateMaximumTickVisibility 一次调用内复用 maximum labels、普通 labels 及 axis tick labels 两次格式化的查询结果；不缓存跨帧 DOM 或原生 client rect，不改变避让/精度/字体规则。3 文件 / 32 相关回归及 typecheck/lint/450 行通过；360×300、8 系列、10000 总点数 compatible 三对物理增量为 33,325,120 / 29,884,416 / 27,230,272 bytes，运行器 exit 0。减少 query count 没有证明物理预算收益，结果仍超 10MB 且重叠此前范围，已恢复原 yAxisTickVisibility；没有继续 gzip 或将候选作为生产验收。

未采用 patch、原始指纹/报告与实际错误列表见 call-cache-verification.json。正式源码保持共享形状校验版本，不勾选 10.4/10.5；10.7 依用户暂缓。本批不提交、发布、改版本或修改现行行为规格。后续应重点分析 native text/axis 写入与数值域投影，不能把减少查询次数或隔离试验低峰值当作已达标。

恢复后的正式源码与候选前备份逐字节一致；6 文件 / 50 项轴、端点、最小刻度及动画集成回归通过，随后 typecheck、lint、450 行检查均 exit 0。原始日志见 call-cache-restored-*.txt，汇总见 call-cache-verification.json。本批没有保留运行时代码修改，不重跑未变化产物的全套覆盖率、构建、包消费或 FPS；现有证据继续按各自版本和范围解释。移动端依据用户“暂不在移动端验证”保持规划/暂缓，不能勾选 10.7。

### 有界 Y 数字文本缓存（2026-10-13，未采用）

候选仅缓存舍入后的 Intl 中文数字文本，最多 256 项，元数据仍按当前域、可见最大刻度和单位生成，碰撞与字体测量未改。4 文件 / 57 回归及独立格式化对照测试（600 数值、重复/逆序、科学缩放、单位/顶部变化）通过；typecheck/lint/450 行通过。360×300、8 系列、10000 总点 compatible 三对物理增量为 31,506,496 / 27,000,896 / 27,836,544 bytes，exit 0、测量错误 0，仍超预算且重叠历史范围；撤回缓存及候选专用测试，原源码逐字节恢复。恢复后 4 文件 / 57 回归及 typecheck/lint/450 行均通过。没有候选 gzip/FPS/原生结论，10.4/10.5 不勾选，10.7 按用户暂缓。原始报告、patch、日志见 number-cache-verification.json。

### 内部已提交数值快照复用（2026-10-13，已实现）

PropertyGroups 的 entry.value、group.base 是经过数值校验、仅被替换且不暴露给消费者的内部快照；committed 直接保留它们，不再重复复制。插值、合成的有限值检查及目标赋值的独立复制保留，目标 setter 异常仍在已提交状态更新前处理。新增普通/累加两项嵌套数组隔离回归：中止其中一个写入者、外部修改此前输出数组后，活动 peer 继续使用内部提交值，原输入不变。9 文件 / 209 动画测试通过；完整 131 文件 / 1079 测试通过，行/语句/函数/分支覆盖率 93.48 / 91.53 / 92.82 / 86.38%，核心 98.98 / 98.09 / 98.26 / 95.94%。随后 typecheck、lint、450 行、构建、包消费、dry-run 打包均 exit 0。

同配置/依赖/WASM 递归 gzip 完整 ESM/CJS 增量为 11,810 / 11,646 bytes；本身产物减少 7 / 6 bytes，基线 gzip 同时漂移 +3 / +3 bytes，不能将增量变化 10 / 9 bytes 全归为源码收益。仍未达到 10KB。Chromium/Chrome/Firefox 两尺寸组件及 Demo/交互/导出共 6 组生产冒烟通过，Firefox 小尺寸 Demo 截图已查看。未重跑原生 Safari/Edge、完整 FPS 或移动原生，各历史指纹及范围保留。最新360×300、8系列、10000总点 compatible 三对物理增量为 25,198,656 / 33,030,272 / 23,740,416 bytes，exit 0、错误0，20次动画装卸任务/元素0。组件使用回调驱动的空 tracks，不能由公共数值轨道复制减少推断组件内存收益。10.4/10.5 保持未完成，10.7 按用户暂缓。原始日志、当前指纹与局限见 committed-sharing-verification.json。未提交、发布、改版本或缩减规格。

### 数值 X 投影缓存及缓动家族表（2026-10-13，均未采用）

数值 X 候选只缓存 D3 数值投影，保留原 D3 curve/context/舍入；比例尺引用、domain、range、clamp、unknown、插值工厂或逐点 X 变化会失效，自定义插值工厂绕过缓存。候选精度/集成 2 文件 / 47 测试及 typecheck/lint/450 行通过；360×300、8 系列、10000 总点 compatible 三对生产物理增量 27,426,688 / 29,622,464 / 31,260,736 bytes，exit 0、错误0。结果仍超预算且重叠已知范围，未证明峰值改善，撤回缓存及其专用 D3 oracle 测试；没有候选 gzip/FPS/原生结论。

缓动家族表候选保持静态 D3 导入、31 种映射及 pure factory，以固定家族/方向数组生成映射；9 文件 / 209 动画回归通过。同配置/依赖/WASM 递归 gzip 实测候选完整 ESM/CJS 增量 11,825 / 11,671 bytes，但不能把基线漂移混为源码效果：候选自身产物实际增加 14 / 24 bytes。撤回候选，恢复原显式映射及正式 gzip-results.json；没有为已知包体积倒退的候选继续 typecheck、包消费或完整覆盖率。

三份恢复源码与试验前备份逐字节一致。恢复后 10 文件 / 236 动画及集成回归、typecheck/lint/450 行通过；当前正式源码仍为上一批内部提交快照复用版本，完整 1079 测试及构建/包/6 组浏览器证据保留其原范围，不重复未变化运行时的完整门禁。正式物理预算仍为 memory-committed-sharing.json 的三对超限，正式 gzip 增量仍 11,810 / 11,646 bytes。10.4/10.5 不勾选，10.7 按用户暂缓；原始报告、指纹、patch 和日志见 numeric-x-family-verification.json。未提交、发布、改版本或缩减规格。

### 独立过渡源快照（2026-10-13，未采用）

候选在注册轨道更新前独立复制旧数值几何，旧渲染元数据移除完整查询 source/points，旧轨道引用替换为当前轨道；保持四列误差数据、样式、域及基于完整数据缓存的标注锚点。原有 2 文件 / 46 测试及 typecheck/lint/450 行通过；其后新增的候选专用 2 项绘制 oracle 也通过，覆盖兼容/点数变化淡化在 0/0.25/0.5/1 的线、点、误差棒、样式、透明度及标注锚点，未再为该专用测试运行 typecheck。360×300、8系列、10000总点 compatible 三对生产物理增量为 33,407,104 / 25,624,576 / 35,193,088 bytes，exit 0、错误0。减少源码引用图不等于证明实际 GC 或自然物理峰值下降；所有样本仍超预算，没有采用。

两个运行时文件与试验前备份逐字节恢复，专用 oracle 移至 evidence 文本供审阅。恢复后 10 文件 / 236 回归、typecheck/lint/450 行均通过。未为已拒绝候选继续 gzip、完整覆盖率、包消费、FPS 或原生验证；正式源码仍为内部提交快照复用版本。当前正式内存及 gzip 数值和任务10.4/10.5未完成状态保持，10.7继续按用户暂缓。原始报告/指纹/patch/日志见 detached-source-verification.json。

### 当前正式源码完整96场景生产FPS验收（2026-10-13，已验证）

同一原进程正常完成、exit 0，未重启或缩减场景。核对完整笛卡尔矩阵：1280×720/360×300、1/8系列、1000/10000/49999/50000/50001/100000总点、static/enter/compatible/crossfade，共96场景，逐场景3预热/10记录，960条观测均>=2100ms。当前正式源码/fixture/WASM指纹15a5861c31815e6170e5a12c68d61b5077a12f70f33d43fb59b99170fa37d4bd；最低59.529433997918574 FPS，阈值内55/50目标未达0、>50ms长帧0、浏览器错误0，每条观测结束任务0。50k及以上各模式maxActiveTasks0，36组静态降级对照保留中位FPS差及显示坐标集合，微小差异不解释为“绝对无性能损失”。20次动画装卸任务/元素0、maxActiveTasks8。两尺寸Demo视觉阶段通过、标注settled，两张截图已实际查看。

见 browser-results-final-committed-full96.json、final-committed-full96-summary.json、final-committed-full96-stdout.txt；原live progress记录现标记completed，不冒充仍有运行作业。10.3现证据扩大到当前源码完整Chromium生产矩阵，历史开发并行和24场景证据保留各自范围。本轮等待期间没有修改源码、并行构建或测内存。此证据仅headless Chromium FPS，不代表原生其他浏览器FPS，不把JS heap装卸记录替代物理内存预算；10.4/10.5仍未达，10.7依用户暂缓。不提交、发布、改版本或缩减规格。

### SVG Text 节点复用（2026-10-13，未采用）

候选在已有且唯一Text子节点时只改nodeValue，其他内容继续textContent替换；对轴定位文本和两次compact格式化应用同一内部函数。不改变文本内容、可见性、字体或原生client rect。6文件/51回归及typecheck/lint/450行通过，含节点身份、空文本和混合tspan回归。360×300、8系列、10000总点compatible三对生产物理增量28,885,056 / 24,297,536 / 22,413,376 bytes，exit0、错误0，仍超预算且重叠既有范围；未证明峰值收益，撤回候选及专用测试。

三文件恢复后与备份逐字节一致，6文件/50测试及typecheck/lint/450行通过。没有候选gzip/FPS/原生结论，正式源码仍为内部提交快照复用版本，完整96场景FPS证据仍适用原正式指纹；不重复未变化运行时的全套覆盖率/构建/包门禁。10.4/10.5保持未完成，10.7按用户暂缓。原始报告、patch、日志和指纹见text-node-verification.json。未提交、发布、改版本或缩减规格。

### 当前正式源码完整12场景物理矩阵（2026-10-13，预算未通过）

v3生产同一指纹15a5861c31815e6170e5a12c68d61b5077a12f70f33d43fb59b99170fa37d4bd的1280×720/360×300、8系列、10000/49999总点、enter/compatible/crossfade，共12场景36对，原命令exit0。完整报告memory-final-committed-full12.json，逐组汇总final-committed-full12-summary.json。桌面10k compatible/crossfade发生11次execution context destroyed失败尝试并自动重试，原错误保留，不能把exit0当作无错误验收；归因工具要求errors0，未强行绕过。

36对成功测量20次装卸任务/元素均0，max8，但每场景只有第一对保存afterCycles物理样本，其余只有资源计数；GC后仍可能活动任务，不当作终态泄漏证明。预算仍未达：桌面49999淡化83.35–87.24MB、小容器49999淡化53.41–55.20MB；10k兼容分别22.89–23.02MB和27.82–30.16MB。小容器入场各三对低于对应目标，不扩大为全部模式通过。下一步补充失败phase/导航/pageerror诊断，复测出错两组，再针对淡化的投影/DOM成本优化。10.4/10.5不勾选，10.7按用户暂缓；未修改运行时、规格、版本或提交发布。

运行器现记录失败phase、主frame导航、pageerror/crash及stack，成功浏览器也保存诊断；不改变测量时钟、样本/点数、进程计数或GC位置。此前出错的1280×720/10000 compatible/crossfade各3对复测exit0、错误0，每浏览器只有初始导航且pageerror/crash0，原异常没有复现，不声称历史错误已修复。兼容增量24,035,328 / 28,639,360 / 25,083,904 bytes；淡化64,143,552 / 54,952,000 / 48,185,536 bytes，仍超10MB。原完整报告不被拼接/覆盖，11错误保留，独立复测只证明其自身范围。错误0复测的离线同一峰值进程归因exit0，诊断仍validForBudgetAcceptance=false；见memory-phase-verification.json及memory-final-committed-error-scenes-attribution.json。

本批诊断脚本lint、正式typecheck、450行检查均exit0；完整FPS/1079测试及产物门禁仍按未变化运行时的上一批范围，不重跑。后续重点处理交叉淡化双份几何投影成本，原数据/标注查询及最多两份几何契约不变。

### 累加插值单遍历（2026-10-13，未采用）

候选合并插值和累加相减到一次combineValues遍历，保留原乘加/相减顺序与最终copyAnimationValue有限值校验及输出隔离；9文件/209测试、typecheck/lint/450行通过。首次gzip在恢复后的WASM输入下exit0，虽单次基线/候选使用相同WASM，但指纹不同于正式已准备WASM报告，不能横比实际产物。准备WASM后指纹与正式报告一致，递归ESM/CJS完整增量11,821 / 11,659 bytes；候选产物实际增加6 / 9 bytes，基线同时漂移-5 / -4 bytes，未将漂移误归源码收益。公共累加数组分配减少并不能推断组件空轨道回调路径的物理收益，因此未保留候选。

两源码逐字节恢复、正式gzip报告恢复；恢复后9文件/209测试及typecheck/lint/450行exit0。没有候选组件物理内存、完整覆盖率/包/FPS/原生结论，正式源码及96场景FPS指纹保持。10.4/10.5未完成，10.7按用户暂缓。原始两个gzip输入/报告、patch和日志见fused-additive-verification.json。未提交、发布、改版本或缩减规格。

### 交叉淡化分配归因及网格节点复用（2026-10-13，已实现）

桌面1280×720/8系列/49999总点crossfade的production+sourcemap V8采样静态48,370,088/启用240,313,536 bytes；包括已回收对象和最近映射祖先归因，不是物理峰值、精确对象类型或FPS验收。D3曲线/line、Vue仍主要，背景网格约6.83MB分配差。临时构建省略整个Backdrop三对物理增量53,854,400 / 50,446,336 / 53,837,888 bytes、错误0；它违反背景/网格/水印视觉契约，只隔离诊断，未写入运行时。脚本/transform指纹、原始profile和报告见crossfade-allocation-summary.json与memory-omit-backdrop-diagnostic.json。

正式优化在Backdrop保留背景/水印Vue渲染，四组网格依数值刻度复用独立SVG line，保持data-grid-direction、minor/major样式、逐线避让与clip；仅改变的坐标/颜色写入，节点重排/移除一致，不缩减点数或双份几何。首轮5文件/46测试通过但typecheck因可省略stroke颜色exit2，修正undefined删除属性后6文件/48测试及typecheck/lint/450行通过。新增两方向回归覆盖节点身份、坐标域变化、顺序、移除、无stroke颜色及既有display遮挡标记。

同场景候选三对57,065,536 / 59,588,672 / 60,768,256 bytes，其间恢复原源码对照80,183,424 / 83,935,360 / 75,661,504，再恢复候选三对54,313,024 / 59,408,448 / 57,081,856；两轮候选错误0；原源码对照保留1次warmup-3-mount上下文销毁重试，三轮成功测量装卸任务/元素0。此机器上复现方向性改善，不声称精确因果幅度或全矩阵达标，仍超20MB。完整同配置/依赖/已准备WASM gzip ESM/CJS增量12,010 / 11,833 bytes，候选产物实际增加197 / 184 bytes（基线漂移-3/-3），接受小包体积代价换取较大、复现的淡化物理改善，10.5仍需继续达标。

完整132文件/1081测试、覆盖率（行/语句/函数/分支93.51/91.57/92.81/86.45%）、build/包消费/dry-run打包通过；core覆盖率98.98/98.09/98.26/95.94%。Chromium/Chrome/Firefox桌面/小容器6组生产组件与Demo/交互/SVGPNG通过，Chromium桌面组件及Firefox小Demo截图实际查看。见grid-dom-verification.json。正式源码现在为网格节点复用版本，历史96场景FPS、原生Safari/Edge保留旧指纹；最终新源码复验仍规划，10.3/10.6重置未完成，10.4/10.5未达，10.7依用户暂缓。不提交、发布、改版本或缩减规格。

最新网格版本10000点compatible两尺寸各三对exit0/错误0：1280为25,673,728 / 22,249,344 / 23,920,512 bytes，360为25,182,208 / 31,785,088 / 26,869,824 bytes。仍超10MB，没有稳定兼容模式收益结论；淡化方向性改善与兼容预算分开。见memory-grid-dom-compatible.json。

### 轴构造、模板复用、网格变换及压缩选项复验（2026-10-13，均未采用）

按正式网格节点复用版本继续优化，未调整现行规格或点数。惰性构造 D3 axis 候选仅在刻度结构/range/devicePixelRatio 变化时创建轴；3 文件 / 33 测试及 typecheck/lint/450 行检查通过。360×300、8 系列、10000 总点 compatible 三对物理增量 34,750,464 / 35,045,440 / 30,097,472 bytes，exit0、错误0，未显示收益，三文件逐字节恢复；恢复后 3 文件 / 32 测试通过。见 lazy-axis-verification.json。

轴 Vue 模板 v-memo 候选保留当帧 D3 域写入，仅复用结构/标签/样式未变化的模板。7 文件 / 76 测试及 typecheck/lint/450 行通过；同场景三对物理增量 35,799,104 / 26,689,600 / 48,037,888 bytes，exit0、错误0，未显示收益，撤回。见 axis-template-verification.json。

网格数值组变换候选保留逐线避让、裁剪、非缩放描边及不适用比例尺的原路径回退。4 文件 / 44 测试及 typecheck/lint/450 行通过；同场景三对物理增量 44,154,944 / 42,860,608 / 43,728,896 bytes，exit0、错误0，报告完整结束，未显示收益。候选四文件逐字节恢复，新增 helper 删除，patch 与原报告保留。没有为这些已拒绝候选继续完整覆盖率、gzip/FPS/原生验收；不能把减少属性写入当作物理峰值收益。见 grid-transform-verification.json。

独立临时构建测试非 unsafe 的 Terser inline:false、reduce_funcs:false、collapse_vars:false 及组合，工作区配置/源码/正式产物未改。相同配置、依赖及已准备 WASM，递归并集完整 gzip ESM/CJS 增量分别为 12,018/11,822、11,995/11,771、12,005/11,806、12,007/11,780 bytes，命令 exit0。全部超过 10KB，未采用，不将基线漂移解释为源码压缩收益。见 gzip-inline-experiments.json 及原脚本/日志。

正式已实现内容仍为网格节点复用、引擎/预设/组件及公共接口；预算优化候选仅为试验，不是已实现功能。10.4/10.5 继续未完成，10.7 依用户“暂不在移动端验证”延期。下一批建议先对 renderer 的原生 SVG path 更新成本做有界隔离归因，再检查配置校验与生命周期协调中的重复逻辑；任何候选都需先验证精度/契约，再复测物理预算和完整 gzip。未提交、发布或改版本。

### 完整刻度标签缓存与连续四列几何快照（2026-10-13，均未采用）

完整标签缓存试验按轴弱引用保存最多两种指数/最高可见刻度/单位/轴侧组合，每种最多64值；域指数改变、可见最高刻度改变或单位/左右轴变化重新格式化，native字体/碰撞测量原样保留。6文件/71测试及typecheck/lint/450行通过，包含跨科学指数边界、缓存上限和原地tick/domain变更对照。360×300、8系列、10000总点compatible三对物理增量33,390,656 / 30,916,544 / 44,433,536 bytes，exit0、错误0，仍超10MB，没有证明收益。撤回两源码和新增helper/test，未为候选宣称gzip/完整覆盖率/FPS/原生验收。见axis-label-cache-verification.json及patch/原始日志。

连续Float64几何候选只改变组件私有快照存储，保留X/Y/上下误差四列、double精度、逐帧数值插值及D3路径生成；公共AnimationValue/NumericGeometry数组接口未改。10文件/236测试、typecheck/lint/450行通过，误差同步和替换端点隔离回归通过。相同物理场景三对27,295,808 / 32,964,672 / 26,148,864 bytes，exit0、错误0，仍超10MB并重叠正式范围，未证明收益。同配置/依赖/已准备WASM的递归完整gzip ESM/CJS增量12,044 / 11,862 bytes；候选产物自身增加36/31 bytes，基线漂移+2/+2，不能混为源码收益。三源码/测试逐字节恢复，未采用。见packed-geometry-verification.json及两份原始报告。

当前网格版本额外复验Oxc和不压缩两种构建，临时输出目录、工作区配置/源码/正式产物不变；同输入完整ESM/CJS增量分别12,995/11,762、17,436/17,362 bytes，exit0。较早Oxc结果仍保留其原源码范围，不说这次是首次测试Oxc；两种方式均未达10KB，不采用。见gzip-oxc-experiments.json与原脚本/日志。

已实现正式源码仍为网格节点复用版本；缓存和Float64只属于未采用的优化试验。10.4/10.5保持未完成，10.7依用户暂缓，当前完整FPS/桌面浏览器证据仍按正式指纹解释。下一批需针对布局/格式/渲染协调的真实分配或可验证的重复代码收敛继续优化，避免重复已失败候选，不缩减点数、精度、功能或调整测量预算；未提交、发布、改版本。

### 稳定变量名及仿射 SVG 投影隔离（2026-10-13，仅诊断，未采用）

Terser变量名缓存试验先从临时未压缩产物生成仅变量名缓存；基线与当前构建分别使用相同初始缓存的独立副本，初始缓存SHA一致，不压缩公共属性名。两种module设置的递归并集完整gzip结果均为ESM11,947/CJS11,737 bytes，exit0，仍超10KB。工作区配置/源码/正式产物未改，不采用；缓存、脚本、日志见gzip-name-cache-experiments.json和terser-variable-name-cache.json。

临时Vite pre-transform对不变的线条数值快照使用D3全精度基路径，并从当前默认线性比例尺计算数值矩阵，由Vue绑定路径transform及non-scaling-stroke；非双端点、clamp、自定义插值、非有限或动态几何回退原路径。固定投影oracle114组exit0，与未舍入D3最大差1.1368683772161603e-13，但与正式三位小数路径最大差0.0005000000000592308。它不是保持现行路径精度的正式候选：tasks.md任务10.1要求D3路径精度不变，当前诊断不满足；没有修改这一验收或四份specs，也不把oracle当作原生SVG几何/描边/裁剪视觉验收。

1280×720、8系列、49999总点crossfade三对物理增量43,909,184/41,615,296/37,437,568 bytes；间隔正式源码对照96,977,024/63,946,816/100,810,752；同一诊断复测47,530,048/43,941,952/42,172,480，三次命令均exit0、错误0，20次装卸任务/元素0。实际每个动画样本建16条基路径、复用1744–1944次，静态样本0，确认transform确实应用。支持本机下降方向，不宣称精确因果幅度或20MB预算通过，正式对照大幅波动完整保留。复测首对读取计数时已有8条带transform线条（开始16条）；没有断言自然完成/导出时transform清理，不把装卸资源0当作终态视觉效果均清除。

扩展隔离对动态数值几何每帧检查所有线点当前投影与矩阵结果（绝对误差<=1e-9），不满足仿射关系即回退。184组oracle包含五种曲线、动态X/Y/域、非仿射扰动及不适用比例尺，exit0，与未舍入D3最大差1.7053025658242404e-13；仍与正式三位小数路径最多相差约0.0005。360×300、8系列、10000总点compatible三对物理增量21,790,720/38,535,232/38,240,192 bytes，exit0、错误0，建8条/复用840–848次，实际数值检查最大误差5.684341886080802e-14，装卸任务/元素0，仍超10MB。此诊断未改变点数或查询/标注完整数据，但不能因代数等价就忽略原生SVG浮点/描边行为与现行精度差异，没有采用。

运行时工作区源码未改。两个诊断的报告均diagnosticOnly=true、validForBudgetAcceptance=false，正式源码/fixture/WASM SHA为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526，实际helper/server/runner的不同SHA另存affine-svg-projection-verification.json。没有候选完整覆盖率/包/gzip/FPS/原生视觉结论，正式1081测试和96场景FPS/桌面矩阵继续按正式源码解释。10.4/10.5仍未达，10.7按用户延期，未提交、发布或改版本。后续应优先找保持现行精度的布局/生命周期及重复逻辑优化，不直接采用本诊断来绕过10.1。

### 原生文字边界与延迟遮挡提交（2026-10-13，未采用）

先用 Chromium/Firefox/WebKit 各270组文字尺寸、锚点、内容与变换对照原生 getBoundingClientRect。缓存局部 getBBox 后投影不能保持原生边界：double 最大差分别0.23657、1.15278、0.09734px，因此没有采用近似边界。另810组对照确认 visibility:hidden 不改变原生文字边界，hiddenMismatches 全部0；这些是诊断，不是预算或原生Safari验收。

候选保留原生测量、字体及避让算法，先计算整次隐藏集合再提交DOM差异；文字使用visibility:hidden保留边界，线条仍display:none，边界刻度线单独处理。3文件/40测试、typecheck/lint/450行检查通过。两尺寸、兼容/淡化、三个headless引擎的120次状态观测及12组SVG截图与正式实现完全一致；小尺寸Firefox候选截图实际查看。该功能对照注入手动RAF/时钟，不测FPS；报告缺少每轮浏览器版本/构建指纹，不能事后以oracle版本补记，不能当最终组件/Demo/导出或原生Safari验收。

360×300、8系列、10000总点compatible的生产三对物理增量40,681,536 / 51,707,968 / 42,025,088 bytes，运行exit0、错误0；20次动画装卸任务/元素0、max8。结果仍超10MB且未证明收益，候选未采用，两份源码/测试逐字节恢复；恢复后3文件/40测试、typecheck/lint/450行通过，已准备WASM的正式输入SHA恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。未继续候选gzip、完整覆盖率、包、FPS或原生验收；正式完整1081测试及96场景FPS/桌面矩阵仍仅按其原指纹解释。原始oracle、probe、patch、日志、报告指纹见evidence/visibility-layout-verification.json。

本轮新增的是诊断证据与实施记录，没有新增已交付运行时优化。10.4物理预算和10.5完整gzip预算仍未完成；10.7依用户“暂不在移动端验证”延期。后续规划是重新按renderer原生分配定位可保留精度的优化，再收敛配置/生命周期重复逻辑并复测完整gzip；不重复已失败候选，不改规格/版本，不提交或发布。

### 预计算兼容性与私有过渡对象复用（2026-10-13，均未采用）

先通过 CodeGraph 定位配置/协调模块，发现组件 transitionTrack 每帧重复扫描端点 X 判定几何兼容。首个候选把判定移至一次性过渡工厂，保留插值、淡化、锚点及域计算；连续替换先取消旧时间线，固定端点不再随其旧帧变化。新增三项回归覆盖端点扫描次数、几何/锚点/域同步、淡化两份及终态单份、下一次计划重新判断、被替换半程端点不变。首轮新增测试对getter次数预期错误，实际三次而非四次；改为比较稳定后续帧的读取增量后3文件/49测试通过，原失败日志保留，不把首次运行记通过。typecheck/lint/450行均通过。

360×300、8系列、10000总点compatible生产三对物理增量45,105,152 / 32,063,552 / 31,883,392 bytes，exit0、错误0；同配置/依赖/已准备WASM递归完整gzip ESM/CJS增量12,035 / 11,855 bytes。相对正式报告，实际产物增加24/21bytes，基线同时漂移-1/-1，不能把增量变化全归为源码收益。未达到任一预算，未采用。

第二变体在同一私有时间线内复用系列Map、系列展示对象、锚点Map/对象；逐帧只更新数值、透明度和展示域，终帧仍返回目标单份，真实查询/公共帧对象/点数/D3精度不变。3文件/49测试及typecheck/lint/450行通过。相同生产场景三对物理增量36,831,232 / 37,978,176 / 44,400,512 bytes，exit0、错误0；完整gzip ESM/CJS增量12,053 / 11,872 bytes，实际产物增加45/41bytes、基线漂移+2/+2。也未证明预算收益，未采用。两候选20次动画装卸任务/元素0、max8；资源0不能代替自然峰值预算或视觉终态证明。

两个运行时源码逐字节恢复，新候选测试移至evidence文本，未留下生产重构。恢复后2文件/46相关回归通过；其他恢复门禁及指纹见transition-planning-verification.json。两个构建在临时目录完成，未覆盖正式dist或gzip-results.json。不为未采用候选宣称完整覆盖率、包消费、FPS、组件/Demo/导出或原生矩阵验收。原始报告、patch、探针、测试及成功/失败日志均保留。

正式已交付运行时仍是网格节点复用版本。10.4/10.5继续未完成；10.7按用户暂缓。下一批规划应继续针对原生renderer分配和可复现的包体重复代码，不再重复此次兼容性/私有对象复用试验；不改规格、点数、阈值、版本，不提交或发布。

### 完整自然观测窗与逐次装卸物理样本（2026-10-13，测量工具已实现，预算未通过）

审阅原v3测量发现其固定6次样本常在2秒动画结束前开始强制GC，且20次装卸物理样本只保存每场景第一对。现v4扩展到挂载返回后至少duration+100ms并观察任务归零才结束自然采样；窗内无强制GC。每次运行均记录settled GC留存、20次装卸后未经GC和GC后的物理样本，保存footprint采样时间及runner SHA；不会把GC后值替换自然峰值。旧v3原始报告保留，v4不与它们直接比较推断优化收益。它仍是挂载完成后的离散采样峰值，不证明挂载中或采样间的真实最大值；包括SystemInfo所列browser/renderer/GPU/network进程，不包含无法归因到这些进程的驱动/系统分配。

归因器支持历史v3；对v4核验观测时长、采样时间顺序/范围、终态任务0及每次装卸前后样本/资源。新增7项CLI回归验证相同总峰值进程分账、峰值与GC值分离、历史版本不暗示完整窗，以及短窗、未settle、缺少装卸样本、错误峰值和未完成报告拒绝。与gzip核算测试共2文件/10测试通过，typecheck/lint/450行及node语法检查通过。只有脚本和脚本测试改变，库运行时未改，正式已准备WASM输入SHA仍8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；此前完整1081测试、包/FPS/原生桌面证据保留其实际源码范围，本轮不重复声明这些门禁重新运行。

v4首两组各三对、exit0/错误0：360×300/8系列/10000总点compatible增量35,438,848 / 37,093,440 / 43,253,824 bytes；1280×720/8系列/49999总点crossfade增量84,590,720 / 87,359,488 / 87,490,560 bytes。严格归因exit0，主要增量来自renderer，GPU/browser/network差值小；均超预算。10000兼容组settled强制GC后的配对物理增量约3.47–3.82MB，装卸后GC约3.47–5.65MB，不能以这些留存数字代替35–43MB自然峰值。

另起独立完整12场景（两尺寸×10000/49999×入场/兼容/淡化）、36成功对，命令exit0，72成功浏览器运行覆盖2109–2355ms且末尾任务0。每次20循环任务/根元素0，所有循环后GC DOM计数回到各运行挂载前基线。只有7对低于对应预算、29对超标；小容器入场两场景三对均低于目标，八个更新/淡化场景全部超标，不扩大为预算通过。完整报告保留桌面49999compatible的1次enabled=true、warmup-2-mount execution context destroyed失败尝试，初始导航后无其他记录导航、pageErrors0；归因器按原严格规则exit1拒绝，未删失败或绕过。

独立复测这个出错场景，三成功对65,617,984 / 63,144,064 / 52,559,936 bytes，命令exit0；但enabled=false、warmup-2-mount又发生1次同类失败，重试后完成，严格归因同样exit1。它不能证明异常修复，不拼接为完整无错误报告。成功数值依然超20MB，错误/phase/stack/导航列表原样保留。完整数据的描述性汇总明确diagnosticOnly=true、validForBudgetAcceptance=false；峰值、settled及循环前后GC分列，不将新数据改变成已完成10.4。

本轮已实现的是完整窗测量及逐运行装卸证据/核算回归；性能/包体优化仍规划。10.4内存、10.5完整gzip保持未完成，10.7按用户暂缓。下一批先捕获Runtime执行上下文生命周期与renderer进程变化，定位重复的第二次静态预热异常；再独立试验不改变精度/裁剪的SVG合成层，验证原生视觉、物理峰值及完整gzip。未提交、发布、改版本或缩减规格。原命令、exit码、runner/probe指纹、四份报告及限制见physical-memory-full-window-verification.json。

### 上下文生命周期、SVG 合成层与压缩格式复测（2026-10-13，诊断及未采用候选）

生命周期诊断在导航前订阅Runtime/Page事件，并在每次静态预热前增加SystemInfo查询。30个全新Chromium浏览器、90次49999点预热均成功，未观察到预热中的上下文销毁、导航或崩溃，exit0；额外协议调用改变时序，不能证明此前完整物理报告的间歇失败已修复。未改生产测量器，旧失败记录继续保留。见context-events-summary.json。

SVG合成层初试发生实现错误：字符串全局替换污染了overlay选择器，改变pointer/cursor策略。该初试物理及LayerTree数据无效，不作为优化证据；原patch和日志保留。修正后仅在原SVG规则后添加一次动画class，恢复全部overlay规则。57项相关测试及typecheck/lint/450行均exit0；三个headless引擎两尺寸兼容/淡化120次标签/网格状态观测、60次class生命周期检查及60个CSS模式样本一致，共204条检查、错误0。CSS模式是样式模拟，不是公共平移交互；注入手动时钟，不测FPS。12组SVG截图8组逐字节相同，4组Chromium存在轻微像素差，最大通道差4，不能说截图全部一致。

修正候选LayerTree静态无SVG节点层、动画task8时有、SVG导出task0后消失；浏览器返回RootScroller/OverflowScrolling原因，没有明确3D-transform原因。总层数4/6/5，不据此声称导出后全部资源等于静态。生产v4小尺寸10000点compatible三对物理增量36,716,736 / 34,422,976 / 43,253,824 bytes，运行及严格归因exit0、错误0，仍超10MB，未证明收益，候选撤回。未为候选运行完整覆盖率、包、gzip、FPS、原生Safari或Demo验收。四源码逐字节恢复；恢复后先3文件57测试，再typecheck/lint/450行均exit0。证据及原始文件SHA见compositing-verification.json。

临时同配置/依赖/已准备WASM构建四种压缩变体，递归并集包含CSS及额外输出：不混淆变量名ESM/CJS增量15,125/14,961bytes，仅局部变量名12,009/12,230，换行分隔12,021/11,838，格式化但保留压缩/混淆14,198/13,982。均超10KB，未采用，正式配置/dist/gzip-results不改；1byte差异不构成已验证源码收益。见gzip-name-format-experiments.json。

正式实现仍为网格节点复用版本，10.4/10.5保持未完成；10.7按用户决定暂缓。下一批规划优先验证原生实时CSSStyleDeclaration弱引用复用能否保持样式变更语义，再决定是否形成物理预算候选；尚未实现或证明收益。不改规格/版本，不提交或发布。

### 实时 CSS 声明、原生分账及跨帧 DOM 查询复用（2026-10-13，诊断及未采用候选）

三个headless引擎Chromium141.0.7390.37、Firefox142.0.1、WebKit26.0对text/line共60次检查：既有CSSStyleDeclaration随属性、内联、继承、样式表插入/删除、媒体查询、移除/重连同步，差异0。它不是全部CSS环境/原生Safari验收。候选弱引用复用声明而非数值，保留原生文字边界读取；jsdom不实现实时声明，两项窄测试显式提供标准实时getter，不改全局测试支撑。3文件34测试通过；候选typecheck/lint/450行日志无诊断，顺序shell最终exit0，但早期各命令退出码未单独保留，不能补造。原生手动时钟144次标签/网格/样式/截图检查，12组SVG PNG逐字节相同，不测FPS。生产v4物理增量37,830,592 / 35,569,664 / 39,960,704bytes，运行/严格归因exit0、错误0，仍超10MB，未采用。源码和测试恢复，恢复后32测试及各自typecheck/lint/450行exit0。见live-style-verification.json。

正式恢复源码的两个全新Chromium浏览器分别静态/启用动画，用Tracing memory-infra详细dump记录baseline、挂载后、400ms后、自然settled。所有dump成功，动画中间task8、末尾task0；自然阶段不强制GC，仅基线GC。Blink GC静态1,753,088→6,815,744bytes，动画1,753,088→25,296,896；V8静态7,120,876→26,231,796，动画7,137,260→39,564,244。分账路径互相重叠，不能相加，也不等于物理footprint。单对且Tracing改变时序/开销，不作为预算或因果证明；没有保存同时构建输入SHA，不事后补记为正式验收。原始trace字节SHA、chronological phase mapping及局限见native-memory-dump-summary.json；trace id从0开始，CDP请求GUID从1开始，按顺序对应，未直接假设id相等。

第二候选弱引用保留跨帧选择器结果，MutationObserver在元素增删/选择器归属属性变化时失效；同步takeRecords和异步回调两种情况均覆盖，文字内容变化不重新发现节点，坐标/样式/原生边界仍每次读取。新增回归验证网格vertical/horizontal切换、line替换、tick标记变化以及双SVG隔离，既有插入/移除/坐标移动回归保留。3文件34测试及typecheck/lint/450行各自exit0。三个headless引擎144次手动时钟状态/样式对照无快照错误，12组截图10组逐字节一致，两组Firefox桌面有差异（compatible 29,662像素最大通道差149，crossfade 11,299像素最大差58），实际查看compatible两张，未解释差异，不宣称完整视觉一致或FPS验收。

该候选生产v4三对物理增量33,767,488 / 44,908,544 / 35,078,144bytes，运行/严格归因exit0、错误0，仍超10MB，未证明收益。撤回两源码/测试变更和新增helper，patch/源码/原始日志保留，见collision-discovery-verification.json。未追加候选gzip、全套coverage、包、Safari、Demo或导出验收。正式实现仍是网格节点复用版本；本批增加的是诊断证据，没有新增已交付运行时优化。

10.4/10.5未完成，10.7按用户暂缓；不改规格、精度、点数、阈值、版本，不提交或发布。下一批规划应直接检查逐帧路径属性更新的Blink原生对象分配/生命周期，避免再次把DOM/CSS缓存当作预算收益；包体仍需有实际可验证的功能等价重构，此处没有提出已实现的压缩改善。

本批全部候选恢复后，先运行3文件32相关测试，再逐个typecheck/lint/450行检查，均exit0；OpenSpec strict/status和git diff --check通过。已准备WASM输入SHA恢复8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；仅恢复任务生成WASM后输入SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c。未变化正式运行时不重复全套coverage/包/FPS/桌面矩阵，不把旧结果写成本轮重新运行。

### 原生变换精度及 Blink 池化容量澄清（2026-10-13，仅诊断，未进入生产候选）

先核对历史实验：冻结线条d写入和跳过路径计算已经做过，未证明它们是主要物理来源，本批不重复。此前native-memory-dump中Blink size应解释为堆容量，不能写成存活对象大小。动画settled主线程Blink committed_size为24,510,464bytes，pooled_size为16,121,856，allocated_objects_size为6,709,208；静态对应6,029,312 / 393,216 / 1,500,376。字段重叠，不能相加或从物理预算扣除；fragmentation单位是objects，不能误读bytes。仅原始trace的离线再解释，无新的物理测量或分配类型归因。见native-memory-dump-pool-analysis.json。

新隔离对照检查复用SVGTransform/setTranslate是否与原transform字符串解析一致；没有修改正式源码。Chromium141.0.7390.37、Firefox142.0.1、WebKit26.0每引擎144组矩阵/原生文字边界检查，分别23/0/23项差异，命令exit1。极大坐标123456789在Chrome/WebKit字符串解析成123456784，IDL浮点转换成123456792；部分原生文字边界也不同。第二次固定seed=42的随机矩阵对照每引擎20000组，分别9299/115/9331项差异，exit1；普通小数坐标也存在反例，不能仅按极大坐标回退就声称精度相同。随机对照只检查矩阵，不扩大为20000组原生边界/视觉验收。

直接native setter替换在生产候选前即被否决，未减少精度或修改规格；没有候选物理/gzip/FPS/包/Safari/Demo/导出验收，也没有加入公共接口。原始成功/失败判定、probe、文件SHA见svg-native-transform-verification.json。另一种由离屏SVG解析后再写数值的路径仅准备了临时oracle脚本，尚未执行或实现，不能宣称它保留语义或减少分配。

正式5文件34项测量/几何/轴相关测试先运行通过，随后typecheck/lint/450行分别exit0。为解决先前完整v4矩阵保留失败尝试、严格归因拒绝的问题，启动同正式源码、同v4方法的独立12场景复测，原报告和全部失败记录继续保留；在它实际结束前不记录为通过，不合并报告、不称间歇失败已修复。

随后完成离屏原生SVG解析再setTranslate的隔离对照：每引擎144组矩阵/文字边界以及20000组随机矩阵均差异0，两命令exit0。它仅保持实时数值，序列化后的字符串仍需验证。原生getter字符串重新解析的144组对照，每引擎均108组矩阵差异，exit1；直接复制它进入生产并不足以保留终态序列化精度。这不是正式图表导出已发生的回归（源码未改），也没有实际执行组件导出验收。未实现候选；只在动画中的展示比例尺上采用原生变换、终态/导出恢复原始字符串是下一批规划，必须另行实现并验证，不能把单独实时oracle通过当作导出契约闭合。原始报告/probe见svg-native-transform-verification.json新增parsedAlternative。

独立正式v4完整12场景复测已实际结束，运行及严格归因均exit0，36对/72浏览器运行、失败尝试0，采样窗2105–2427ms、末次任务0、20次装卸任务/元素0。7对低于预算、29对超过预算，八个更新/淡化场景的24对全部超标；本次桌面10000点入场3对也略超10MB。见memory-full-window-v4-formal-repeat12-summary.json及原始报告。它补足独立无错误完整矩阵及可通过归因的数据，不证明之前上下文销毁已修复；旧两份带失败报告原样保留，不拼接数据或移除错误。相同正式源码/runner指纹分别为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526 / f0c302754e529ea9a263efbffc200fa4460f919c175c098222a36be10a63d35c，不把跨报告波动写成优化收益。

正式运行时与构建配置未改，10.4物理预算和10.5完整gzip预算仍未达到，10.7按用户暂缓。本批增加完整复测和精度/池化诊断；全套coverage/包/FPS/原生桌面证据仍按此前实际源码范围解释，不写成本批重新运行。不改规格、版本，不提交或发布。下一批应验证展示期变换复用与终态字符串恢复能否同时保留实时/导出语义，再决定是否进行物理候选；该方案目前仅规划。

### 展示期原生轴变换与终态字符串恢复（2026-10-13，未采用）

本批实施私有候选：仅为临时复制域比例尺加WeakSet标记，轴渲染在展示期通过离屏SVG原生解析目标字符串，再更新既有SVGTransform；真实比例尺走原字符串渲染。自然终态和导出commit恢复真实比例尺，从而恢复完整原始刻度字符串。解析节点由轴弱引用拥有，静态渲染删除解析节点缓存，避免Document持有长期解析节点；没有新增公共类型/导出或引擎DOM写入。新增两项回归覆盖临时域不改变真实比例尺、终态精确字符串恢复以及缺少原生API时普通字符串回退。5文件63测试及typecheck/lint/450行各自exit0。

第一轮加入波形path的组合原生快照，在Firefox桌面compatible进度0失败，exit1；详细失败快照未落盘，不能证明具体字段或根因，初次probe、部分报告和日志保留。另一个受控oracle先调用SVG导出稳定初始采样，再启动数据更新，两版本执行相同步骤；不能把它当成原始性能fixture或宣称修复初次问题。收紧轴节点所有权后，尝试用逗号/空格判断原生执行次数又在Firefox误报未执行，exit1；改为临时直接计数后确认Firefox确实调用了原生setter，原无效计数失败日志保留。

最终受控生产oracle为Chromium141.0.7390.37、Firefox142.0.1、WebKit26.0，两尺寸兼容/淡化共192检查、快照错误0：波形d/透明度、标签边界/可见性、网格一致；12组SVG截图逐字节相同，小尺寸Firefox候选图已实际查看。每引擎四页面在500ms时实际原生调用96/240/96/112次，自然终态累计144/360/144/168次，证明候选执行，不是仅测试回退。12对最终SVG刻度transform字符串和波形路径完全一致，48次SVG/PNG导出返回成功、末尾task0；PNG导出仅核验receipt，没有比较导出PNG像素。此oracle注入手动时钟/RAF及临时计数，不测FPS、不算原生Safari、Demo、完整设备矩阵或包验收。探针/源快照/patch及scope见native-axis-owned-verification.json。

之后用未改变的生产benchmark和v4物理运行器测量，没有初始SVG导出稳定步骤或计数。360×300、8系列、10000总点compatible三对增量34,144,256 / 31,457,216 / 34,766,912bytes，命令及严格归因exit0、错误0，仍超10MB并重叠正式范围，未证明收益。20次装卸任务/元素0、max8；各自GC后DOM counters回到baseline的documents1/nodes28/listeners14，仅说明这些观测，不证明无泄漏，也不能代替自然峰值。候选撤回，两原源码逐字节恢复，两新增helper及新测试归档为evidence文本；没有候选gzip/全套coverage/包/FPS/原生Safari或Demo验收。

恢复后先4文件61相关测试，再typecheck/lint/450行检查，各自exit0。正式实现仍是网格节点复用版本，完整无错误v4复验及96场景FPS/桌面矩阵保留各自正式源码范围，不写成本批重新运行。10.4物理预算和10.5完整gzip预算仍未完成；10.7按用户暂缓。不改规格、精度、点数、阈值、版本，不提交或发布。本批交付的是实验/验证记录，没有新增正式运行时优化。下一批规划应转向配置/生命周期重复逻辑的可证明等价收敛，不继续以更多DOM缓存或原生变换层假定能达到预算。

### 共享数值遍历与数组隔离回归（2026-10-13，候选撤回，测试已实现）

将普通数值遍历与组件私有几何缓冲收敛为同一递归遍历，保持端点分支/凸组合及有限性检查，公共帧仍分配新数组，私有缓冲复用。初版使用 undefined 初始化几何通道导致 typecheck exit2；该版本的 gzip 报告独立保留，不作为已验证代码。修正为 own 属性空数组初始化后，10文件238测试及 typecheck/lint/450行分别exit0，原型命名通道不触发对象 prototype setter。

修正版本同配置/依赖/已准备WASM三临时构建，完整递归并集包括CSS及所有额外chunk：正式ESM/CJS增量12,011/11,834bytes，候选11,996/11,806bytes；同次候选产物仅减少15/28bytes。正式数字与历史12,010/11,833相差1byte，属于基线/构建差异，不宣称为源码收益。原始旧报告与新报告均保留，未覆盖正式dist/config/gzip报告。

未改变的生产v4测量器在360×300、8系列、10000总点compatible场景完成三对，物理增量34,357,184 / 36,094,080 / 35,356,672bytes，运行及严格归因exit0、失败尝试0，仍全部超10MB，没有证明预算收益。自然观测窗2104–2354ms、末尾任务0；自然窗不强制GC，另列settled及20装卸前后GC样本。它仍不覆盖挂载中/采样间未知最大峰值，不用GC留存替代物理预算。

候选两份生产源码逐字节恢复，patch、源码、探针及全部日志归档。保留两项有独立价值的回归，验证公共帧与后续帧/输入数组隔离，以及私有缓冲行复用、own **proto** 通道和输入端点不变；它们在正式实现上通过。恢复后先10文件238测试，再完整133文件1090测试覆盖率、typecheck/lint/450行分别exit0。总体L/S/F/B为93.51/91.57/92.81/86.45%，核心98.99/98.10/98.26/95.94%；不宣称候选通过完整覆盖率、FPS、包消费、原生Safari/Demo或导出验收。

正式运行时仍为网格节点复用版本，10.4物理预算、10.5完整gzip未完成，10.7用户暂缓。不改规格、精度、点数、阈值、版本，不提交或发布。已实现的是回归测试及验证记录，预算优化仍待完成；下一批应选取能消除实质重复的配置/生命周期边界，并在同次对照确有收益后再运行完整门禁，不以这15/28bytes标记目标完成。证据见shared-numeric-verification.json。

本批 OpenSpec strict/status、文档格式与 git diff --check 通过。仅恢复任务生成的两份 tracked WASM，正式输入指纹恢复 8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c；已准备WASM正式指纹仍为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。构建/包消费/96场景FPS/原生桌面矩阵未在本批重跑，沿用旧证据的实际范围。

### 预检快照收敛与原生分配调用栈（2026-10-13，未采用候选及诊断）

CodeGraph 及产物确认动画类使用原生私有字段，没有可移除的兼容层。控制器预检已复制轨道端点，随后又复制一次；候选复用 group-aware 预检的轨道副本，但保留原始 loop/配置字段，并在旧回调后重新校验管理器属性组。新增预检副本隔离、零初始化/调度与布尔无限循环回归，10 文件 / 240 测试通过。候选未运行 typecheck/lint/450 行或完整门禁，不能称已静态验收。

同配置、依赖及已准备 WASM 三临时构建：正式 ESM/CJS 完整增量 12,008/11,832 bytes，候选 11,991/11,816 bytes，同次候选产物只减少 17/16 bytes。基线微小漂移不算源码收益，递归并集包含 CSS 和全部额外 chunk。收益不足以扩展辅助 validate 的返回接口，候选撤回；管理器、控制器、测试逐字节恢复，README 试验说明撤回。patch、源快照、测试和原始 gzip 报告保留。恢复后先 10 文件 / 238 测试，再 typecheck/lint/450 行，各自 exit0。见 preflight-snapshot-verification.json。

原生调用栈诊断先使用默认 Playwright 启动、memlog=all/native-with-thread-names、16KiB 采样及 page CDP Memory 域。静态/动画四阶段均返回空样本，trace 无 heaps_v2，不能解释为零原生分配。切换到同版本完整 Chromium 可执行文件后取得非空样本。另一次 browser-level CDP 启动诊断报 Memory.startSampling 不支持（exit1）；正确采样使用 page session。完整 Chromium 探针首次因 self-hash 文件名重复 full 后缀在启动前失败，修正后独立成功运行；记录生成器的 UTF-8 错误及首次格式检查缺失报告也保留。未猜测默认 shell 空样本的根因。

完整 Chromium 141.0.7390.37 两次新浏览器生产 fixture 运行完成，八次 detailed dump 成功，页面错误0，动画 active 任务8、settled0。page Memory 采样估计静态 baseline/挂载后/active/settled 为 163,840/4,947,968/4,866,048/4,866,048 bytes；动画为 229,376/11,747,328/10,174,464/9,699,328 bytes。这是采样分配估计，不是 footprint 或全部存活 GC 对象，不用于物理预算；完整 Chromium 诊断不同于正式 headless-shell 环境，Tracing/采样改变时序和开销，不能跨报告推断优化效果。

trace 的 heaps_v2 来自 browser/GPU/network/storage/tracing 服务，没有 renderer 堆快照；renderer 数值仅来自独立 page Memory 域。已知模块地址按偏移归一化，未知/JIT 地址保留。atos 只得到最近导出 ChromeMain 及偏移，不能精确归到函数或对象类型；未将最近符号当真实调用点，不相加重叠 allocator 字段。完整原始 trace 经 gzip 无损归档，逐字节 round-trip 与原始/归档 SHA 均核验。浏览器 stderr 的 GCM 注册错误保留，pageErrors0 仅指页面错误。见 native-stack-profile-verification.json、native-stack-profile-analysis.json 及无损归档清单。

本批新增原生采样证据和未采用候选记录，正式运行时不变，10.4/10.5 未达标，10.7 用户暂缓。未运行候选物理/FPS/完整 coverage/包/Safari/Demo/导出或移动验收；不改规格、点数、精度、阈值、版本，不提交或发布。下一批可利用完整 Chromium 的非空样本进行保留功能的分配路径对照，但须取得具体符号或建立受控因果证据，不从未解析 PC 直接写优化结论；包体仍需实质的等价收敛。

### ASCII 路径解码对照（2026-10-13，候选撤回，长路径回归已实现）

候选保持完整 D3 line/curve、坐标三位精度和点数，只将私有 Uint8Array 的惰性 TextDecoder 解码改为每块 8192 字节的 String.fromCharCode。新增五种线型的 10000 点精确 D3 对照，覆盖超过 65536 字符的长路径、冻结点对象及同一数组缩至单点后的无残留输出。候选 2 文件 / 53 测试、typecheck、lint、450 行及局部格式检查均 exit0。

同配置/依赖/已准备 WASM 三临时构建的递归并集包含 CSS 和全部额外 chunk：正式 ESM/CJS 增量 12,004/11,826 bytes，候选 12,028/11,854 bytes，同次产物增加 24/28 bytes。继承探针的 accounting 文案误写两文件，已更正为实际仅虚拟恢复 pathBuffer.ts；数值未改，探针原文保留。

生产 v4 物理测量在 360×300、8 系列、10000 总点 compatible 场景完成三对/六次运行，增量 38,780,992 / 65,323,136 / 43,548,800 bytes，全部超过 10MB。运行及严格归因 exit0、错误0；自然观测窗 2114–2377ms、终态任务0，20次装卸后任务/元素0、动画 max8。自然窗未强制 GC，另存终态及装卸 GC 前后样本；离散采样仍不覆盖挂载中或采样间未知最大值，不将 GC 留存作为预算。没有证明 TextDecoder 原生调用是内存根因或候选带来预算收益。

运行时代码逐字节恢复，保留五项回归，patch/源/测试/探针及全部日志归档。恢复后先 10 文件 / 243 测试，再完整 133 文件 / 1095 测试覆盖率，全部通过；总体 L/S/F/B 为 93.51/91.57/92.81/86.45%，核心为 98.98/98.09/98.26/95.94%。候选未运行完整 coverage/包消费/FPS/原生 Safari、Demo 或移动验收，正式运行时仍为网格节点复用版本；旧完整矩阵保留各自源码范围。

已实现的是五项长路径回归及对照证据，10.4 物理预算、10.5 完整 gzip 仍待实现/验收，10.7 依据用户“暂不在移动端验证”暂缓。下一批规划应先建立 renderer 分配路径的具体因果对照，以及配置/生命周期逻辑的实质等价收敛；不继续假设解码、缓存或未解析原生 PC 就能解决预算。见 ascii-decode-verification.json。不改规格、精度、点数、阈值、版本，不提交或发布。

恢复后 typecheck/lint/450 行检查各自 exit0。

本批记录格式、OpenSpec strict/status 和 git diff --check 通过；status 4/4 仅表示规划文档齐备。仅恢复任务生成的 tracked WASM 两文件，运行时输入指纹恢复 8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c；其余既有改动保留。

### CSS 平移与系列 SVG 视口（2026-10-13，诊断及候选撤回）

未重复此前缓存/原生 transform 候选。先在 Chromium 141.0.7390.37、Firefox 142.0.1、WebKit 26.0 比较 SVG transform 属性和行内 CSS 平移，24 个矩形/样式检查中，12 个宿主 CSS 覆盖检查全部不等价；Chromium 另有一项边界高度微小差异。行内 CSS 改变作者样式优先级，不能作为兼容替换，因此未改生产轴源码，也未测此诊断的性能。

系列视口候选仅把绘制层容器 g 改成同尺寸 SVG，overflow=visible，保持数值坐标、D3 路径、裁剪和点数。首个相关命令包含不存在的 rendering.test.ts，因此实际只有 2 文件 / 38 测试；随后针对正确 renderingStyles.test.ts 补跑 1 文件 / 4 测试通过。候选 typecheck/lint/450 行检查通过。

受控生产对照在三个 headless 引擎、两尺寸、兼容/淡化中共 192 条检查，路径/透明度/路径原生 client rect/标签边界与可见性/网格一致，快照错误0，12组SVG视口截图逐字节一致；小尺寸Firefox候选图已查看。48次SVG/PNG导出receipt成功、终态task0，最终SVG刻度transform字符串与波形路径一致；未比较导出PNG像素。此fixture注入手动clock/RAF并先用SVG导出稳定初始采样，不是原生Safari、Demo、入场/点和误差符号/指针查询/FPS或完整候选验收。探针/server SHA、每轮引擎版本及实际构建输入均保存于 series-viewport-layout-browser/comparison.json。

之后使用未修改的生产 v4 runner，按候选→正式→候选复测顺序独立构建/启动，360×300、8系列、10000总点compatible各三对：首轮候选 27,901,952 / 28,442,624 / 29,737,024 bytes；正式对照 35,209,280 / 34,209,792 / 28,573,824；第二轮候选 36,896,768 / 33,177,664 / 22,626,432。三份报告运行和严格归因exit0、错误0，所有九对超过10MB。复测范围重叠，首轮低值不能证明稳定物理改善；没有采用候选。自然窗与20装卸逐运行样本完整保存，GC后留存不替代自然峰值，离散采样仍不覆盖挂载中/采样间未知最大值。

候选运行输入SHA为527600c552724079e9a3bc469b569183c4ae149f468ce3446925fcfe8c558591，正式对照为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526。候选源/patch、原始报告/脚本/日志保留；系列层逐字节恢复。gzip探针仅准备，未执行；未运行候选完整coverage/包/FPS/原生Safari或Demo/移动验收，不扩大历史正式证据的范围。

本批已实现的是受控等价检查、两轮候选及同期正式物理对照证据；没有新增正式运行时优化。10.4物理预算、10.5完整gzip仍未完成，10.7按用户暂缓，不勾选。下一批仍需取得具体renderer分配路径的因果证据并寻找实质包体收敛；CSS优先级不等价和SVG视口不稳定收益已排除，不重复这两条候选。不改规格、精度、点数、阈值或版本，不提交或发布。见 series-viewport-verification.json。

恢复后先3文件/42项相关测试，再typecheck/lint/450行，各自exit0；正式运行时仍为网格节点复用版本。本批未重复未改变运行时的全套coverage/构建/包/FPS/原生桌面矩阵，既有结果保留原范围。

本批记录格式、OpenSpec strict/status及git diff --check均通过；status4/4仅表示规划文档齐备。仅恢复任务生成的两份tracked WASM后输入SHA为8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余工作区改动保留。

### 终止与分类关闭编排收敛（2026-10-13，候选撤回，回归已实现）

CodeGraph 和调用点确认 AnimationTask.settle 的延迟通知只由 Animator 替换事务使用，控制器 private bulk 的 finish/commit 标志始终成对。首版将 task 终止统一为分离后由调用方执行通知、移除关联 commit 标志，复用累加初始零偏移。新增回归验证延迟的二维累加任务在首帧前取消、重复取消仅通知一次、后续任务从剩余普通轨道终点派生，输入数组不变且终态与任务清理正确。首版10文件/244测试以及typecheck/lint/450行通过。

同配置/依赖/已准备WASM三临时构建的递归并集包括CSS和全部额外chunk：正式ESM/CJS完整增量12,013/11,836bytes，首版12,003/11,831bytes，同次产物仅减少10/5bytes。另四个虚拟源码子集构建使用该次同一formal/baseline产物：单独终止路径减少17/11、单独commit标志减少3/3、初始零值复用增加7/8、终止+commit减少18/12bytes。虚拟子集未各自执行测试/静态验收，不能写成四个已验收优化；不把绝对基线漂移当源码收益。

进一步恢复原初始零值，移除settle已涵盖的重复ended守卫，提取四个分类关闭watcher的共同流程，保持注册顺序、谓词、提交函数及入场关闭后标注释放时机；没有扩展公共接口。11文件/255测试、typecheck/lint/450行通过。另一次同配置三构建正式完整增量12,006/11,830、候选11,995/11,835bytes，同次ESM减少11bytes而CJS增加5bytes。没有解决完整<10KB预算，也没有候选物理收益证据，运行时全部撤回。

五份运行时源码逐字节恢复，新增行为回归保留；首版/收敛版source、patch、测试、探针及日志完整归档。恢复后先11文件/255测试，再全套133文件/1096测试覆盖率，各自exit0；总体L/S/F/B为93.51/91.57/92.81/86.45%，核心98.98/98.09/98.26/95.94%。未运行候选完整coverage/包/物理内存/FPS/原生Safari或Demo/移动验收，不扩大既有正式证据的源码范围。见terminal-consolidation-verification.json。

本批已实现的是回归及配置/终止编排的等价对照证据；未新增正式运行时优化，10.4物理、10.5完整gzip预算仍待完成，10.7依用户暂缓。不改规格、精度、点数、阈值或版本，不提交或发布。下一批规划应检查轴post-flush watcher中额外nextTick是否可在保证Vue DOM更新/字体及卸载时序后消除，并建立当帧轴/网格/路径原生对照；这是尚未实施的假设，须先相关回归再测物理预算，不能从少一个Promise直接推断收益。不重复此次仅减少几个字节的终止/分类候选。

恢复后typecheck/lint/450行检查各自exit0，正式运行时保持原网格节点复用版本。

本批文档格式、OpenSpec strict/status和git diff --check通过；status4/4仅表示规划完整。仅恢复任务生成的tracked WASM两文件后，输入SHA恢复8050329df79b38bc09744f1989c8baee1b1d56dfb918803f425652902a9f024c，其余既有工作区改动保留。

### 轴 post-flush 时序对照（2026-10-13，候选撤回，三项回归已实现）

尝试移除轴 mounted/post-flush watcher 内额外 nextTick，保留字体监听与遮挡检查。原正式实现也通过三项新增生命周期回归，因此没有证明卸载后 formatter 的既有缺陷；中间 disposed 守卫在最终候选验证前撤回。新增测试覆盖立即卸载、DOM patch 后显示轴使用当前比例尺/formatter、字体 ready/loadingdone 重测并在卸载后停止。首版 fixture 缺少 waveform-track 导致三项未捕获错误、exit1，已修复并保留失败日志。

候选五文件/41测试、typecheck/lint/450行通过。三个引擎两尺寸兼容/淡化受控对照192检查、错误0，12组SVG视口截图逐字节一致，48次SVG/PNG导出receipt成功；未比较导出PNG像素。手动时钟/RAF及初始SVG导出用于稳定采样，此结果不替代原生Safari、Demo、入场或FPS验收。

未修改的生产v4 runner在360×300、8系列、10000总点compatible完成三对物理测量，增量33,570,880 / 34,783,232 / 29,081,728bytes，均超过10MB；严格归因exit0、错误0，窗口2121–2380ms，终态任务0、20次装卸任务/元素0。离散自然峰值不覆盖挂载中/采样间未知最大值，GC后留存不替代预算。同配置三构建正式完整gzip增量12,005/11,828bytes，候选11,992/11,818bytes，同次产物仅减少13/10bytes，仍超10KB。未证明物理预算收益，轴运行时逐字节恢复。

保留三项测试，恢复后五文件/41测试通过；全套134文件/1099测试覆盖率通过，总体L/S/F/B为93.51/91.57/92.81/86.47%，核心98.98/98.09/98.26/95.94%。最终测试区间断言改为不依赖DPR的坐标差；typecheck发现其SVG属性可能undefined（exit2），补测试非空断言后重跑相关测试、typecheck/lint/450行，各自exit0。全套coverage在最后非空断言前执行，不声称此后再次全跑。

本批已实现三项回归和候选对照证据，正式运行时未新增优化。10.4/10.5未达标、10.7按用户暂缓。未运行候选完整coverage/包消费/FPS/原生Safari或Demo/移动验收。下一批规划先建立具体renderer DOM wrapper分配与Blink留存池的因果归因，再寻找足以弥补约2KB差额的等价包体收敛；这些尚未实施，不能从少一个Promise推断预算收益。不改规格、精度、点数、阈值或版本，不提交或发布。见axis-postflush-verification.json。

### V8 / DOM 包装对象留存诊断（2026-10-13，仅诊断）

前批三项回归及证据收尾属于实际进展。本批不重复仅几个字节的配置/生命周期候选；CodeGraph检查当前配置校验调用路径，随后对正式网格节点复用生产源码进行两个独立Chromium141.0.7390.37场景（静态/动画，360×300、8系列、10000总点compatible）。每组3次静态预热，baseline/active-request/settled/20次装卸后共八份CDP堆快照。输入SHA为8d45e77744f2b5ca2b3b35591eeb0c809c2f2f28f8bad957f0dec0e79722a526；快照触发GC及执行暂停，不属于自然物理峰值/FPS/预算验收。

动画active-request快照前后task8，settled为0，20装卸task/element0、max8；静态各阶段task0。两组页面及运行错误0。挂载后的SVG元素包装对象清单完全相同，均有24 SVGPathElement、200 SVGLineElement、196 SVGGElement、89 SVGTextElement等；20装卸后快照均无SVG元素，DOM counters回到1 document/28 nodes/14 listeners。只证明此场景GC后观测，不宣称不存在全部泄漏或瞬时原生分配。

active-request动画相对静态object/array/number self-size分别增加716,272/792,916/473,616bytes，合计1,982,804bytes；native增加260,105bytes，主要为外部字符串128,905及ArrayBufferData131,072bytes。settled object/array增加77,888/211,012bytes；20装卸后object增加704、array减少15,728bytes，代码增加235,196bytes。快照字段为V8 self-size，不是footprint，不能用来相加/扣减此前物理预算，也不能从编译代码增量推导泄漏。

平面路径字符串标签截断到1024字符，统计漏掉拼接/切片字符串以及Blink路径段，不作为完整路径成本。快照只表明SVG包装对象数相同，没有取得Blink renderer具体分配器类型/原生池容量归因；下一批应针对未覆盖的原生路径存储/分配器容量进行具体因果诊断，尚未实施，不能据此宣称内存根因已确定或预算达标。

八份原始快照gzip无损归档，生成时round-trip相等；独立Python读取归档重新核验原始/压缩SHA、node_count及所有type/native计数和self-size，exit0。探针、分析器、环境/输入、错误与全部日志保留。相关预算报告脚本2文件/10测试、typecheck/lint/450行均通过；本批未改生产源码、未重跑完整coverage/包消费/FPS/原生桌面或移动验收，也没有新的gzip/自然物理预算结果。10.4/10.5仍未完成，10.7依用户暂缓，不改规格、阈值、点数、精度或版本，不提交或发布。见heap-retention-verification.json及heap-retention-analysis.json。

### 已回收 JS 分配采样与坐标十进制编码（2026-10-13，候选撤回，回归已实现）

上批堆快照/独立核验是实际进展，但只反映GC后留存。本批先检查配置校验/错误处理调用路径，没有实施错误消息缩减，也没有改异常类型或消息。原生xcrun无法找到xctrace开发工具，未安装Xcode或改变开发者目录。改用CDP HeapProfiler.startSampling，samplingInterval16384，请求包含minor/major GC已回收对象的统计，正式/候选各独立静态及动画浏览器一次；这是统计性累计JS分配估计，不是footprint/留存峰值或预算证明。

每次使用隐藏source map临时生产构建，全部非map输出名称/字节与对应无map生产构建一致；映射源码及输入SHA、引擎版本、参数、任务计数/错误和产物SHA保留。源码最近祖先只表示调用上下文，不代表精确原生分配点。正式两组观测2324/2316ms、tasks max0/8，页面错误0、卸载task/element0；tree selfSize静态28,153,272、动画136,128,960bytes，sample总量是独立协议视图，不相加或强制相等。路径生成调用链为最大采样热点，String叶节点静态2,032,844、动画20,525,944bytes。

候选保留D3 line/五种曲线、点数、Math.round(value*1000)/1000语义和TextDecoder；仅对abs(rounded)<=1e9的坐标直接写ASCII十进制整数/小数，超范围及非有限仍使用原String转换。新增五种线型精确D3对照，覆盖正负零/半舍入/进位/±1e6边界/科学计数回退、细分小数及固定随机数，并检查长数组缩至单点。候选3文件/55测试以及typecheck/lint/450行通过。

候选分配观测2326/2320ms、max0/8、错误0及卸载资源0；tree selfSize静态24,700,132、动画108,328,584bytes，String叶节点0/410,080bytes。两种实现各仅一次统计采样，不据此宣称稳定性能改善或物理根因确定。原始四份profile及所有map经gzip无损归档；独立Python核验原始/压缩SHA、node selfSize/sample累计/group selfSize，并核对map中pathBuffer sourcesContent与实际测量源码，exit0；独立核验没有重新实现VLQ解码，不夸大映射验证范围。

未修改生产v4物理runner，360×300、8系列、10000总点compatible三对增量43,433,984 / 44,974,144 / 58,523,840bytes，全部超10MB；运行/严格归因exit0、错误0，自然窗2117–2363ms、terminal task0，20装卸task/element0、max8。无当窗强制GC，单独保留GC留存；离散峰值不包含挂载中/采样间未知最大值。没有同批正式物理对照，不能断言候选因果恶化，也没有证明物理收益。临时同配置/依赖/已准备WASM三构建递归并集包括CSS及全部额外产物：正式完整gzip增量12,011/11,832、候选12,168/11,980bytes，同次候选产物增加157/148bytes。

候选因全部物理对超标且包体增加而撤回；pathBuffer逐字节恢复，保留五项回归及全部源/patch/脚本/日志。恢复后先5文件/65测试通过。本批未运行候选完整coverage/包消费/完整FPS/原生Safari或Demo/移动验收，不把分配采样替代预算。10.4/10.5未完成、10.7按用户暂缓；不改规格、阈值、精度、点数、版本，不提交或发布。下一批规划应对剩余D3调用链的数值装箱和Vue逐帧对象更新建立因果证据，并寻找足够的等价包体收敛；尚未实施。见decimal-coordinate-verification.json、js-allocation-reconciliation.json。

恢复后的全套135文件/1104测试覆盖率通过，总体L/S/F/B为93.51/91.57/92.81/86.47%；随后typecheck/lint/450行各自exit0。正式运行时仍为网格节点复用版本，本批没有新增已采用的运行时优化。

### V8 优化/上下文日志及舍入命令缓存（2026-10-13，诊断及候选撤回）

上一批五项D3回归及分配采样为实际进展。本批CodeGraph与历史记录确认，冻结路径计算、直接D3曲线和仿射SVG诊断未解决正式预算，未重复这些候选。生产Chromium141.0.7390.37开启V8 trace-opt/deopt/file-names，一组静态/动画浏览器各3静态预热，再各3次挂载。首轮exit1：静态3次完整，动画第三次mount发生execution context destroyed；原始report只记录完整静态组，日志中保留动画前两次unmounted标记，不将失败写成完整通过。

增强探针另一次独立复测补充phase、main-frame导航和CDP Runtime execution context事件，并在开始时保存partial run。该次exit0、两组6次挂载完成，静态max0、动画max8、terminal task0、卸载task/element0、page errors0；每浏览器仅初始导航，context创建/clear只在初始navigate阶段。未复现不等于间歇失败已修复，不合并或替换首轮失败。

分析按launch PID+URL+SFI分组，避免压缩名称碰撞；首轮/独立复测完整观察事件1557/1691，各有1条关闭浏览器时的截断尾行，未计为完整事件。每个浏览器日志中point标签的同一SFI各有wrong call target/wrong map eager deopt一次、TURBOFAN completed optimizing一次，没有取得精确SFI源码定位，也不以缓冲stdout接收时间赋予逐帧时间。只说明日志观察，不声称具体D3函数已精确归因、无分配或预算改善。见jit-diagnostic-verification.json。

随后试验舍入命令缓存：D3仍逐次计算全部moveTo/lineTo/closePath，把实际命令和三位小数坐标保存在私有Float64缓冲；只有所有命令/坐标及数量一致才复用SVG字符串，任何变化完整重新序列化。没有舍入端点后自行计算step中点，没有跳过比例尺/几何计算或缩减点数。新增3项回归覆盖舍入边界、step中点/命令变化/单点Z/空输出、自定义插值器每次生成均被调用。4文件/58测试及typecheck/lint/450行通过。

候选独立静态/动画JS采样各一次，hidden map非map产物与对应无map生产构建逐字节一致；观测2339/2325ms、max0/8、页面错误及卸载task/element0。tree selfSize为27,235,584/141,933,676bytes，未证明比此前正式采样28,153,272/136,128,960改善；统计采样不构成严格因果或物理峰值证据。四份formal/candidate profile及map的独立SHA/累计/源码内容核验exit0，VLQ映射由trace-mapping完成，独立核验未另行实现解码。

未改生产v4 runner，候选只运行360×300、8系列、10000总点compatible一对初步物理测量，增量37,240,832bytes超10MB；命令/严格归因exit0、错误0，窗口2113/2337ms、终态task0、20装卸task/element0、动画max8。单对不证明复现性或完整矩阵；自然窗无强制GC，独立留存样本不能替代离散自然峰值。三临时同配置/依赖/已准备WASM构建递归并集包括CSS及全部额外产物：正式完整gzip12,006/11,828、候选12,157/11,976bytes，同次产物增加151/148bytes。

候选未证明分配/物理收益且包体增加，已撤回，pathBuffer逐字节恢复；保留三项回归及源/patch/原始脚本/日志。恢复后6文件/68相关测试通过。候选未运行完整coverage/包消费/完整FPS/原生Safari或Demo/移动验收，不扩大旧证据范围。10.4/10.5未完成，10.7按用户暂缓；不改规格、精度、点数、阈值或版本，不提交或发布。下一批仍需保留功能的实质包体收敛及renderer因果诊断；持续反优化和完整舍入路径缓存尚无收益证据，不继续把它们当已确定根因。见rounded-path-verification.json。

恢复后的全套136文件/1107测试覆盖率通过，总体L/S/F/B为93.51/91.57/92.81/86.47%；typecheck/lint/450行各自exit0。正式运行时仍为网格节点复用版本，本批未采用新的运行时优化。
