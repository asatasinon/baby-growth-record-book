# 基础设施与 OSS 集成

> 文档编号：T06
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 基于架构文档与现有实现缺口，创建基础设施 OSS 集成任务。 |

## 文档目的
- 实现对象存储（OSS）客户端集成，供报告导出 Worker 使用；同时确认关键数据库迁移的完整性。

## 目标读者
- 后端工程师
- 运维工程师

## 关联文档
- [系统架构 A01](../architecture/A01-system-architecture.md)（OSS 作为 API 和 Worker 依赖的外部组件）
- [部署与运维 A02](../architecture/A02-deployment-and-ops.md)
- [数据库设计 D05](../design/D05-database-design.md)
- [数据库 DDL S02](../specs/S02-db-schema.sql)
- [Worker 任务真实实现 T03](./T03-worker-jobs.md)

## 任务背景
A01 架构图明确 API 和 Worker 均依赖对象存储（OSS），但当前代码库中：
- 无 OSS 客户端实现（无 SDK 引用、无配置项、无上传函数）。
- `export_tasks.download_url` 字段存在但永远为 `null`。
- `daily_summaries` / `metric_snapshots` 表在 DDL 中是否完整存在需确认。
- `task_jobs` 表在迁移文件中是否存在需确认。

## 执行状态
未开始

## 执行 owner
- owner 角色：后端/运维负责人
- 当前执行 owner：`backend-agent`
- 备援 owner：待分配
- 协作角色：T03 Worker jobs 执行者（消费 OSS 客户端）
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P1
- ETA：待定（可与 T01 并行）
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。

## 预计输入
- `docs/specs/S02-db-schema.sql`：当前 DDL
- `backend/app/migrations/versions/`：现有迁移文件
- A01、A02：OSS 选型约束（兼容 S3 接口即可）
- `backend/app/core/config.py`：配置扩展参考
- `worker/app/`：Worker OSS 消费方

## 预计输出
- `backend/app/core/storage.py`（或等效模块）：OSS 客户端封装（upload、generate_presigned_url）
- `backend/app/core/config.py`：新增 `OSS_BUCKET`、`OSS_ENDPOINT`、`OSS_ACCESS_KEY`、`OSS_SECRET_KEY` 配置
- `worker/app/core/storage.py`：Worker 中复用相同 OSS 客户端（或通过共享包引入）
- `backend/app/migrations/versions/`：补充缺失的迁移文件（`task_jobs`、`daily_summaries`、`metric_snapshots`、`ai_conversations`、`ai_messages`）
- `docs/specs/S02-db-schema.sql`：同步更新 DDL（若有新增表或字段）

## 允许修改的代码目录
- `backend/app/core/`
- `backend/app/migrations/versions/`
- `worker/app/core/`
- `docs/specs/S02-db-schema.sql`（同步 DDL）

## 外部依赖登记表

| 依赖项 | 类型 | 状态 | 说明 |
| --- | --- | --- | --- |
| OSS 服务（S3 兼容） | 外部服务 | 待配置 | 可使用 MinIO（本地开发）或阿里云 OSS / AWS S3（生产），需提供 endpoint、bucket、访问凭证 |
| `boto3` 或 `aiobotocore` | Python 依赖 | 待安装 | S3 兼容客户端；选择异步版本以配合 FastAPI 异步上下文 |

## agent 接手说明
1. 先检查 `backend/app/migrations/versions/` 下是否包含 `task_jobs`、`daily_summaries`、`metric_snapshots`、`ai_conversations`、`ai_messages` 表的迁移文件；缺失则按 S02 DDL 补充迁移。
2. 在 `backend/app/core/config.py` 中增加 OSS 配置项（从环境变量读取）。
3. 在 `backend/app/core/storage.py` 实现两个函数：`upload_object(key, data) -> str`（返回 URL），`generate_presigned_url(key, expires_seconds) -> str`。
4. Worker 可直接引用相同的 `storage.py`，或在 `worker/app/core/` 中建立薄包装。
5. 在 `docker-compose.yml` 中增加 MinIO 服务用于本地开发。
6. 完成后在 `S02-db-schema.sql` 中同步补全缺失的表定义。

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T06-01 | 未开始 | 数据库迁移完整性核查与补全 | `backend-agent` | `S02-db-schema.sql`、现有迁移文件 | 缺失表的迁移文件；更新后的 S02 | `alembic upgrade head` 无报错；`task_jobs`、`daily_summaries`、`metric_snapshots`、`ai_conversations`、`ai_messages` 表均存在。 |
| T06-02 | 未开始 | OSS 配置项接入 | `backend-agent` | `core/config.py`、A01/A02 配置约定 | `config.py` 新增 OSS 配置字段 | OSS 配置项从环境变量读取；缺失时启动时输出明确错误提示。 |
| T06-03 | 未开始 | OSS 客户端封装（backend） | `backend-agent` | `core/storage.py`（新建）、`boto3`/`aiobotocore` | `upload_object()` 和 `generate_presigned_url()` 函数 | 能将字节数据上传至 OSS bucket；能生成有时效的预签名下载 URL。 |
| T06-04 | 未开始 | OSS 客户端封装（worker） | `backend-agent` | T06-03 完成、`worker/app/core/` | Worker 可复用的 OSS 工具函数 | Worker job 可调用 OSS 上传并获得下载 URL；无需重复实现客户端逻辑。 |
| T06-05 | 未开始 | MinIO 本地开发环境配置 | `backend-agent` | `docker-compose.yml` | `docker-compose.yml` 新增 MinIO 服务 | `docker-compose up` 后 MinIO 可访问，本地环境 OSS 上传/下载可正常工作。 |

## 完成标准
- 所有子任务子状态均为 `已完成`。
- `alembic upgrade head` 在全新数据库上无报错。
- OSS 上传和预签名 URL 生成在本地 MinIO 和生产 OSS 均可工作。
- OSS 凭证不出现在任何代码或日志中。
- 新增 Python 依赖已更新 `backend/pyproject.toml` 和 `worker/pyproject.toml` 并执行 `uv sync`。

## 交接记录

| 时间 | 交接人 | 接手人 | 说明 |
| --- | --- | --- | --- |
| 2026-04-13 | Codex | `backend-agent` | 任务文档初始化，可与 T01 并行执行。 |
