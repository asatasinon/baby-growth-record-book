# 后端约束速查（仓库基线）

## 来源文档
- `docs/architecture/A01-system-architecture.md`
- `docs/architecture/A02-deployment-and-ops.md`
- `docs/architecture/A03-security-and-compliance.md`
- `docs/design/D02-business-flows.md`
- `docs/design/D03-api-design.md`
- `docs/design/D04-domain-data-model.md`
- `docs/design/D05-database-design.md`
- `docs/design/D06-ai-and-rule-engine.md`
- `docs/specs/S01-openapi.yaml`
- `docs/specs/S02-db-schema.sql`
- `docs/task/T04-spec-baseline-and-data-contract.md`
- `docs/task/T06-backend-auth-family-and-events.md`
- `docs/task/T07-summary-alerts-and-async-jobs.md`
- `docs/quality/Q01-testing-and-acceptance.md`

## 技术与依赖管理
- API：`FastAPI + Pydantic + SQLAlchemy`
- 数据库：`PostgreSQL 16`
- 异步：`task_jobs` + Worker
- Python 依赖管理统一使用 `uv`，不要混用 `pip`、`poetry`、`pipenv`

## API 契约
- Base URL：`/api/v1`
- 鉴权：`Authorization: Bearer <token>`
- ID 字段类型：API 边界使用数字字符串（数据库内部为 `bigint`）
- ID 正则约束：`^[0-9]+$`
- 时间字段类型：UTC 毫秒时间戳（`int64`）
- 响应壳：`{ code, message, data }`
- 错误码：`OK`、`INVALID_ARGUMENT`、`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`RATE_LIMITED`、`AI_SERVICE_UNAVAILABLE`、`INTERNAL_ERROR`
- 写接口支持 `X-Idempotency-Key`
- 入参中的字符串 ID 在服务层统一转换为 `bigint` 后再查询或写入
- 出参中的 `bigint` ID 统一转换为字符串返回前端
- 非法 ID 统一返回 `INVALID_ARGUMENT`，并带 `data.field/reason/value`

## 领域与数据隔离
- 所有业务数据必须带 `family_id`
- 所有查询显式校验家庭归属与角色权限
- 事件删除采用软删除（`status=deleted` + `deleted_at`）
- 事件主写入后需要投递异步重算任务

## 数据库约束
- 主键统一 `BIGINT`
- 关键时间字段统一为 UTC 毫秒时间戳（`BIGINT`）
- 详情表与 `growth_events` 通过 `event_id` 一对一关联
- 关键唯一约束：
  - `family_members (family_id, user_id)`
  - `daily_summaries (family_id, baby_id, summary_date)`
  - `metric_snapshots (baby_id, metric_code, bucket_type, bucket_date)`

## 安全与合规
- 全站 HTTPS
- JWT 过期与刷新机制
- 登录、AI、导出接口限流
- 日志禁止输出 token、手机号明文、openid/unionid
- AI 回答必须附免责声明，且不可输出医疗诊断建议

## 验收关注点（Q01）
- 编辑/删除事件后，汇总与趋势自动修正
- 多家庭并行使用不串数据
- 角色写权限与只读限制正确
- AI 有数据时返回时间窗口，无数据时给出“数据不足”
- 导出失败可重试并保留失败原因
