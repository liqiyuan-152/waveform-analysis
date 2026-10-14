# 实施与验收记录

## 依赖边界

| 使用位置 | 替换或保留方式 | 验证 |
| --- | --- | --- |
| WaveformChartView 的 Pagination | 内部原生分页；计算逻辑为普通 TypeScript | 分页窗口单测、原图表分页/布局/动画测试、浏览器页码与首尾验证 |
| WaveformAnnotationEditor 的 InputNumber | 原生输入、自有步进按钮与样式 | 字符串编辑、键盘步进、失焦校验、完整数据吸附及秒坐标测试 |
| WaveformAnnotationEditor 的 Modal | 原生 dialog、独立 DOM 生命周期、自有样式 | 焦点、取消、快捷保存、滚动锁定、多实例及卸载测试 |
| 组件中的 .ant-* 样式 | 移除，使用 waveform-* 样式 | 无 antd.css 的组件页与打包消费页 |
| package.json / pnpm-lock.yaml | antd 仅作为 devDependency，移除运行时和 peer 要求 | 冻结安装、独立消费者实际依赖图 |
| vite.lib.config.ts / test-package.mjs | 移除 antd external 假设，新增实际消费验证 | ESM、CJS、声明、tree shaking、浏览器产物 |
| demo 与其测试 | 保留 antd 控件、样式和相关测试 | demo 桌面/小屏截图、App 与 demo 测试 |
| Vue / vue3-colorpicker | 本阶段保留 | README 明确当前依赖及未来迁移边界 |

公开入口 src/index.ts、props、事件和标注格式保持兼容。用户原有未跟踪文件未改动；实施分支为 refactor/waveform-antd。

## 基线与视觉对照

基线来自替换前 Chromium 的实际渲染，见 baseline-metrics.json 和 before-*.png。桌面视口 1100×850、图表 800×400；小屏视口 390×844、图表宽 342。固定数据、动画关闭。

| 状态 | 替换前 | 替换后（含 antd.css） | 替换后（无 antd.css） |
| --- | --- | --- | --- |
| 分页首尾与禁用 | before-pagination-first/last.png | after-pagination-first/last.png | independent-pagination-first/last.png |
| 页码悬停与多页省略 | before-pagination-hover/middle.png | after-pagination-hover/middle.png | independent-pagination-hover/middle.png |
| 新增与编辑弹窗 | before-editor-add/edit.png | after-editor-add/edit.png | independent-editor-add/edit.png |
| 输入焦点与错误 | before-input-focus/error.png | after-input-focus/error.png | independent-input-focus/error.png |
| 颜色浮层 | before-color-popup.png | after-color-popup.png | independent-color-popup.png |
| 小屏分页与弹窗 | before-pagination-small.png、before-editor-small.png | after-pagination-small.png、after-editor-small.png | independent-pagination-small.png、independent-editor-small.png |
| 宿主控件重置 | — | after-host-reset.png | independent-host-reset.png |

桌面弹窗的布局盒为 x=330、y=100、width=440、height=587.90625；小屏为 x=8、y=108、width=374、height=617.1875，前后相同。布局盒包含原有底部 24px 空白。

人工查看桌面、小屏、颜色浮层和宿主重置截图，保留原有字体、留白、色彩、边框、遮罩、按钮和输入布局。无 antd.css 时补齐原先隐式提供的 legend 宽度及 6px 底部间距。分页保留旧版 992px 以下隐藏省略号相邻窗口边缘页码的规则；更窄容器使用单行横向滚动，保持 32px 高度，不换行遮挡横轴标题。

visual-comparison.json 对比弹窗面板裁剪区域：RGB 通道差值大于 16 的像素占桌面约 0.005%、小屏约 0.115%。差异主要来自自绘关闭/步进图标的细微笔画和抗锯齿；不把截图外的宿主按钮默认样式及图表位置差异计为控件视觉变化。

## 弹窗与浏览器行为

dialog-decision.json 记录实际命中测试：颜色浮层挂到 body 时不可点击，挂到 dialog 内部独立容器后可点击。采用原生 dialog，未新增 a11y-dialog 或其他运行时依赖。

browser-verification.json 与 browser.log 记录：

- Chromium 验证有/无 antd.css、分页跳转、禁用、初始焦点、Tab/Shift+Tab、时间步进与错误、Esc 层级、Ctrl+Enter、焦点/滚动恢复、小屏和宿主重置。
- Firefox、WebKit 验证原生模态、颜色浮层、连续 Tab、多弹窗、先卸载底层弹窗，再关闭顶层弹窗时的焦点与滚动恢复。恢复焦点测试使用键盘打开的已聚焦触发按钮；Safari 鼠标点击按钮默认不聚焦，恢复遵循实际打开前的焦点。
- demo-desktop.png 与 demo-small.png 验证 demo 中的 antd 控件继续存在。

复现组件浏览器验证：启动 `pnpm dev --host 127.0.0.1 --port 5178` 后执行 `node scripts/test-native-controls.mjs`。其他地址可通过 NATIVE_CONTROLS_URL 指定。

## 发布包独立消费

`pnpm test:package` 创建临时消费项目，仅直接安装打包组件、Vue 和测试用 TypeScript；检查实际 node_modules/.pnpm 不存在 ant-design-vue 或 @ant-design 包。ESM、CJS、声明和 tree shaking 均验证打包产物。

消费页仅导入公开组件及 waveform-analysis/style.css，不引用仓库源组件或 demo；构建后使用真实浏览器验证分页、受控新增/编辑标注、1200ms 吸附到原始 1s 采样点、选色与透明度、越界错误、小屏和卸载清理。见 package.log、packed-consumer-desktop.png 和 packed-consumer-small.png。

## 质量检查

工具链版本见 quality-gates.json；toolchain.txt 为本地执行记录。使用临时 pnpm 启动入口，使顶层命令及 package scripts 内嵌的 pnpm 均为 10.32.1，Node 为 22.23.2。

最终检查全部通过（quality-gates.json）：156 个测试文件、1313 个用例；行覆盖率 94.28%、语句 92.4%、函数 93.46%、分支 87.88%。对应日志与 OpenSpec 状态：install.log、typecheck.log、file-length.log、lint.log、coverage.log、build.log、package.log、pack-dry-run.log、openspec-validation.txt。执行日志和上述 .txt 文件仅保留在本地，不纳入提交；结构化结果见 quality-gates.json。完成状态仅在所有检查成功后勾选。

当前仍保留 Vue 与颜色选择器；本变更完成的是 antd 解耦及新增控件逻辑的框架隔离，不表示整个图表已脱离 Vue。
