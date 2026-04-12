# Worker

异步任务执行骨架，对齐设计文档中的任务类型：

- 汇总重算（`aggregate_daily`）
- 报告导出（`export_report`）
- 提醒扫描（`scan_alerts`）
- AI 摘要（`generate_ai_summary`）

## 快速开始

```bash
cd worker
uv sync
uv run python -m app.main
```
