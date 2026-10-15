## Purpose

定义阶段切换条件与可复现验收方法。本文件中的阈值是计划验收标准，不是已测得结果。记录机器、浏览器、锁文件、提交/工作区快照和测量脚本，保证前后对照基于同一环境。

## Environments

- 使用仓库约定 Node 22、pnpm 10.32.1 和 frozen lockfile。Vue 使用当前锁定开发版本，并增加 peer 下限 3.2.33 的独立兼容消费检查；必要时使用只覆盖旧 Vue 支持配置的消费项目。
- React 使用实施时明确锁定的稳定 React 版本和匹配 React DOM/types，写入开发依赖与锁文件，不使用浮动 latest；开启 Strict Mode。React 是示例依赖，不是原生包 peer。
- 用仓库锁定 Playwright 对应 Chromium、Firefox、WebKit 跑主要浏览器路径；桌面 1280×800 与图表宽约 360px。缺失浏览器不能标通过；在交付中列出环境限制和未完成验收。
- ESM 和 CJS 导入均在无 window/document、无 Vue/React 的隔离消费者检查；DOM 绘制在浏览器检查。原生声明使用 skipLibCheck:false 验证依赖边界。
- 原生、Vue DOM ref、React DOM ref、Vue 包装分别检查；pnpm 安装 tarball 后核查实际依赖树，不能仅在仓库 node_modules 下验证。

## Gates

1. 基础入口阶段：包级依赖可选化及旧 UI 打包先完成，再建立 native 构建；此阶段只验证已提供算法/声明和无浏览器导入，不宣称完整图表可用。
2. 基础图表阶段：初始化/尺寸/数据更新/事件系统/销毁通过；三示例只使用 rendered 基础事件。此阶段不要求尚未迁移的缩放和标注业务事件。
3. 功能阶段：全部兼容矩阵项目与采样、交互、标注、动画和导出完成；部分模块可单独验收，但不得将原生整体标记为功能一致。
4. 预切换阶段：/native 和 /vue、三种 DOM 消费者在浏览器与隔离安装中通过；全量相关 gates 通过才可更改根入口。第 10 阶段内部先完成依赖/产物和验收，再执行入口切换任务。
5. 最终阶段：重新打包后核对根/native 的函数与实例身份、无框架依赖、Vue 迁移和完整 CI；没有自动版本发布步骤。

## Performance

- 同一机器、浏览器、尺寸和数据种子对比旧实现与新实现；生产构建、采样配置、动画开关保持一致。
- 固定 1/8 系列，每系列 10,000/100,000/1,000,000 点；分别测原始数据和当前推荐自动采样，typed 数据至少覆盖一组；若原始全量场景超出当前合理资源范围，先在基线记录双方相同的超时/点数上限，不能只减少新实现负载。
- 每场景预热 3 次，正式测量 10 次；采集初始化至稳定、数据替换至稳定、连续 100 次视口操作的处理时间与帧间隔，报告中位数及 P95。动画组单独测量，不混入关闭动画结果。
- 独立样本对照使用 `--collect-between-runs`：双方销毁后释放测量夹具的数据引用，在所有计时区外强制 GC 并等待两帧完成浏览器清理；每次创建、更新、动画和 100 次视口操作内部不强制回收，保持真实工作负载。报告明确记录是否启用；保留未隔离连续运行及诊断结果，不将两种方法混成一组统计。该方法减少数百轮共享页面的跨样本回收影响，不替代下述连续生命周期/资源验收，也不能据此声明连续创建没有长尾。
- 初始化和数据更新的“至稳定”以非空 SVG 稳定导出完成为终点，保留前置帧等待及真实采样/动画完成校验。导出后的额外 rAF 仍执行以隔离后续操作，但不计入该指标，避免完成后距下一帧的空闲相位被误当处理成本；连续 100 次视口操作的帧间隔仍完整计时。此前包含尾部 rAF 的报告单独保留，不能与此定义混算统计。
- 任一可比指标中位数或 P95 超过基线 20% 且绝对差超过 5ms，作为待修复回退；未满足阈值不得切换入口，除非用户明确接受具体已测差异并同步修改标准。
- 同浏览器做 30 次创建/交互/销毁循环，检查保留实例、监听、Worker、Observer、定时器/rAF 和 detached DOM 计数；计数回到基线，注册查询无旧实例。Chromium 可控 GC 的稳定堆增长超过 10% 且超过 5MiB 时排查并修复；其他浏览器不将不可获得的堆指标当作零。

