# Repository Guidelines

## Project Structure & Module Organization
This repository is documentation-first. The root contains a minimal [README.md](/Users/raven/code/baby-growth-record-book/README.md) and the governed document set under `docs/`.

- `docs/product/`: product overview, scope, roadmap (`Pxx-*`)
- `docs/architecture/`: system, deployment, and security docs (`Axx-*`)
- `docs/design/`: flows, API, data model, database, and AI design (`Dxx-*`)
- `docs/quality/`: testing and acceptance criteria (`Qxx-*`)
- `docs/specs/`: machine-readable artifacts such as `S01-openapi.yaml` and `S02-db-schema.sql`
- `docs/task/`: execution-task index for future `Txx-*` documents
- `.agents/skills/`: the canonical source for documentation governance rules

## Documentation Governance Source of Truth
Documentation governance rules are maintained only in `.agents/skills/`.

- Use `.agents/skills/document-governance/` for non-task documentation governance
- Use `.agents/skills/task-doc-management/` for task-document rules
- Do not recreate governance rule copies under `docs/`
- Keep `docs/` focused on project documents and machine-readable deliverables

When updating governance behavior such as document status, versioning, template requirements, naming, numbering, or T-category task-document rules, modify the relevant skill/reference instead of adding parallel prose under `docs/`.

## Build, Test, and Development Commands
No application build pipeline or package manifest is checked in yet. Current work is document and spec maintenance.

- `rg --files docs`: list the governed document set quickly
- `git diff -- docs`: review documentation changes before committing
- `sed -n '1,120p' docs/specs/S01-openapi.yaml`: inspect spec edits in manageable chunks
- `find .agents/skills -maxdepth 3 -type f | sort`: inspect the active governance skill set

If runnable services are added later, update this guide with real project commands instead of placeholders.

## Coding Style & Naming Conventions
Use short, direct Markdown sections with stable numbering and relative links. Follow the existing filename pattern: `P01-product-overview.md`, `A02-deployment-and-ops.md`, `Q01-testing-and-acceptance.md`.

- Markdown docs: preserve the metadata block and `变更记录` table used across `docs/`
- YAML: use two-space indentation and keep the OpenAPI version at `3.1.0`
- SQL: prefer uppercase SQL keywords and `snake_case` identifiers
- Filenames: ASCII only, hyphenated, category-prefixed (`P/A/D/Q/S/T`)

For governance changes, update `.agents/skills/document-governance/` or `.agents/skills/task-doc-management/` rather than duplicating rules in `docs/`.

## Testing Guidelines
There is no automated test suite in the repository yet. Treat [docs/quality/Q01-testing-and-acceptance.md](/Users/raven/code/baby-growth-record-book/docs/quality/Q01-testing-and-acceptance.md) as the current validation baseline.

- Verify links, numbering, and category indexes after every doc change
- Keep `S01-openapi.yaml` and `S02-db-schema.sql` aligned with the architecture and design docs
- When behavior or scope changes, update the relevant acceptance criteria in `docs/quality/`

## Commit & Pull Request Guidelines
Git history currently contains only `Initial commit`, so follow a simple imperative style for new commits, for example: `Add API error handling notes` or `Update Q01 acceptance scenarios`.

PRs should include a concise summary, the document areas changed, any renumbering or link updates, and related issue references when available. Include screenshots only when reviewing rendered diagrams or UI assets in future implementation work.
