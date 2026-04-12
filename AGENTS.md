# 仓库指南

## 项目结构与模块组织
该仓库以文档为先。根目录包含一个简洁的 [README.md](/Users/raven/code/baby-growth-record-book/README.md)，以及位于 `docs/` 下、受治理约束的文档集合。

- `docs/product/`：产品概述、范围、路线图（`Pxx-*`）
- `docs/architecture/`：系统、部署与安全文档（`Axx-*`）
- `docs/design/`：流程、API、数据模型、数据库与 AI 设计（`Dxx-*`）
- `docs/quality/`：测试与验收标准（`Qxx-*`）
- `docs/specs/`：机器可读产物，例如 `S01-openapi.yaml` 和 `S02-db-schema.sql`
- `docs/task/`：未来 `Txx-*` 文档的执行任务索引
- `.agents/skills/`：仓库本地 skills 集合，包含文档治理与任务文档管理等可复用工作流

## Skills 使用说明
`.agents/skills/` 不只是文档治理目录，而是本仓库的本地 skills 集合。当前仓库已定义的 repo-local skill 如下：

- `document-governance`：用于非任务类文档治理与文档体系维护，例如重组 `docs/`、统一文档分类、规范元数据、状态、版本、模板、命名、编号、索引以及跨类别文档规则
- `task-doc-management`：用于 `docs/task/` 下的 `T` 类任务文档，例如执行计划、里程碑计划、任务拆解、负责人分配、依赖与阻塞跟踪、上线清单和完成标准

使用判断规则：

- 当请求的重点是文档体系治理、跨类别规范、README/索引整理、规格合并、命名编号标准化时，使用 `document-governance`
- 当请求的重点是“谁做什么、按什么顺序做、依赖什么、何时算完成”的执行类文档时，使用 `task-doc-management`
- 如果只是修改某一份普通产品、架构、设计、质量或 specs 文档，但改动涉及元数据、编号、模板或文档归类，也应优先参考 `document-governance`
- 不要因为要写任务计划，就把规则写回 `docs/specs/` 或其他 `docs/` 目录；任务类规则应以 `task-doc-management` 为准

## 文档治理来源说明
与文档治理相关的规则集中维护在 `.agents/skills/` 中对应的 skill/reference 内，而不是在 `docs/` 下重复维护一份副本。

- 非任务类文档治理请使用 `.agents/skills/document-governance/`
- 任务文档规则请使用 `.agents/skills/task-doc-management/`
- 不要在 `docs/` 下重复创建治理规则副本
- 保持 `docs/` 只聚焦于项目文档和机器可读交付物

当需要更新文档状态、版本管理、模板要求、命名、编号或 T 类任务文档规则等治理行为时，应修改对应的 skill/reference，而不是在 `docs/` 下额外补充一套平行说明。

## 构建、测试与开发命令
当前仓库现阶段仍以文档与规格维护为主，但研发实现已明确依赖管理约束：前端统一使用 `pnpm`，Python 统一使用 `uv`。

- `rg --files docs`：快速列出受治理的文档集合
- `git diff -- docs`：在提交前检查文档改动
- `sed -n '1,120p' docs/specs/S01-openapi.yaml`：分段查看规格文件修改
- `find .agents/skills -maxdepth 3 -type f | sort`：查看当前启用的治理技能集合
- `pnpm install`：前端工程依赖安装（如 `frontend/miniapp/`、`frontend/web/`、`frontend/admin/`）
- `uv sync`：Python 工程依赖同步（如 `backend/`、`worker/`）

如果后续加入可运行的服务，请用真实项目命令更新本指南，而不是保留占位说明。

## 编码风格与命名约定
请使用简短、直接的 Markdown 章节，保持稳定编号和相对链接。文件名遵循现有模式：`P01-product-overview.md`、`A02-deployment-and-ops.md`、`Q01-testing-and-acceptance.md`。

- Markdown 文档：保留 `docs/` 中通用的元数据区块和 `变更记录` 表格
- YAML：使用两个空格缩进，并将 OpenAPI 版本保持为 `3.1.0`
- SQL：优先使用大写 SQL 关键字和 `snake_case` 标识符
- 文件名：仅使用 ASCII，采用连字符写法，并带类别前缀（`P/A/D/Q/S/T`）
- 依赖管理：前端统一 `pnpm`，Python 统一 `uv`，避免混用 `npm/yarn/pip/poetry/pipenv`

涉及治理规则的修改时，应更新 `.agents/skills/document-governance/` 或 `.agents/skills/task-doc-management/`，不要在 `docs/` 中重复维护规则。

## 测试指南
仓库目前还没有自动化测试套件。请将 [docs/quality/Q01-testing-and-acceptance.md](/Users/raven/code/baby-growth-record-book/docs/quality/Q01-testing-and-acceptance.md) 视为当前验证基线。

- 每次修改文档后都要检查链接、编号和分类索引
- 保持 `S01-openapi.yaml` 与 `S02-db-schema.sql` 和架构、设计文档一致
- 当行为或范围发生变化时，更新 `docs/quality/` 中对应的验收标准

## 提交与拉取请求指南
当前 Git 历史中只有 `Initial commit`，因此新提交请采用简洁的祈使句风格，例如：`Add API error handling notes` 或 `Update Q01 acceptance scenarios`。

PR 应包含简要摘要、变更涉及的文档范围、任何重新编号或链接更新，以及相关 issue 引用（如有）。只有在后续实现工作中评审已渲染的图表或 UI 资产时，才需要附上截图。
