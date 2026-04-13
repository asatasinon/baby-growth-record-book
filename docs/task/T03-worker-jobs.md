# Worker 任务真实实现

> 文档编号：T03
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 基于 Worker 存根实现与 D02/D06 设计文档，创建 Worker 任务补全任务。 |

## 文档目的
- 将 `worker/app/jobs/` 下四个只有 `print` 语句的存根 Job 替换为真实业务逻辑实现。

## 目标读者
- 后端工程师

## 关联文档
- [业务流程 D02](../design/D02-business-flows.md)（日报生成流程、事件编辑补算）
- [AI 与规则引擎设计 D06](../design/D06-ai-and-rule-engine.md)（规则类型、扫描逻辑）
- [数据库设计 D05](../design/D05-database-design.md)
- [后端核心模块补全 T01](./T01-backend-core.md)
- [基础设施与 OSS 集成 T06](./T06-infra-oss.md)

## 任务背景
`worker/app/jobs/` 下存在四个 job 文件，当前实现均为存根（仅 print）：
- `aggregate_daily.py`：重算 daily_summaries / metric_snapshots
- `export_report.py`：生成报告文件并上传 OSS
- `scan_alerts.py`：扫描规则触发 AlertEvent
- `ai_summary.py`：生成 AI 摘要

这四个 job 对应了事件写入、报告导出、提醒、AI 摘要四条核心异步链路，全部为存根导致 Worker 无实际价值。

## 依赖
- T01 完成（事件写入后 task_jobs 派发；summary/analytics 聚合接口稳定，aggregate_daily 可复用逻辑）
- T06 完成（export_report 需要 OSS 客户端上传文件）

## 执行状态
未开始

## 执行 owner
- owner 角色：后端负责人
- 当前执行 owner：`backend-agent`
- 备援 owner：待分配
- 协作角色：无（独立异步执行）
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P1
- ETA：待定（建议在 T01 + T06 完成后启动）
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。

## 预计输入
- `docs/design/D02-business-flows.md`：日报生成流程、聚合逻辑
- `docs/design/D06-ai-and-rule-engine.md`：规则类型列表和扫描逻辑
- `docs/design/D05-database-design.md`：`daily_summaries`、`metric_snapshots`、`alert_events`、`export_tasks` 表结构
- T06 OSS 客户端接口
- `worker/app/jobs/base.py`：TaskJob 基类

## 预计输出
- `worker/app/jobs/aggregate_daily.py`：重算 daily_summaries + metric_snapshots
- `worker/app/jobs/export_report.py`：生成报告 PDF/CSV 并上传 OSS，更新 export_tasks 状态
- `worker/app/jobs/scan_alerts.py`：按规则扫描，写入 alert_events
- `worker/app/jobs/ai_summary.py`：调用 LLM 生成摘要并落库

## 允许修改的代码目录
- `worker/app/jobs/`
- `worker/app/core/`（如需新增工具函数）
- `worker/app/`（如需新增 OSS 客户端引用）

## 外部依赖登记表

| 依赖项 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| T01 task_jobs 派发 | 内部任务 | 未开始 | aggregate_daily 需要 task_jobs 表有数据才会触发 |
| T06 OSS 客户端 | 内部任务 | 未开始 | export_report 需要 OSS 上传能力 |
| T02 LLM 接入 | 内部任务 | 未开始 | ai_summary 与 T02 共用模型调用逻辑，建议抽取可复用函数 |

## agent 接手说明
1. 阅读 D02 中日报生成流程图和 D06 规则类型列表。
2. `aggregate_daily`：从 `task_jobs` 领取任务，计算受影响宝宝+日期，重新聚合事件，写 `daily_summaries` 和 `metric_snapshots`，标记任务完成。
3. `export_report`：从 `task_jobs` 或 `export_tasks` 领取任务，生成 PDF/CSV 内容，上传至 OSS（复用 T06 客户端），更新 `export_tasks.status`、`object_key`、`download_url`、`expires_at`。
4. `scan_alerts`：从 `alert_rules` 加载启用规则，逐条扫描最新数据，满足触发条件则写入 `alert_events`（避免重复写入同一 rule+宝宝+日期）。
5. `ai_summary`：调用 T02 中抽取的 context builder 和模型工具函数，将摘要写入对应日报/周报/月报字段或 `ai_conversations`。

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T03-01 | 未开始 | aggregate_daily：日汇总重算逻辑 | `backend-agent` | D02 日报生成流程、D05 表结构、T01 完成 | `aggregate_daily.py` 真实聚合实现 | 写入事件后触发任务，`daily_summaries` 和 `metric_snapshots` 数据正确更新；受影响的旧日期和新日期均重算。 |
| T03-02 | 未开始 | export_report：报告文件生成与 OSS 上传 | `backend-agent` | D05、T06 OSS 客户端、`export_tasks` 表 | `export_report.py` 真实实现 | 任务执行后 `export_tasks.status=succeeded`，`download_url` 有效，文件可下载；失败时 `status=failed` 且记录 `error_message`。 |
| T03-03 | 未开始 | scan_alerts：规则扫描与提醒生成 | `backend-agent` | D06 规则类型列表、`alert_rules` 表、`alert_events` 表 | `scan_alerts.py` 真实实现 | 配置了 `feeding_interval_too_long` 等规则时，满足阈值条件后在 `alert_events` 中正确写入提醒记录，不重复触发。 |
| T03-04 | 未开始 | ai_summary：AI 日/周/月摘要生成 | `backend-agent` | T02 context builder 和模型工具函数 | `ai_summary.py` 真实实现 | 定时或按需触发后，摘要文本写入数据库对应记录；LLM 错误时任务标记失败而非崩溃。 |

## 完成标准
- 四个 job 均无 `print` 存根，均有真实业务逻辑。
- `aggregate_daily` 完成后 summaries 数据与手动计算结果一致。
- `export_report` 生成的文件可通过 `download_url` 实际下载。
- `scan_alerts` 不产生重复提醒记录。
- `ai_summary` LLM 失败时 worker 不崩溃。
- 新增依赖已更新 `worker/pyproject.toml` 并执行 `uv sync`。

## 交接记录

| 时间 | 交接人 | 接手人 | 说明 |
| --- | --- | --- | --- |
| 2026-04-13 | Codex | `backend-agent` | 任务文档初始化，等待 T01 + T06 完成后执行。 |
