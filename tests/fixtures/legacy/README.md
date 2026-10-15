# Historical Vue comparison fixture

此目录保存迁移期间用于对照的旧 Vue 编排、视图和控件，按原 `src/` 相对目录组织。
它不属于发布源码或声明，也不能被 `src/` 导入。生产图表仅保留原生实例和 Vue 薄适配。

保留这些文件是为了独立比较原始 Vue 绘制、手势、标注和布局，以及执行同机性能对照。
纯算法、采样协议和共享动画状态机仍引用当前 `src/` 的公共实现，避免在夹具中复制它们。
迁移前基线提交为 `247144ee3e88a7fceb6cb3382fb80eb5b274dd3e`；夹具包含实施记录中
已说明的共同算法提取和修复，不能宣称它与该提交逐字相同。

`tests/support/LegacyWaveformChart.vue` 是对照入口，仅额外暴露测试稳定查询；
实际消费者和原有 chart cases 使用新 Vue 适配器。新增功能应在原生实现及其测试中维护，
不向此历史夹具加入产品功能。

移入前的模块图与各文件 SHA256 见迁移提案的
`evidence/legacy-only-module-audit.json`、`evidence/legacy-relocation.json`。
