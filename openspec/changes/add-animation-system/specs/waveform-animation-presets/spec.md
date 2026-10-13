## Purpose

规定系列整体入场、兼容数据插值、不兼容交叉淡化、同步展示域和受控标注出现及退场的行为契约。所有预设使用数值状态及更新回调，Vue 负责节点渲染，并保持业务数据不可变和终态资源清理。

## ADDED Requirements

### Requirement: PRE-01 系列整体入场裁剪

预设 SHALL 支持 left-to-right/right-to-left/center-out，在线条、散点和误差棒共同所属的系列组应用内层裁剪，并保留外层轨道裁剪。裁剪 ID MUST 跨实例唯一。首次有效非空显示及 data 更新新增系列 SHALL 触发入场；延迟前已设置初态，交错仅按当前页可见系列排序。

#### Scenario: 三方向半程

- **WHEN** 宽度 W 的系列以 linear 播放至 0.5
- **THEN** 三方向裁剪宽度均为 W/2，x 分别为 0、W/2、W/4；点和误差棒与线条同步出现

#### Scenario: 延迟与多实例

- **WHEN** 两个图表有同名系列，某系列延迟 200ms 入场
- **THEN** 裁剪引用不冲突，延迟前宽度为 0，无最终路径闪现；完成后恢复完整轨道范围

#### Scenario: 空数据和新系列

- **WHEN** 首次数据为空，之后以新引用提供非空数据
- **THEN** 空状态无动画任务，新系列就绪时入场；仅分页或隐藏后重现不触发整批重播

### Requirement: PRE-02 兼容更新插值与不兼容淡化

同 ID、同 lineType、同分段/命令结构、同几何渲染点 X 序列且点型/误差棒结构一致时，预设 SHALL 在数值空间插值并通过现有生成器生成路径；MUST NOT 插值 SVG 字符串。不兼容时 SHALL 对整个系列交叉淡化。非空到空/删除系列立即清除，空到非空执行入场。

#### Scenario: Y 值改变且域不变

- **WHEN** 新旧系列 X 序列相同、Y 值不同但目标域相同
- **THEN** 波形坐标仍平滑过渡，不把域插值误当成全部更新动画

#### Scenario: 采样或线型改变

- **WHEN** data 更新导致点数、采样 X 序列、线型或分段结构变化
- **THEN** 采用旧/新系列交叉淡化，点和误差棒同步淡化，不强行配对产生虚假波形

#### Scenario: 连续更新的内存上限

- **WHEN** 兼容更新未完成又收到兼容更新，或双份几何交叉淡化中又有新数据
- **THEN** 前者从当前展示值接续；后者若需要第三份几何则释放旧过渡并直达最新目标，每系列最多两份展示几何

### Requirement: PRE-03 同步展示域与几何

目标业务域 SHALL 立即更新，动画 SHALL 使用独立展示域，不修改真实域、输入或查询缓存。同轨道/同轴的轴、网格、系列和标注投影 SHALL 共享进度；固定域不插值。对应点插值数值后按当帧展示域投影，MUST NOT 再叠加一遍屏幕坐标插值；交叉淡化的两组使用相同展示域。刻度使用目标集合并随展示比例尺定位。

#### Scenario: 多系列共享 Y 轴

- **WHEN** 一个系列更新引起共享域变化
- **THEN** 该轴只有一条域时间线，其余系列、网格和标注同时重新投影，不分别改写同一 scale

#### Scenario: 固定域与 overlay 多轴

- **WHEN** 固定域系列发生更新，或 overlay 各轴域分别变化
- **THEN** 固定域保持不动但数据仍过渡；独立轴分组同步各自所属几何，不串用比例尺

### Requirement: PRE-04 四种标注效果与受控退场

预设 SHALL 提供 fade-in/scale/slide-in/bounce，默认 scale，fade-in 为 opacity 0→1（cubicOut），scale 为标签中心 scale 0→1 加淡入（backOut），slide-in 为标签相对布局向下 8px→0 加淡入（cubicOut），bounce 为 scale 0→1 加淡入（bounceOut）；显式 easing 覆盖默认，退场从当前状态到隐藏状态，opacity 限幅 [0,1]、scale 下限 0 但允许大于 1，引线与锚点仅淡化；不覆盖用于布局/拖拽的外层 transform。退场 SHALL 保存独立只读展示快照，结束后由 Vue 移除；退场节点不参与交互、序列化或受控数组事件。标注默认等待对应系列入场结束，内容更新不重播出现。

