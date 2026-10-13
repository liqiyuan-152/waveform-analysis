## Purpose

规定完整动画引擎的可观察行为；本地 Animation 为时间实例、Animator 为调度器。具体职责映射见 design.md，不声称等同上游同名类。

## ADDED Requirements

### Requirement: ENG-01 时间状态与终点

通用配置默认 duration=1000ms、delay=0、easing=linear、loop=1、direction=normal、force=false、additive=false。引擎 SHALL 支持 PENDING/RUNNING/PAUSED/FINISHED/ABORTED、首次 delay、暂停恢复、有限正整数次数或无限 loop，以及 normal/reverse/alternate/alternate-reverse。MUST 根据绝对有效经过时间计算迭代及周期余数，暂停时冻结延迟与播放时间。结束后 tick 无效；done 与 aborted 互斥且至多一次。

#### Scenario: 延迟阶段暂停

- **WHEN** duration=1000、delay=200，启动后 100ms 暂停 500ms 再恢复
- **THEN** 恢复后再经过 100ms 才开始播放，暂停期间不推进，之后 500ms 的 rawProgress 为 0.5

#### Scenario: 跨越多个循环

- **WHEN** duration=100、loop=4、direction=alternate，首个运行帧后有效时间跳到 250ms
- **THEN** iteration=2、rawProgress=0.5；到 400ms 结束时使用 iteration=3 的反向终点，done 只触发一次

#### Scenario: 四种方向

- **WHEN** 原始进度 p 分别应用四种 direction
- **THEN** normal 为 p、reverse 为 1-p、alternate 为偶数迭代 p/奇数 1-p、alternate-reverse 为偶数 1-p/奇数 p，先方向后缓动

#### Scenario: 零时长及非法时间

- **WHEN** duration=0、loop=2、direction=alternate、delay=100
- **THEN** 忽略延迟，同步提交最后反向终点并 done 一次；duration 为负/非有限、loop=0/小数或零时长无限循环则注册前抛错，无任务残留

### Requirement: ENG-02 缓动与无变化任务

引擎 SHALL 复用 D3 提供 linear 及十类 In/Out/InOut 共 31 个命名缓动，允许自定义 easing。during SHALL 接收 easedProgress 和含 rawProgress/directedProgress/iteration 的帧信息；原始进度在 [0,1]，缓动结果可以越界。force SHALL 仅强制无变化/无轨道任务实际计时，不绕过组件禁用策略。

#### Scenario: 回弹缓动越界

- **WHEN** backOut 在中间帧输出大于 1 的值
- **THEN** 引擎保持该值供支持回弹的轨道使用，裁剪/opacity 由预设限幅，不把 rawProgress 变成大于 1

#### Scenario: 相同起终点

- **WHEN** 所有轨道起终点相同且 force=false
- **THEN** 同步提交终态、during 终帧通知及 done，不安排 RAF；force=true 则按 duration/delay 实际运行

### Requirement: ENG-03 属性轨道与累加

轨道 SHALL 只接受有限数值标量、同形一维/二维数值数组，不修改调用者的 from/to 数组；target 属性为输出位置，数组输出以新数组替换而非原地修改旧数组。普通轨道替换冲突任务时 SHALL 捕获当前合成值并中止旧任务。累加 SHALL 按 value(t)=base(t)+committedOffset+sum(activeDelta(t)) 统一合成；新轨道 from=baseEnd+committedOffset+sum(activeEndDelta)，delta(t)=interpolate(from,to,p)-from；baseEnd/activeEndDelta 为考虑 direction 的终点，p 为缓动后的方向进度，无基础轨道时 base 为固定基值，每目标属性每帧只写一次；MUST NOT 对上一帧输出重复加总。loop 不为 1/false、基础轨道循环、维度不同或字符串累加 SHALL 在注册前拒绝。

#### Scenario: 两条累加轨道

- **WHEN** 固定基础值为 10，第一条累加轨道 from=10/to=14、第二条 from=14/to=20，两条进度均为 0.5
- **THEN** 合成值为 10+2+3=15；同时间重复更新仍为 15，不变成 20

