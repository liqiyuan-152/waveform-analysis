## Purpose

让客户从内置工具栏或外部接口获取当前波形画面的 PNG 与 SVG 文件，明确图片内容、异步状态一致性和失败处理；确保导出可独立展示且不修改消费者数据、不泄漏临时资源。

## ADDED Requirements

### Requirement: 支持 PNG 和 SVG 两种导出入口

exportImage SHALL 返回 Promise<Blob>，默认 PNG，支持 SVG，MIME 分别为 image/png 和 image/svg+xml；外部调用不自动下载。工具栏 SHALL 提供两种格式下载。PNG scale 默认 1，接受不超过 4 的有限正数，仅影响输出像素尺寸；SVG 不接受非默认 scale。背景默认解析后的图表背景，允许显式 backgroundColor。

#### Scenario: 外部导出图片
- **WHEN** 宿主调用 exportImage({format:'png',scale:2})
- **THEN** 获得可解码 PNG Blob，尺寸为图表快照逻辑尺寸的两倍，不弹出自动下载，不改变视口或采样参数

#### Scenario: 工具栏下载 SVG
- **WHEN** 用户选择工具栏的 SVG 导出
- **THEN** 下载 waveform.svg，能独立打开并显示图表，临时对象 URL 被释放

### Requirement: 导出当前页图表而非操作界面

图片 SHALL 包含当前页和当前视口的标题、坐标轴、网格、可见曲线、点/误差条、图例及注解，保留颜色、线型、当前线宽和中文文字。工具栏、分页控件、悬浮提示、选区、菜单与编辑弹窗 SHALL 被排除。隐藏系列与非当前页图框不出现在导出内容中。图片不得依赖宿主页面样式才能显示。

#### Scenario: 隐藏系列和已有注解
- **WHEN** 当前页部分系列隐藏、其余系列带有注解且悬浮提示打开
- **THEN** 图片保留可见系列、对应图例状态及当前可见注解，不含悬浮提示和操作控件，不恢复隐藏曲线

#### Scenario: 没有有效曲线
- **WHEN** 图表尺寸有效但没有有效曲线
- **THEN** 允许导出空坐标系及当前可见标题，不伪造数据

### Requirement: 导出保持版本一致并等待稳定画面

导出 SHALL 捕获调用时数据、视口、可见性、注解及布局版本，等待对应采样、字体和渲染稳定；过程中状态改变拒绝 export-stale，不输出混合版本。等待总上限 5 秒，超时拒绝 export-timeout。wasm/error 模式已稳定的占位或保留路径 SHALL 可导出，不要求转成 JavaScript 采样。

#### Scenario: 采样未完成时导出
- **WHEN** 当前版本 Worker 仍在采样且随后在超时前完成
- **THEN** 导出该版本稳定后的画面，不使用上一版路径

#### Scenario: 导出等待中替换数据
- **WHEN** 捕获版本后宿主替换 data 或改变视口
- **THEN** Promise 拒绝 export-stale，用户可重新导出新画面，不触发旧图片下载

### Requirement: 导出错误可处理且资源完整释放

导出 SHALL 以带 code/message 的 Error 拒绝：非法参数 export-invalid-options、零尺寸/不可用 DOM export-unavailable、并发调用 export-busy、卸载 export-cancelled、编码失败 export-render-failed，以及版本/超时错误。工具栏 SHALL 展示失败反馈、恢复按钮可用，不产生未处理 rejection。成功、失败、取消均 SHALL 清理临时 DOM、Canvas、URL、计时器和监听，不修改源数据或注解。

#### Scenario: 并发导出
- **WHEN** 一次导出仍执行时再次调用
- **THEN** 第二次拒绝 export-busy，第一项继续；完成后可再次导出

#### Scenario: 导出中卸载
- **WHEN** 组件在等待字体或图像编码期间卸载
- **THEN** 拒绝 export-cancelled，不下载迟到图片且释放资源
