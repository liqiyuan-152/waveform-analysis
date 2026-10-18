# waveform-analysis 0.3.1

打包与发布流程优化补丁，公开组件 API 保持兼容。

## 改进

- GitHub 普通 CI 仅由分支和 PR 触发，发布标签由 Release 校验；同一分支的新运行自动取消过期 CI。
- 缓存 pnpm 下载与固定版本 wasm-pack，减少工具准备开销。
- 浏览器验证复用正式构建；GitHub/Gitea 发布只打包一次，消费者检查验证同一个 tarball，发布前校验 SHA-256。
- 保留本地 `pnpm pack` / `pnpm test:package` 的完整 prepack 构建行为。
- 修复包验证模块被导入时误执行父脚本命令行参数的问题，并增加回归测试。

## 升级

```sh
pnpm add waveform-analysis@0.3.1
```

本次保留完整测试、覆盖率与发布门禁；Demo 部署链路未在本补丁中变更。
