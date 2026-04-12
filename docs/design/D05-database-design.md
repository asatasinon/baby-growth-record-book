# 数据库设计

> 文档编号：D05
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-12
> 审核人：待定
> 生效日期：2026-04-12
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 创建数据库设计文档首版。 |

## 文档目的
- 定义 PostgreSQL 层面的表、字段、索引、约束和归档预案。

## 目标读者
- 后端工程师
- DBA
- 运维工程师

## 关联文档
- [领域数据模型](./D04-domain-data-model.md)
- [数据库 DDL 草案](../specs/S02-db-schema.sql)

## 设计原则
- 主键统一使用 `UUID`。
- 所有业务表都带 `created_at`、`updated_at`，重要业务表带 `deleted_at`。
- 时间统一按 UTC 存储，展示转换在应用层完成。
- 枚举值默认通过 `CHECK` 或 PostgreSQL `ENUM` 管理。

## 主要表

### 用户与身份
- `users`
- `user_identities`

### 家庭与宝宝
- `families`
- `family_members`
- `babies`

### 事件主表与详情表
- `growth_events`
- `feeding_events`
- `excretion_events`
- `measurement_events`
- `sleep_events`
- `medication_events`
- `vaccine_events`
- `milestone_events`

### 聚合与分析
- `daily_summaries`
- `weekly_summaries`
- `metric_snapshots`

### 智能与提醒
- `alert_rules`
- `alert_events`
- `ai_conversations`
- `ai_messages`

### 异步与审计
- `export_tasks`
- `task_jobs`
- `operation_logs`

## 关键字段说明

### `growth_events`
- `event_type`：记录类型。
- `family_id`：冗余存家庭，便于权限过滤和索引命中。
- `baby_id`：统计主体。
- `occurred_at`：事件发生时间。
- `start_at/end_at`：时段型事件，如喂养、睡眠。
- `payload_snapshot`：保存提交时的扁平结构快照，便于列表摘要和审计。

### `daily_summaries`
- 唯一键：`(family_id, baby_id, summary_date)`
- 字段建议：
  - `feeding_total_ml`
  - `feeding_breakdown`
  - `excretion_count_total`
  - `excretion_breakdown`
  - `sleep_total_minutes`
  - `last_measurement_snapshot`
  - `alert_count`

### `metric_snapshots`
- 用于趋势查询的通用指标表。
- 唯一键：`(baby_id, metric_code, bucket_date, bucket_type)`

## 索引策略
- `growth_events (baby_id, occurred_at desc)`
- `growth_events (family_id, event_type, occurred_at desc)`
- `daily_summaries (baby_id, summary_date desc)`
- `metric_snapshots (baby_id, metric_code, bucket_date)`
- `alert_events (baby_id, status, triggered_at desc)`
- `task_jobs (status, run_after)`

## 数据库约束
- `family_members` 上 `user_id + family_id` 唯一。
- 详情表 `event_id` 唯一且外键到 `growth_events(id)`。
- `feeding_events.volume > 0`
- `measurement_events.weight_g > 0`
- `sleep_events.duration_minutes >= 0`

## 审计与删除策略
- 事件删除采用软删除：更新 `growth_events.status=deleted` 和 `deleted_at`。
- 审计记录保存在 `operation_logs`，至少保存 180 天。
- AI 会话和导出任务可按保留策略归档。

## 备份与恢复
- 每日全量备份数据库到对象存储。
- 保留最近 7 天日备份和最近 4 周周备份。
- 恢复演练至少每月一次，目标为在单机环境快速恢复业务。

## 分区与扩展预案
- 首版不强制分区。
- 若事件量增长，可将 `growth_events` 和 `operation_logs` 按月分区。
- 聚合表和指标表保持单表，结合索引足以支撑首版访问量。
