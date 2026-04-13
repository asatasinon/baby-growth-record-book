# 前端小程序缺失功能补全

> 文档编号：T04
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 基于现有小程序实现与产品需求差距，创建前端小程序缺失功能补全任务。 |

## 文档目的
- 补全 `frontend/miniapp` 中已有页面骨架但功能缺失、或尚未创建的页面与交互。

## 目标读者
- 前端工程师

## 关联文档
- [信息架构 D01](../design/D01-information-architecture.md)
- [业务流程 D02](../design/D02-business-flows.md)
- [接口设计 D03](../design/D03-api-design.md)
- [产品需求 P02](../product/P02-requirements-and-scope.md)
- [后端核心模块补全 T01](./T01-backend-core.md)（前端依赖后端接口稳定）

## 任务背景
当前小程序已实现：登录（密码）、宝宝列表、首页日报、记录列表（含删除）、趋势图（文字条形图）、AI 问答、提醒列表（含 ACK）、报告导出提交。尚缺：
- 微信 `wx.login` 登录流程
- 家庭创建与成员邀请 UI
- 事件编辑（PATCH）
- 宝宝档案编辑（PATCH）
- 提醒规则创建 UI
- 导出报告下载链接展示
- 真实 ECharts 图表（当前为 div 宽度模拟）
- 周报 / 月报汇总页
- 里程碑、用药、疫苗事件录入
- H5 分享页

## 依赖
- T01 已完成（PATCH 事件、家庭管理、宝宝编辑接口稳定）

## 执行状态
未开始

## 执行 owner
- owner 角色：前端负责人
- 当前执行 owner：`frontend-agent`
- 备援 owner：待分配
- 协作角色：后端负责人（接口联调）
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P1
- ETA：待定
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。

## 预计输入
- `docs/design/D01-information-architecture.md`：页面结构
- `docs/design/D03-api-design.md`：接口规范
- `frontend/miniapp/src/`：现有实现
- T01 完成后可用的后端接口

## 预计输出
- `frontend/miniapp/src/pages/` 下新增或修改的页面文件
- `frontend/miniapp/src/services/api.ts`：新增 API 调用函数
- `frontend/miniapp/src/types/domain.ts`：如需新增类型

## 允许修改的代码目录
- `frontend/miniapp/src/`

## 外部依赖登记表

| 依赖项 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| T01 PATCH /events/{event_id} | 内部任务 | 已完成 | 事件编辑页面依赖此接口 |
| T01 PATCH /babies/{baby_id} | 内部任务 | 已完成 | 宝宝编辑依赖此接口 |
| T01 POST /families | 内部任务 | 已完成 | 家庭创建接口已存在 |
| T01 POST /families/{family_id}/members | 内部任务 | 已完成 | 成员邀请接口已存在 |
| T01 POST /alerts/rules | 内部任务 | 已完成 | 规则创建接口已存在 |
| T03 export_report | 内部任务 | 已完成 | 下载链接可由 Worker 生成并回写 |
| ECharts for Taro | 外部依赖 | 待确认 | 确认 `@antv/f2` 或 `echarts-for-weixin` 在 Taro 环境下的集成方式 |
| 微信 `wx.login` | 外部依赖 | 待确认 | 需测试环境微信 AppID 配置 |

