## ADDED Requirements

### Requirement: 分层持续浏览器验证

GitHub push/PR SHALL 执行 Chromium 核心场景；GitHub 每周定期任务及手动入口 SHALL 在 Chromium、Firefox、WebKit 各执行全部核心场景、交互耗时和重复创建/替换/销毁资源检查。核心场景 SHALL 包含悬停、缩放、受控图例、销毁及 SVG/PNG 导出，覆盖原生/Vue、1280px 桌面和 360px 小容器。

GitHub release.yml 与 Gitea package.yml SHALL 各自执行当前提交的 Chromium 核心场景及实际 tarball 消费验证；失败 SHALL 阻断各自后续 registry 发布、Release 创建和部署（如有）。不得以历史定期结果替代当前提交验证；Gitea 不要求重复部署定期跨浏览器任务。

#### Scenario: 核心交互回归

- **WHEN** 悬停、缩放、受控图例、销毁或导出场景失败
- **THEN** 对应检查失败，保留环境和最小诊断证据，不能将失败解释为性能波动忽略

#### Scenario: 浏览器启动失败或必跑场景超时

- **WHEN** 浏览器安装/启动失败，或矩阵中的必跑场景异常、超时
- **THEN** 对应 job 返回非零，不能通过 skip、continue-on-error 或删除场景让矩阵通过；发布流程停止后续发布与部署

### Requirement: 内存指标能力边界

定期 Chromium 内存任务 SHALL 至少采集预先选定的一项受支持指标并说明范围，采集失败或全部指标缺失 SHALL 使任务失败。Firefox/WebKit 对不支持的 Chromium 专属堆指标 SHALL 标记 N/A 并附能力检测和原因，但功能、耗时及可移植资源计数 SHALL 仍执行。JS 堆数据不得被表述为全进程峰值。

#### Scenario: 浏览器无专属堆采样能力

- **WHEN** Firefox 或 WebKit 的能力检测确认不支持该专属指标
- **THEN** 仅该指标记录 N/A，不将其记作通过，也不跳过核心场景、耗时或资源生命周期检查

### Requirement: 可复核性能基线

性能门禁 SHALL 固定工作负载和环境口径，预热至少五次并测量至少二十次，保存中位数和 p95。至少三轮基线后 SHALL 明确阈值、绝对容差和重测规则；未设置阈值时 SHALL 仅报告测量而不声称门禁通过。

#### Scenario: 性能超出预算

- **WHEN** 指标按预定重测规则确认超过锁定预算
- **THEN** 性能任务失败并保留前后数据，不静默放宽阈值

#### Scenario: 平台覆盖声明

- **WHEN** 发布浏览器验证报告
- **THEN** 区分实际浏览器与自动化引擎，列出未验证 Safari/iOS 和辅助技术，不由 Chromium 或 WebKit 推断其通过
