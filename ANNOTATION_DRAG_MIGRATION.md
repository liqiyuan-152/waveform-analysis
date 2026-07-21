# 标注拖动功能迁移指南

## 概述

版本更新添加了标注标签拖动功能，允许用户手动调整重叠标签的位置。此功能引入了接口变更和行为变化。

## 接口变更

### WaveformAnnotation 接口新增字段

```typescript
interface WaveformAnnotation {
  // ... 现有字段

  // 新增：标签偏移量（像素）
  labelOffsetX?: number
  labelOffsetY?: number
}
```

**影响范围**：

- 序列化/反序列化代码
- 标注验证逻辑
- 类型检查工具

### 迁移步骤

#### 1. 更新序列化代码

如果您有过滤已知字段的序列化代码，请添加新字段：

```typescript
// 修改前
function serializeAnnotation(annotation: WaveformAnnotation) {
  return {
    id: annotation.id,
    seriesId: annotation.seriesId,
    x: annotation.x,
    y: annotation.y,
    label: annotation.label,
  }
}

// 修改后
function serializeAnnotation(annotation: WaveformAnnotation) {
  return {
    id: annotation.id,
    seriesId: annotation.seriesId,
    x: annotation.x,
    y: annotation.y,
    label: annotation.label,
    // 添加新字段（如果存在）
    ...(annotation.labelOffsetX !== undefined && { labelOffsetX: annotation.labelOffsetX }),
    ...(annotation.labelOffsetY !== undefined && { labelOffsetY: annotation.labelOffsetY }),
  }
}
```

#### 2. 更新验证逻辑

如果使用严格的对象键检查，请允许新字段：

```typescript
// 修改前
const ALLOWED_KEYS = ['id', 'seriesId', 'x', 'y', 'label']

// 修改后
const ALLOWED_KEYS = ['id', 'seriesId', 'x', 'y', 'label', 'labelOffsetX', 'labelOffsetY']
```

#### 3. 更新 JSON Schema（如果使用）

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "seriesId": { "type": "string" },
    "x": { "type": "number" },
    "y": { "type": "number" },
    "label": { "type": "string" },
    "labelOffsetX": { "type": "number" },
    "labelOffsetY": { "type": "number" }
  },
  "required": ["id", "seriesId", "x", "y"]
}
```

## 行为变更

### 1. 自动碰撞检测已移除

**之前**：标注标签会自动避免重叠，系统尝试 8 种放置位置（上/下/左/右及对角线）。

**现在**：标注标签默认放置在数据点上方，重叠时需要手动拖动调整。

**原因**：手动拖动提供了更精确的控制，避免了自动布局可能产生的意外位置。

**迁移建议**：

- 如果您的应用依赖自动避让，请在文档中告知用户现在需要手动调整
- 可以通过监听 `@move` 事件来实现自定义的自动布局逻辑

### 2. 标注系列切换使用最近采样点

**之前**：在编辑器中切换标注所属系列时，Y 坐标通过插值计算。

**现在**：Y 坐标捕捉到最近的实际采样点。

**影响**：对于阶梯线或稀疏数据，切换系列时 Y 值可能会跳变到不同的采样点位置。

**用户体验建议**：

- 在 UI 中添加提示："切换系列将捕捉到最近的数据点"
- 考虑在切换前保存原始坐标，提供"恢复"功能

## 向后兼容性

✅ **完全向后兼容**：

- 新字段是可选的
- 未设置偏移量时，行为与之前相同
- 旧数据可以无需修改直接使用

❌ **可能不兼容的场景**：

1. **严格类型检查**：使用 `Object.keys().length` 检查精确键数量
2. **JSON Schema 验证**：`additionalProperties: false` 会拒绝新字段
3. **序列化白名单**：只序列化已知字段会丢失偏移量

## 测试建议

### 单元测试

```typescript
describe('Annotation serialization', () => {
  it('should preserve labelOffset fields', () => {
    const annotation: WaveformAnnotation = {
      id: 'test',
      seriesId: 'series-1',
      x: 100,
      y: 50,
      label: 'Test',
      labelOffsetX: 10,
      labelOffsetY: -20,
    }

    const serialized = JSON.parse(JSON.stringify(annotation))
    expect(serialized.labelOffsetX).toBe(10)
    expect(serialized.labelOffsetY).toBe(-20)
  })

  it('should handle annotations without offsets', () => {
    const annotation: WaveformAnnotation = {
      id: 'test',
      seriesId: 'series-1',
      x: 100,
      y: 50,
      label: 'Test',
    }

    // 应该不会抛出错误
    expect(() => renderAnnotation(annotation)).not.toThrow()
  })
})
```

### 集成测试

1. 加载旧数据文件，验证标注正常显示
2. 拖动标注，验证偏移量正确保存
3. 重新加载，验证偏移量持久化

## 支持

如有问题，请查看：

- 示例代码：`src/components/WaveformChart.test.ts` (行 942-1020)
- 类型定义：`src/types/chart.ts` (行 928-932)
- API 文档：`README.md`

## 更新日期

2026-07-21
