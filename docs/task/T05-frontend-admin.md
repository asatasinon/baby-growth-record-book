# 前端管理后台补全

> 文档编号：T05
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 基于现有管理后台实现与架构文档，创建管理后台补全任务。 |

## 文档目的
- 补全 `frontend/admin` 中已有菜单项但内容为空壳的功能模块。

## 目标读者
- 前端工程师

## 关联文档
- [接口设计 D03](../design/D03-api-design.md)
- [AI 与规则引擎设计 D06](../design/D06-ai-and-rule-engine.md)
- [后端核心模块补全 T01](./T01-backend-core.md)
- [后端 AI 模块真实接入 T02](./T02-backend-ai.md)

## 任务背景
管理后台（`frontend/admin`）已有完整菜单结构，家庭管理、宝宝管理、事件审计、导出任务等核心视图已基本实现。以下菜单项仍为空壳：
- `dashboard`：工作台/统计看板
- `rules`：提醒规则模板管理（CRUD）
- `ai`：AI 会话日志查看
- `dict`：字典配置管理
- `settings`：系统设置

## 依赖
- T01 完成（summary、analytics 接口稳定可用于 dashboard 统计）
- T02 完成（AI 日志接口 `/admin/ai-conversations` 需后端实现）

## 执行状态
未开始

## 执行 owner
- owner 角色：前端负责人
- 当前执行 owner：`frontend-agent`
- 备援 owner：待分配
- 协作角色：后端负责人（admin API 联调）
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P2
- ETA：待定（建议在 T01 + T02 完成后启动）
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。

## 预计输入
- `frontend/admin/src/App.tsx`：现有菜单和视图结构
- `frontend/admin/src/api.ts`：现有 API 调用
- `docs/design/D03-api-design.md`：admin 相关接口
- `docs/design/D06-ai-and-rule-engine.md`：规则类型定义

## 预计输出
- `frontend/admin/src/App.tsx` 或拆分后的页面组件
- `frontend/admin/src/api.ts`：新增 admin 相关 API 调用

## 允许修改的代码目录
- `frontend/admin/src/`

## 外部依赖登记表

| 依赖项 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| T01 summary/analytics 接口 | 内部任务 | 未开始 | Dashboard 统计数据来源 |
| T02 AI 日志接口 | 内部任务 | 未开始 | `/admin/ai-conversations` 需要后端实现 |
| 后端 `/admin/alert-rules` CRUD | 内部任务 | 未确认 | 现有 admin router 中是否已有规则 CRUD，需确认 |
| 后端字典配置接口 | 内部任务 | 未确认 | `/admin/dict` 类接口后端是否已实现 |

## agent 接手说明
1. 阅读 `App.tsx` 中现有菜单项和各视图组件结构，理解现有布局框架。
2. Dashboard：从现有 `/admin/families`、`/admin/babies`、`/admin/events` 等接口汇总统计数字（家庭数、宝宝数、今日事件数等），使用 Ant Design `Statistic` 组件展示。
3. 规则模板：基于 D06 规则类型列表，实现规则列表展示 + 启用/禁用开关 + 新增/编辑表单，调用后端 `AlertRule` 相关接口。
4. AI 会话日志：展示 `AiConversation` 列表（用户 ID、宝宝 ID、问题摘要、时间、token 用量），需 T02 后端接口支持。
5. 字典配置、系统设置：与后端确认接口后实现，若后端接口未完成则先用 Mock 数据渲染 UI 骨架。
6. 所有新增代码遵循现有 Ant Design + TypeScript 风格；新增依赖通过 `pnpm` 安装。

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T05-01 | 未开始 | Dashboard 工作台统计看板 | `frontend-agent` | `/admin/families`、`/admin/babies`、`/admin/events` 接口 | `dashboard` 视图：展示家庭数、宝宝数、今日事件数等核心指标 | 登录后进入工作台能看到真实统计数据；数据从 API 获取，非硬编码。 |
| T05-02 | 未开始 | 提醒规则模板管理 CRUD | `frontend-agent` | D06 规则类型列表、后端 AlertRule CRUD 接口 | `rules` 视图：规则列表、新增、编辑、启用/禁用 | 可查看现有规则；可按 D06 规则类型新建规则并设置阈值；可切换启用状态。 |
| T05-03 | 未开始 | AI 会话日志查看 | `frontend-agent` | T02 后端 AI 日志接口（依赖 T02 完成）、`AiConversation` 模型 | `ai` 视图：会话列表，含用户、宝宝、问题、时间、token 用量 | 列表展示最近 AI 会话记录；可按家庭 / 宝宝筛选；需 T02 后端接口就绪。 |
| T05-04 | 未开始 | 字典配置管理 | `frontend-agent` | 后端字典接口（待确认）、D06 规则类型 | `dict` 视图：配置项列表，支持编辑 | 字典配置项可查看和编辑；若后端接口未就绪，先完成 UI 骨架并用 Mock 数据。 |
| T05-05 | 未开始 | 系统设置页面 | `frontend-agent` | 待确认后端设置接口 | `settings` 视图：基本系统配置项 | 系统设置页面可访问；若无后端接口则展示占位 UI。 |

## 完成标准
- T05-01 ～ T05-03 子任务子状态均为 `已完成`（T05-04、T05-05 可在后端就绪后完成）。
- `pnpm build` 编译无报错。
- 新增 API 调用遵循现有 `request()` 封装格式和 TypeScript 类型声明。
- 新增依赖通过 `pnpm` 安装，不混用 npm/yarn。

## 交接记录

| 时间 | 交接人 | 接手人 | 说明 |
| --- | --- | --- | --- |
| 2026-04-13 | Codex | `frontend-agent` | 任务文档初始化，等待 T01 + T02 完成后启动。 |
