# 实施验收索引

最终状态以本表、任务勾选和原始日志共同确认。OpenSpec 严格校验只验证规格结构。

## 规格、任务与证据

| 规格/范围 | 任务 | 实现与实际验证证据 |
| --- | --- | --- |
| 基线及迁移清单 | 1.1–1.6 | baseline.md、compatibility-matrix.md、reuse-inventory.md、export-map.md；原分析 241 文件/2163 用例、原展示 45 文件/502 用例；两个原修订固定 |
| 单包双组件与显式类型 | 2.1–2.4、2.9 | src/analysis.ts、src/display.ts、src/index.ts；manifest/声明后处理；final-package-confirmed.txt、final-unified-package.txt，42 个公开展示类型的别名等价检查 |
| Tree shaking 与跨入口身份 | 2.5–2.6 | package-bundles.json：Vite 8.1.5/terser 的 root-analysis、root-display、analysis、display 四种实际 .tgz 消费；CJS 可达依赖及 ESM/CJS 身份断言；浏览器交叉创建/查询/销毁 |
| 无 Vue、类型与 CSS | 2.7–2.8 | 独立原生临时项目先断言 Vue 不可解析，Bundler/NodeNext/Node10 均 skipLibCheck=false；Node 纯导入；packed-browser.json 的 standaloneDisplayWithoutCss=true；原有 Vue/CSS/WASM 消费继续由完整 test:package 验证 |
| 共享基础及依赖方向 | 3.1–3.5 | reuse-inventory.md；shared 下格式化、样式、几何及 DOM/observer 实现；check-native-boundary 对 shared 反向依赖和两子入口进行检查；final-check-native-boundary.txt、final-coverage.txt |
| 唯一动画内核及兼容 | 4.1–4.4、5.1–5.4、5.6、5.8–5.10 | Animator 为唯一任务实现，ElapsedTimeline 委托时钟状态；compatibility-matrix.md 给出具体用例及通知次数/顺序；final-coverage.txt 覆盖原展示测试、分析动画和导出生命周期 |
| 同页/iframe/外部任务隔离 | 5.5、5.10–5.11 | tests/display/integration/unifiedComponents.test.ts 三项通过，unified-ownership-final.txt；原生与展示 foreign-window 用例也纳入全量测试 |
| 性能及体积预算 | 1.4、1.6、5.7 | baseline-performance-production.txt、integrated-performance-production.txt 各 27 条正式观测，performance-comparison.json 有效指标均通过；bundle-comparison.json 三类相同生产消费体积预算均通过 |
| 重复生命周期和保留堆 | 5.7、5.11 | packed-browser.json：两视口，12 轮预热+12 轮正式创建/更新/销毁，CDP GC 后堆序列；每轮在宿主保留时检查 SVG/RAF/ResizeObserver 均为零，保留堆增长低于既定 8 MB 噪声预算 |
| 组件站、原场景和示例代码 | 6.1–6.4 | 原分析 URL 保留，/display 迁入完整原展示工作区，/components 双组件公开 API 控制；examples 源码同时运行并以 ?raw 展示；Ant Design Vue 统一 4.2.6，原测试完整保留 |
| 响应式及路由资源 | 6.5–6.6 | browser/results.json 与截图：1280/360，无水平溢出、重复 clip ID 或 pageerror；反复路由切换后帧/observer 数量与初始一致；components-display-* 补充内部滚动区下方图表截图 |
| 工程及综合验收 | 7.1–7.6 | README/AGENTS 更新；测试发现=241+45+1=287；final-static-gates.json、final-gates.json、final-coverage.txt、final-package-confirmed.txt；最终源码及产物指纹单独留存 |

## 已运行命令

| 命令 | 结果及日志 |
| --- | --- |
| pnpm install --frozen-lockfile | 通过，final-install.txt / final-gates.json |
| pnpm prepare:wasm | 通过，prepare-wasm.txt；Rust 源码未修改，构建产生的二进制及 package.json 格式差异未纳入本次变更；最终全量测试和发布包使用仓库原有 WASM |
| pnpm typecheck | 通过，final-typecheck.txt；示例最后补充右侧留白后再次检查 |
| pnpm check:file-length、lint:all、check:native-boundary、check:licenses | 通过，相应 final-* 日志；shared 反向依赖检查已接入现有门禁 |
| pnpm test:coverage --maxWorkers 4 | 通过，final-coverage.txt：287 文件/2668 用例；行 93.95%、语句 91.43%、函数 91.82%、分支 85.66%；动画/core 严格门槛保持且通过 |
| pnpm build | 在 test:package 的 prepack 中执行并通过，final-package-confirmed.txt；库、声明和统一 Demo 一次构建 |
| pnpm typecheck:examples | 通过，final-typecheck-examples.txt |
| pnpm test:package | 通过，final-package-confirmed.txt；现有 CI/发布流程执行该门禁时也执行统一组件及 Demo 验证 |
| node scripts/verify-unified-package.mjs <最终 tgz> | 通过，final-unified-package.txt；补充展示无 CSS 页面、预热后堆趋势及窄视口展示留白 |
| pnpm build:demo:app；node scripts/verify-unified-demo.mjs | 最后窄视口示例调整后复验，final-demo-build.txt、final-demo-browser.txt |
| node scripts/compare-unified-performance.mjs | 通过，performance-comparison.txt；数值预算未放宽 |
| BASELINE_ANALYSIS_ROOT=<原分析快照> node scripts/compare-unified-bundles.mjs | 通过，bundle-comparison.txt；源码生产消费体积与 .tgz 入口隔离分别验证，不混用指标 |
| openspec validate integrate-waveform-display-and-component-demos --strict | 见 openspec-final.txt |

## 失败历史及修复边界

- 原 baseline-performance-run.txt 含 Worker allow list 错误，不能作为性能基线；保留失败日志。后续从原分析修订快照和未改动的展示修订重建生产基线，修正动画启用/采样窗口，按原数值预算比较。有效数据为当前 baseline-performance.json，不能把历史失败描述成当时已通过。
- 原 full-coverage.txt 中 3 个 Demo 用例超时。单独无覆盖率运行 3/3 通过；覆盖率插桩下耗时超过原 10 秒。保留真实密集数据、全部控件和断言，将该测试专属超时调整为仓库已有的 30 秒标准。final-coverage.txt 全量 2668 用例通过；聚焦 coverage 运行虽然用例通过，但由于只运行一个文件，整体覆盖率门槛失败，不能将该聚焦命令记作全门禁成功。
- 原包消费浏览器临时路径在 macOS /var 与 /private/var 下不一致，导致 Vite HTML 输出失败；以 realpath 创建消费根目录后通过。
- 旧包验证脚本默认刷新 remove-waveform-antd-dependency/evidence 下两张已修改截图，本轮早期运行再次写入了这些文件；没有将其还原到 HEAD，避免进一步覆盖已有工作。已将输出改为显式环境变量优先、默认 artifacts/package；本次最终运行的证据位于本变更目录。
- 全量覆盖率后仅新增/完善验证脚本和窄视口示例右留白，库运行代码未改变；对应类型、包消费和浏览器验证已复跑。声明/构建文件为生成物，不手改。

不自动发布、推送、归档或删除原展示项目。原展示仓库 HEAD 仍为 74135cecaa12636647243c43e0be624827039f8a，已跟踪工作区干净。
