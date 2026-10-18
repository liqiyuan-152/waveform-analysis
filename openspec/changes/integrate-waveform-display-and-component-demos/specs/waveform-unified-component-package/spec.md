## ADDED Requirements

### Requirement: 单包提供两个组件

系统 SHALL 通过单一 waveform-analysis 包及版本提供分析组件和 Waveform 展示组件，根入口新增 Waveform，并提供 /analysis、/display 独立入口及无歧义类型导出。

#### Scenario: 独立安装消费两个组件
- **WHEN** 消费项目仅安装发布包及声明所需依赖
- **THEN** ESM、CJS 和 TypeScript 可使用两个组件，且不需要同级 waveform-display 仓库或其源码路径

### Requirement: 保留现有入口和隔离依赖

系统 SHALL 保持现有分析根入口、/native、/vue 和 CSS 入口兼容；/native SHALL 继续作为根入口兼容别名；原生入口不得引入 Vue 或 Demo，/analysis 与 /display 不得互相引入对方业务代码。

#### Scenario: 旧消费者及展示按需消费者
- **WHEN** 旧分析消费用例与仅导入 /display 的用例分别构建
- **THEN** 旧 API 和类型检查通过，展示消费依赖图只包含其所需实现及共享模块

### Requirement: 资源和发布统一

系统 SHALL 隔离两组件实例、样式及 SVG ID，并统一声明、测试、许可证与发布流水线；本变更不得自动发布或删除原项目。

#### Scenario: 同页挂载和独立销毁
- **WHEN** 同一份包中的两种组件在同页各自宿主容器运行并销毁其中一个
- **THEN** 另一组件的图形、状态及资源保持有效，发布包包含完整运行资源

### Requirement: 显式公开导出和类型命名

系统 SHALL 保留原分析公开符号及含义，在根入口以 WaveformDisplay 前缀导出展示类型，并以 waveformDisplayDefaultOptions 导出展示默认配置；/display SHALL 保持原展示入口的 Waveform、defaultOptions 及公开类型局部名称。所有旧展示公开导出 SHALL 有逐项迁移映射，不将未公开内部动画类自动提升为公共 API。

#### Scenario: 根入口与展示类型同时使用
- **WHEN** 消费者从根入口导入 WaveformDisplayData，或从 /display 导入 WaveformData，并使用旧分析 WaveformData
- **THEN** 类型各自正确解析且互不覆盖，别名不得与已有 WaveformDisplayMode 等符号冲突，事件、动作、动画等原展示公开类型均有明确导入路径

### Requirement: 按需消费须有真实构建证据

系统 SHALL 验证 ESM 根入口单组件消费能够消除未使用组件的业务代码，/analysis 和 /display 的产物不得包含对方业务实现；共享代码允许保留，CJS 不承诺 ESM 等价的 tree shaking。

#### Scenario: 四种独立生产消费构建
- **WHEN** 以固定生产打包器/版本分别构建实际 .tgz 的根入口仅分析、根入口仅展示、/analysis 和 /display 消费示例
- **THEN** 依赖图和产物证明组件边界成立，记录体积和模块组成，不仅搜索压缩符号，不能仅以 package.json 配置作为通过依据

### Requirement: 跨入口对象身份一致

系统 SHALL 在每种支持的模块格式内部，使根入口、/native、/analysis 对同一分析实现共享实例注册表，并使根入口与 /display 的 Waveform 为同一构造器；跨入口不得重复装载动画引擎实现；允许不同实例使用各自调度器，两种组件的实例注册表不合并。

#### Scenario: 交叉创建查询及销毁
- **WHEN** 消费者从一个入口创建图表，并从另一个等价入口查找、销毁或检查构造器身份
- **THEN** 查找和清理作用于同一实例，入口切换不会创建重复实例或重复动画资源；此要求不扩展为 ESM/CJS 混用单例保证

### Requirement: 类型与模块导入边界

系统 SHALL 验证 bundler、NodeNext 及已有传统 TypeScript 解析消费；未安装 Vue 时根、/native、/analysis、/display 的运行时和声明 SHALL 可用。仅模块导入 SHALL 不依赖 DOM，也不得启动帧循环或注册全局监听。

#### Scenario: 无 Vue 和无 DOM 的导入
- **WHEN** 原生 .tgz 消费项目与 Vue 消费项目完全隔离，确认 Vue 不可解析后，分别在 Node 中导入原生入口并以 skipLibCheck: false 进行类型检查
- **THEN** 导入及类型检查成功，不创建图表或后台动画资源；不因此承诺服务端图表渲染

### Requirement: 样式入口明确且兼容

系统 SHALL 保持旧 CSS 入口及 CSS sideEffects 声明，展示组件 SHALL 不要求加载完整分析 CSS；若需要展示专用 CSS，则 SHALL 提供 /display/style.css 并记录使用要求。

#### Scenario: 单组件和同页样式消费
- **WHEN** 展示单独使用所需样式，或与分析组件同时加载各自样式
- **THEN** 两者外观符合基线，旧 CSS 路径仍可用，宿主通用元素样式不被污染

### Requirement: 完整声明产物和迁移门禁

系统 SHALL 将新增入口纳入声明编译与后处理，正确解析展示源码的相对 .js 导入，并保持迁入代码适用现有长度、类型和 lint 约束；未解析依赖不得被边界检查静默跳过。

#### Scenario: 检查真实打包产物
- **WHEN** 独立消费测试安装实际打包产物并导入 /analysis 和 /display
- **THEN** exports 声明的每个类型文件存在且依赖可解析，边界工具覆盖迁入源码，不依赖工作区路径或目录豁免

### Requirement: 包体积采用可比口径

包体积验收 SHALL 采用一致的生产消费构建与旧新入口映射，覆盖可达代码及异步资源，不以不同口径结果证明预算通过。

#### Scenario: 比较迁移前后的入口体积
- **WHEN** 对旧分析/展示入口和新对应子入口进行体积预算验收
- **THEN** 使用相同生产消费构建配置统计可达 JS，单列 CSS、Worker 和 WASM，保存入口映射；原始 dist 文件清单不能直接与消费 bundle 比较，聚合双组件根入口单列预算
