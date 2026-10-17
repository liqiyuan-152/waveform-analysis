## ADDED Requirements

### Requirement: 紧凑输入的受限 JavaScript 索引

typed 和 samples 输入的 JavaScript 采样路径 SHALL 为 peak/min/max/minmax 支持按需构建受预算限制的索引，避免仅为索引创建全量点对象。源索引、相等值取舍和边界 SHALL 与当前参考结果完全一致；none 保持直通，LTTB 及额度不足时 SHALL 使用原后备路径。

#### Scenario: WASM 不可用时反复缩放

- **WHEN** 既有模式允许 JavaScript 降级且 WASM 不可用，紧凑数据连续改变可视范围
- **THEN** 适用策略复用有效索引，各次结果与既有参考算法在原容差内一致

#### Scenario: 异常输入与数据替换

- **WHEN** 输入含非有限值、重复 X、乱序或稀疏样本索引，随后替换数据引用
- **THEN** 归一化和范围语义保持兼容，旧索引失效，域、最近点、误差范围仍来自完整新源

### Requirement: 聚合数值兼容优先于索引复用

紧凑输入的 sum/average SHALL 默认保留数值参考实现的顺序聚合，不直接复用分层求和或放宽既有容差。聚合索引候选 SHALL 验证大动态范围、抵消、中间溢出和非有限结果；未证明兼容时 SHALL 保留原路径，不阻塞极值索引交付。

#### Scenario: 正负抵消的单桶聚合

- **WHEN** x=[0,1,2,3]、y=[1e16,1,-1e16,1]、目标桶数为 1
- **THEN** 紧凑 JavaScript 路径的 sum 为 1、average 为 0.25，不能用分层索引的 0 替换

#### Scenario: 中间溢出或非有限结果

- **WHEN** 有限输入在聚合中产生溢出或抵消，或请求不同桶边界
- **THEN** 对照当前数值参考实现，保持 NaN/Infinity 分类及既有数值断言；未通过兼容验证的候选继续使用原路径