#### Scenario: 累加结束和中止

- **WHEN** 一条累加轨道完成，另一条在中途 abort
- **THEN** 分别把最终贡献和当前贡献折入持久偏移，移除任务的瞬间显示值不跳变，且不再逐帧重复加入已折入贡献

#### Scenario: 普通轨道接管累加

- **WHEN** 当前属性合成值为 15，新普通任务要求转到 30
- **THEN** 以 15 为 from，终止该属性相关旧普通/累加任务并清空旧偏移；无冲突属性的其他任务继续

#### Scenario: 数组和不支持的值

- **WHEN** 创建同形数值数组轨道或字符串/变长数组累加轨道
- **THEN** 前者逐项插值且不修改传入数组，后者注册前抛错，不产生半注册任务

### Requirement: ENG-04 调度与异常隔离

Animator SHALL 惰性运行 RAF，支持注入时钟；无任务或全部暂停时停止 RAF，仅延迟任务使用一个最早截止时间定时器。遍历 SHALL 使用帧快照及任务身份校验，回调中新建的正时长任务下帧推进；initialize 在其注册成功时执行。零时长任务遵循同步终态规则，批量终止期间则遵循 ENG-10 拒绝规则。缓动/during 异常 SHALL 中止该任务并报告 onError，终止回调异常只报告；其他任务继续。缓动返回 NaN/Infinity SHALL 视同抛错，图表控制器静态提交合法目标。无 onError 时使用 console.error，报告器自身异常也不得破坏调度。

#### Scenario: 回调替换同 ID 任务

- **WHEN** 旧任务 done 回调以相同 ID 创建新任务
- **THEN** 清理旧任务不删除新任务，新任务下一帧启动

#### Scenario: 全部暂停及延迟取消

- **WHEN** 所有任务暂停，或仅剩延迟任务且随后被 clear
- **THEN** 前者无持续 RAF，resume 后重新启动；后者清除唤醒定时器，空闲期间不再执行回调

#### Scenario: 单任务回调抛错

- **WHEN** 两任务并行，其中一个 during 抛错
- **THEN** 该任务 aborted 一次并报告异常，另一任务正常更新；done 回调抛错不再追加 aborted

### Requirement: ENG-05 显式结束与无 RAF 环境

finish SHALL 提交有限任务最后迭代终点，无限任务当前迭代终点，并 done 一次；abort SHALL 保留当前值并 aborted 一次；destroy SHALL 只中止清理而不补帧。无 RAF 环境 SHALL 直接结束任务，不创建模拟循环。模块导入 MUST NOT 访问浏览器专属全局或启动计时器。

#### Scenario: 无限任务显式结束

- **WHEN** 无限 alternate 任务在奇数迭代中被 finish
- **THEN** 提交该反向迭代终点并 done，队列移除，不继续等待无限循环

#### Scenario: SSR 导入和运行

- **WHEN** 无 window/requestAnimationFrame 环境导入模块并调用 animate
- **THEN** 导入不报错，调用直接提交任务终点并完成，无后台定时器

### Requirement: ENG-06 替换事务与同步终态

所有 animate 请求 SHALL 先完整校验，再捕获当前合成值并解决同 ID/属性冲突，最后选择同步终态或注册播放；零时长、无变化、无 RAF 分支不得跳过冲突处理。替换 SHALL 登记新代次再通知旧 aborted；回调内更晚代次的同 ID/属性请求优先，失去所有权的外层请求不再写值。同步期间 during 抛错 SHALL aborted/onError，不再 done。

#### Scenario: 零时长覆盖运行任务

- **WHEN** 属性正从 0 动画到 100，在 40 时创建 duration=0 的任务到 20
- **THEN** 旧任务 aborted 一次，新值同步为 20，新任务 done 一次；后续帧不会被旧任务覆盖

#### Scenario: 校验失败不取消旧任务

- **WHEN** 正在运行时用相同 ID 创建非法 duration 的新任务
- **THEN** 新请求抛错，旧任务继续，值和旧回调不受影响

#### Scenario: 替换回调重入

