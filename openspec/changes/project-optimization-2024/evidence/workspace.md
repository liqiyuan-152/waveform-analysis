# 阶段 2：Workspace 隔离

日期：2026-10-16。起点、原有修改和工具链见 baseline.md。
未提交、未发布、未修改版本或公开 exports；阶段 3–7 未实施。

## 实现与边界

- demo 迁入 private `demo-app`，包括 HTML、路由、样式、数据和测试。
  `src/data` 仍归库所有。demo 仅使用 `waveform-analysis`、`waveform-analysis/vue`
  和公开 CSS 入口，不将私有 helper 扩大为 API。
- 保留已有 workspace `allowBuilds`，新增 demo-app 与 private tests 包。
  UI 依赖在 demo 和历史测试夹具所属包中显式声明，根移除对应开发依赖。
  库 dependencies、peers、exports、typesVersions 保持不变。
- demo 的 toolbar 展示配置、窗口域对齐和公开 normalization 适配由 demo 自有模块负责；
  空窗口保持 series ID 的回归测试见 demo-app/tests/demo/normalizeDemoSeries.test.ts。
- 根 `@`/`@tests` 保留库/根测试语义；demo 自己的 `@` 指向 demo 源码；
  根测试使用 `@demo`。根 TS references 包含 demo 项目与构建配置。
- 根 dev 准备 WASM → 库 → 声明后启动监听与 demo；build 与独立 build:demo 均输出根 dist-demo。
  CSS 复制移入构建插件，使 watch 同步 native/style.css；声明监听保留 WASM 声明后处理。
- 库 Vite base 改为相对路径，修复跨 workspace/独立消费者 Worker 路径；未切换压缩器或压缩参数。
- 根 Vite 配置保留 Vitest 和历史夹具支持；旧浏览器脚本的 demo HTML 路径已迁移。
  GitHub/Gitea 保持根命令，Gitea 部署仍读取根 dist-demo，无需更改部署路径。
- Windows 检查脚本使用系统路径分隔符，并在许可证比较时统一 CRLF/LF；
  不改变许可内容或边界规则。初次失败和通过复测日志均保留。

Dockerfile.dokploy 与 deploy/Dockerfile.demo 同步复制 workspace 清单和 demo/test importer，
后者移除根 index.html 的旧 COPY；构建阶段提供 Rust 1.95.0、WASM target 和 wasm-pack 0.14.0，
以满足独立 build:demo 的库准备顺序。两个 Docker ignore 增加递归 node_modules 排除。
本机没有 docker 命令，镜像未构建；这里只完成路径/工具链静态核查，不声称容器运行验收。

## 验证记录

| 验证                                      | 结果与证据                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 根 frozen install                         | 通过，workspace-install.txt                                                                                                              |
| 干净副本 frozen install                   | 通过，workspace-clean-install.txt；锁定 importer 安装                                                                                    |
| 显式依赖/公开导入                         | 通过，workspace-dependency-audit.json；根 node_modules 无三个 UI 包链接，demo 自有链接可解析                                             |
| 根 typecheck / examples / 长度 / lint:all | 通过，workspace-checks.json；覆盖 demo、库、测试和两套 Vite 配置                                                                         |
| native boundary / licenses                | 初次有 Windows 路径/换行失败；修复后通过，workspace-check-*-recheck.txt                                                                  |
| demo 单测                                 | 首轮 12 文件/36 测试通过；适配生产 SFC 的公开 expose 读取后另外 5 文件/28 测试通过，workspace-demo-tests.txt、workspace-demo-recheck.txt |
| 根完整 build（干净副本）                  | 退出 0，workspace-clean-build.txt，根 dist 与 dist-demo 均生成                                                                           |
| 独立 build:demo                           | 删除副本 dist/dist-demo 后退出 0，workspace-standalone-demo-build.txt；没有构建循环                                                      |
| 独立 tarball 消费                         | 退出 0，workspace-package.txt；三入口 ESM/CJS/TS 声明、CSS 同一内容、无 AntD 传递安装、真实 WASM 与 Worker                               |
| 三次安装/构建复测                         | 全部有效采样退出 0，workspace-install-after.json、workspace-build-after.json                                                             |
| OpenSpec strict                           | 退出 0，workspace-openspec.txt；不表示后续阶段已经完成                                                                                   |

完整覆盖率串行复测退出 1：226 文件中 225 通过，2064 测试中 2062 通过，耗时 2080.77 秒。
仅 integerZoomStall.test.ts 的 independent/separated 两例触及原有 20 秒超时；
属于基线同一文件/同一失败类型。日志为 workspace-coverage-serial.txt，不记录全量覆盖率通过。
首轮同时执行测量时首个文件有 4 个超时，在可用内存约 300 MB 时停止，保留 workspace-coverage.txt。
没有改变 testTimeout、排除文件或覆盖率阈值。
coverage 线程池定向复核仍为 5/7 通过、两例 20 秒超时（73.19 秒，退出 1），
见 workspace-coverage-targeted-threads.txt；普通单 worker 定向复测 7/7 通过
（38.66 秒，退出 0），见 workspace-timeout-recheck.txt。
这些结果只能支持专项迁移行为已验证、超时与覆盖率开销有关，不能证明完整覆盖率门槛已通过。

