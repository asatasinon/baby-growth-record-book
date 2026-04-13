# 后端核心模块补全

> 文档编号：T01
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 基于现有实现与文档差距分析，创建后端核心模块补全任务。 |

## 文档目的
- 补全 auth、event、summary、analytics 四个模块中已有路由骨架但功能不完整或缺失的接口。

## 目标读者
- 后端工程师

## 关联文档
- [接口设计 D03](../design/D03-api-design.md)
- [业务流程 D02](../design/D02-business-flows.md)
- [数据库设计 D05](../design/D05-database-design.md)
- [OpenAPI S01](../specs/S01-openapi.yaml)

## 任务背景
架构与接口文档已定义完整 API 集合，当前实现覆盖了基础 CRUD 骨架，以下接口和功能存在缺失或存根：
- auth 模块缺少 Token 刷新、注销、真实微信 API 对接、手机号加密存储。
- event 写入后未派发 `task_jobs`，破坏了 Worker 异步补算链路。
- summary 模块仅实现 `daily`，缺少 `weekly` 和 `monthly`。
- analytics 模块未处理 `temperature_c` 指标。

## 执行状态
未开始

## 执行 owner
- owner 角色：后端负责人
- 当前执行 owner：`backend-agent`
- 备援 owner：待分配
- 协作角色：前端负责人（接口联调）
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P1
- ETA：待定
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。

## 预计输入
- `docs/design/D03-api-design.md`：接口规范
- `docs/design/D02-business-flows.md`：事件写入 → task_jobs 派发流程
- `docs/design/D05-database-design.md`：`task_jobs`、`daily_summaries`、`metric_snapshots` 表结构
- `backend/app/modules/`：现有路由实现

## 预计输出
- `backend/app/modules/auth/router.py`：补全 Token 刷新、注销接口；微信 API 真实对接
- `backend/app/modules/event/router.py`：写入事件后写 `task_jobs`
- `backend/app/modules/summary/router.py`：补全 weekly、monthly 接口
- `backend/app/modules/analytics/router.py`：补全 `temperature_c` 指标处理
- `backend/app/migrations/versions/`：如需新字段，补充迁移文件

## 允许修改的代码目录
- `backend/app/modules/auth/`
- `backend/app/modules/event/`
- `backend/app/modules/summary/`
- `backend/app/modules/analytics/`
- `backend/app/models/`（只读，原则上不新增字段，如必须新增须更新 DDL）
- `backend/app/migrations/versions/`（新增迁移时）

## 外部依赖登记表

| 依赖项 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| 微信 API（`code2session`） | 外部服务 | 待接入 | 需要微信 AppID + AppSecret 配置 |
| T06 OSS 集成 | 内部任务 | 未开始 | task_jobs 派发后 export_report 需要 OSS |
| `task_jobs` 表 DDL | 数据库 | 待确认 | 确认表已存在于 S02-db-schema.sql |

## agent 接手说明
1. 阅读 `D03` 中各接口规范，以及 `D02` 中事件写入流程图。
2. 按子任务顺序逐项实现，优先完成 `event task_jobs 派发` 和 `summary weekly/monthly`（下游依赖多）。
3. auth 微信登录对接需要环境变量 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`，接入前先在 `core/config.py` 中增加配置项。
4. 每项子任务完成后更新子状态列。

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T01-01 | 未开始 | POST /auth/refresh：Token 刷新接口 | `backend-agent` | D03 接口规范、现有 JWT 工具 | `auth/router.py` 新增 `/auth/refresh` 路由 | 有效 refresh_token 换回新 access_token；过期或无效 token 返回 401。 |
| T01-02 | 未开始 | POST /auth/logout：注销接口 | `backend-agent` | D03 接口规范 | `auth/router.py` 新增 `/auth/logout` 路由 | 调用后当前 token 失效（或加入黑名单/返回成功即可，视实现策略）。 |
| T01-03 | 未开始 | 微信登录真实 API 对接 | `backend-agent` | 微信 code2session 文档、WECHAT_APP_ID/SECRET 配置 | `auth/router.py` wechat_login 改为调用真实微信 API 获取 openid/unionid | 使用真实微信 code 能正确获取 openid；前端传入无效 code 返回 INVALID_ARGUMENT。 |
| T01-04 | 未开始 | 手机号加密存储 | `backend-agent` | D03 安全约束、现有 `phone_ciphertext` 字段 | `core/security.py` 或 `models/user.py` 中加入手机号加解密逻辑 | 数据库中 `phone_ciphertext` 存储的是加密值而非明文；查询时能解密匹配。 |
| T01-05 | 未开始 | 事件写入后派发 task_jobs | `backend-agent` | D02 流程图、`task_jobs` 表结构 | `event/router.py` 的 POST /events 写入后写 `task_jobs(aggregate_daily)` | 新增事件后 `task_jobs` 表中出现对应 `aggregate_daily` 记录；重算受影响日期。 |
| T01-06 | 未开始 | 确认并补全 GET /events/{event_id} | `backend-agent` | 现有 `event/router.py` | 确认路由存在且正确返回单条事件详情 | 已登录用户用有效 event_id 能获取详情；无权或不存在返回对应错误码。 |
| T01-07 | 未开始 | 确认并补全 PATCH /events/{event_id} | `backend-agent` | 现有 `event/router.py`、D03 规范 | event 编辑接口可用；编辑时触发 task_jobs 重算旧日期和新日期 | 编辑事件后 payload/时间更新生效；操作日志记录 old_value/new_value；重算队列写入。 |
| T01-08 | 未开始 | GET /summaries/weekly | `backend-agent` | D03 接口规范、现有 summary/router.py daily 实现 | `summary/router.py` 新增 weekly 路由 | 传入 `week_start` 参数能返回当周汇总数据（喂养/排泄/睡眠/测量）。 |
| T01-09 | 未开始 | GET /summaries/monthly | `backend-agent` | D03 接口规范、现有 summary/router.py | `summary/router.py` 新增 monthly 路由 | 传入 `month`（月起始毫秒）能返回当月汇总数据。 |
| T01-10 | 未开始 | analytics temperature_c 指标处理 | `backend-agent` | 现有 `analytics/router.py` 中 `_LAST_METRICS` 定义 | `_event_metric_value` 函数补全 `temperature_c` 分支 | GET /analytics/trends?metric_code=temperature_c 能返回体温趋势数据点。 |

## 完成标准
- 所有上表子任务子状态均为 `已完成`。
- 新增接口已在 OpenAPI 规范（S01）中同步更新。
- 不引入新的 Python 依赖（如必须引入须更新 `backend/pyproject.toml` 并执行 `uv sync`）。
- 所有接口遵循 D03 响应包装格式和错误码规范。

## 交接记录

| 时间 | 交接人 | 接手人 | 说明 |
| --- | --- | --- | --- |
| 2026-04-13 | Codex | `backend-agent` | 任务文档初始化，等待执行。 |
