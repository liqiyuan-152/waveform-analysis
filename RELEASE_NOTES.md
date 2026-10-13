# waveform-analysis 0.1.75

本版本加入动画系统，并支持分页切换时的新页淡入。

- **系列入场**：首次有效非空系列默认1000ms入场，多系列交错100ms。
- **数据更新**：默认300ms过渡；结构兼容时插值波形几何和展示域，不兼容时交叉淡化。
- **标注动画**：默认300ms，支持淡入、缩放、滑入和弹跳效果。
- **分页淡入**：波形、点、误差棒和标注同步淡入；轴与网格立即更新，连续翻页只保留最新页。复用`animationUpdate`，默认300ms、`cubicInOut`。
- **公开动画接口**：提供`Animation`、`Animator`、`globalAnimator`、`WaveformAnimationController`、数值轨道、六个预设工厂和31种D3缓动。

动画默认开启，属于可观察的展示时机变化。使用`:animation-enabled="false"`可恢复静态展示，或分别关闭`animation`、`animationUpdate`、`animationAnnotation`的`enabled`；`duration: 0`直接显示最终态。

默认总点数达到50,000、系统启用减少动态效果或缺少RAF时静态降级。动画保持不可变数据、原始秒坐标、完整数据查询和受控标注契约；绘图区交互、视口命令及PNG/SVG导出先提交最新最终态。后台暂停，卸载清理，多实例隔离。

分页专项通过Chromium、Chrome和Firefox的桌面与小容器验收。完整139个测试文件、1130项测试及覆盖率检查通过；原生移动端不在本次验收范围，分页专项未重测原生Safari。完整动画包体gzip增量约12.7KB（ESM）/12.5KB（CJS），符合15KB修订预算；历史物理内存优化目标仍作为诊断指标，不保证所有设备性能或全系统无泄漏。

安装或更新：`pnpm add waveform-analysis@0.1.75`。配置示例见README的“动画”章节。
