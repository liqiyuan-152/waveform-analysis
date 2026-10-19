# Design

## Context

动机见 proposal.md。库内直接依赖集中在 WaveformChartView.vue 的 Pagination，以及 WaveformAnnotationEditor.vue 的 Modal、InputNumber。对应 CSS 包含 Ant Design 类名。标注颜色选择另由 vue3-colorpicker 提供，不在本次替换范围。Vue 响应式控制器与 D3/SVG 渲染继续沿用。

## Goals / Non-Goals

**Goals:**
- 用内部 Vue 组件封装原生 HTML、浏览器事件和自有 CSS，保持公共接口。
- 使独立消费者不依赖 Ant Design 的安装、样式重置或隐式传递依赖。
- 以当前实现的测试和浏览器截图为迁移基线，逐项验证交互状态。

**Non-Goals:**
- 本次不移除 Vue，不切换 Canvas，不重新设计整体界面。
- 不引入其他 UI 框架，不复制 Ant Design 内部代码，不公开新的通用 UI 组件 API。
- 不调整标注颜色选择器、波形数据契约及动画控制器。

## Decisions

### 1. 内部原生控件边界

分页放在现有 controls 责任边界，对话框和时间输入归属 annotation；每文件不超过 450 行。使用 button、input 等语义元素及局部 CSS。直接把全部逻辑放进现有大组件会增加编排负担，因此采用小模块封装；保留 Vue 模板以控制本阶段迁移范围。

### 2. 分页使用原生按钮

通过现有 currentPage、getPageSize、pageableTracks 和 goToPage 接入，不重写轨道分页及视口恢复。页码压缩、省略号导航、禁用状态按实施前基线复刻，使用 aria-current 和真实 disabled 属性。无需增加未启用的页大小选择或跳页输入。

### 3. 对话框采用原生 dialog

使用 showModal 配合自有样式和 ::backdrop，保留原有 440px 默认宽度并限制窄视口宽度。适配 cancel、close、遮罩点击和组件卸载，确保仅一次取消或确认；使用生命周期控制打开和关闭、焦点恢复及必要的滚动锁。相比自行维护 div 焦点陷阱，原生 dialog 提供模态语义和焦点约束；真实浏览器验证必需，jsdom 测试不得以桩替代该验收。

颜色选择浮层可能传送到 body，受到 dialog 顶层和 inert 影响：实施时先验证并将浮层配置或挂载到 dialog 内，保留其可交互性。若现有颜色选择器不能适配，则采用 Teleport 到 body 的原生 DOM 对话框，并显式实现焦点陷阱、背景隔离和恢复；两种方案必须满足同一规范，不能删减颜色功能。

### 4. 时间输入使用原生文本输入与自有步进按钮

保留字符串编辑草稿，继续复用既有格式转换与校验逻辑，明确支持 ArrowUp/ArrowDown 和 0.001 步进。避免直接依赖 input[type=number] 对空值、非法中间态和浏览器数字微调外观的差异。提供 spinbutton 语义及错误关联，步进计算避免可见浮点误差；显示单位和原始秒坐标边界保持不变。

### 5. 依赖和样式隔离

将 ant-design-vue 从 dependencies 和 peerDependencies 移到 devDependencies，demo 保留显式全局 CSS 导入。移除库构建中的相关 external 项和库内 .ant-* 选择器；自有样式完整定义控件基础外观并限定命名空间。检查剩余依赖是否传递引入 ant-design-vue，不能只删除直接 import。

保留 Vue peer 和 vue3-colorpicker。在隔离临时消费项目安装打包产物，检查实际依赖树，分别验证 ESM/CJS、类型声明及浏览器渲染；不能以工作区已安装 Ant Design 的测试作为独立消费证明。README 说明库仅需自身样式，demo 的 Ant Design 要求单独列明。

## Risks / Trade-offs

- 原生控件默认外观与 Ant Design 不同 → 使用自有 CSS，记录桌面和小容器的迁移前后截图；不承诺跨浏览器逐像素相同。
- 对话框顶层影响颜色浮层 → 首先验证实际浮层挂载方式，按上述兼容路径处理，并覆盖透明度交互。
- demo 全局 CSS 掩盖库样式缺失 → 增加不加载 Ant Design CSS 的独立页面验收。
- 新旧测试依赖 Ant Design 组件查找 → 迁移到可访问角色、可见状态和事件断言，保留既有业务回归。
- 其他进行中的 OpenSpec 变更也触及控制器或测试 → 实施前复核工作区，限制修改到本次控件边界，不覆盖无关变更。

## Migration Plan

先记录基线，依次替换分页、弹窗和时间输入，每步落地测试；然后清理生产依赖及文档，最后完成独立打包消费与浏览器验证。仅在功能与包装验证均完成后发布。不需要消费者迁移公共 API；异常时可回退本变更及匹配的依赖清单和锁文件，不回退无关工作区内容。
