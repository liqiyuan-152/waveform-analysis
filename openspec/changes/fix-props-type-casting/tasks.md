# Tasks

## Task 1: 分析当前类型定义
- [ ] 读取 `src/components/core/waveformChartTypes.ts` 完整内容
- [ ] 读取 `src/components/WaveformChart.vue` props 定义
- [ ] 列出所有使用工厂函数的默认值
- [ ] 列出所有使用函数类型的 props
- [ ] 识别所有可选属性

## Task 2: 创建类型工具
- [ ] 创建 `ResolveDefaultValue<T>` 类型工具
- [ ] 创建 `ResolveAllDefaults<T>` 类型工具
- [ ] 添加类型注释和使用示例
- [ ] 编写类型级单元测试

## Task 3: 更新 ResolvedWaveformChartProps
- [ ] 使用新的类型工具重新定义 `ResolvedWaveformChartProps`
- [ ] 验证所有字段类型正确
- [ ] 处理特殊情况（如 xDomainStrategy）
- [ ] 运行 `pnpm typecheck` 验证

## Task 4: 移除类型断言
- [ ] 在 `WaveformChart.vue` 中移除 `as ResolvedWaveformChartProps`
- [ ] 验证 IDE 无类型错误
- [ ] 运行 `pnpm typecheck` 确认通过

## Task 5: 全面验证
- [ ] 搜索所有使用 `ResolvedWaveformChartProps` 的地方
- [ ] 验证每个使用位置类型兼容
- [ ] 运行完整测试套件
- [ ] 更新类型文档
- [ ] 代码审查
