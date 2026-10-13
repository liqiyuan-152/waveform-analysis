# 发布说明草案（未发布，不改版本）

动画默认开启：首次有效非空系列入场 1000ms，数据更新与标注 300ms，多系列交错 100ms。
这是可观察的显示时机变化。消费者可用 `:animation-enabled="false"` 恢复静态展示，或分别关闭
animation、animationUpdate、animationAnnotation 的 enabled。duration=0 跳过对应延迟/交错。

新增根入口 Animation、Animator、globalAnimator、WaveformAnimationController、31 种 D3 缓动、
数值轨道与六个纯预设工厂。支持暂停原因、延迟、四方向、循环、兼容数值累加及同步终态。
更新使用数值几何与同步展示域，结构不兼容时整体交叉淡化；标注支持四种效果与只读退场快照。

有效总点数达到 50000、threshold=0、reduced-motion、无 RAF 或导出抑制时静态展示。
完整数据查询、秒坐标及受控 data/annotations/hidden-series 所有权保留。交互、布局变更及导出
提交最新目标；PNG/SVG 沿用已有 busy/stale/cancelled/timeout 契约，其他图表不被结束。

桌面验收已完成：同源码完整96场景/960记录的Chromium FPS达到目标，Chrome/Firefox/Edge及原生Safari组件与Demo验证通过。移动端依用户要求不在本次验收范围。

完整gzip增量ESM/CJS为12,012/11,834 bytes，满足修订后的15,000 bytes预算；原10KB目标未达。物理内存仍超过原10/20MB优化目标，现改为必须披露的诊断指标；保留最多双份几何、终态释放及卸载资源清理约束。20次装卸任务/元素归零不代表全系统内存无泄漏，历史间歇浏览器上下文销毁也未证明已修复。详见evidence/final-acceptance-verification.json。

本文件是未发布草案；没有提交、改版本、打标签或发布。