## Visual and Behavior

同数据、字体、设备像素比、尺寸与操作状态比较截图；固定字体加载完成后采集，时间/动画相关截图固定帧或关闭动画。使用显式基线检查标题、水印、单位、轴、网格、线点、误差条、标注、图例及控件位置；未解释的尺寸/位置差超过 1 CSS px 或明显样式变化均待修复。颜色编辑器改为原生控件允许内部实现变化，但颜色、透明度、键盘操作、焦点和功能仍需通过；明确记录新增 UI 差异，不宣称像素完全相同。

行为证据覆盖受控请求未回传、字段移除、同调用栈新数据与命令、乱序采样、派发中销毁、失败初始化、异常监听、跨入口查询和导出稳定化。功能回归使用现有测试及新增原生实例测试，不能仅对 incidental SVG 结构断言。

## Required Commands

frozen install、typecheck、check:file-length、lint:all、test:coverage、build、test:package、pack --dry-run 与 OpenSpec 严格校验，逐项记录实际执行及结果。覆盖率至少保持 lines/statements/functions 80%、branches 75%，src 文本文件不超过 450 行。

## Final Verification — 2026-10-15

最终根入口为原生 API，/native 为同一实现别名，Vue 组件从 /vue 导入。以下结果在 Node 22.23.2 / pnpm 10.32.1 上实际运行；未采用性能例外或降低覆盖率。

| 验收项                 | 证据与结果                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同内核完整回归与覆盖率 | native-pipeline-coverage.txt：204 文件/1815 项；statements 90.76%、branches 84.83%、functions 90.78%、lines 93.08%，含动画核心阈值                                          |
| 完整性能矩阵           | native-performance-pipeline-complete.json：18 场景全部指标通过，6 个双方一致 raw 资源上限场景另记；原始失败保留                                                             |
| 资源生命周期           | native-pipeline-resources-browser.json：三浏览器各 30 轮，66 个图表/66 个 Worker，资源计数回到基线；Chromium 堆增约 0.49MiB、DOM 计数不变，另两浏览器堆不可获得             |
| 行为、导出与框架示例   | native-pipeline-export-browser.json、native-final-vue-adapter-browser.json、native-final-native-examples-browser.json：三浏览器桌面/360px、Vue 适配及 9 组 DOM ref 示例通过 |
| 最终入口与打包身份     | native-final-entry-tests.txt：35 项；native-final-package.txt：完整构建/声明/打包、真实 DOM 跨 root/native 初始化/查询/销毁通过                                             |
| 隔离消费与 SSR         | native-final-native-consumer.txt、native-final-vue-consumer.txt、native-final-vue-minimum-consumer.txt：ESM/CJS 全部运行时导出共享、严格声明、无框架依赖、Vue 当前/下限通过 |
| 工具链与发布预演       | native-final-frozen-install.txt、native-final-package.txt、native-final-length.txt、native-final-lint.txt、native-final-format.txt、native-final-pack-dry-run.txt 实际通过  |
| 边界与原始出口         | native-final-boundary.txt：191 模块；native-final-symbol-inventory.txt：134 个原始出口可追踪，Vue 组件移至 /vue，其余 133 个 root/native 同一 symbol                        |

完整覆盖率在入口切换前的同一内核执行；入口切换仅重排公开 barrel 和验证脚本，随后以针对测试、完整声明/产物消费和浏览器再次验证。旧版系统色板 Esc/焦点实机证据仍见 native-system-palette-checks.json。版本保持 0.1.77，README 记录下一次破坏性发布建议及回退基线；没有提交、推送、标签、发布或归档操作。
