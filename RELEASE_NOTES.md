# waveform-analysis 0.2.1

- 将演示应用隔离到私有 `demo-app` workspace，演示通过公开包入口消费组件库，UI 和路由依赖由演示应用独立声明。
- 保留根目录开发、构建和预览命令，支持库代码、样式和声明监听，演示构建输出仍为 `dist-demo`。
- 修复 Windows 原生 `pnpm.exe` 启动失败；日常启动、类型检查和测试复用现有 WASM，不再要求 Rust 工具链。
- Rust 源码修改后通过 `pnpm build:wasm` 显式重新打包；CI 和发布流程显式准备 WASM。
- 保持 rc.1 的根、native、vue 三个包入口及图表行为。Vue 组件仍从 `waveform-analysis/vue` 导入。
- **从 0.1.x 升级的破坏性变更**：根入口提供框架无关的 `init`、`getInstanceByDom`、`dispose`，不再导出 `WaveformChart`；Vue 组件需改从 `waveform-analysis/vue` 导入。Vue 为可选 peer dependency，原生消费者无需安装 Vue。

安装正式版本：`pnpm add waveform-analysis@0.2.1` 或 `pnpm add waveform-analysis@latest`。
Vue 消费者另行安装 Vue，并使用 `import { WaveformChart } from 'waveform-analysis/vue'`。
本版本发布到 `latest`，并触发正式演示站部署。
