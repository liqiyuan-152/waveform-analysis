# 阶段 1：基线与迁移准备

日期：2026-10-16（Asia/Shanghai）。起点 commit：`4bd09b90eb0571bc45eaf5ecc9a38d55b548bc0c`。
本次不提交、不发布、不创建标签；工作区结果并非该 commit 的干净快照。

## 工作区保护

开始时 `git status --short`：

```text
 M wasm/pkg/waveform_sampling_wasm_bg.wasm
?? .kiro/
?? openspec/changes/project-optimization-2024/
?? openspec/changes/remove-antd-from-waveform-library/
?? pnpm-workspace.yaml
```

原 WASM SHA256：`d4f4984c072d7a65df53cce39845c72074abe85d4f6481d84ae702ece367a400`。
已在仓库外备份，所有需要 Rust 的验证结束后恢复原字节，避免覆盖已有二进制修改。
原 workspace 内容为 `allowBuilds` 下的 core-js/vue-demi 提示字符串；迁移只合并实际包路径，保留原设置。
`.kiro` 和其他 change 不修改。

## 环境和初始检查

Windows 10.0.26300，AMD Ryzen 7 5800H；Node v22.22.2，pnpm 10.32.1。
默认 PATH 下 Rust/Cargo/wasm-pack 不可用：首次 `pnpm typecheck` 退出 1，`spawnSync rustc ENOENT`。
找到并使用本机既有隔离工具：
`C:/Users/lqy15/.codex/tmp/waveform-release-tools/environment.ps1`。
该文件仅对当前命令进程设置环境，不修改用户全局 PATH。
Rust/Cargo 1.95.0，wasm-pack 0.14.0，活动工具链 1.95.0-x86_64-pc-windows-gnu；
与 CI Rust 版本一致，但本机 host 为 Windows GNU，CI 为 Linux。

初始 `pnpm lint:all`、`pnpm check:file-length` 退出 0。
其余检查、耗时、退出码及原始输出由 baseline.json 和 baseline-N.txt 记录。

## 测量方法

复现：加载上述环境后运行
`node scripts/measure-workspace.mjs baseline <pnpm.cjs绝对路径>`。
先检查 typecheck、文件长度、lint:all、覆盖率，再执行至少三轮 build:lib/build:types。
build:lib 的计时不包含 WASM 准备、类型声明或 demo；依赖缓存热，dist 每轮由 Vite 重建。
每个入口按静态相对 JS/CJS 引用闭包去重计算 gzip，另记所有 JS 去重合计、CSS/WASM/声明逻辑字节和 tarball。

安装使用临时目录内仅包含清单与锁文件的副本，禁用生命周期脚本以测量下载/链接成本。
每个 scope 三对独立 store：cold 初始为空，hot 复用同对 store 但安装到另一空目录。
不清理、不测量用户共享 store。workspace scope 安装全仓；runtime scope 用
`--prod --filter waveform-analysis` 测量库运行时依赖，**不是完整库开发环境**。
磁盘按 node_modules/dist/dist-demo 路径统计普通文件逻辑大小，不追随符号链接，
不等同 NTFS 实际分配空间，也不把共享 store 归入单包大小。
保留三次原始数据，比较中位数；不把历史估算或预设提速比例作为通过条件。

安装原始数据单独保存为 baseline-install.json（12 次命令均退出 0）：

| 范围                                         | 冷 store 中位数 | 热 store 中位数 | 冷安装 node_modules 逻辑字节 |
| -------------------------------------------- | --------------: | --------------: | ---------------------------: |
| 全仓清单                                     |       78,225 ms |       16,066 ms |                  263,753,369 |
| 根库包开发依赖（--filter waveform-analysis） |       69,646 ms |       14,955 ms |                  263,757,875 |
| 库 runtime                                   |        4,234 ms |        1,477 ms |                    5,306,731 |

根库包开发范围另存 baseline-library-dev.json，六次命令均退出 0；迁移前这些开发依赖仍包含 demo UI。
该范围指根包自己的工具/依赖，不等同迁移后整仓 demo/历史夹具的完整测试环境。

安装测量时基线覆盖率进程同时运行，因此安装数据包含本机竞争负载，不能用于宣称精确的迁移加速比例。
首次未限制 worker 的覆盖率运行出现资源竞争和失败，被主动终止，输出保留在
baseline-interrupted-coverage.txt，命令记录在 baseline-initial-attempt.json；不算通过。
随后按 CI 的 `--maxWorkers=2` 执行完整覆盖率。

## 阶段结果

完整覆盖率命令退出 1：225 文件中 221 通过、4 失败；2063 用例中 2052 通过、11 失败，
耗时 1654.80 秒。失败全部为 20/30 秒超时，没有断言不匹配；这不是覆盖率通过证据。
四个失败文件在 `pnpm test <四文件> --maxWorkers=1` 下 43/43 用例通过（130.07 秒），
完整输出为 baseline-timeout-recheck.txt。保留原来的测试超时、覆盖率阈值和文件范围。
阶段 2 必须继续验证完整回归；阶段 1 的“完成”只代表基线结果、迁移清单及重复测量齐全，
不代表全仓覆盖率门禁已绿。

baseline-build.json 保存三轮库构建、声明、产物和 demo/pack 原始数据；相关命令退出 0。
build:lib 为 13,684 / 10,235 / 8,361 ms，中位数 10,235 ms，波动较大。
构建测量与四文件定向复测有重叠；不得将此样本用于证明压缩配置或迁移的精确加速收益。
三次产物大小一致；CSS 共 65,196 字节（包含 native 兼容副本），声明 226,023 字节，
tarball 694,969 字节。逐入口可达 JS（含 Worker 资源）及全 JS 去重 gzip 以 JSON 为准。
WASM 内联于 JS data URL，因此独立 .wasm 产物为 0；JSON 另记录内联 WASM 的解码大小、
SHA256 和所在文件，不把它漏算或再次加入 JS gzip 合计。
脚本采用 TypeScript AST 识别 import、require 和 Worker URL，避免将 import-map 字符串误当作独立文件。

1.1/1.2/1.3 的记录验收完成：起点及保护范围明确，工具可用，迁移项有目标和验证方式，
三个安装范围各三对冷/热样本，三次构建及全入口体积可复核。
未完成的覆盖率门禁作为已知基线限制带入后续验收，不隐藏、不改为成功。
