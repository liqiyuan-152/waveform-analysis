# 0.3.0 发布准备

使用 Node 22.23.2 / pnpm 10.32.1。发布内容见根目录 RELEASE_NOTES.md。

已通过：

- `pnpm install --frozen-lockfile`
- `pnpm prepare:wasm`
- `pnpm typecheck`
- `pnpm check:file-length`
- `pnpm lint:all`
- `pnpm check:native-boundary`
- `pnpm check:licenses`
- `pnpm typecheck:examples`
- `pnpm test:coverage --maxWorkers=2`：294 个测试文件、2698 项测试通过。

覆盖率：语句 90.91%、分支 85.70%、函数 91.26%、行 93.28%。

- `pnpm test:package`：完整通过；包含 prepack 类型检查和生产构建，以及独立 ESM/CJS、Bundler/NodeNext/Node10 类型、CSS/WASM、跨入口实例、组件隔离和真实浏览器消费。
- `WAVEFORM_BROWSER=chromium WAVEFORM_BROWSER_EVIDENCE_DIR=artifacts/release-1.0.0 pnpm test:browser`：通过。
- `git diff --cached --check`：通过。

六个基础组件的系统/浅色/深色主题、1280px/360px 页面、嵌套弹窗、Popup 交互、旧路由重定向和重复页面切换均通过浏览器验证。截图和详细运行日志保留在本地 artifacts 与 /tmp，未加入发布包。

这些检查在版本号仍为 1.0.0 的提交 a1a4a57 上完成。用户澄清目标版本为 0.3.0 并要求停止发布后，已取消 GitHub 工作流 39136143482，并撤销误建的 v1.0.0 标签。npm 未发布 1.0.0，GitHub Release 与线上部署均未执行。

用户随后授权发布 0.3.0 并将工作区改动一并提交。最终版本补充基础组件 Demo 布局与间距改进、架构和设计文档，并同步已跟踪的 WASM 产物及验证截图。最终增量验证结果将在下方记录；历史覆盖率结果对应上文注明的提交。

修正过期的 Demo 检查：展示主题通过全局主题 provider 驱动；旧 /components 路由验证重定向，资源释放检查覆盖分析、展示和 Popup 之间的重复切换。


## 最终工作区改动验证

- `pnpm build:demo`、`pnpm typecheck`、`pnpm lint:all` 通过。
- `pnpm exec vitest run demo-app/tests/demo/controlPages.test.ts`：3 项测试通过。
- `node scripts/verify-public-controls-browser.mjs`：六个组件深浅色、系统主题、桌面及窄屏交互通过。
- `pnpm test:package`：版本 0.3.0 完整通过，包含真实 tarball 消费和 Demo 路由检查。

此次补充为 Demo 布局与文档更新；生产 TypeScript 实现保持此前 2698 项测试通过的版本。已跟踪的 WASM 产物来自同一工具链的重新生成，并经过上述真实包浏览器消费验证。

- 最终文件长度、原生依赖边界、许可证和公开示例类型检查全部通过。
- `WAVEFORM_BROWSER=chromium WAVEFORM_BROWSER_EVIDENCE_DIR=artifacts/release-0.3.0 pnpm test:browser` 通过。
- 发布标签为 `v0.3.0`，由 GitHub Release 工作流执行远端全量验证、npm 上传和 Demo 部署。
