## Context

参见 proposal.md 的动机。当前 WaveformChartView 使用 Pagination，WaveformAnnotationEditor 使用 Modal 和 InputNumber；组件 CSS 引用 .ant-*。ant-design-vue 同时出现在运行时依赖和 peerDependencies，demo 入口加载 antd.css。

分页关闭 page-size changer 和 quick jumper，由现有控制器决定页大小、显示条件和当前页。编辑器负责文本、时间、颜色输入；时间失焦触发最近采样点吸附，原始 X 坐标保持秒。vue3-colorpicker 没有声明 antd 依赖，但仍是未来移除 Vue 时需要替换的部分。

## Goals / Non-Goals

**Goals:**

- 在不加载 antd.css 的消费环境中完整使用组件，尽量还原当前控件视觉。
- 保留控制器、数据和受控标注契约，将替换限定在 UI 与依赖边界。
- 普通 TypeScript 承载新控件可独立测试的状态计算与 DOM 生命周期；Vue 包装负责属性传递、渲染和事件桥接。

**Non-Goals:**

- 本次不移除整个图表的 Vue 依赖，不替换 vue3-colorpicker，不迁移 demo UI。
- 不增加公开 UI 适配 API，不引入另一套完整 UI 框架，不照搬 antd 的内部 DOM 或类名。

## Decisions

### 原生控件与组件自有样式

采用原生按钮、输入、弹窗结构及 waveform-* 命名空间。分页序列和边界计算使用纯 TypeScript；数值输入保留原始字符串，以支持空值和输入过程，有限数值校验后交由原有时间逻辑处理。步进保持现有 0.001 显示单位，不更改秒坐标或重新实现吸附算法。

替代方案：Vue 专用无样式库会增加后续迁移成本；Zag.js 虽支持原生 JS，但为当前三个控件引入状态机及多个包没有必要；Web Components 组件体系还需要额外运行时与样式接入。本次优先小范围原生实现。

### 弹窗生命周期独立于 Vue

弹窗的显示结构由薄包装渲染，DOM 行为模块显式 mount/destroy，管理初始焦点、Tab 循环、焦点恢复、Esc、遮罩关闭和滚动锁定。卸载必须释放监听与锁定，多实例锁定采用可恢复计数，避免互相解锁。

采用原生 dialog.showModal 的顶层与背景隔离机制。浏览器实验确认默认 body 颜色浮层不可点击，将现有颜色选择器的 pickerContainer 指向弹窗内部独立容器后可以正常显示和点击（evidence/dialog-decision.json）。普通 TypeScript 生命周期模块提供统一 Tab 循环、焦点恢复、Esc 层级及共享滚动锁定；Firefox 与 WebKit 的多实例验证见 evidence/browser-verification.json。无需引入 a11y-dialog 或其他运行时依赖。

### 视觉基线来自当前实际渲染

实施前在固定浏览器、字体、数据、尺寸与动画状态下保存当前截图与尺寸记录。覆盖分页首尾页、多页省略、悬停与禁用，弹窗新增/编辑、错误态、输入焦点、颜色浮层及小屏。替换后以相同条件对照；尺寸、间距、颜色、遮罩、边框、圆角和阴影不得出现未经说明的明显变化。允许浏览器字体抗锯齿差异，不以像素绝对相等替代人工验收。

在 demo（加载 antd.css）与独立消费页（不安装 antd、不加载其样式）均验证。样式显式覆盖所需属性并限制命名空间，测试典型宿主 button/input 重置，避免 demo 掩盖缺失样式。

### 包依赖与未来框架边界

ant-design-vue 移至 devDependencies，移除 peer 要求、库 external 列表与包测试中的 antd 假设，同步锁文件和文档。独立消费者安装打包产物，验证 ESM/CJS、样式、分页和标注，无运行时或传递 antd 要求。

后续单独规划普通 TypeScript 图表核心及原生入口，Vue 成为可选包装；同时评估替换颜色选择器。本次不把仅新增控件的解耦宣称为整个图表已脱离 Vue。

## Risks / Trade-offs

- 原生数值输入在不同浏览器的步进外观有差异 → 使用组件自有步进按钮和样式，验证键盘、空值与小数。
- 模态焦点与颜色浮层相互影响 → 验证浮层焦点范围及 Esc 优先关闭浮层，必要时调整挂载容器。
- demo 全局样式掩盖组件缺失 → 使用不加载 antd.css 的消费页，并验证样式隔离。
- 小容器页码溢出或弹窗截断 → 保留现有响应式行为，验证窄容器和小视口。
- 现有测试依赖 .ant-* 和 Modal stub → 改为用户操作、可访问名称与事件断言，并使用真实弹窗浏览器验证。

## Migration Plan

先保存基线，再逐项替换分页、输入、弹窗，随后调整包依赖、测试和文档。运行全量质量门禁、独立消费验证及视觉比较后交付。回退时整体恢复控件实现、依赖清单、锁文件和样式，避免混用新旧交互。无需消费者更改 props、事件或标注格式。
