## Scan Baseline

日期：2026-10-17。提交：`315c730`（perf(chart): optimize incremental updates and strengthen quality gates）。扫描时已跟踪文件无修改，未跟踪文件共 2,078 个；该计数包含既有工作，不是建议删除的清单。CodeGraph 存在但部分索引过期，结论以当前源码为准。

默认 Node v24.15.0；检查切换到本机 Node v22.23.2，pnpm 10.32.1。CI 配置的 Node 为 22.20.0，不能声称本地与 CI 补丁版本一致。

## Findings

| 优化项      | 当前证据                                                                                       | 结论边界                             |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| 索引预算    | multiresolution.ts 的 ensureExtrema/ensureSum 在 reserve 前创建数组；下述探针确认 extrema 分配 | 已确认无效分配；未测浏览器峰值或 OOM |
| Tooltip     | TooltipView.ts 每次 render 创建行、replaceChildren 后立即测量                                  | 已确认路径；尚无浏览器提速数据       |
| 紧凑降级    | repositoryDataset.ts 仅对象点分支建立 JS 多分辨率索引                                          | 缺少该加速路径，不代表结果错误       |
| Worker 传输 | WorkerSamplingClient.ts 普通 postMessage，已有安全 transfer 不采用记录                         | 重新评估候选，不视为已确认缺陷       |
| CI 构建     | coverage、build、pack/prepack 各有准备；先前明确保留独立命令                                   | 同流水线复用候选，不否定先前去重成果 |
| 浏览器门禁  | CI 安装 Chromium 并执行包消费；专用质量/动画脚本未直接接入                                     | 不等于当前没有浏览器测试             |
| 工具和证据  | 无 .nvmrc，存在大量未跟踪证据                                                                  | 不证明文件无用，不据此清理           |

## Allocation Probe

通过 Vite ssrLoadModule 加载 `src/core/workerSampling/multiresolution.ts`，创建 100,000 个 `{ x, y: Math.sin(x) }` 点。构造 `MultiResolutionSamplingIndex(points, { maxBytes: 0 })`，临时代理全局 Uint32Array 构造器累计 byteLength，依次执行：

```ts
index.sample(0, points.length, 'minmax', 100)
index.sample(1, points.length, 'minmax', 100)
```

结果：`retainedBytes=0`，`allocatedUint32BytesAcrossTwoRequests=800000`。代理在 finally 恢复，Vite server 随后关闭。该探针仅统计两次请求中 Uint32Array 的累计构造字节，不是同时驻留内存；sum 分支的同类问题来自源码检查，尚未由该探针覆盖。

## Executed Checks

以下为前一轮扫描实际执行结果，不是本提案实施验收：

| 命令                                      | 结果                                |
| ----------------------------------------- | ----------------------------------- |
| pnpm exec vitest run --project algorithms | 28 文件、180 测试通过               |
| pnpm lint:all                             | 退出码 0                            |
| pnpm check:file-length                    | 退出码 0                            |
| pnpm check:native-boundary                | 退出码 0，207 模块                  |
| pnpm check:licenses                       | 退出码 0，70 npm 包、12 Rust crates |

未运行完整 DOM 测试、完整覆盖率、类型检查、构建、包消费和浏览器性能测试。上述摘要来自本次会话工具结果，未保存原始日志；实施时须重新建立带原始最小数据的基线。
