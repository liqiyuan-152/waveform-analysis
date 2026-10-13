## Purpose

规定默认开启动画时的公共配置、降级和兼容性，所有配置类型及支持的高级 API 通过包根入口导出。实施和验证必须保留本规格全部公共接口、同步终态及生命周期约束，并通过实际行为测试提供证据。

## ADDED Requirements

### Requirement: API-01 配置默认值与合并

WaveformChart SHALL 保留 animationEnabled/animation/animationUpdate/animationAnnotation/animationThreshold 五个顶层 props；三类配置均支持 enabled。默认全局及分类开启，入场 1000ms/cubicInOut/delay=0/staggerDelay=100/left-to-right，更新 300ms/cubicInOut，标注 300ms/scale/backOut，阈值 50000。嵌套字段 SHALL 按字段合并，undefined 才使用默认；duration=0 直接提交终态并跳过该阶段延迟。

#### Scenario: 局部覆盖

- **WHEN** 仅传 animation={duration:200} 和 animationUpdate={enabled:false}
- **THEN** 入场沿用其余默认，更新静态；标注仍启用，分类开关不改变全局配置

#### Scenario: 零值和非法配置

- **WHEN** duration=0 或 delay=0，或 duration 为负数、threshold 为 NaN
- **THEN** 合法零值保留；非法字段回退对应默认并在开发环境告警，其余合法配置不被覆盖；底层引擎直接接受非法配置时仍按引擎规格抛错

### Requirement: API-02 自动降级与减少动态效果

有效开关 SHALL 同时满足全局开启、分类开启、可用 RAF、非 reduced-motion、有效规范化总点数小于 threshold、非导出抑制。计数 SHALL 含隐藏和非当前页系列，通过数据源有效计数避免展开压缩数据，不使用采样点数。threshold SHALL 是有限非负整数；0 始终静态。首次绘制前 MUST 已应用策略。

#### Scenario: 阈值边界

- **WHEN** 默认阈值下总有效点数分别为 49999、50000、50001
- **THEN** 第一种可动画，后两种静态；隐藏系列或采样到少量点不绕过阈值

#### Scenario: 首次大数据及运行中降级

- **WHEN** 首次挂载即达到阈值，或动画中更新数据使点数达到阈值
- **THEN** 前者不创建入场初态/任务；后者结束旧动画，直接显示最新完整几何

#### Scenario: 动态减少动态效果偏好

- **WHEN** 系统偏好从 no-preference 切换到 reduce
- **THEN** 所属图表立即提交最终态，force 不能绕过；改回后只动画后续变化，卸载清理监听

#### Scenario: 无浏览器动画能力

- **WHEN** RAF 不可用，或 matchMedia 不存在
- **THEN** 无 RAF 时静态；只有 matchMedia 缺失时视为无 reduce 偏好，不因访问不存在的 API 报错

### Requirement: API-03 公共导出与行为兼容说明

包根入口 SHALL 明确导出本规格 API-05 及引擎规格 ENG-09 中的类型、Animation、Animator、globalAnimator、WaveformAnimationController、getEasingFunction 和全部预设工厂，不要求内部路径或 D3 selection。README SHALL 说明默认开启带来的时机变化、分类关闭、阈值、减少动态效果和最终态导出；MUST NOT 声称默认开启完全没有可观察影响。

#### Scenario: 包消费者编译

- **WHEN** 消费者从 waveform-analysis 导入动画配置类型、Animator、globalAnimator 和预设
- **THEN** ESM/CJS 及声明文件可用，无需访问 src 或手写内部类型，预设只依赖数值状态及回调

#### Scenario: 恢复静态行为

- **WHEN** Vue 消费者设置 :animation-enabled="false"
- **THEN** 立即呈现最终画面，既有 props/events/expose 可用，原始 X 及事件数值仍为秒，受控数组不被动画改写

### Requirement: API-04 动态配置一致性

duration/delay/easing/direction/type/staggerDelay SHALL 在创建任务时快照，运行中修改仅影响下一任务。分类 enabled=false SHALL 立即结束该类：update 包含域/锚点联动，annotation 只结束出现/退场而不停止数据更新的锚点投影。关闭 enter 释放等待的标注，标注仍启用时开始出现；关闭 annotation 立即恢复当前合法标注、移除退场，不结束系列入场。全局禁用/阈值降级/reduce 结束全部类别。恢复分类不重播；同一 Vue 提交批次的 data 和配置更新 SHALL 先合并最新配置再处理 data。

#### Scenario: 仅关闭更新动画

- **WHEN** 更新和标注出现同时运行，animationUpdate.enabled 改为 false
- **THEN** 数据/域/锚点到终态，标注出现继续；其他类别不被取消