- **WHEN** B 替换 A，A 的 aborted 回调又创建同属性 C
- **THEN** C 为最终所有者，B 被中止且不能随后覆盖 C，同步和异步分支遵守同样顺序

### Requirement: ENG-07 累加固定偏移与回收

完成贡献 SHALL 从活动集合移入 committedOffset；中止贡献移入当前值，不能重复保留在两处。追加轨道 SHALL 包含已固定偏移计算 from。组内无任务后 SHALL 将当前输出写回目标并释放组，后续任务从目标重建，不能重复吸收偏移。

#### Scenario: 完成后再次追加

- **WHEN** 基值 10 的累加任务完成到 14，随后追加目标 20
- **THEN** 新 from=14、增量=6，最终为 20；保留组或已回收重建两种路径结果一致

#### Scenario: 部分中止后再次追加

- **WHEN** 基值 10，第一轨道目标 14 半程中止固定贡献 2，另一轨道 from=14/to=20 的目标贡献仍为 6；此时追加目标 25
- **THEN** 新 from=10+2+6=18、目标增量为 7；其余任务完成后的输出为 25，不重算已中止轨道原目标

### Requirement: ENG-08 暂停原因独立

单任务 manual、管理器 manual-all、控制器 manual-all、document-hidden SHALL 独立持有暂停原因；原因集合非空即暂停，仅最后原因移除才恢复。pause/resume 只修改自身原因，resumeAll 不清除单任务原因；新任务继承所属批量/后台原因。暂停时间 SHALL 按非空区间并集累计。finish/abort 不受暂停原因限制。

#### Scenario: 手动暂停后切换标签页

- **WHEN** 手动暂停任务后页面隐藏再返回
- **THEN** 只移除 document-hidden，任务仍手动暂停，直到显式 resume 才继续

#### Scenario: 重叠原因与后台新任务

- **WHEN** t=100 手动暂停，t=200 页面隐藏，t=300 手动恢复，t=500 页面显示；隐藏期间又创建带 delay 的任务
- **THEN** 原任务累计暂停 400ms 而非相加成 500ms；新任务继承后台原因，显示前不运行 RAF 或延迟唤醒

### Requirement: ENG-09 公共引擎接口

以下类型和符号 SHALL 从包根入口导出。签名中的时间单位为 ms，during 的进度含义及所有边界遵循本规格。Animation 用于独立手动驱动，Animator 用于自动调度；同一实例不能同时由调用者和管理器 tick。

```typescript
type AnimationValue = number | number[] | number[][]
type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
type AnimationState = 'PENDING' | 'RUNNING' | 'PAUSED' | 'FINISHED' | 'ABORTED'
type EasingFunction = (progress: number) => number
type EasingFamily =
  'quad' | 'cubic' | 'quart' | 'quint' | 'sine' | 'expo' | 'circ' | 'back' | 'elastic' | 'bounce'
type EasingType = 'linear' | `${EasingFamily}${'In' | 'Out' | 'InOut'}`
interface AnimationFrame {
  rawProgress: number
  directedProgress: number
  iteration: number
  terminal: boolean // 本次写入为自然完成或 finish 的终帧
}
interface AnimationTrack {
  target: Record<string, AnimationValue>
  property: string
  from?: AnimationValue // 普通任务省略时捕获当前合成值
  to: AnimationValue
}
interface AnimationConfig {
  initialize?: () => void // 注册事务成功后、延迟前同步初始化展示态
  tracks?: AnimationTrack[]
  duration?: number
  delay?: number
  easing?: EasingType | EasingFunction
  loop?: number | boolean
  direction?: AnimationDirection
  force?: boolean
  additive?: boolean
  during?: (easedProgress: number, frame: AnimationFrame) => void
  done?: () => void
  aborted?: () => void
  onError?: (error: unknown) => void
}
interface AnimationHandle {
  readonly id: string
  readonly state: AnimationState
  pause(): void
  resume(): void
  abort(): void
  finish(): void
}

interface AnimationScheduler {
  now(): number
  requestFrame?: (callback: (time: number) => void) => number
  cancelFrame?: (id: number) => void
  setTimer(callback: () => void, delay: number): unknown
  clearTimer(id: unknown): void
}
declare class Animation {
  constructor(config: AnimationConfig)
  readonly state: AnimationState
  start(time: number): void
  tick(time: number): boolean
  pause(time: number): void
  resume(time: number): void
  abort(): void
  finish(): void
}
declare class Animator {
  constructor(scheduler?: AnimationScheduler)
  animate(config: AnimationConfig, id?: string): AnimationHandle
  remove(id: string): void
  pause(id: string): void
  resume(id: string): void
  pauseAll(): void
  resumeAll(): void
  finishAll(): void
  clear(): void
  getAnimationCount(): number
  destroy(): void
}
declare const globalAnimator: Animator
declare function getEasingFunction(easing: EasingType | EasingFunction): EasingFunction
```

