---
name: task-doc-management
description: Create, structure, and maintain task-category documentation for execution and delivery. Use this skill whenever the user asks for task breakdowns, execution plans, milestone plans, implementation checklists, ownership matrices, blocker tracking, rollout checklists, sprint task docs, or any T-category documentation under docs/task. Also use it when the user wants to turn a plan into an actionable task document with owners, dependencies, progress tracking, and done criteria, even if they do not explicitly mention task docs.
---

# Task Doc Management

Use this skill to create and maintain `T` category documents under `docs/task`.

This skill is for:
- Turning plans into actionable task documents
- Creating execution plans, milestone plans, and rollout checklists
- Maintaining owner assignments, dependencies, blockers, and completion criteria
- Standardizing task docs with the repo's metadata, versioning, and numbering system
- Updating task indexes when new T-category docs are added

Read [references/task-doc-standard.md](./references/task-doc-standard.md) before creating or restructuring task documentation.

## Default workflow

1. Confirm the document belongs to the task category.
   Use this skill when the main question is execution: who does what, in what order, with what dependencies, and what counts as done.

2. Place the doc under `docs/task`.
   Use the `T` prefix and the next available two-digit number.
   Keep `docs/task/README.md` as the category index with document ID `T00`.

3. Apply the standard metadata block and change-log section.
   Task docs follow the same governed header pattern as the rest of the repo docs.

4. Use the task template.
   Every task doc should clearly answer:
   - what the task is
   - why it exists
   - who owns it
   - what the subtasks are
   - what blocks progress
   - what counts as complete

5. Keep tasks actionable.
   Prefer explicit tasks, owners, dependencies, milestones, and done criteria over vague goals.

6. Update navigation if the task doc set changes.
   When you add a visible task document, update `docs/task/README.md`.
   Update `docs/README.md` if the task doc should appear in the top-level navigation.

## Use this skill for

- MVP execution plans
- iteration task breakdowns
- responsibility matrices
- milestone tracking docs
- launch and release checklists
- blocker and dependency tracking docs

## Do not use this skill for

- broad documentation governance rules across all categories
- system architecture and deployment standards
- API and database specs
- product scope or roadmap docs unless the user explicitly wants an execution task document derived from them

Use `document-governance` instead for those governance-heavy or cross-category requests.

## Output requirements

When writing task docs:
- keep the file name ASCII and hyphenated
- use the next valid `T` number
- include metadata and change log
- include task scope, owners, dependencies, and completion criteria
- keep the document directly actionable

## Example trigger cases

**Example 1**
Input: "帮我写一个 MVP 执行计划，把工作拆成可以跟进的任务。"
Action: Use this skill to create a `T` doc with scope, task breakdown, owners, dependencies, and done criteria.

**Example 2**
Input: "把这份方案改成上线前检查清单。"
Action: Use this skill to convert the plan into a T-category checklist document.

**Example 3**
Input: "我要一个迭代任务文档，能标负责人、阻塞项和里程碑。"
Action: Use this skill to create a task execution document under `docs/task`.
