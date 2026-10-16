# 0.2.1 发布检查

2026-10-16 用户明确要求发布正式版 0.2.1，使用 latest 并执行稳定版本演示站部署。
workspace 迁移及启动修复已提交为 7f4ba1c；原先准备的 rc.2 未打标签、未发布。
发布说明包含从 0.1.x 升级的 Vue 入口变更。

本地 pnpm lint:all、pnpm check:file-length、pnpm typecheck:examples 已通过。
隔离副本使用源码生成的 WASM，pnpm test:package 退出 0；包含完整构建、三入口 ESM/CJS、
声明检查、CSS、真实 WASM Worker 和桌面/小视口包消费者浏览器检查。
这次本地包验证使用版本调整前的 rc.2 manifest，代码与 0.2.1 一致；原始日志为
release-rc2-package.txt，截图为 rc2-package/。最终版本将再次经 CI 和标签发布流程验证。
本机覆盖率运行主动中止，不能作为通过证明；完整覆盖率通过前不创建 v0.2.1 标签。
原工作区用户 WASM 修改及无关目录保留。