Animation.start 仅允许初始 PENDING 启动一次，结束实例不可重启；tick 返回是否已终止。独立 Animation 拥有私有属性组，不能与其他实例同时写同一个 target/property；并发/累加通过 Animator 使用。调度器省略参数使用宿主默认实现，注入时 requestFrame/cancelFrame 必须同时提供或同时缺失，缺失走静态规则。Animation 手动 tick 不依赖宿主 RAF。getAnimationCount 包含延迟和暂停、排除终止任务。未知 ID 的 remove/pause/resume 为无操作。clear 中止当前任务但不改变批量暂停设置；destroy 中止并清除暂停/定时器/所有内部组，之后允许重新 animate。控制器销毁不调用共享管理器 destroy。

#### Scenario: 引擎接口可归档及消费

- **WHEN** 使用 OpenSpec 的 delta 解析器及归档合并构造器处理本规格，并编译包根入口的类型消费用例
- **THEN** ENG-09 的 requirement 原文保留全部接口声明；AnimationConfig、AnimationFrame 和调度器接口可从根入口使用，不依赖被忽略的二级标题

### Requirement: ENG-10 注册初始化与终止屏障

initialize SHALL 仅在完整配置校验、同 ID/属性冲突处理以及新代次所有权复核通过后同步调用一次，早于延迟和首次绘制；普通 abort 保留值，初始化不得在工厂构造阶段发生。零时长、无变化和静态禁用分支 SHALL 跳过 initialize，直接提交终态。initialize 抛错 SHALL 中止该任务并报告异常，控制器恢复合法展示态。onframe/during 的 frame.terminal SHALL 在自然末帧及 finish 为 true，循环重启/普通帧为 false；abort 不生成终帧。终帧直接使用方向对应的端点（不调用自定义 easing 改变端点），因此终态不会受 easing(1) 非 1 影响。

Animator.finishAll/clear/destroy SHALL 在调用开始时固定任务快照并开启管理器级终止屏障，完成清理及回调后 finally 解除。屏障期间 animate SHALL 在任何初始化/写值/回调前抛出带 code='animation-terminating' 的 Error，不创建句柄、不触发新 done/aborted。递归调用批量终止为无操作。屏障外普通替换仍按 ENG-06 处理回调重入。Animation/句柄的单任务 finish 不建立管理器全局屏障；图表控制器批量结束使用自身 owner 屏障。

#### Scenario: 工厂构造不污染中断起点

- **WHEN** 旧展示值为 40，构造新预设但未注册，或随后用非法 duration 注册
- **THEN** 展示仍为 40；合法注册先处理冲突，再从当前态初始化；非法配置不调用 initialize、不取消旧任务

#### Scenario: 初始化与零时长

- **WHEN** 注册带 delay 的入场预设，或 duration=0 的同预设
- **THEN** 前者注册成功后同步设置隐藏初态再等待；后者从未写入隐藏初态，直接提交终帧并完成

#### Scenario: finishAll 遇到无限回调链

- **WHEN** 任务 done 回调通过 animate 继续创建下一段，期间管理器执行 finishAll
- **THEN** 当前任务按规则结束，续建请求立即以 animation-terminating 拒绝且无新回调；异常按既有回调隔离规则报告，finishAll 有界返回，队列为空
