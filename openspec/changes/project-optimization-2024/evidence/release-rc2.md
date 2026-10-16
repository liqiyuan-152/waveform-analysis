# 0.2.0-rc.2 发布检查

2026-10-16 用户授权提交并发布新版本；沿用当前 0.2.0 候选版本序列，准备 rc.2 / next。
本次提交包含阶段 1–2 workspace 迁移、启动修复、显式 WASM 发布准备及版本说明。
原有 .kiro、remove-antd-from-waveform-library 变更和用户修改的 WASM 二进制不纳入提交。

提交前 pnpm lint:all、pnpm check:file-length、pnpm typecheck:examples 通过。
启动修复的类型检查、定向测试和浏览器结果见 startup-fix.md。
隔离副本中 Rust 1.95 / wasm-pack 0.14.0 从源码打包成功；原工作区 WASM 保持原摘要。
本机全量覆盖率启动后因内存压力主动中止，release-rc2-coverage.txt 不是通过证明。
推送提交后使用 GitHub CI 的 frozen install、完整覆盖率、构建和包消费者验证作为标签发布门槛；
CI 完成前不创建发布标签。发布结果将在本记录追加。
