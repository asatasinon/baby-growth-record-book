# baby-growth-record-book

按照架构与设计文档初始化的首版工程骨架，包含：

- `frontend/miniapp`: `Taro + React + TypeScript`（小程序/用户端）
- `frontend/web`: `React + Vite`（H5 分享页）
- `frontend/admin`: `React + Vite + Ant Design`（管理后台）
- `backend`: `FastAPI + Pydantic + SQLAlchemy`（模块化单体 API）
- `worker`: Python 异步任务执行器（聚合、导出、提醒、AI 摘要）
- `docker-compose.yml`: `nginx + api + worker + postgres` 本地部署基线

## 前端（pnpm）

```bash
pnpm install
pnpm dev:miniapp   # 小程序开发模式
pnpm dev:web       # H5
pnpm dev:admin     # 管理后台
```

## 后端（uv）

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Worker（uv）

```bash
cd worker
uv sync
uv run python -m app.main
```

## 容器启动

```bash
cp .env.example .env
docker compose up --build
```

## 文档入口

- [系统架构](/Users/raven/code/baby-growth-record-book/docs/architecture/A01-system-architecture.md)
- [部署与运维](/Users/raven/code/baby-growth-record-book/docs/architecture/A02-deployment-and-ops.md)
- [接口设计](/Users/raven/code/baby-growth-record-book/docs/design/D03-api-design.md)
- [OpenAPI 规格](/Users/raven/code/baby-growth-record-book/docs/specs/S01-openapi.yaml)
