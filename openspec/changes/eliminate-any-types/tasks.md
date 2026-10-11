# Tasks

## Task 1: 审计所有 any 使用

- [ ] 使用 grep 找出 `src/components/core/useWaveformPresentation.ts` 中的所有 `any`
- [ ] 使用 grep 找出 `src/components/core/xDomain.ts` 中的所有 `any`
- [ ] 使用 grep 找出 `src/components/interaction/WaveformTooltip.vue` 中的所有 `any`
- [ ] 使用 grep 找出 `src/types/chart.ts` 中的所有 `any`
- [ ] 为每个 `any` 创建替换计划（记录行号和上下文）

## Task 2: 修复 src/types/chart.ts

- [ ] 读取文件完整内容
- [ ] 识别每个 `any` 的使用目的
- [ ] 替换为具体类型或 `unknown`
- [ ] 添加必要的类型守卫函数
- [ ] 运行 `pnpm typecheck` 验证

## Task 3: 修复 src/components/core/useWaveformPresentation.ts

- [ ] 读取文件完整内容
- [ ] 识别每个 `any` 的使用场景
- [ ] 替换为正确的类型（CSSProperties 等）
- [ ] 运行 `pnpm typecheck` 验证

## Task 4: 修复 src/components/core/xDomain.ts

- [ ] 读取文件完整内容
- [ ] 替换 D3 相关的 `any` 为具体类型
- [ ] 导入必要的 D3 类型定义
- [ ] 运行 `pnpm typecheck` 验证

## Task 5: 修复 src/components/interaction/WaveformTooltip.vue

- [ ] 读取文件完整内容
- [ ] 替换组件相关的 `any`
- [ ] 确保 props 和 emits 类型正确
- [ ] 运行 `pnpm typecheck` 验证

## Task 6: 添加 ESLint 规则

- [ ] 在 `eslint.config.js` 中添加 `@typescript-eslint/no-explicit-any: 'error'`
- [ ] 运行 `pnpm lint` 确认无 `any` 残留
- [ ] 更新 CI 配置确保规则生效

## Task 7: 全面验证

- [ ] 运行 `pnpm typecheck` 确认通过
- [ ] 运行 `pnpm lint` 确认通过
- [ ] 运行完整测试套件
- [ ] 更新类型文档
- [ ] 代码审查
