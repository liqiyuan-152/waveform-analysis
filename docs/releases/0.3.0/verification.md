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

当前仅将版本元数据修正为 0.3.0，未创建 v0.3.0 标签或重新触发发布。后续发布需验证最终提交，不能将上述结果视为后续工作区改动的验证结果。

修正过期的 Demo 检查：展示主题通过全局主题 provider 驱动；旧 /components 路由验证重定向，资源释放检查覆盖分析、展示和 Popup 之间的重复切换。