#### Scenario: 修改时长及批量更新

- **WHEN** 入场中修改 duration/easing，或同批设置 animationUpdate.enabled=false 并替换 data
- **THEN** 已运行入场保持旧参数，后续使用新参数；同批数据静态提交，不短暂创建更新任务

#### Scenario: 独立关闭标注或入场

- **WHEN** 系列入场中关闭 annotation，或保持 annotation 开启但关闭 enter
- **THEN** 前者合法标注立即到终态但系列入场继续；后者系列完整显示且等待的标注开始出现，不永久隐藏

#### Scenario: 分页复用更新配置

- **WHEN** 用户切换分页或动态关闭 animationUpdate
- **THEN** 分页淡入复用更新类别（默认300ms、cubicInOut），enabled=false 或 duration=0 完整静态展示；播放时配置快照不变，关闭立即结束，恢复开关不重播；不新增分页 prop

### Requirement: API-05 公共预设与控制器接口

本节中的接口以及引用的引擎规格类型 SHALL 从包根入口导出。它们是公共契约，不依赖 change 目录的设计说明；代码块为声明签名，不表示已实现。

```typescript
type LineDrawingDirection = 'left-to-right' | 'right-to-left' | 'center-out'
type AnnotationAnimationType = 'fade-in' | 'scale' | 'slide-in' | 'bounce'
interface LineDrawingOptions {
  duration?: number
  delay?: number
  easing?: EasingType | EasingFunction
  direction?: LineDrawingDirection
  onComplete?: () => void
  onAbort?: () => void
}
interface StaggeredLineDrawingOptions extends LineDrawingOptions {
  staggerDelay?: number
}
interface DataUpdateOptions {
  duration?: number
  easing?: EasingType | EasingFunction
  onComplete?: () => void
  onAbort?: () => void
}
interface AnnotationAnimationOptions extends DataUpdateOptions {
  type?: AnnotationAnimationType
}
interface WaveformEnterAnimationOptions extends StaggeredLineDrawingOptions {
  enabled?: boolean
}
interface WaveformUpdateAnimationOptions extends DataUpdateOptions {
  enabled?: boolean
}
interface WaveformAnnotationAnimationOptions extends AnnotationAnimationOptions {
  enabled?: boolean
}
interface WaveformAnimationProps {
  animationEnabled?: boolean
  animation?: WaveformEnterAnimationOptions
  animationUpdate?: WaveformUpdateAnimationOptions
  animationAnnotation?: WaveformAnnotationAnimationOptions
  animationThreshold?: number
}
interface ClipAnimationState {
  x: number
  width: number
}
interface AnimationBinding<T> {
  read(): T
  write(state: T): void
}
type NumericGeometry = Record<string, AnimationValue>
interface GeometryTransitionInput {
  from: NumericGeometry
  to: NumericGeometry
  compatible: boolean
}
type GeometryTransitionFrame =
  | { kind: 'settled'; values: NumericGeometry }
  | { kind: 'interpolate'; values: NumericGeometry; progress: number }
  | {
      kind: 'crossfade'
      from: NumericGeometry
      to: NumericGeometry
      fromOpacity: number
      toOpacity: number
    }
interface AnnotationAnimationState {
  opacity: number
  scale: number
  offsetY: number
}
declare function createLineDrawingAnimation(
  binding: AnimationBinding<ClipAnimationState>,
  width: number,
  options?: LineDrawingOptions,
): AnimationConfig
declare function createStaggeredLineDrawingAnimations(
  series: readonly { binding: AnimationBinding<ClipAnimationState>; width: number }[],
  options?: StaggeredLineDrawingOptions,
): AnimationConfig[]
declare function createPathTransitionAnimation(
  input: GeometryTransitionInput,
  write: (frame: GeometryTransitionFrame) => void,
  options?: DataUpdateOptions,
): AnimationConfig
declare function createYAxisScaleAnimation(
  binding: AnimationBinding<[number, number]>,
  to: [number, number],
  options?: DataUpdateOptions,
): AnimationConfig
declare function createAnnotationAppearAnimation(
  binding: AnimationBinding<AnnotationAnimationState>,
  options?: AnnotationAnimationOptions,
): AnimationConfig
declare function createAnnotationDisappearAnimation(
  binding: AnimationBinding<AnnotationAnimationState>,
  options?: AnnotationAnimationOptions,
): AnimationConfig
type AnimationScope = 'enter' | 'update' | 'leave' | 'domain'
interface AnimationObjectKey {
  kind: 'series' | 'annotation' | 'axis' | 'custom'
  id: string
  scope: AnimationScope
}
interface WaveformAnimationControllerOptions {
  enabled?: boolean
  animator?: Animator
  commitFinalState: () => void
}
declare class WaveformAnimationController {
  constructor(options: WaveformAnimationControllerOptions)
  animate(key: AnimationObjectKey, config: AnimationConfig): AnimationHandle
  animateSeriesEnter(
    id: string,
    binding: AnimationBinding<ClipAnimationState>,
    width: number,
    options?: LineDrawingOptions,
  ): AnimationHandle
  animateMultiSeriesEnter(
    series: readonly { id: string; binding: AnimationBinding<ClipAnimationState>; width: number }[],
    options?: StaggeredLineDrawingOptions,
  ): AnimationHandle[]
  animateDataUpdate(
    id: string,
    input: GeometryTransitionInput,
    write: (frame: GeometryTransitionFrame) => void,
    options?: DataUpdateOptions,
  ): AnimationHandle
  animateYAxisScale(
    id: string,
    binding: AnimationBinding<[number, number]>,
    to: [number, number],
    options?: DataUpdateOptions,
  ): AnimationHandle
  animateAnnotationAppear(
    id: string,
    binding: AnimationBinding<AnnotationAnimationState>,
    options?: AnnotationAnimationOptions,
  ): AnimationHandle
  animateAnnotationDisappear(
    id: string,
    binding: AnimationBinding<AnnotationAnimationState>,
    options?: AnnotationAnimationOptions,
  ): AnimationHandle
  cancel(key: AnimationObjectKey): void
  cancelAll(): void
  finishAll(): void
  pauseAll(): void
  resumeAll(): void
  setEnabled(enabled: boolean): void
  getActiveAnimationCount(): number
  destroy(): void
}
```

