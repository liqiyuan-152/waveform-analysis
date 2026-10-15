# DOM ref 示例

三个示例都通过真实 DOM 调用 `init`，框架负责挂载/卸载和传递新数据引用。
示例覆盖数据/回调更新、自动及手动尺寸、缩放/重置/fit、受控模式与系列显隐、
标注创建/编辑/清空、SVG/PNG 下载、双实例与独立卸载。

在仓库根目录运行：

```bash
pnpm install --frozen-lockfile
pnpm build:lib
pnpm build:types
pnpm dev
```

访问 `/examples/vanilla/`、`/examples/react/`、`/examples/vue/`。示例导入已构建的
`waveform-analysis/native` 和独立样式，修改原生源码后重新构建库。
`pnpm typecheck:examples` 检查示例及其公开声明。

React 示例开启 Strict Mode，在 effect 清理中取消订阅并销毁实例；订阅通过 ref 读取最新回调。
Vue 示例使用 DOM ref、浅数据引用 watch 和稳定事件转发；vanilla 示例显式管理生命周期。
更改回调后点击“替换数据”，新帧应调用最新宿主回调。

React 的 `useState`、Vue 的 `shallowRef/ref` 和 vanilla 消费类分别保存
`annotations`、`hiddenSeriesIds`、`interactionMode`。实例发出的 `update:*`
是更新请求；消费者接收替换数组/模式，并通过 `setOption` 回传后才提交绘制。
核心工具栏与外部按钮使用同一套受控状态，第二个图表拥有独立状态。

点击“标注模式”后点击波形，填写文本并保存；右键标注可编辑或删除。
切换数据会替换数据引用；坐标与事件始终为秒，编辑器当前显示毫秒。
导出先等待稳定图表再返回 Blob；共享 `ExampleImageDownload` 演示由宿主主动下载，
PNG 使用 2 倍尺寸、SVG 使用 scale 1，下载完成释放 URL，卸载后忽略晚到结果。
导出期间修改数据/视口可能得到 `export-stale`，状态区会显示错误，可再次导出。

`scripts/test-native-examples-browser.mjs` 在三种浏览器中操作示例，检查真实下载、
状态回传、双实例隔离、React Strict Mode 重放、最新回调和清理；诊断模块仅观察公开
实例状态，不参与绘制或消费者业务状态。截图与结果保存在迁移提案的 evidence 目录。
