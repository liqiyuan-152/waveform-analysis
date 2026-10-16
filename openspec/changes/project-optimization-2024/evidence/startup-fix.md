# 启动回归修复（2026-10-16）

## 原因与修复

普通 Windows 终端运行 `pnpm dev` 先报 `SyntaxError: Invalid or unexpected token`：
`npm_execpath` 指向 pnpm.exe，原 dev 脚本将其作为 JavaScript 交给 Node 执行。
现按入口后缀区分 JS 入口与原生可执行文件，保留参数边界，不经过 shell 拼接。

修复后暴露 `spawnSync rustc ENOENT`。此前启动验证加载了临时 Rust 环境及 JS 版 pnpm，
未覆盖普通终端；此前证据不能证明无需这些准备即可启动。
按用户补充要求，dev/typecheck/test/test:coverage/build/prepack 复用已有 wasm/pkg，
不自动调用 prepare:wasm。只有显式 build:wasm / prepare:wasm 使用 Rust 工具链。
修改 Rust 源码或缺失 WASM 产物需显式打包；README、design 和 workspace spec 已同步。
GitHub CI 已有显式准备步骤；Gitea 发布与两个 Docker 构建入口补上显式步骤以保留源码打包。

## 本次验证

- 原工作区、Node 22.22.2、原生 pnpm 10.32.1；验证进程 PATH 中 rustc/cargo/wasm-pack 均不可解析，未加载临时工具环境。
- `pnpm dev --host 127.0.0.1 --port 5287 --strictPort` 成功：库 ESM/CJS、声明构建完成，服务监听 5287，声明监听报告 0 errors。
- Chromium 检查四路由 `/`、`/fixed-y-domain`、`/animation`、`/wasm-sampling`，各在 1200×900 和 360×900 验证实际曲线。
- WASM 路由断言十个通道后端均为 wasm，页面错误为空，原始结果见 startup-fix-browser.json。
- `pnpm typecheck` 退出 0，覆盖库、测试、构建配置和 demo。
- `pnpm exec vitest run tests/scripts/package-manager.test.ts tests/scripts/prepare-wasm.test.ts`：2 文件、10 测试通过；覆盖原生入口、JS/CJS/MJS 入口、含空格参数及原有 WASM 缓存行为。
- 修改的启动脚本、声明与测试通过 ESLint；脚本、测试、manifest、README、design 和 spec 通过 Prettier 检查。Gitea 工作流整文件 Prettier 检查有格式告警，未整体重排发布配置。
- 停止本次验证服务后 5287 已无监听；另一个由用户启动的根 dev 进程监听 5173，HTTP 返回 200，保留运行。
- 未重跑此前已记录失败的全量覆盖率，未运行 Docker 或实际发布。

## 工作区与本机状态

原有 WASM 二进制未重建，SHA256 仍为
`d4f4984c072d7a65df53cce39845c72074abe85d4f6481d84ae702ece367a400`。
现有工作区修改保留，无提交、标签或发布。
用户先确认补齐工具链后，Rust 1.95 GNU 工具链及 WASM 工具已安装到用户 .cargo/.rustup，
用户 PATH 已加入 .cargo/bin；随后用户改为要求启动不检查 Rust，因此项目启动已解除该依赖。
本次验证沿用未刷新 PATH 的终端，证明启动不依赖新安装的 Rust。
