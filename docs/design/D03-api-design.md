# 接口设计

> 文档编号：D03
> 状态：草案
> 版本号：v0.2.0
> 最后更新时间：2026-04-12
> 审核人：待定
> 生效日期：2026-04-12
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 创建接口设计文档首版。 |
| v0.2.0 | 2026-04-12 | Codex | 统一 ID 为 `bigint`，时间字段为毫秒时间戳。 |

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
- ID 格式：`int64`（对应数据库 `bigint`）
- 时间格式：毫秒时间戳（UTC），例如 `1744416720000`
- 鉴权方式：`Authorization: Bearer <token>`
- 分页参数：`page`、`page_size`
- 排序参数：`sort_by`、`sort_order`

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

## 鉴权接口

### `POST /auth/wechat/login`
- 用途：使用微信 code 换取业务登录态。
- 请求：

```json
{
  "code": "wx-login-code",
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
      "id": 10001,
      "display_name": "妈妈"
    },
    "families": [
      {
        "id": 20001,
        "name": "张家",
        "role": "owner"
      }
    ]
  }
}
```

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
  "family_id": 20001,
  "baby_id": 30001,
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
  - `bucket=day|week|month`
- 返回示例：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "metric_code": "weight_g",
    "unit": "g",
    "points": [
      {"bucket_date": 1743436800000, "value": 4900},
      {"bucket_date": 1744041600000, "value": 4970},
      {"bucket_date": 1744387200000, "value": 5010}
    ]
  }
}
```

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
  "family_id": 20001,
  "baby_id": 30001,
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
