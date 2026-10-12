## Purpose

为波形组件提供可选择启用的内置操作入口，使终端用户能够发现并使用缩放、平移、注解与图片导出能力，同时保障小容器、键盘和触屏可用性，并让既有消费者默认保持原有界面。

## ADDED Requirements

### Requirement: 工具栏可配置且默认关闭

组件 SHALL 接受 toolbar 布尔值或配置对象；省略/false 时不展示工具栏，true 使用右上角悬浮默认配置。配置对象 SHALL 支持 visible、hover/always 显示方式、top-right/top-left 位置及有序 items；重复项目去重，空集合不显示空容器。默认项目 SHALL 包括框选、平移、注解、放大、缩小、重置、显示全部和 PNG/SVG 导出入口。

#### Scenario: 既有使用者不配置工具栏
- **WHEN** 消费者不传 toolbar
- **THEN** 图表不新增工具栏，原有布局、交互和公开方法保持可用

#### Scenario: 动态关闭工具栏
- **WHEN** 已激活平移模式且消费者把 toolbar.visible 设为 false
- **THEN** 工具栏消失，当前模式与外部控制能力保持，不隐式重置视口

#### Scenario: 自定义按钮集合
- **WHEN** 消费者只配置 reset、export、reset
- **THEN** 按配置顺序显示一个重置和一个导出入口，不出现其余按钮

### Requirement: 按钮元数据由内部注册表统一管理

工具栏 SHALL 使用以稳定按钮 ID 为键的类型化内部注册表，统一维护图标、标签/提示、功能分组、命令映射与实际状态选择器。命令映射 SHALL 调用既有统一命令层，状态选择器 SHALL 从同一控制状态快照读取高亮和可用性，不复制约束逻辑或持有独立模式状态。注册表 SHALL 不成为公共导出或自定义回调 API；export 的 PNG/SVG 子项 SHALL 共用 exportImage，由工具栏执行下载及反馈。

#### Scenario: 注册表保留受控模式所有权
- **WHEN** 宿主传入 zoom，用户点击注册表提供的 pan 按钮但宿主尚未回传
- **THEN** 通过统一命令发 update:interactionMode 并返回 requested，高亮和 aria-pressed 仍反映 zoom；宿主回传 pan 后才同步更新

### Requirement: 默认功能分组保留消费者项目顺序

默认工具栏 SHALL 分为模式（zoom-box、pan、annotate）、视口（zoom-in、zoom-out、reset、fit）和导出（export）三组，组间通过间距或装饰性分隔线区分。公共配置 SHALL 保持扁平有序 items，不新增 groups API。分组 SHALL 在按 items 顺序去重后，仅合并相邻同组项目，不重排自定义顺序。空组和多余首尾/连续分隔线 SHALL 不渲染，分隔线不参与键盘焦点。禁用能力 SHALL 保留对应按钮禁用态，不通过分组移除项目；小容器折叠 SHALL 保留顺序、分组辨识和全部功能可达性。分组或 items 变化 SHALL 不改变模式或视口。

#### Scenario: 默认分组
- **WHEN** toolbar=true 且未指定 items
- **THEN** 按模式、视口、导出顺序展示三组，组内顺序符合默认项目列表

#### Scenario: 自定义跨组顺序
- **WHEN** items=[reset, export, pan, zoom-in, reset]
- **THEN** 去重后保持 reset、export、pan、zoom-in 顺序，形成视口/导出/模式/视口四段，不将两个视口按钮重排到一起

#### Scenario: 单组及空列表
- **WHEN** items 仅包含 pan、annotate，或切换为空列表
- **THEN** 前者只显示一个模式组且无首尾分隔线；后者不显示空工具栏，两者都不修改实际模式或视口

### Requirement: 内置与外部控制共享实际状态

工具栏 SHALL 使用与外部接口相同的命令语义和能力判定；框选、平移、注解为互斥模式并显示实际生效状态。被 props 禁用的操作 SHALL 不可触发，按钮具有禁用态；命令 pending/requested 不得冒充已生效。当前页多目标操作中，只要至少一个目标可改变，放大/缩小/fit SHALL 可用；全部 unchanged/disabled/empty-data 时禁用。reset SHALL 在存在合法、非空且允许重置的目标时可用，即使该目标已处于初始视口，以保留恢复数据意图。

