# 前端约束速查（仓库基线）

## 来源文档
- `docs/architecture/A01-system-architecture.md`
- `docs/architecture/A02-deployment-and-ops.md`
- `docs/architecture/A03-security-and-compliance.md`
- `docs/design/D01-information-architecture.md`
- `docs/design/D02-business-flows.md`
- `docs/design/D03-api-design.md`
- `docs/specs/S01-openapi.yaml`
- `docs/task/T04-spec-baseline-and-data-contract.md`
- `docs/task/T05-frontend-user-app-and-admin.md`
- `docs/quality/Q01-testing-and-acceptance.md`

## 技术与依赖管理
- 用户端：`Taro + React + TypeScript`
- 管理端：`React + Vite + Ant Design`
- 图表：`ECharts`
- 前端依赖管理统一使用 `pnpm`，不要混用 `npm` 或 `yarn`

## 页面域与职责
- 小程序：核心记录、查询、趋势、提醒、AI、家庭协作
- H5：分享页、报告页、部分趋势展示
- 管理后台：家庭/宝宝/事件审计、规则模板、AI 日志、导出任务

## 契约与数据上下文
- API Base URL：`/api/v1`
- ID 字段类型：API 返回数字字符串（数据库内部为 `bigint`）
- ID 正则约束：`^[0-9]+$`
- 统一响应壳：`{ code, message, data }`
- 常见错误码：`INVALID_ARGUMENT`、`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`RATE_LIMITED`、`AI_SERVICE_UNAVAILABLE`
- 除登录外，业务请求必须携带并维护家庭/宝宝上下文（至少 `family_id`，必要时 `baby_id`）
- 事件写接口支持 `X-Idempotency-Key`，前端重试要避免重复提交

## 时间与展示
- 后端 UTC 存储，前端按用户/家庭时区展示
- 时间参数与响应统一为 UTC 毫秒时间戳

## 安全与隐私
- 不在日志、埋点、错误上报中输出 token、手机号明文、openid/unionid
- 仅做前端可见性控制，真实权限以后端鉴权为准
- 分享页必须考虑脱敏与令牌过期态

## 验收关注点（Q01）
- 核心记录新增/编辑/删除后，列表/汇总/趋势表现正确
- 跨家庭数据不可串读
- 不同角色（owner/caregiver/viewer）页面行为符合权限预期
- AI 页面展示时间窗口和免责声明
- 导出任务失败可重试，成功后可下载
