# 0.3.3 发布前验证

环境：Node.js 22.23.2、pnpm 10.32.1、macOS arm64。

## 已通过

- `pnpm install --frozen-lockfile`
- `pnpm prepare:wasm`（指纹校验后复用已有产物）
- `pnpm lint:all`、`pnpm check:file-length`
- `pnpm check:native-boundary`、`pnpm check:licenses`
- `python3 scripts/issue_triage_agent.py --self-test`
- `pnpm test:coverage --maxWorkers=5`：262 个文件、2492 项测试通过，Vitest 170.52 秒。
- `DEMO_BASE_PATH=/waveform-analysis/ pnpm build`（包括库声明、项目类型检查和 Demo 构建）
- `pnpm typecheck:examples`
- `WAVEFORM_BROWSER=chromium pnpm test:browser:built`：原生/Vue、1280/360 像素宽度的组件库回归及性能预算通过。
- `pnpm --config.ignore-scripts=true pack --pack-destination /tmp/waveform-033-package`
- `pnpm test:package --tarball /tmp/waveform-033-package/waveform-analysis-0.3.3.tgz`：独立 ESM/CJS、类型、CSS/WASM、Tree Shaking 和浏览器消费者通过。
- tarball 在消费者验证前后 SHA-256 一致。
- 修改文件的 Prettier 检查、GitHub 工作流 actionlint 1.7.7 检查及 `git diff --check`。

## 布局测试超时修复

v0.3.2 远程验证中，同一用例内部六次布局更新累积超过 20 秒，六个多轴用例超时。
本次把相同配置矩阵展平为 72 个独立用例，保留所有断言及 20 秒限制；局部 72 项通过，
全量覆盖率下单项最长 2.845 秒。旧公开标签保持原位。

## 组件库覆盖率

| 指标 |   结果 | 门禁 |
| ---- | -----: | ---: |
| 行   | 97.28% |  80% |
| 语句 | 95.16% |  80% |
| 函数 | 96.83% |  80% |
| 分支 | 89.77% |  75% |

动画核心模块的更严格阈值也已通过。范围为 `src/**/*.{ts,tsx,js,jsx,vue}`。

## Demo 与发布范围

按照发布约束，不手动运行 `test:demo`、`test:demo:browser` 或 Demo 覆盖率。
Demo 仅构建并由稳定版工作流归档，服务器校验资产 digest 后部署，工作流核对线上提交 SHA。
库与 Demo 测试的发现完整性由回归用例验证：套件不重叠，所有测试文件均归属一个配置。

本地覆盖率耗时不直接等同于 Worker 提速：本次还分离了 Demo 用例、延迟加载旧版对照组件，
并优化刻度计算。线上发布、打包与部署的实际耗时需以 v0.3.3 Actions 结果为准。
