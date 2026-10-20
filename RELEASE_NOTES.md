# waveform-analysis 0.3.6

新增可选视口动画，并修复毫秒整数缩放与旧构建目标下的端点格式化兼容性。默认交互行为保持兼容。

## 新增

- `animationUpdate.animateViewport` 默认关闭，开启后兼容的命令、滚轮缩放和 `setViewportDomain` 平滑过渡到目标视口。
- 连续缩放从当前显示位置接续，采样未完成时等待结果；无按键悬停不会提前结束动画。
- 数据更新和结构变化保留原有稳定化规则，动画总开关、零时长、减少动态效果偏好及大数据阈值继续生效。

## 修复

- 毫秒整数缩放按单位换算比例处理浮点误差，避免近整数端点意外向外扩张。
- 端点格式化使用精确十进制字符串进位，移除 BigInt 依赖，保持正负端点向外舍入和负零处理；增加 ES2018 包消费构建检查。
- 修复 Windows 下独立包验证启动 pnpm 和测试发现路径比较问题。
- 更新 README 的公开入口、原生/Vue 示例、展示组件 API、控件说明及开发命令。

## 升级

```sh
pnpm add waveform-analysis@0.3.6
```

无需修改现有参数。需要视口动画时显式设置
`animationUpdate: { animateViewport: true, duration: 400, easing: 'linear' }`。
原生与 Vue 入口使用相同配置；原始 X 坐标与事件值始终为秒。
