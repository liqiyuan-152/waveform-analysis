# 消除 any 类型使用

## Summary

项目中有 4 个文件使用了 `any` 类型，需要替换为具体类型以提高类型安全性。

## Background

以下文件中存在 `any` 类型：
- `src/components/core/useWaveformPresentation.ts`
- `src/components/core/xDomain.ts`
- `src/components/interaction/WaveformTooltip.vue`
- `src/types/chart.ts`

使用 `any` 会绕过 TypeScript 的类型检查，可能导致运行时错误。

## Goals

- 找出所有 `any` 类型的使用位置
- 为每个 `any` 确定合适的具体类型
- 替换所有 `any` 为具体类型
- 确保类型检查通过

## Non-goals

- 重构类型系统架构
- 引入新的泛型抽象

## Plan

### Phase 1: 审计 (预计 1 小时)
1. 使用 grep 找出每个 `any` 的具体位置
2. 分析每个 `any` 的上下文
3. 确定替换策略

### Phase 2: 替换 (预计 2-3 小时)
1. 修复 `src/types/chart.ts` 中的 `any`
2. 修复 `src/components/core/useWaveformPresentation.ts` 中的 `any`
3. 修复 `src/components/core/xDomain.ts` 中的 `any`
4. 修复 `src/components/interaction/WaveformTooltip.vue` 中的 `any`

### Phase 3: 验证 (预计 30 分钟)
1. 运行 `pnpm typecheck` 确认无类型错误
2. 运行测试套件确认功能正常
3. 代码审查

## Common Patterns

常见的 `any` 替换策略：
- D3 事件类型：使用 `D3ZoomEvent<Element, Datum>`
- 未知对象：使用 `Record<string, unknown>` 或具体接口
- 泛型参数：使用 `unknown` 或具体类型约束
- DOM 元素：使用 `HTMLElement` / `SVGElement` 等具体类型

## Risks

- 可能发现之前未暴露的类型不兼容问题
- 需要修改相关代码以满足类型约束

## Success Criteria

- [ ] 项目中不再有 `any` 类型（除非有明确注释说明原因）
- [ ] `pnpm typecheck` 通过
- [ ] 所有测试通过
- [ ] ESLint 无警告
