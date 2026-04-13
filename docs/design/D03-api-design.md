# 接口设计

> 文档编号：D03
> 状态：草案
> 版本号：v0.6.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 创建接口设计文档首版。 |
| v0.2.0 | 2026-04-12 | Codex | 统一 ID 为 `bigint`，时间字段为毫秒时间戳。 |
| v0.3.0 | 2026-04-12 | Codex | 明确 API 层 ID 使用字符串，后端入参转 `bigint`、出参转字符串。 |
| v0.4.0 | 2026-04-12 | Codex | 增加 ID 正则约束、Pydantic 转换层规范和错误 ID 标准示例。 |
| v0.5.0 | 2026-04-13 | Codex | 增加手机号+密码登录；微信登录改为手机号归一用户身份。 |
| v0.6.0 | 2026-04-13 | Codex | 趋势接口补充 `minute` 粒度，默认按记录时间分钟点位返回，用于折线图展示。 |

## 文档目的
- 定义首版 REST API 的路径、鉴权、请求响应结构、错误码和公共约定。

## 目标读者
- 后端工程师
- 前端工程师
- 测试工程师

## 关联文档
- [领域数据模型](./D04-domain-data-model.md)
- [数据库设计](./D05-database-design.md)
- [OpenAPI 规范](../specs/S01-openapi.yaml)

## 基础规范
- Base URL：`/api/v1`
- 数据格式：`application/json`
- ID 格式：数字字符串（正则 `^[0-9]+$`，数据库内部存储为 `bigint`）
- 时间格式：毫秒时间戳（UTC），例如 `1744416720000`
- 鉴权方式：`Authorization: Bearer <token>`
- 分页参数：`page`、`page_size`
- 排序参数：`sort_by`、`sort_order`
- ID 转换规则：请求中的 ID 字符串在服务端转换为 `bigint` 查询；响应中的 `bigint` ID 统一转换为字符串返回前端。

## ID 校验与转换实现规范
- OpenAPI 中所有 `id/*_id` 字段必须声明为字符串并加正则 `^[0-9]+$`。
- 后端必须在统一的 schema 层实现 ID 校验，不允许在业务逻辑里散落 `int()` 转换。
- 推荐在 `backend/app/schemas/` 下定义统一 ID 类型和转换器（Pydantic validator/serializer），供所有请求和响应模型复用。
- 服务层只接收“已校验且可转换”的 ID 值，Repository 层只接收 `bigint`。

## 推荐实现骨架（Pydantic）
```python
IdStr = Annotated[str, Field(pattern=r"^[0-9]+$")]

def to_db_id(value: IdStr) -> int:
    return int(value)

def to_api_id(value: int) -> str:
    return str(value)
```

## 响应包装

```json
{
  "code": "OK",
  "message": "success",
  "data": {}
}
```

## 错误码
- `OK`
- `INVALID_ARGUMENT`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `AI_SERVICE_UNAVAILABLE`
- `INTERNAL_ERROR`

### 错误 ID 标准示例
当 ID 格式非法（例如 `family_id=abc`）时，返回：

```json
{
  "code": "INVALID_ARGUMENT",
  "message": "invalid id format",
  "data": {
    "field": "family_id",
    "reason": "must match ^[0-9]+$",
    "value": "abc"
  }
}
```

## 鉴权接口

### `POST /auth/wechat/login`
- 用途：使用微信 code + 手机号换取业务登录态，手机号作为主身份归一键。
- 请求：

```json
{
  "code": "wx-login-code",
  "phone": "13800138000",
  "encrypted_phone_data": "optional",
  "iv": "optional"
}
```

