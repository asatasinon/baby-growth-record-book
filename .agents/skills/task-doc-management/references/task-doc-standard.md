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

For assignment-ready execution docs, also include:
- `执行状态`
- `执行 owner`
- `执行排期`
- `预计输入`
- `预计输出`
- `允许修改的代码目录`
- `外部依赖登记表`
- `agent 接手说明`
- `交接记录`

## 6. Recommended sections

Add these when useful:
- `优先级`
- `里程碑`
- `依赖与阻塞`
- `风险`
- `状态跟踪`
- `交付物`
- `派单规则`
- `总看板视图`
- `按 owner 聚合视图`
- `按阻塞聚合视图`

## 6.1 Task-system document roles

When the task set becomes a working execution system, prefer these roles:

| Document role | Typical number | Main job |
| --- | --- | --- |
| Task index/dashboard | `T00` | index, dispatch rules, dashboard, owner/blocker views |
| Umbrella execution plan | `T01` | overall phase plan and milestone summary |
| Umbrella acceptance checklist | `T02` | overall integration and acceptance summary |
| Collaboration-boundary doc | `T03` | ownership boundaries, handoff rules, maintenance rules |
| Execution docs | `T04+` | one stable responsibility slice per doc |

Execution docs should not overlap in primary ownership.

## 6.2 Execution status vs. metadata status

Metadata `状态` is still governed by lifecycle values:
- `草案`
- `评审中`
- `已生效`
- `已废弃`

Execution-facing task tracking should use a separate `执行状态` section.

Recommended `执行状态` values:
- `未开始`
- `进行中`
- `阻塞`
- `已完成`

Recommended `子状态` values for subtask rows:
- `未开始`
- `进行中`
- `阻塞`
- `已完成`

Do not replace the metadata lifecycle status with execution status.

## 6.3 Execution owner and schedule fields

Assignment-ready task docs should include:

```md
## 执行 owner
- owner 角色：前端负责人
- 当前执行 owner：`frontend-agent`
- 备援 owner：待分配
- 协作角色：后端负责人、测试负责人
- owner 变更要求：切换执行人时同步更新本节和交接记录。

## 执行排期
- 优先级：P1
- ETA：2026-04-21
- 实际完成时间：待完成
- 排期维护要求：排期变化时同步更新 `T00`。
```

Recommended priority values:
- `P0`
- `P1`
- `P2`

If the real assignee is unknown, default role-based agent names are acceptable.

## 6.4 Assignment-ready subtask table

Prefer this table shape for execution docs:

```md
| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| T05-01 | 未开始 | 应用骨架与全局上下文 | `frontend-agent` | `D01`、`T04` | 路由骨架和上下文切换 | 应用可稳定切换家庭与宝宝，并具备全局错误兜底。 |
```

Rules:
- `子任务编号` should be stable and traceable to the parent task doc
- `执行 owner` should normally match the task owner unless the task intentionally contains sub-ownership
- `预计输入` should be concrete upstream docs, contracts, environments, or data
- `预计输出` should be concrete deliverables
- `Done Criteria` should be observable and testable

## 6.5 Expected inputs and outputs

Assignment-ready task docs should explicitly state:
- what upstream docs, systems, or decisions they consume
- what downstream tasks can rely on after completion

This reduces informal coordination and prevents multiple agents from making hidden assumptions.

## 6.6 Allowed write scope

Execution docs should include `允许修改的代码目录` when code work is expected.

This section should:
- list the expected write scope
- mark whether each path already exists
- clarify which areas are placeholders vs. established directories

If the write scope changes materially, update the task doc before implementation.

## 6.7 External dependency register and handoff

Execution docs should include:
- `外部依赖登记表`
- `agent 接手说明`
- `交接记录`

These sections are used to:
- record blockers without editing other task docs
- preserve handoff continuity between agents
- keep ownership changes visible and auditable

## 6.8 T00 dashboard expectations

When `T00` acts as the active portfolio dashboard, it should usually include:

### Portfolio dashboard
- task id
- ownership domain
- current execution status
- current execution owner
- priority
- ETA
- actual completion time
- main inputs
- main outputs
- current blocker

### Owner aggregation view
- owner
- owned tasks
- current status
- near-term goal
- main blocker

### Blocker aggregation view
- blocker theme
- impacted tasks
- current status
- responsible owner
- handling direction

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

## 8.1 Example assignment-ready template

```md
# 标题

> 文档编号：T04
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-12
> 审核人：待定
> 生效日期：2026-04-12
> 负责人：后端负责人

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 创建首版任务文档。 |

## 执行状态
- 当前状态：未开始
- 可选状态：未开始 / 进行中 / 阻塞 / 已完成

## 执行 owner
- owner 角色：后端负责人
- 当前执行 owner：`spec-agent`
- 备援 owner：待分配
- 协作角色：前端负责人、测试负责人

## 执行排期
- 优先级：P0
- ETA：2026-04-14
- 实际完成时间：待完成

## 文档目的
## 目标读者
## 关联文档
## 任务背景
## 任务范围
## 预计输入
## 预计输出
## 允许修改的代码目录
## 外部依赖登记表
## agent 接手说明
## 交接记录

## 任务拆解

| 子任务编号 | 子状态 | 子任务 | 执行 owner | 预计输入 | 预计输出 | Done Criteria |
| --- | --- | --- | --- | --- | --- | --- |
```

## 9. Update checklist

When adding a task doc:
1. choose the next valid `T` number
2. create the file under `docs/task`
3. add the metadata block
4. add the change-log section
5. decide whether this is an umbrella doc, a dashboard doc, a boundary doc, or an execution doc
6. if it is an execution doc, add execution owner, schedule, inputs, outputs, write scope, dependency register, and handoff sections
7. if `T00` is active, update dashboard, owner view, and blocker view
8. follow the required task structure
9. update `docs/task/README.md`
10. update `docs/README.md` if the new task doc should be listed there

## 10. Relationship to document governance

Task docs still follow the repo-wide governance rules:
- status values
- versioning format
- naming format
- preservation of deprecated docs

Use `document-governance` when the user is asking for cross-category governance changes rather than task execution documents.

## 11. Multi-agent maintenance rule

When task docs are used by multiple agents:
- one execution doc should have one clear primary owner
- agents should update their own execution doc first
- blockers should be recorded as dependencies, not solved by editing other task docs
- `T00` should summarize, not replace, execution detail
- umbrella docs should not become the primary working surface once execution docs exist
