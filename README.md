# baby-growth-record-book

按照架构与设计文档初始化的首版工程骨架，包含：

- `frontend/miniapp`: `Taro + React + TypeScript`（同一套代码产出小程序与 H5）
- `frontend/admin`: `React + Vite + Ant Design`（管理后台）
- `backend`: `FastAPI + Pydantic + SQLAlchemy`（模块化单体 API）
- `worker`: Python 异步任务执行器（聚合、导出、提醒、AI 摘要）
- `docker-compose.yml`: `nginx + h5 + api + worker + postgres` 本地部署基线

## 运行时版本

- Python 默认版本：`3.13`（见 [`.python-version`](/Users/raven/code/baby-growth-record-book/.python-version)）
- 前端包管理：`pnpm`
- Python 包管理：`uv`

## 前端（pnpm）

```bash
pnpm install
pnpm dev:miniapp   # 小程序开发模式
pnpm dev:h5        # H5 开发模式（来自 miniapp）
pnpm dev:admin     # 管理后台
```

## 常用快捷指令（pnpm）

```bash
pnpm setup:python   # 安装 backend + worker 的 uv 依赖（含 dev）
pnpm dev:backend    # 启动后端 API（uvicorn --reload）
pnpm dev:worker     # 启动 worker
pnpm check          # ruff check --fix（backend + worker）
pnpm lint           # backend/worker lint + frontend build 校验
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
pnpm build:h5
cp .env.example .env
docker compose up --build
```

容器启动后：

- H5 访问：`http://localhost:8080/`
- API 访问：`http://localhost:8080/api/v1/...`
- 健康检查：
  - `http://localhost:8080/health/live`
  - `http://localhost:8080/health/ready`

## 文档入口

- [系统架构](/Users/raven/code/baby-growth-record-book/docs/architecture/A01-system-architecture.md)
- [部署与运维](/Users/raven/code/baby-growth-record-book/docs/architecture/A02-deployment-and-ops.md)
- [接口设计](/Users/raven/code/baby-growth-record-book/docs/design/D03-api-design.md)
- [OpenAPI 规格](/Users/raven/code/baby-growth-record-book/docs/specs/S01-openapi.yaml)
