## 实施基线

在 codex/plan-waveform-reliability-refactor 分支实施。此前文档阶段的“仅创建文档”限制已由本次实施授权取代；不提交、推送、发布或归档。

实施前将工作区 SHA-256 清单、完整 tracked diff 和本地 WASM 二进制备份至 `/tmp/waveform-toolbar-baseline/`。
原有无关文件包括 .dockerignore、deploy/Dockerfile.demo、src/components/core/layout.ts、src/main.ts、三个布局测试、WASM 二进制，以及未跟踪的 .codegraphy、发布工作流、doc、niceScale 源码/测试和 decimal-scale 脚本。

| 兼容面 | 实施约束 |
| --- | --- |
| resetViewport(trackIndex?) / setViewportDomain(domain, trackIndex?) | 保留 void 和静默行为，无参数仍选择旧重载 |
| toolbar 省略 | 不增加工具栏；内部实际模式默认 zoom |
| interactionMode 传入 | 请求只发 update，回传后改变实际状态 |
| 原 wheel/box 和双击 | 保留既有通知；新 command 字面值需穷举适配 |
| 坐标、输入、注解 | 秒坐标，输入不可变，注解/隐藏状态仍属消费者 |
| 新命令 | 当前页稳定 ID；事件快照、逐目标结果和部分成功 |

实现验证与浏览器证据在完成各项检查后追加。任务仅在实现及对应验证完成后勾选。

## 已实现内容

- 新增公开 handle、结果、状态、toolbar、导出选项/错误类型，保留旧数字重载静默行为。
- 命令层统一当前页目标解析、逐目标结果、事件快照与能力限制；受控模式只请求更新，回传后生效。
- initial/effective 边界供布局、D3 滚轮、框选、平移和新命令共同使用；fit/reset、旧 setter、数据/可见性/分页变化处理边界生命周期。
- 内部按钮注册表与模式/视口/导出分组；自定义顺序保留，窄容器默认折叠，支持焦点、Escape、触屏和错误反馈。
- 导出等待采样/字体/渲染；SVG 注入样式并重绘图例与标题，PNG 使用同一快照编码；版本变化、并发、超时及卸载有明确错误。
- 综合 Demo 使用受控模式回传、移除重复重置按钮；同次多目标缩放合并加载，fit 不加载；WASM Demo 为非受控模式。两个示例都有工具栏开关。
- README 提供配置、ref 调用、结果解释、事件/类型迁移和加载入口示例；包消费测试编译新增类型及旧重载。

## 浏览器验证

使用真实 Chromium：综合 Demo 1280×800 与 360×800 触屏视口，以及独立挂载组件 800px/360px 容器。

- Demo 平移按钮完成受控回传并同步 aria-pressed；WASM Demo 直接切换 pan，隐藏再显示工具栏保持 pan。
- 独立组件 fit [2,8] → [0,10]，放大 → [2.5,7.5]，拖动平移 → [2.7161383285302594,7.71613832853026]；框选得到 [0.14409221902017322,5]。
- 注解模式点击实际采样点打开中文注解编辑器；none 生效，presentationMode 下新缩放返回 disabled。
- 分页后只返回 channel-2，channel-0 命令返回 invalid-target，导出排除上一页注解。
- 受控请求返回 requested，实际状态保持 zoom，回传后为 pan。
- auto、wasm、raw 均成功导出；模拟 Worker 构造失败的 wasm/error 保留画面可导出。
- 数据替换时 export-stale，导出期间卸载时 export-cancelled。
- 实际解码桌面 2 倍 PNG 为 1924×1452，小 Demo PNG 为 358×754，独立小容器 PNG 为 358×498（内容尺寸不含边框）。
- SVG 单独打开并检查中文标题、图例、轴、网格、曲线/点/误差条；无 foreignObject、工具栏或交互蒙层。注解在独立组件导出保留。窄容器展开后导出菜单右边界 352px，全部操作在 360px 内可达。

证据：`evidence/demo-desktop.png`、`evidence/demo-small.png`、`evidence/demo-export.svg`、`evidence/demo-export-2x.png`。浏览器验证覆盖 Chromium；未宣称 Safari/Firefox 像素一致性。

## 最终验收

Node.js 22.23.2、pnpm 10.32.1 环境下实际执行并通过：

- `pnpm typecheck`、`pnpm check:file-length`、`pnpm lint:all`。
- `pnpm test:coverage`：84 个测试文件、571 项测试通过；语句 89.84%、分支 83.94%、函数 90.94%、行 92.26%。
- `pnpm build`：库、声明与 Demo 构建通过。
- `pnpm test:package`：包含嵌套 prepack 构建、ESM/CJS 消费及新增公开类型/旧数字重载声明编译，通过。
- OpenSpec 严格校验通过，4/4 文档齐全；24 项任务已完成，未归档。
- `git diff --check` 通过；分支仍为 `codex/plan-waveform-reliability-refactor`。

构建过程中使用工具链重新生成 WASM 验证；全部构建及包检查完成后，恢复实施前备份的本地 WASM 二进制和原本干净的生成元数据。复核实施前记录的全部无关文件 SHA-256，均与基线一致。构建验证针对工具链生成的产物，最终工作区保留消费者原有二进制改动。

未提交、推送、发布或自动归档。Safari/Firefox 尚未做浏览器验证；当前截图和解码结果来自 Chromium。
