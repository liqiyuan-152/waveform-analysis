# 兼容与更新依赖记录

## 明确改进

原生和 Vue 入口的实际变化仅为 lineColor 时，不再取消活动手势、滚轮、标注编辑/拖拽或动画。
这是一项有意的行为改进。实际混合字段（例如颜色 + 尺寸）继续执行原来的必要重排/取消；包含
相同值字段（颜色变化 + 相同 width）按实际变化判断。空 patch 或全为相同值不产生业务 revision。
颜色变化仍使旧导出 export-stale，rendered/finished 继续遵循最新 revision 和稳定屏障。

保留 immutable 输入、秒坐标、稳定 ID、受控数组及完整源查询/误差域契约。不增加包导出或公共配置。
同 ID 子数据引用改变必须生成新源，元数据变化重组描述或按误差显示重新计算域；重排按归一化 ID
匹配，空序列保留原来的同轨道域规则。缓存只保留当前数据与当前 transport 资源。

## 依赖矩阵

可执行的完整矩阵位于 src/chart/optionEffects.ts，以 Record<keyof WaveformChartProps, ...>
约束现有全部顶层 option；新增字段而未分类会导致 typecheck 失败。矩阵表达保守的依赖并集，
不是把所有 style 字段都加入快速通道的许可。首批快速通道仍仅 lineColor；既有 showTooltip 独立处理。

- data：布局、几何、采样、交互和动画；按源身份保留未变化系列。
- 尺寸、显示/叠加/单位/布局模式、标签、时间单位、坐标轴、边距、标题、域、可见性、网格、渲染配置：
  保守执行布局/采样依赖，相关输入能力和域仍保留交互处理。
- lineColor：仅样式；frameNumber/frameNumbers/frameStyle：样式，但不扩大本次快速白名单。
- annotations/annotationsVisible：样式、交互、动画；legend：布局/样式/交互。
- zoomable/integerZoom/pannable/缩放限制/边界：交互及必要布局/采样；toolbar/presentationMode/interactionMode：样式与交互。
- animationEnabled/animation/animationUpdate/animationAnnotation/animationThreshold：动画配置。
- zeroLine：布局、样式与保守采样失效；cleanView：布局、几何、采样、交互。

快速分支只改变业务 revision、颜色和 view 调度，不清除布局/采样、不重置 wheel deadline，不取消
annotation draft 或动画。最终绘制刷新内部显示记录的颜色，包含正在插值/交叉淡化的旧/新路径；
动画选项签名排除 lineColor，避免样式导致 finishAll。内部显示记录允许更新，消费者输入不修改。

## 已执行的窄层回归

颜色测试覆盖原生/Vue 框选、平移、滚轮帧前与防抖中、编辑/新建草稿、标注拖拽、动画时间线、
焦点/选区、无变化/混合更新、export-stale 和 finished。按源测试覆盖替换、元数据、重复 ID、
重排、空序列和删除。Worker 假时钟与可控传输覆盖失联、迟到响应、混合批次、正常取消、版本恢复。
完整最终命令与浏览器证据见 implementation.md，不能据此推断其他浏览器或真实屏幕阅读器通过。