#### Scenario: 外部切换后同步高亮
- **WHEN** 非受控图表通过外部接口切换到可用的 pan 模式
- **THEN** 平移按钮选中，其余模式按钮取消选中，图表可直接拖动平移

#### Scenario: 受控宿主尚未回传
- **WHEN** 工具栏请求切换模式但宿主还未更新 interactionMode
- **THEN** 发出模式更新请求，按钮仍反映原来的实际模式

#### Scenario: 消费者禁止平移
- **WHEN** pannable=false
- **THEN** 平移按钮禁用，新外部平移模式请求也被拒绝且不改变当前视口

#### Scenario: 部分图框已到缩放极限
- **WHEN** 当前页 A 可放大、B 已到极限且 C 为空
- **THEN** 放大按钮仍可用，执行仅改变 A，结果完整区分三个目标

#### Scenario: 初始视口重置入口仍可用
- **WHEN** 合法非空目标允许重置且已经处于初始范围
- **THEN** 重置按钮仍可触发一次恢复数据意图，不因视口 unchanged 而禁用

### Requirement: 目标选择明确且不依赖悬浮

独立模式工具栏 SHALL 展示当前页全部及当前页稳定图框目标，默认当前页全部；失效目标 SHALL 回到当前页全部。共享 X 模式 SHALL 展示共享操作语义，不提供伪单图框缩放。模式按钮决定手势种类，独立图框手势仍作用于实际拖动图框。

#### Scenario: 分页后目标消失
- **WHEN** 已选目标不在新页
- **THEN** 工具栏回到当前页全部，后续按钮操作不影响隐藏页

### Requirement: 工具栏可访问且隔离绘图手势

工具栏 SHALL 提供按钮名称、可见焦点、模式 aria-pressed 和禁用语义，支持键盘激活和 Escape 关闭菜单/取消拖动。hover 模式 SHALL 在焦点或菜单活动时保持显示，触屏可常驻访问；隐藏区域不截获绘图指针。按钮和菜单点击 SHALL 不触发底层缩放或创建注解，在 360px 容器中所有启用功能均可到达。

#### Scenario: 小容器键盘操作
- **WHEN** 用户在 360px 图表内通过 Tab 和 Enter 使用导出菜单
- **THEN** 能看到焦点并选择 PNG/SVG，菜单不因指针移出消失，不触发绘图区操作

### Requirement: Demo 仅展示内置控制入口

示例 Demo SHALL 默认开启内置工具栏，提供参数区开关用于展示隐藏，并启用演示所需平移能力；不得增加一套独立外部操作按钮。外部控制用法 SHALL 在 README 提供可编译示例。综合 Demo 的 DemoChartHost SHALL 将 update:interactionMode 回传 App 中的受控 ref，不能保留仅单向传入的模式绑定；未传入模式的 WASM 示例 SHALL 使用非受控模式。示例 SHALL 启用所需注解能力并保留受控注解回传。

DemoViewControls 中既有外部“重置视图”按钮及重复模式入口 SHALL 移除，但 resetWaveformViewport 和 zoom-reset 的数据恢复绑定 SHALL 保留。Demo SHALL 继续使用单一 zoom-end 加载入口并忽略 action=fit，zoom-reset 取消在途请求并恢复初始数据。

#### Scenario: 查看示例
- **WHEN** 用户打开示例 Demo
- **THEN** 能通过内置工具栏完成各项操作，通过配置开关隐藏它，页面不出现第二套放大/平移/导出操作栏

#### Scenario: 内置按钮完成受控模式切换
- **WHEN** 在综合 Demo 点击平移或注解按钮
- **THEN** 更新请求回传 App，实际模式和高亮改变，可执行对应手势；页面不保留重复的重置操作按钮

#### Scenario: 内置重置恢复 Demo 数据
- **WHEN** 局部数据加载后通过工具栏重置，包括视口已在初始范围的情况
- **THEN** 既有重置处理取消在途请求并恢复初始数据；fit 则不触发该恢复或新的加载
