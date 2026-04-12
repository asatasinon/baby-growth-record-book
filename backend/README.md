# Backend API

基于 `FastAPI + Pydantic + SQLAlchemy` 的模块化单体骨架，已对齐：

- `docs/architecture/A01-system-architecture.md`
- `docs/design/D03-api-design.md`
- `docs/specs/S01-openapi.yaml`

## 快速开始

```bash
cd backend
uv sync --extra dev
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> 运行基线：Python `3.13`

## 目录

- `app/main.py`: 应用入口
- `app/api/router.py`: v1 路由聚合
- `app/core/`: 配置、错误、响应包装、数据库健康检查
- `app/schemas/`: 通用 schema 与 ID 转换层
- `app/modules/`: 按领域模块拆分路由