## agent 接手说明
1. 阅读 `frontend/miniapp/src/services/api.ts` 和现有页面结构再动手。
2. 新增 API 函数须遵循现有 `request()` 封装格式，类型声明加入 `types/domain.ts`。
3. ECharts 集成：优先查看 Taro 文档中 Canvas 图表集成方案，避免直接使用 DOM。
4. 微信登录：补充 `wx.login` 调用，将 code 发至 `/auth/wechat/login`，与现有密码登录保持相同的 session 存储格式。
5. H5 分享页作为独立低优先级子任务，可在核心功能完成后实现。
6. 所有子任务完成后用 `pnpm build:weapp` 验证编译无误。

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T04-01 | 未开始 | 微信 wx.login 登录流程 | `frontend-agent` | D03 `/auth/wechat/login` 规范、Profile 页现有实现 | Profile 页增加微信登录入口 | 小程序内点击微信登录能获取 session，与密码登录共享存储和后续页面逻辑。 |
| T04-02 | 未开始 | 家庭创建 UI | `frontend-agent` | D03 POST /families、Profile 页 | Profile 页增加"创建家庭"表单 | 未加入家庭的账号可创建家庭，创建后自动选中新家庭并刷新宝宝列表。 |
| T04-03 | 未开始 | 成员邀请 UI | `frontend-agent` | D03 POST /families/{family_id}/members | 家庭管理页面或 Profile 页增加邀请成员入口 | 家庭 owner 可通过手机号邀请成员；邀请后显示待确认状态。 |
| T04-04 | 未开始 | 事件编辑页面（PATCH） | `frontend-agent` | D03 PATCH /events/{event_id}、Records 页 | Records 页列表项增加"编辑"入口；新建或复用编辑表单页 | 可修改事件时间、备注、payload；保存后列表刷新且数据正确。 |
| T04-05 | 未开始 | 宝宝档案编辑（PATCH） | `frontend-agent` | D03 PATCH /babies/{baby_id}、Profile 页 | Profile 页宝宝列表增加"编辑"入口 | 可修改昵称、身高、体重、头围等字段；保存后显示更新值。 |
| T04-06 | 未开始 | 提醒规则创建 UI | `frontend-agent` | D03 POST /alerts/rules、Alerts 页 | Alerts 页增加"新建规则"入口 | 可选择规则类型、阈值、严重级别并提交；创建后规则生效（Worker 扫描时使用）。 |
| T04-07 | 未开始 | 导出报告下载链接展示 | `frontend-agent` | D03 GET /reports/exports/{task_id}、Reports 页 | Reports 页任务列表展示下载链接 | 任务状态为 `succeeded` 时显示可点击的下载链接；点击跳转到文件 URL。 |
| T04-08 | 未开始 | ECharts 图表集成（替换 div 模拟） | `frontend-agent` | Taro ECharts 集成文档、Trends 页 | Trends 页使用真实图表组件渲染折线/柱状图 | 趋势图以真实图表库渲染，支持坐标轴、数据点 tooltip；在微信小程序和 H5 均可正常显示。 |
| T04-09 | 未开始 | 周报 / 月报汇总页 | `frontend-agent` | D03 GET /summaries/weekly + monthly、T01 完成 | 新增 weekly/monthly 页面或在 Home 页增加切换 Tab | 可查看当周/当月喂养、睡眠、排泄、测量汇总数据。 |
| T04-10 | 未开始 | 里程碑 / 用药 / 疫苗事件录入 | `frontend-agent` | D03 POST /events event_type 枚举、首页快速录入 | 首页或 Records 页增加这三类事件的录入 UI 和 payload 字段 | 可录入里程碑描述、用药名称+剂量、疫苗名称；提交后出现在记录列表。 |
| T04-11 | 未开始 | H5 分享页（低优先级） | `frontend-agent` | A01 H5 需求、分享令牌接口（report 模块） | 独立 H5 路由，展示宝宝成长数据 | 通过分享链接访问时能展示基础成长数据，无需登录；令牌过期后显示友好提示。 |

## 完成标准
- T04-01 ～ T04-10 子任务子状态均为 `已完成`（T04-11 H5 分享页为低优先级，可延后）。
- `pnpm build:weapp` 编译无报错。
- 所有新增 API 调用遵循 `request()` 封装，token 从 session 取，不硬编码。
- 新增依赖通过 `pnpm` 安装，不混用 npm/yarn。

## 交接记录

| 时间 | 交接人 | 接手人 | 说明 |
| --- | --- | --- | --- |
| 2026-04-13 | Codex | `frontend-agent` | 任务文档初始化，等待 T01 核心接口完成后启动。 |