#### Scenario: 四种出现效果

- **WHEN** 为标注分别选择四种效果
- **THEN** fade-in 仅淡入；scale 围绕标签中心缩放并淡入；slide-in 从下方 8px 偏移到 0 并淡入；bounce 使用 bounceOut 缩放并淡入；均保留最终锚点和拖拽偏移

#### Scenario: 删除后重加相同 ID

- **WHEN** 父组件删除标注后在退场中重新加入同 ID
- **THEN** 旧 leave 被取消，从当前展示样式转向出现终态，不重复 DOM 身份，不因旧完成回调删除新标注

#### Scenario: 隐藏不等于删除

- **WHEN** 关闭 annotationsVisible、隐藏系列、切换分页或进入 cleanView
- **THEN** 立即清除不再可见的动画及退场快照，不修改 annotations，不对隐藏内容继续离场动画

### Requirement: PRE-05 展示域安全

域插值 SHALL 使用 q=clamp(easedProgress,0,1) 和凸组合 (1-q)*old+q*new；每帧域 MUST 有限、严格递增且非退化。目标域先通过现有域正规化，非法目标保留最近合法域并报告错误，非法中间域直接采用合法目标。不得把标注的回弹越界直接用于域；标注缩放仍可回弹。自定义 easing 非有限值按引擎异常处理，并使图表静态提交最新合法目标。

#### Scenario: 回弹缓动收缩域

- **WHEN** 域从 [0,100] 到 [49,51]，backOut 在 rawProgress=0.6 输出约 1.09935
- **THEN** 域使用 q=1 得到 [49,51]，不出现 [53.87,46.13] 的反转，标注可保留回弹效果

#### Scenario: 非有限缓动或浮点退化

- **WHEN** 自定义 easing 返回 NaN，或有限端点的中间凸组合因舍入退化
- **THEN** 前者终止并报告错误，后者直接采用合法目标；比例尺不接收 NaN、Infinity 或相等上下界

### Requirement: PRE-06 标注锚点过渡

可见标注的新旧数值锚点 SHALL 从对应完整规范化数据求得并缓存，不从采样点求得、不逐帧扫描完整数据。兼容更新时 SHALL 与波形使用同一 easedProgress 插值锚点值，再按展示域投影；固定域也适用，连续更新从当前展示锚点接续。交叉淡化只保留新系列标注，使用新锚点并随新组 opacity 淡入；移除旧展示不发受控删除事件。新端无锚点则隐藏，仅新端有效则从新端淡入。标签偏移保持消费者值，标签框及引线跟随当帧锚点。

#### Scenario: 固定域下锚点 Y 改变

- **WHEN** 对应波形点及完整数据锚点从 Y=0 更新到 Y=10，linear 进度为 0.5
- **THEN** 波形和锚点都在 Y=5 后投影，不出现标注提前跳到 Y=10

#### Scenario: 不兼容更新的标注归属

- **WHEN** 波形交叉淡化进度为 0.4
- **THEN** 只展示新数据锚点的标注，opacity 随新组为 0.4，无重复交互节点、不修改 annotations

### Requirement: PRE-07 单份几何终态协议

createPathTransitionAnimation SHALL 在 frame.terminal=true 时调用 write({kind:'settled',values:to})，此帧不包含 from、旧透明度或旧几何引用；兼容插值和交叉淡化统一采用该终态协议。调用者 SHALL 在处理 settled 时释放旧展示组及快照，再触发 onComplete；普通 abort 不生成 settled 并保留当前画面。零时长、自然完成和显式 finish 均适用；图表控制器整体终态提交可直接生成最新业务目标的 settled，不把旧任务过期目标重新播放一遍。

#### Scenario: 交叉淡化自然完成

- **WHEN** crossfade 的最后一帧到达
- **THEN** write 收到只含新几何的 settled，旧组/快照已释放，之后 onComplete 读取不到旧几何

#### Scenario: 零时长和结束控制

- **WHEN** duration=0，或交叉淡化中调用句柄 finish，或图表整体禁用
- **THEN** 前两者提交预设 to 的 settled；整体禁用提交最新业务目标 settled；都不留下 opacity=0 但仍持有旧几何的组
