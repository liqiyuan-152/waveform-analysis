## Purpose

在波形组件内部统一提供 Y 轴上下独立留白能力，使消费者仅需配置开关和比例即可获得一致的自动范围，兼容已有上方比例 API，并保持固定范围、手动视口和不同显示模式的行为稳定。

## ADDED Requirements

### Requirement: 双侧配置与旧调用兼容

组件 SHALL 支持 axes.y.upperPaddingEnabled、lowerPaddingEnabled、upperPaddingRatio 和 lowerPaddingRatio。每侧显式 false 优先关闭；显式 true 且比例省略使用 0.1；开关省略时已有有限正比例继续生效；全部省略不添加留白。零、负数及非有限比例 SHALL 不扩展范围。

#### Scenario: 旧调用保持上方比例
- **WHEN** 仅配置 upperPaddingRatio=0.1，自动范围为 [0,100] 且 nice=false
- **THEN** 最终范围为 [0,110]，下方不扩展

#### Scenario: 独立开关与默认比例
- **WHEN** upperPaddingEnabled=false、upperPaddingRatio=0.2、lowerPaddingEnabled=true 且下方比例省略，自动范围为 [0,100] 且 nice=false
- **THEN** 最终范围为 [-10,100]

#### Scenario: 省略或无效配置
- **WHEN** 两侧配置均省略，或比例为零、负数、NaN、Infinity
- **THEN** 对应侧不添加比例留白，输出范围保持有限

### Requirement: 使用同一自动范围跨度

组件 SHALL 基于常量回退之后、比例留白和 nice 之前的同一范围 [a,b]，计算 [a-(b-a)*lowerRatio,b+(b-a)*upperRatio]，不得依次扩大跨度。范围 SHALL 基于完整数据及既有误差棒、系列分组规则；溢出侧退回原边界；不得修改消费者输入或把扩域结果缓存为原始数据域。

#### Scenario: 双侧各百分之十
- **WHEN** 原始自动范围为 [20,80]，上下各 0.1 且 nice=false
- **THEN** 最终范围为 [14,86]，重复渲染结果不累积

#### Scenario: 常量与误差棒
- **WHEN** 输入为常量或启用了误差棒
- **THEN** 常量沿用现有非零范围回退后计算跨度，误差棒参与上下限；空数据不产生虚构的数据最大值

#### Scenario: 多轴与显示模式
- **WHEN** 在单 Y 轴叠加、多 Y 轴和独立、分离、紧凑模式间切换
- **THEN** 单轴按合并范围、多轴按各自轴组范围计算，比例规则不随显示模式改变

### Requirement: 固定视口与刻度取整兼容

组件 SHALL 跳过固定轴组和手动 Y 视口的比例扩域，沿用既有固定轴组判定。nice SHALL 在自动比例扩域后执行；关闭比例不禁止 nice 取整。修改开关不得清除手动 Y 视口，reset/fit 恢复自动范围时重新计算一次。

#### Scenario: 固定与手动范围
- **WHEN** 固定范围或手动 Y 视口为 [20,40] 且 nice=false，上下留白开启
- **THEN** 范围仍为 [20,40]；手动视口重置后才对自动范围应用当前比例

#### Scenario: nice 可继续扩域
- **WHEN** 开启 nice 和比例留白
- **THEN** 对添加留白后的范围执行既有 nice 算法，不承诺最终留白恰等于配置比例

### Requirement: Demo 和外部接入

组件 Demo SHALL 在配置区提供上下独立开关和百分比输入，默认显式开启各 10%；关闭时保留数值并禁用对应输入。组件省略配置 SHALL 保持旧默认。文档 SHALL 说明仅自动范围生效及 nice 影响；宿主只传 axes.y 配置，不自行计算范围。

#### Scenario: Demo 单侧关闭
- **WHEN** 关闭 Demo 上方留白且保留下方开启
- **THEN** 自动范围仅使用下方比例，上方输入保留 10% 但禁用，重新开启恢复该值
