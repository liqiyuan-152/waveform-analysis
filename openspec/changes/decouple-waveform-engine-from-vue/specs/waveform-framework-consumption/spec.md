## Purpose

定义发布包在普通 JavaScript、React 与 Vue 环境下的依赖和接入边界，使原生图表运行时、样式与类型声明均不要求安装框架，同时为已有 Vue 消费者提供明确的兼容入口与迁移路径。

## ADDED Requirements

### Requirement: 原生发布入口独立

最终主入口和 native 子入口 SHALL 提供同一原生实例 API 及既有无框架工具/类型。原生运行时、声明和共享样式 SHALL 不直接或间接要求 Vue、React、Vue Router 或 Vue UI 库；包 SHALL 不强制安装这些框架及 UI 运行时。ESM、CJS、CSS、声明与 WASM 资产 SHALL 可在独立消费者中使用。

#### Scenario: 无框架消费者

- **WHEN** 在未安装 Vue、React 或 Vue UI 库的隔离项目安装打包产物并导入原生 API、类型和样式
- **THEN** 导入、类型检查、图表渲染、标注编辑及导出正常，不出现缺失框架模块或样式引用

### Requirement: 无浏览器导入

模块导入 SHALL 不访问 window、document 或创建浏览器资源。初始化绘制 SHALL 在客户端得到 HTMLElement 后进行；不要求服务端输出图表。

#### Scenario: 服务端模块加载

- **WHEN** 无 window/document 的环境导入原生包
- **THEN** 导入成功，不初始化图表或创建监听器

### Requirement: React 与 Vue 的 DOM ref 接入

React 和 Vue SHALL 可通过 DOM ref 获取容器并使用同一原生 API，无需专用组件包装。挂载时初始化、配置更新时 setOption、卸载时 dispose SHALL 正常。宿主回调更新 SHALL 无需重建图表且不产生陈旧回调；React Strict Mode 的创建/清理/重建 SHALL 安全。

#### Scenario: React Strict Mode 和回调更新

- **WHEN** React 示例在 Strict Mode 下挂载、清理、重建，随后更新数据和事件回调
- **THEN** 只有一个存活实例，事件调用最新回调，无重复监听、旧状态或重复 DOM

#### Scenario: Vue DOM ref 生命周期

- **WHEN** Vue 示例挂载、替换 data 引用、回传受控状态并卸载
- **THEN** 原生实例正确更新和释放，不依赖 Vue 对图表内部状态的深度监听

### Requirement: Vue 兼容入口与迁移说明

系统 SHALL 从 vue 子入口提供薄 Vue 组件，保留原有 props、emits、默认行为和 exposed 方法；组件 SHALL 使用同一原生实现。根入口移除原 Vue 组件导出 SHALL 明确标为破坏性入口变化，提供迁移示例和版本策略；原有无框架工具出口 SHALL 保留。

#### Scenario: 迁移既有 Vue 消费者

- **WHEN** 消费者将 WaveformChart 的 import 从根入口改为 vue 子入口，保持原 props、事件和 ref 方法
- **THEN** 原有业务行为及类型兼容，不需要修改数据、坐标、受控状态或序列化格式

### Requirement: 示例与开发依赖隔离

项目 SHALL 提供 vanilla、React、Vue 示例，覆盖初始化、更新、事件、尺寸和卸载，并在桌面和小容器验证。demo SHALL 可保留开发期框架/UI 依赖，但不得使原生消费链引入这些依赖或全局样式。

#### Scenario: 三种消费环境

- **WHEN** 在相同数据和配置下运行三种示例并操作主要功能
- **THEN** 图表行为一致，开发环境的 Vue UI 样式不成为原生消费者正常显示的条件

### Requirement: 过渡入口隔离与一致实例身份

native 过渡入口 SHALL 在接受无框架消费者验收前解除包级必需 Vue/UI 安装依赖，提供独立 native/style.css，旧 Vue 入口和 style.css SHALL 继续可用。同一包安装和同一模块格式下，最终根入口、native 及 Vue 包装 SHALL 共享原生实例身份和注册语义；不承诺 ESM/CJS 混用或多个包副本共享身份。

#### Scenario: 过渡期独立消费

- **WHEN** 安装含旧根 Vue 入口和新 native 入口的产物，仅导入 native 与 native/style.css 且未安装 Vue/UI 库
- **THEN** 原生导入和声明检查成功；显式安装 Vue 的旧入口消费者仍正常运行

#### Scenario: 跨入口查询

- **WHEN** 通过同一模块格式的 native 初始化，再经最终根入口查询同一 DOM，或 Vue 包装查询其底层实例
- **THEN** 获取同一实例，无第二份注册表或重复图表

### Requirement: 适配配置移除和最新回调

Vue 适配 SHALL 在 props 移除时传递明确重置值，非数据配置更新不得克隆或重新归一化同引用 data。React 示例 SHALL 显式更新或正确重订阅事件回调，不要求核心识别框架闭包。

#### Scenario: Vue 移除约束

- **WHEN** 移除 yDomain、width 或受控 interactionMode prop，data 引用不变
- **THEN** 约束按字段规则解除，数据不因适配重新提交而重置视口