WaveformChartProps SHALL 扩展 WaveformAnimationProps，不增加新的组件 expose 方法。三个组件配置包含的 onComplete/onAbort 按每系列/标注任务调用，不代表整图完成，不作为 Vue emit；终态提交的全局回退先清除任务再统一恢复画面。控制器 enabled 默认 true、animator 默认 globalAnimator，构造时分配不可碰撞的 owner；commitFinalState 由图表适配器提交最新业务目标，公共消费者自行提供。finishAll 的终态、状态和通知顺序遵循 CTL-07；destroy 后 animate 抛错，其他清理方法幂等。所有预设的方向/时长/缓动及限幅遵循预设规格，onComplete/onAbort 分别映射 done/aborted。

NumericGeometry 的键代表调用者已匹配的线条、点、误差棒数值通道，不接受路径字符串。compatible=true 时键和数组形状必须一致，否则注册前拒绝；调用者仍负责同系列/线型/X 序列等语义检查。插值帧输出新数值；crossfade 帧输出只读复制的新旧几何及互补透明度，终帧统一输出 settled 帧且仅含 to；释放旧几何后才通知完成。write 回调负责投影并通知 Vue，预设不查询数据、不写 DOM。输入均在创建时复制，调用者不得修改帧内快照。

工厂 SHALL 只校验静态参数、复制输入并生成配置，不调用 binding.read/write、write 回调、用户回调，不修改展示状态。当前状态通过配置 initialize 在注册事务获得所有权后读取和捕获；几何 from/to 是调用者提供的值快照，控制器在取消冲突前捕获 from，再构造工厂。initialize 不会抢先覆盖旧画面。新入场注册时初始化裁剪，标注使用当前 binding 状态；适配器只在确定为新节点时准备隐藏态，重加则保留当前值。静态终帧跳过 initialize，必要的当前值在终帧处理函数中读取。工厂不移除 DOM；标注退场由展示列表在终帧阶段清理，onComplete 是清理完成后的用户通知，不能作为唯一清理途径。回调驱动预设须 force=true，未变化可生成 duration=0。

控制器先完整校验请求并判断有效策略，禁用时跳过 initialize，只提交最终结果并返回已完成句柄，onComplete 一次。开启时在对象级冲突事务内构造并注册预设。全局回退/finishAll/cancelAll/destroy 期间，所属控制器开启 owner 级终止屏障，重入 animate 在任何写入、工厂初始化或新回调之前抛出 animation-terminating；不是同步完成新任务。其他 owner 仍可正常调度。destroy 后请求抛出 animation-disposed。类别开关、采样和页面暂停由图表适配器协调，独立公共控制器不擅自安装页面监听。

#### Scenario: 预设接口归档与类型消费

- **WHEN** 解析和合并本规格 delta，并从根入口消费六个预设工厂和控制器
- **THEN** API-05 保留全部签名及 settled 帧类型；类型消费者必须处理 settled，工厂仅构造配置而不写展示状态
