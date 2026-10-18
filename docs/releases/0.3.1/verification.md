# 0.3.1 发布验证

使用 Node 22.23.2 / pnpm 10.32.1。此补丁优化 CI 与打包流程，不修改公开组件 API。

发布前实际通过：

- `pnpm install --frozen-lockfile`
- `pnpm prepare:wasm`：指纹验证通过，复用现有 WASM。
- `python3 scripts/issue_triage_agent.py --self-test`
- `pnpm check:file-length`
- `pnpm lint:all`
- `pnpm check:native-boundary`
- `pnpm check:licenses`
- `pnpm test:coverage --maxWorkers=2`：295 个文件、2703 项测试通过，Vitest 耗时 618.23 秒。
- 覆盖率：语句 90.89%、分支 85.71%、函数 91.26%、行 93.25%。
- `pnpm build`：正式库、声明、全项目类型检查和 Demo 构建通过。
- `pnpm typecheck:examples`
- `pnpm test:browser:built`：Chromium 回归通过。
- `pnpm --config.ignore-scripts=true pack --pack-destination <临时目录>`
- `pnpm test:package --tarball <临时目录>/waveform-analysis-0.3.1.tgz`：独立 ESM/CJS、无 Vue 导入、类型、tree shaking、主题、Demo 路由、真实浏览器消费及清理检查通过。
- tarball 消费者验证前后 SHA-256 一致。
- 修改文件的 Prettier 检查、GitHub Actions actionlint、`git diff --check` 通过。

## 耗时对比基线

GitHub v0.3.0 Release 运行：39137764446。

- 覆盖率：711 秒。
- 正式构建：23 秒。
- 浏览器验证：29 秒。
- 包消费者验证（含重复 prepack）：79 秒。
- 最终打包（再次 prepack）：24 秒。
- 上述正式构建到最终打包四项合计 155 秒，不含浏览器安装与覆盖率。

0.3.1 将用相同口径记录 Actions 实测；首次运行可能未命中新增的 wasm-pack 缓存。

## Demo 部署调查

v0.3.0 包发布成功，但部署验证超时。线上和容器内的 version.txt 均仍为
v0.2.2 提交 6ae94c4f699d787251bf0e5c8d5433a8d39291b0。

Dokploy 日志确认失败发生在克隆 production 分支时，未进入 Docker 构建。
接收约 27.6 MiB 后连接断开，错误为 unexpected disconnect、early EOF、invalid index-pack output。
HTTPS 克隆在 120 秒诊断窗口内也未完成；GitHub 源码归档诊断下载速度约 33 KiB/s。
容器健康、内存占用正常、磁盘剩余约 26 GiB，现有服务仍可访问。

仓库当前跟踪的 openspec 文件约 64.9 MiB，增加了每次完整源码克隆的传输量。
建议后续将 Demo 改为部署 CI 已构建的静态产物或镜像，避免服务器再次从 GitHub 克隆并构建。
本补丁未修改生产部署配置。
