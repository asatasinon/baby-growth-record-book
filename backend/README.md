# Backend API

基于 `FastAPI + Pydantic + SQLAlchemy` 的模块化单体骨架，已对齐：

- `docs/architecture/A01-system-architecture.md`
- `docs/design/D03-api-design.md`
- `docs/specs/S01-openapi.yaml`

## 快速开始

```bash
cd backend
cp .env.example .env
uv sync --extra dev
uv run python main.py
```

> 运行基线：Python `3.13`

## 启动配置

- 启动参数与业务配置统一读取 `backend/.env`
- `API_HOST/API_PORT/API_RELOAD/API_LOG_LEVEL/API_WORKERS` 可作为覆盖项

## 目录

- `main.py`: 服务启动入口（读取 `backend/.env` 并启动 uvicorn）
- `app/main.py`: 应用入口
- `app/api/router.py`: v1 路由聚合
- `app/core/`: 配置、错误、响应包装、数据库健康检查
- `app/schemas/`: 通用 schema 与 ID 转换层
- `app/modules/`: 按领域模块拆分路由
