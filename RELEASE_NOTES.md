# waveform-analysis 0.2.2

- 修复采样索引先分配再检查预算的问题，避免超预算大数组分配；分配失败后保留正确降级路径。
- Tooltip 按稳定系列 ID 复用节点，同内容移动复用尺寸，减少连续悬停中的 DOM 创建和布局测量。
- 为 typed/samples 紧凑输入增加受预算限制的 JavaScript 极值索引，改善 Worker/WASM 降级时的连续视口查询；sum/average 保留原顺序聚合语义。
- 包含增量更新优化与回归加固；保持完整源查询、坐标单位、受控状态及原生/Vue 公开 API 兼容。
- 增加 Chromium 持续交互门禁与每周 Chromium/Firefox/WebKit 回归，覆盖桌面、小容器、动画、标注、导出和资源释放。
- 固定 Node 22 开发入口，继续使用 pnpm 10.32.1；传输仍使用 clone，未启用未经证实的内存或构建缓存候选。

本地验证：238 个测试文件、2140 项测试通过，三引擎浏览器回归、类型检查、lint、覆盖率、构建与实际 tarball 消费者检查通过。详细证据见 `openspec/changes/optimize-waveform-memory-hover-and-regression/implementation.md`。浏览器自动化不代表真实 Safari/iOS 或屏幕阅读器验证。

安装：`pnpm add waveform-analysis@0.2.2`。Vue 消费者使用 `import { WaveformChart } from 'waveform-analysis/vue'`。
本版本使用 `latest` 标签，正式发布工作流同时部署演示站。
