# Tasks

## Task 1: 设置测试基础设施

- [ ] 创建 `tests/components/core/` 目录结构
- [ ] 创建共享的 test helper：`tests/support/composableTestUtils.ts`
- [ ] 设置 D3 mocks：`tests/support/d3Mocks.ts`
- [ ] 设置 DOM mocks：`tests/support/domMocks.ts`
- [ ] 文档化 composable 测试模式

## Task 2: 测试 useWaveformChartController

- [ ] 创建 `tests/components/core/useWaveformChartController.test.ts`
- [ ] 测试：初始化状态正确（refs、reactive 状态）
- [ ] 测试：元素引用绑定（setContainer, setSvgElement 等）
- [ ] 测试：子 composables 正确集成
- [ ] 测试：props 变化触发正确的响应式更新
- [ ] 测试：expose 的方法（resetViewport, setViewportDomain）
- [ ] 达到 80%+ 代码覆盖率

## Task 3: 测试 useWaveformChartLifecycle

- [ ] 创建 `tests/components/core/useWaveformChartLifecycle.test.ts`
- [ ] 测试：ResizeObserver 正确创建和清理
- [ ] 测试：容器尺寸变化触发更新
- [ ] 测试：标题测量正确
- [ ] 测试：键盘事件处理（空格键、ESC）
- [ ] 测试：分页导航（goToPage）
- [ ] 测试：数据引用变化时的清理逻辑
- [ ] 测试：组件卸载时的清理
- [ ] 达到 80%+ 代码覆盖率

## Task 4: 测试 useWaveformChartAnnotations

- [ ] 创建 `tests/components/annotation/useWaveformChartAnnotations.test.ts`
- [ ] 测试：注解创建流程（右键创建编辑器）
- [ ] 测试：注解编辑流程（打开编辑器、修改、保存）
- [ ] 测试：注解删除流程（右键删除）
- [ ] 测试：注解显示/隐藏切换
- [ ] 测试：右键菜单交互
- [ ] 测试：坐标转换正确性（屏幕坐标 ↔ 数据坐标）
- [ ] 测试：系列选择器更新
- [ ] 测试：不可变性（不修改 props.annotations）
- [ ] 测试：取消编辑恢复状态
- [ ] 达到 80%+ 代码覆盖率

## Task 5: 测试 ResolvedWaveformChartProps 类型

- [ ] 创建 `tests/components/core/waveformChartTypes.test.ts`
- [ ] 测试：默认值解析正确
- [ ] 测试：函数类型默认值正确调用
- [ ] 测试：数组和对象默认值是新实例
- [ ] 测试：可选属性处理正确
- [ ] 测试：类型兼容性（编译时检查）

## Task 6: 文档和总结

- [ ] 更新 `tests/README.md` 添加 composable 测试指南
- [ ] 创建测试模式示例
- [ ] 运行完整测试套件验证
- [ ] 生成测试覆盖率报告
- [ ] 代码审查