历史根 Vite 夹具入口也已复测：`node scripts/test-main-sync-browser.mjs` 退出 0，
workspace-main-sync-browser.txt 和 main-sync/ 下记录 native 1200/360px 与 demo 1440/390px；
检查空窗口恢复、图例/工具栏样式、布局、导出与悬浮行为，page errors 为空。

## 干净启动、监听与浏览器

补充：本节早期验证使用了临时 Rust 环境与 JS 版 pnpm，未覆盖普通 Windows 终端。
后续发现并修复原生 pnpm.exe 调用及启动依赖 Rust 的问题；最新行为及复验见 [startup-fix.md](startup-fix.md)。

workspace-clean-copy.json 记录基线 HEAD 的本地 clone 与当前修改覆盖方式。
副本位于临时目录 `waveform-workspace-6AOjyI/clean checkout`（含空格），
初始没有 node_modules、dist 或 dist-demo；安装后直接执行根 `pnpm dev --host 127.0.0.1 --port 5287 --strictPort`。
WASM 从源码准备、库/声明构建成功，随后 demo 可访问。

workspace-browser.json 记录 demo TS、demo Vue、库 Vue、库 CSS/native 副本和声明探针，
修改仅在副本执行，finally 恢复原文件。早期结果的 Vue 自动整页刷新暴露了 Vite build API
设置同进程 NODE_ENV=production 的问题；已恢复原环境，再验证 demo Vue 无页面导航的 HMR。
包产物重建触发的自动页面刷新与 Vue HMR 分别记录，不承诺保留库实例状态。
最后一轮五项探针的 automaticNavigations 均为 0，demo Vue 的测试显式断言无页面导航。
Ctrl-C 退出后端口 5287/5288 无监听、dev 和 vue-tsc 子进程均不存活，见 workspace-dev-cleanup.json。

根 `pnpm preview --host 127.0.0.1 --port 5288 --strictPort` 在副本启动成功。
workspace-preview-browser.json 与 preview-_.png 覆盖四路由 `#/`、`#/fixed-y-domain`、
`#/animation`、`#/wasm-sampling`，视口分别为 1200×900、360×900。
检查实际曲线几何后截图，主 demo 验证放大、平移、重置、标注保存、分页和 SVG 下载；
导出文件为 workspace-export-{1200,360}.svg。动画路由验证稳定入场后的标注、振幅与点数更新；
WASM 路由等待全部十个通道显示真实 wasm 后端。
独立消费者还验证了 1200×850、360×844 下的标注 CRUD、颜色、校验、分页和卸载清理，
截图为 packed-consumer-_.png。浏览器范围为 Chromium；没有声称本次验证 Firefox/WebKit。

## 三次测量对照

所有数字为逻辑字节，不跟随符号链接，不等于文件系统分配大小。
安装使用新目录和任务专属 pnpm store，cold 为新 store，hot 为同一 store 的新目录；
都是 manifest-only、ignore-scripts，不包含源码、WASM 编译或产物构建。
原始记录和汇总见 workspace-comparison.json。单位为毫秒，中位数：

| 范围                       | cold 前 → 后    | hot 前 → 后     | cold node_modules 字节 前 → 后 |
| -------------------------- | --------------- | --------------- | ------------------------------ |
| workspace                  | 78,225 → 80,168 | 16,066 → 17,208 | 263,753,369 → 263,756,829      |
| library-dev（仅根 filter） | 69,646 → 24,961 | 14,955 → 6,412  | 263,757,875 → 184,208,617      |
| runtime（根 prod filter）  | 4,234 → 4,463   | 1,477 → 1,490   | 5,306,731 → 5,307,851          |

完整 workspace 仍安装全部 demo/测试 UI 依赖，成本未下降；根开发范围不再安装这些 UI 包，
逻辑字节减少约 79.5 MB。runtime 依赖未变化，字节差来自 importer/链接元数据。
两组测量都与其他任务有重叠；迁移后初期内存压力尤其明显，不能把耗时差解释为确定提速。
重复启动的 library/runtime 独立测量不纳入对照；唯一主数据集 workspace-install-after.json
已包含三个范围各三组完整采样。中断记录单独保留。

build:lib 三次前为 13,684 / 10,235 / 8,361 ms，后为 39,711 / 37,232 / 36,449 ms。
后测与安装/浏览器重叠，观测到变慢，未获得构建提速证据。
CSS 总计 65,196 字节、声明 226,023 字节均不变；全部去重 JS gzip 从 352,043 到 352,172 字节。
根/native ESM（含可达 worker）226,844 → 226,849，CJS 227,035 → 227,162；
Vue ESM 194,690 → 194,697，CJS 194,729 → 194,855 字节。
WASM 仍为内联，解码体积 55,331 字节、摘要与基线构建一致。
tarball 694,969 → 662,697 字节；files 规则未扩大，demo 源码不再随库的 src 目录发布。

## 保留项

原有 .kiro、remove-antd-from-waveform-library change 和 workspace allowBuilds 保留。
原有 WASM 二进制在全部检查后按备份恢复并校验，避免生成文件覆盖用户修改。
workspace-preservation.json 记录恢复成功：60,161 字节，SHA256 为
`d4f4984c072d7a65df53cce39845c72074abe85d4f6481d84ae702ece367a400`。
检查使用的是重新生成的 WASM；恢复后未再运行会覆盖它的 WASM 准备命令。
完整覆盖率未通过、Docker 镜像构建未验证；后续阶段及完整验收/归档均保持未完成。
