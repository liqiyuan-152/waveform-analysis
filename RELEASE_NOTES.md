# waveform-analysis 0.2.0-rc.1

- 波形引擎改为框架无关的 TypeScript / D3 DOM 实例，根入口提供 `init`、`getInstanceByDom`、`dispose`；`/native` 为兼容别名。
- **破坏性变更**：Vue 组件改从 `waveform-analysis/vue` 导入，根入口不再导出 `WaveformChart`。Vue 为可选 peer dependency，原生消费者无需安装 Vue。
- 库内分页、工具栏、标注编辑和颜色控件使用原生实现，不再依赖 Ant Design Vue；演示页面仍使用 Vue 和 Ant Design Vue 开发依赖。
- 保留缩放、平移、受控标注、动画、采样及图像导出能力，并完善原生控件的布局和交互。
- 演示页面所有颜色选择器支持透明度；标注编辑器的波形色块由 12px 放大为 18px。

安装候选版本：`pnpm add waveform-analysis@0.2.0-rc.1` 或 `pnpm add waveform-analysis@next`。
Vue 消费者另行安装 Vue，并使用 `import { WaveformChart } from 'waveform-analysis/vue'`。
本版本发布到 `next`，不改变 `latest` 稳定版本。