- 响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "access_token": "jwt",
    "refresh_token": "jwt",
    "user": {
      "id": "10001",
      "display_name": "妈妈"
    },
    "families": [
      {
        "id": "20001",
        "name": "张家",
        "role": "owner"
      }
    ]
  }
}
```

### `POST /auth/password/login`
- 用途：手机号+密码登录；仅允许已注册账号登录。
- 请求：

```json
{
  "phone": "13800138000",
  "password": "Passw0rd!"
}
```

- 响应：与 `POST /auth/wechat/login` 一致。

### `POST /auth/register`
- 用途：手机号+密码注册；注册成功后直接返回登录态。
- 请求：

```json
{
  "phone": "13800138000",
  "password": "Passw0rd!",
  "display_name": "宝宝爸爸"
}
```

- 响应：与 `POST /auth/wechat/login` 一致。

## 家庭接口

### `POST /families`
- 创建家庭。

### `GET /families`
- 查询当前用户可访问的家庭列表。

### `POST /families/{family_id}/members`
- 邀请或添加成员。

### `PATCH /families/{family_id}/members/{member_id}`
- 修改成员角色。

## 宝宝接口

### `POST /babies`
- 新增宝宝档案。

### `GET /babies`
- 查询家庭下宝宝列表。

### `GET /babies/{baby_id}`
- 获取宝宝详情。

### `PATCH /babies/{baby_id}`
- 更新宝宝档案。

## 统一事件接口

### `POST /events`
- 新增事件。
- 请求示例：

```json
{
  "family_id": "20001",
  "baby_id": "30001",
  "event_type": "feeding",
  "occurred_at": 1744416720000,
  "start_at": 1744416720000,
  "end_at": 1744417920000,
  "timezone": "Asia/Shanghai",
  "notes": "夜间喂养",
  "payload": {
    "mode": "breast_milk",
    "volume": 90,
    "unit": "ml"
  }
}
```

### `GET /events`
- 条件：`family_id`、`baby_id`、`event_type`、`date_from`、`date_to`（毫秒时间戳）

### `GET /events/{event_id}`
- 获取事件详情。

### `PATCH /events/{event_id}`
- 编辑事件。

### `DELETE /events/{event_id}`
- 软删除事件。

## 汇总接口

### `GET /summaries/daily`
- 参数：`family_id`、`baby_id`、`date`（毫秒时间戳）

### `GET /summaries/weekly`
- 参数：`week_start`（毫秒时间戳）

### `GET /summaries/monthly`
- 参数：`month`（月起始毫秒时间戳）

## 趋势接口

### `GET /analytics/trends`
- 参数：
  - `family_id`
  - `baby_id`
  - `metric_code`
  - `date_from`（毫秒时间戳）
  - `date_to`（毫秒时间戳）
  - `bucket=minute|day|week|month`（默认 `minute`）
- 返回示例：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "metric_code": "weight_g",
    "unit": "g",
    "points": [
      {"bucket_date": 1744388340000, "value": 4900},
      {"bucket_date": 1744391940000, "value": 4970},
      {"bucket_date": 1744395600000, "value": 5010}
    ]
  }
}
```

- 前端趋势页按 `bucket_date` 时间轴渲染折线图，默认精确到分钟。

## 提醒接口

### `GET /alerts`
- 查询提醒列表。

### `POST /alerts/rules`
- 创建家庭级提醒规则。

### `PATCH /alerts/{alert_id}/ack`
- 标记提醒已读或已处理。

## 报告接口

### `POST /reports/export`
- 发起导出任务。

### `GET /reports/exports`
- 查询导出任务历史。

### `GET /reports/exports/{task_id}`
- 查询导出状态和下载链接。

## AI 接口

### `POST /ai/query`
- 请求：

```json
{
  "family_id": "20001",
  "baby_id": "30001",
  "question": "最近7天平均每天喂养多少毫升？"
}
```

- 响应：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "answer": "最近 7 天平均每天喂养约 560ml。",
    "window_start": 1743811200000,
    "window_end": 1744416000000,
    "disclaimer": "结果基于记录数据生成，不替代医生意见。"
  }
}
```

## 管理后台接口
- `GET /admin/families`
- `GET /admin/babies`
- `GET /admin/events`
- `GET /admin/alert-rules`
- `GET /admin/ai-conversations`
- `GET /admin/export-tasks`

## 幂等与一致性
- 写接口可接受 `X-Idempotency-Key`，用于客户端重试防重。
- 编辑和删除事件后，API 仅保证写入成功；汇总通过异步任务最终一致。
