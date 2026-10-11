## 1. 契约与兼容基线

- [x] 1.1 记录当前工作区与公开入口，列出旧数字索引方法、事件、默认模式和未提交文件；交付兼容对照表，不改动无关部署/niceScale/WASM 文件。
- [x] 1.2 增加旧 resetViewport/setViewportDomain 数字签名及原事件回归，验证关闭 toolbar 的旧用法通过。
- [x] 1.3 定义 toolbar、mode、target、result/state、export options/error 与组件 handle 类型（含按命令种类区分的结果、逐目标快照、command gesture 和 commandId/source/action）；同步显式入口，用类型测试验证新旧 ref 调用均无 any。

## 2. 统一命令与模式

- [x] 2.1 实现共享命令状态与当前页 trackId 解析，测试共享/独立、合并系列、重排、隐藏页、未知 ID 和目标失效行为；验证 applied > unchanged > disabled > empty-data 汇总、空图框保留和非法命令不部分执行。
- [x] 2.2 实现受控/非受控模式、update:interactionMode、实际变化事件与状态快照；测试 requested 不提前生效、无循环通知且返回快照不能修改内部状态。
- [x] 2.3 支持显式 pan/none 并保留 Space 临时平移；测试 zoomable/pannable/annotationsVisible/presentationMode 禁用规则及切换/替换/卸载取消手势。
- [x] 2.4 实现 zoomIn/zoomOut 和旧方法的对象重载，保留旧数字路径；测试中心缩放、X 秒坐标、最小跨度/点数/倍率、边界 unchanged 与不同目标的返回结果及部分成功只通知已改变目标。
- [x] 2.5 分离 initialBoundary/effectiveBoundary，并统一滚轮、框选、平移、命令和 D3 transform/extent；测试 fit 后连续手势无跳变、倍率基于有效跨度（6/10 对应 0.6/1）、固定/自动 Y、空数据、新旧 reset/旧数字 setter 退出 fit，以及数据/可见性/初始域/分页/显示模式变化清理边界，fit/reset 本身不翻页。
- [x] 2.6 接入新命令事件和外部 defineExpose，按事件协议测试 intent→change→end 的顺序/来源/次数、fit 仅 change/end、unchanged reset 仅 reset、其他无效或无变化不通知、旧数字方法静默；验证多目标共享 commandId、回调替换数据仍使用快照、control-state-change 合并及单入口加载不重复。

## 3. 内置工具栏

- [x] 3.1 实现独立工具栏视图、boolean/object 配置、位置、ordered items 及 export 菜单；测试默认关闭、空集合、去重、动态显示不重置状态。
- [x] 3.2 接入实际模式高亮、禁用态和当前页目标选择；测试外部调用同步高亮、分页/数据变动清理失效目标以及独立拖动仅影响所拖图框；验证任一目标可变化即启用、全部不可变化禁用，以及初始视口 reset 仍可触发恢复意图。
- [x] 3.3 完成 hover/always、键盘焦点、触屏可达、Escape 与指针隔离；组件测试验证按钮不触发底层框选/注解，小容器可访问全部操作。

- [x] 3.4 建立内部按钮注册表，统一 ID/图标/标签/分组/命令映射和状态选择器，不新增注册表公共导出；验证所有按钮复用命令能力、PNG/SVG 共用导出入口，并回归受控请求未回传时高亮及 aria-pressed 不提前变化。
- [x] 3.5 实现模式/视口/导出默认分组，保持扁平 items API；测试默认三组、自定义跨组顺序去重后不重排、单组/空组/分隔线、禁用按钮保留、动态配置不改模式或视口，以及 360px 折叠后的顺序、键盘操作和功能可达性。

## 4. 图片导出

- [x] 4.1 实现导出版本捕获与稳定等待、并发互斥及超时；可控采样测试覆盖当前结果、旧响应、data/视口/注解/尺寸变化和卸载。
- [x] 4.2 实现自包含 SVG 快照，包含中文标题/轴/图例/注解及当前样式，排除操作层；测试隐藏系列/非当前页过滤和空坐标系。
- [x] 4.3 实现 PNG 编码、scale/background、Promise<Blob> 与错误码；测试有效尺寸、非法参数、零尺寸、编码失败，不产生自动下载或修改源数据。
- [x] 4.4 接入工具栏下载及失败反馈；测试 export-busy、超时、取消后按钮恢复与 DOM/Canvas/URL/监听清理。

## 5. Demo 与消费者文档

- [x] 5.1 在示例 Demo 默认启用内置工具栏及所需能力，在参数区提供开关；检查不存在第二套外部操作按钮，并能通过内置入口完成全部功能；将 DemoChartHost 的 update:interactionMode 回传 App ref，验证平移/注解实际生效，WASM 示例验证非受控模式；移除 DemoViewControls 既有重置及重复模式按钮，保留 zoom-reset 数据恢复，zoom-end 加载忽略 fit，测试取消在途请求与恢复数据。
- [x] 5.2 更新 README 的外部 ref、受控模式、toolbar 配置、trackId/旧索引、fit/reset 和导出异常示例；补充逐目标结果/部分成功、command gesture 穷举迁移及 intent/end 二选一加载示例；用 TypeScript 检查可编译性及声明出口。

## 6. 综合验收与交付

- [x] 6.1 真实浏览器验证组件及 Demo 的 1280×800 桌面和约 360px 容器，覆盖框选/平移/注解、模式禁用、目标、分页、外部接口同步与快速 data 替换，保存截图/轨迹。
- [x] 6.2 在真实浏览器解码导出 PNG、单独打开 SVG，对比中文/标题/图例/注解/线型/背景，确认两种尺寸及 scale、排除操作层、异步失败和卸载均符合 spec。
- [x] 6.3 运行 typecheck、check:file-length、lint:all、test:coverage、build、test:package；满足 450 行限制和覆盖率门槛，验证 ESM/CJS/声明兼容；重建 WASM 前备份既有二进制。
- [x] 6.4 更新实施及实际验证记录，未完成项保持未勾选；运行 OpenSpec 严格校验并复核无关工作区改动保留，不自动提交、推送、发布或归档。
