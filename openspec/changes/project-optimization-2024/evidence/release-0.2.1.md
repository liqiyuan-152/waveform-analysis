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

首轮 CI 38882343576：227 文件中 226 通过，2071 测试中 2069 通过；
integerZoomStall 的 independent/separated 两例在 20 秒超时，未创建标签。
原用例将本地和远程窗口两个完整且独立的场景放在一个 it 内，共享一个时限。
现将 mode × remote 展开为独立参数用例，保留四通道 × 3001 点、全部断言与每例 20 秒时限，
无生产代码变更、无阈值降低。带 V8 覆盖率的定向复测 10/10 测试通过，测试耗时 63.97 秒。
该定向命令仅运行一个文件，整体覆盖率阈值自然不满足而退出 1，不能代替全量覆盖率验收；
原始结果见 release-0.2.1-targeted-coverage.txt，CI 失败日志见 release-0.2.1-ci-failure.txt。

第二轮 CI 38885045354：227 文件、2074 测试全部通过，但覆盖率失败（语句 76.93%、
分支 66.89%、函数 75.55%、行 92.92%）。报告将 demo 消费的压缩 dist 作为另一份代码统计。
覆盖率专用库构建现使用 --sourcemap --minify false，将打包执行记录合并回原源码；
正式构建仍保持原压缩设置，没有排除文件或降低阈值。
仅添加 source map 时优化后的函数边界仍造成重复计数；未压缩映射使 WaveformChart.ts
函数总数从 168 恢复为直接源码的 84，混合运行源码测试与 demo 测试后仍为 84。
三文件七例定向测试全部通过（24.21 秒），定向命令仍因全局覆盖率不足退出 1，待完整 CI 验收。
对应记录：release-0.2.1-ci-second.txt、release-0.2.1-sourcemap-build.txt、release-0.2.1-sourcemap-targeted.txt。
