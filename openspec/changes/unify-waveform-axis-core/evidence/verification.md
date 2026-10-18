# 验收记录

环境：Node.js 22.23.2、pnpm 10.32.1。

## 已完成检查

- 定向测试：10 文件 / 120 用例通过；后续增加方向切换回归，纳入全量测试。
- pnpm typecheck、pnpm check:file-length、pnpm lint:all 通过。
- pnpm check:native-boundary、pnpm check:licenses、pnpm typecheck:examples 通过。
- pnpm build、pnpm test:package 通过；独立 ESM/CJS、无 Vue 类型消费、tree shaking 和组件边界通过。
- 新增证据脚本单独通过 ESLint / oxlint；源文件通过定向 Prettier 检查。
- openspec validate unify-waveform-axis-core --strict 通过。
- compare-numeric.mjs 对改动前临时源码快照执行 4,000 组数值对比，结果完全一致。
  脚本从仓库根目录执行；依赖 baseline-path.txt 指向的本机临时快照，临时目录清理后需重新提供基线。

## 浏览器

pnpm test:package 使用独立 WAVEFORM_EVIDENCE_DIR，未覆盖旧集成证据。
1280 和 360 宽度均验证打包消费者与 /display、/components、/ Demo 路由，
包括数据替换、动画控制、卸载/重挂载、路由切换和无横向溢出。
打包消费者卸载后 frames、observers、svg 均为 0；无 pageerror。
人工检查窄屏打包双组件截图及桌面双组件 Demo 截图，轴、标签和曲线显示正常。
原始指标与截图保存在 browser/。

## 全量测试复跑

首次 pnpm test:coverage 完成 288 文件 / 2,675 用例，其中 2,673 通过。
两项 Demo 测试分别触发其既有 20 秒 / 30 秒超时，无功能断言失败。
首轮同时存在构建/浏览器验证负载；结束这些任务后使用
pnpm test:coverage --maxWorkers=2 重新完整运行，不修改测试超时限制。

复跑结果：288 个测试文件、2,675 项测试全部通过（605.53 秒），退出码 0。
覆盖率：语句 91.47%、分支 85.66%、函数 91.85%、行 93.98%，全部阈值通过。
源码未因首轮超时修改，测试时限未放宽。首轮两项 Demo 超时在低并发复跑中均通过。
