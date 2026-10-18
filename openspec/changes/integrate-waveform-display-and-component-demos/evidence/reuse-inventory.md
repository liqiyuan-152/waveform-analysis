# 复用清单

| 来源 | 处理 | 保留边界 |
| --- | --- | --- |
| utils/formatters + display/renderer/formatters | 共享指数计算、五位有效数字、指数文本 | 单位及标题拼装 |
| components/rendering/seriesStyle + display/renderer/helpers/series | 共享 D3 曲线和符号及线型工具 | 点大小和点划线参数 |
| animation/core + display/animation/Animator | 唯一公共任务引擎，展示时钟适配 | elapsed 及类别通知适配 |
| animation presets + display clip/easing | 共享缓动、裁剪及插值基础 | 默认值、匹配策略与降级 |
| 容器/资源生命周期 | 提取实际重复的 observer/清理基础 | 独立注册表及尺寸策略 |
| config/equal/snapshot 与 Vue 快照 | 不直接替换；展示 plain object 快照与 Vue 循环/数据身份语义不同 | 保留组件契约，避免强制全量复制 |
| EventEmitter、OptionManager、业务调度 | 保持独立 | 订阅、嵌套更新、同步/异步时序不同 |
| Demo | 共享站点外壳、示例卡和使用代码 | 原控制面板及数据形状 |

## 已落地的共享模块

- `src/shared/formatting/scientific.ts`：两个 formatter 调用；原单位拼装保留。
- `src/shared/rendering/styles.ts`：分析 pathBuffer/seriesStyle 与展示 helpers/series 调用。
- `src/shared/animation/geometry.ts`：分析预设/值插值及展示几何/裁剪/淡入淡出调用。
- `src/shared/dom/svg.ts`：分析 SvgDom 兼容重导出与展示 SvgRenderer 共用。
- `src/shared/dom/resizeObserver.ts`：两种尺寸监听保留策略并共用宿主 realm 解析。
- `src/animation/core/Animator.ts`：唯一任务状态机；展示旧 Animator 文件仅重导出 ElapsedTimeline 适配器，无自有帧循环。
- 展示 Animation 是不可变采样快照，不拥有时钟或可变任务状态；保留类别时长/延迟策略。

配置快照、相等比较、事件和业务调度保持独立，原因见兼容矩阵。Demo 输入校验不深层导入库实现。

Demo 基础控件通过同一 ant-design-vue 4.2.6 依赖复用，导航外壳和 ExampleSource 实际共用。分析的模拟/远程窗口数据具有秒坐标和记录域约束，展示保留原科学数据及多轴配置；不将两套业务数据生成器强行合并。短小的可复制示例分别内联正弦数据，避免复制出的代码依赖 Demo 私有辅助路径。
