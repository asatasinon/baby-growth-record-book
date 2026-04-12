# Task Documentation Standard

Use this reference when creating or maintaining `T` category documents.

This file is the single source of truth for task-document rules in this repository. Do not recreate parallel T-category governance copies under `docs/`.

## 1. Category definition

Task docs are execution-facing documents under `docs/task`.

Use a task doc when the primary need is:
- task breakdown
- execution sequencing
- owner assignment
- milestone tracking
- blocker management
- completion criteria

Do not use task docs for:
- product positioning
- architecture decisions
- API contracts
- cross-category governance rules

## 2. Location and numbering

- Directory: `docs/task`
- Index file: `docs/task/README.md`
- Index document number: `T00`
- Regular task docs: `T01`, `T02`, `T03`, ...

File format:
- `<TNN>-<english-short-name>.md`

Examples:
- `T01-mvp-execution-plan.md`
- `T02-release-readiness-checklist.md`
- `T03-iteration-2-task-breakdown.md`

## 3. Metadata block

Use this exact metadata block below the title:

```md
> 文档编号：T01
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-12
> 审核人：待定
> 生效日期：2026-04-12
> 负责人：待定
```

Allowed status values:
- `草案`
- `评审中`
- `已生效`
- `已废弃`

## 4. Change log

Every task doc should include:

```md
## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 创建首版任务文档。 |
```

When the task doc changes:
- update `版本号`
- update `最后更新时间`
- append a change-log row
- update `状态` if lifecycle changed

## 5. Required structure

Every task doc should include these sections:
- `文档目的`
- `目标读者`
- `关联文档`
- `任务背景` or `任务来源`
- `任务范围`
- `任务拆解`
- `负责人` or `角色分工`
- `完成标准`

## 6. Recommended sections

Add these when useful:
- `优先级`
- `里程碑`
- `依赖与阻塞`
- `风险`
- `状态跟踪`
- `交付物`

## 7. Writing rules

Task docs should answer:
- Why does this task exist?
- What exactly must be done?
- Who owns each part?
- What dependencies or blockers exist?
- How do we know the task is complete?

Prefer:
- explicit actions
- concrete owners
- observable completion criteria
- finite milestones

Avoid:
- vague goals without action items
- missing owners
- missing done criteria
- mixing broad product strategy with execution details

## 8. Example minimal template

```md
# 标题

> 文档编号：T01
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-12
> 审核人：待定
> 生效日期：2026-04-12
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 创建首版任务文档。 |

## 文档目的
## 目标读者
## 关联文档
## 任务背景
## 任务范围
## 任务拆解
## 负责人
## 完成标准
```

## 9. Update checklist

When adding a task doc:
1. choose the next valid `T` number
2. create the file under `docs/task`
3. add the metadata block
4. add the change-log section
5. follow the required task structure
6. update `docs/task/README.md`
7. update `docs/README.md` if the new task doc should be listed there

## 10. Relationship to document governance

Task docs still follow the repo-wide governance rules:
- status values
- versioning format
- naming format
- preservation of deprecated docs

Use `document-governance` when the user is asking for cross-category governance changes rather than task execution documents.
