## Why

客户希望拥有类似 Plotly.js 的常用图表操作，同时能从宿主应用调用相同能力。当前组件只有部分视口方法，缺少可开关的内置工具栏、统一模式切换和图片导出，消费者需要自行拼装交互。

## What Changes

- 增加可开关的内置工具栏，包含框选缩放、平移、注解、放大、缩小、重置、显示全部及 PNG/SVG 导出；不要求复刻 Plotly 外观，不引入 Plotly 依赖。
- 工具栏默认关闭，开启后支持悬浮或常驻显示、位置及按钮集合配置；支持键盘与触屏操作。
- 开放与内置按钮共用逻辑的外部控制接口，保留已有 resetViewport(trackIndex?) 和 setViewportDomain(domain, trackIndex?) 调用及行为。
- 使用内部按钮注册表统一元数据、命令映射和状态读取，默认按模式、视口、导出分组；保留扁平有序 items，不新增公共注册表或分组 API，不改变受控模式所有权。
- 支持独立子图稳定 trackId 定位、逐目标操作结果、受控交互模式及状态通知；隐藏工具栏不关闭外部控制。
- 为新命令增加 gesture=command 与命令来源/动作标识，明确 intent/end/reset 协议；旧事件值和数字方法行为不变，穷举旧 gesture 联合的消费者需适配新增分支。
- 导出当前页图表内容，包含标题、轴、图例、曲线和注解，排除工具栏、分页控件、悬浮提示及编辑弹窗。
- Demo 默认启用内置工具栏，不添加一套独立的外部操作按钮；README 提供外部调用示例。

## Capabilities

### New Capabilities

- `waveform-chart-toolbar`: 工具栏开关、配置、可访问性、按钮状态及 Demo 展示。
- `waveform-chart-controls`: 模式切换、外部方法、视口操作、操作目标和事件兼容性。
- `waveform-chart-image-export`: PNG/SVG 导出内容、异步一致性、错误和资源释放。

### Modified Capabilities

无。主 specs 目录尚无已归档基线，本次使用 ADDED Requirements 记录新能力以及必须保留的既有接口契约；不改写或归档此前可靠性变更。

## Impact

涉及 WaveformChart 的 props/emits/defineExpose、控制器、交互/视口、渲染 UI、图片导出模块、Demo、src/index.ts 类型出口、README 和测试。允许新增公共配置、方法及类型，但不移除既有 props、事件或方法签名，不改变注解序列化、原始秒坐标和输入不可变契约。

本阶段仅创建 OpenSpec 文档，不实现代码，不新建分支，不提交、推送或归档；保留当前所有未提交改动。
