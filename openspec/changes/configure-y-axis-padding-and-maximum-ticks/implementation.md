# 实施与验收记录

日期：2026-10-11。当前分支 codex/plan-waveform-reliability-refactor，HEAD 保持 fdc85d8，未提交、推送、发布或归档。

## 基线与冲突决策

- 基线文件、SHA-256、Git 引用及完整二进制差异已保存到 `/tmp/waveform-y-padding-baseline/`。
- 本次采用需求范围内的功能整合：将远端 7a47872 已有 upperPaddingRatio 的配置、自动域计算和测量传递能力接入今天的工作区，再扩展双侧规则。没有将 origin/main 的 72 个独有提交全量合并，也没有把工作区版本伪装成 0.1.71；package.json 仍为 0.1.63。
- 刻度算法冲突保留今天未提交的 niceScale 实现，原有 resolveYAxisTicks 函数体经对比确认完整保留。未覆盖为远端 D3 nice 实现。
- 今天的 compactFrame 公共边去重文件及 WaveformChartView / WaveformTrack 改动保持字节一致；工具栏及受控模式回归通过。
- 未涉及的布局测试、部署、main.ts、文档及其他原有文件均通过基线哈希核对。layout.ts 在原有修改之上扩展留白逻辑。
- 构建会准备 WASM；所有检查完成后恢复原有本地 wasm 二进制，撤回本次生成的 wasm/pkg/package.json 变化。没有更新仓库依赖或宿主仓库。

## 结果

- axes.y 新增上下独立开关及下方比例，保留旧 upperPaddingRatio 的配置方式；显式开启的缺省比例为 10%，组件省略配置保持不扩域。
- 原始最大值在数据准备阶段保留，不因常量回退、采样、留白或 nice 丢失；固定域和手动视口的优先级不变。
- 在现有轴渲染中插入最大值刻度，按实际文字矩形和线宽处理普通刻度冲突；不改变比例尺。字体完成、布局更新及图片导出前重新计算可见性。
- Demo 配置区提供上下开关和百分比，默认各开启 10%；关闭保留比例，输入禁用。README 与包消费示例包含新旧 API。

## 实际检查

- pnpm typecheck：通过。
- pnpm check:file-length：通过，仍为 450 物理行限制。
- pnpm lint:all：通过。
- pnpm test:coverage：89 个文件、592 项测试全部通过；Statements 90%，Branches 84.18%，Functions 91.08%，Lines 92.41%。
- pnpm build：通过，包含库、声明与 Demo。
- pnpm test:package：通过，包含嵌套 prepack、公开配置类型、新旧 API、ESM/CJS 消费。
- 最后仅调整 Demo 控件网格样式，再运行对应 Demo 测试与 pnpm build:demo，均通过。
- git diff --check：通过。
- 记录日志：`/tmp/waveform-y-padding-{coverage,build,package}.log`。

## 浏览器证据

使用 Chromium 实际组件和综合 Demo：

- 桌面 800px 图框：100 与 100.1 过近时，100 标签和短刻度保留，100.1 标签和短刻度隐藏，上边框仍存在。SVG 导出包含同一最大值及隐藏标记。
- 独立、分离、紧凑三模式的左右双轴均得到范围 a=[14,86]、b=[-210,-90]，分别显示 80 和 -100。
- 360px 小容器：两个最大值保留、两个近邻普通标签隐藏；PNG 实际解码为 358×258。
- 关闭上方后特殊最大值数量为 0，下方范围仍生效；重新开启恢复。综合 Demo 实测 4→0→4，关闭后比例输入禁用。
- 带注解的 360px 图框中，100 的最大值刻度 Y=13.166666666666673，注解箭头端点 Y 完全相同；SVG 导出同时包含最大值和注解。
- 截图及数据见 evidence/。浏览器工具的直接保存接口拒绝路径，改为将其返回的原始截图数据保存到仓库，没有编辑图片。

## 限制

- 未做 Firefox/Safari 验证。
- 极小图框中两个特殊最大值标签互相冲突时按规格同时保留；不通过移动数值或扩域伪造空间。
- 原有工作区仍有独立于本次需求的未提交内容；本次不承担远端所有提交的全量整合或发布。
