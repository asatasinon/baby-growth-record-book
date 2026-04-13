# 后端 AI 模块真实接入

> 文档编号：T02
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 基于 D06 AI 设计文档与当前存根实现，创建 AI 模块补全任务。 |

## 文档目的
- 将 `backend/app/modules/ai/` 从基于事件计数的存根替换为真实 LLM 接入实现，满足 D06 规范。

## 目标读者
- 后端工程师
- AI 工程师

## 关联文档
- [AI 与规则引擎设计 D06](../design/D06-ai-and-rule-engine.md)
- [接口设计 D03](../design/D03-api-design.md)
- [后端核心模块补全 T01](./T01-backend-core.md)

## 任务背景
当前 `POST /ai/query` 实现仅统计事件数量并拼接字符串返回，不调用任何模型服务；对话日志字段（`AiConversation` / `AiMessage`）存在但从未写入；缺少 AI 摘要专用接口。D06 明确要求结构化 prompt、上下文拼装、模型调用、免责声明和日志持久化。

## 依赖
- T01 完成（summary weekly/monthly 聚合层稳定，AI 上下文可依赖聚合结果）
- 模型服务 API Key 配置（环境变量）

## 执行状态
未开始

## 执行 owner
- owner 角色：后端/AI 负责人
- 当前执行 owner：`backend-agent`
- 备援 owner：待分配
- 协作角色：前端负责人（AI 页面联调）
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P2
- ETA：待定（建议在 T01 完成后启动）
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。

## 预计输入
- `docs/design/D06-ai-and-rule-engine.md`：AI 能力边界、上下文、输出要求
- `docs/design/D03-api-design.md`：`POST /ai/query` 接口规范
- `backend/app/models/ai.py`：`AiConversation`、`AiMessage` 模型
- `backend/app/modules/ai/router.py`：当前存根实现
- 聚合数据接口（T01 完成后可用）

## 预计输出
- `backend/app/modules/ai/router.py`：`POST /ai/query` 接入真实 LLM
- `backend/app/modules/ai/router.py`：新增 `POST /ai/summary` 接口（日/周/月摘要）
- `backend/app/core/config.py`：新增 `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL` 配置项
- `backend/app/modules/ai/`：新增 prompt 构造工具函数

## 允许修改的代码目录
- `backend/app/modules/ai/`
- `backend/app/core/config.py`（新增 LLM 配置项）
- `backend/app/models/ai.py`（只读，如需字段变更须走迁移）

## 外部依赖登记表

| 依赖项 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| LLM 模型服务 | 外部服务 | 待接入 | 需要 API Key、Base URL、模型名配置；首选 OpenAI 兼容接口 |
| T01 summary weekly/monthly | 内部任务 | 未开始 | AI 上下文拼装依赖聚合数据 |

## agent 接手说明
1. 阅读 D06 中 AI 流程设计（6 步流程）和 AI 能力边界约束。
2. 先在 `core/config.py` 中增加 `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL` 配置，从环境变量读取，不硬编码。
3. 实现上下文拼装：加载宝宝档案 + 最近 7 天聚合数据 + 最近异常提醒。
4. 实现结构化 prompt，约束模型只引用已提供数据，并强制附加免责声明。
5. 调用模型后持久化 `AiConversation` + `AiMessage`（包含 token 用量、模型名、状态）。
6. 实现 `/ai/summary` 接口，接收 `summary_type`（daily/weekly/monthly）和日期参数，返回 AI 摘要文本。

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T02-01 | 未开始 | LLM 配置项接入 | `backend-agent` | `core/config.py`、D06、环境变量约定 | `config.py` 新增 `LLM_API_KEY`、`LLM_MODEL`、`LLM_BASE_URL` | 配置项从环境变量读取，缺失时启动报错提示明确字段名。 |
| T02-02 | 未开始 | AI 上下文拼装函数 | `backend-agent` | 宝宝档案查询、summary 聚合结果、alert 查询 | `ai/` 下的 context builder 函数 | 能返回包含宝宝档案、7/30 天汇总、最近提醒的结构化 context dict。 |
| T02-03 | 未开始 | 结构化 Prompt 模板 | `backend-agent` | D06 AI 输出要求、context builder | Prompt 模板函数 | Prompt 明确约束模型只引用提供数据；固定附加免责声明文本。 |
| T02-04 | 未开始 | POST /ai/query 接入真实 LLM | `backend-agent` | T02-01、T02-02、T02-03、LLM API | `ai/router.py` 改造 `query_ai` 路由 | 提问返回真实模型回答；答案包含时间窗口和免责声明；对话日志写入数据库。 |
| T02-05 | 未开始 | AiConversation + AiMessage 持久化 | `backend-agent` | `models/ai.py`、T02-04 | `ai/router.py` 写入对话日志 | 每次调用后 `ai_conversations` 和 `ai_messages` 表有对应记录（含 token 用量、模型名、状态）。 |
| T02-06 | 未开始 | POST /ai/summary：日/周/月 AI 摘要接口 | `backend-agent` | D06、T02-02、T02-03、summary 接口 | `ai/router.py` 新增 `/ai/summary` 路由 | 传入 `summary_type` 和日期参数能返回 AI 生成的摘要文本；日志同步写入。 |

## 完成标准
- 所有子任务子状态均为 `已完成`。
- `POST /ai/query` 返回真实 LLM 回答，含时间窗口和免责声明。
- 每次调用均写入 `ai_conversations` / `ai_messages`。
- `POST /ai/summary` 接口可用。
- LLM API Key 不出现在任何代码或日志中。
- 新增 LLM 依赖包已添加至 `backend/pyproject.toml` 并执行 `uv sync`。

## 交接记录

| 时间 | 交接人 | 接手人 | 说明 |
| --- | --- | --- | --- |
| 2026-04-13 | Codex | `backend-agent` | 任务文档初始化，等待 T01 完成后执行。 |
