# Frontend Workspace

前端统一使用 `pnpm` 管理依赖：

- `miniapp`: Taro 用户端（同一套代码产出微信小程序与 H5）
- `admin`: 运营后台

```bash
cp .env.example .env
pnpm install
pnpm --filter @baby-growth/miniapp dev:h5
pnpm --filter @baby-growth/admin dev
pnpm --filter @baby-growth/miniapp dev:weapp
pnpm --filter @baby-growth/miniapp build:h5
```

- 前端配置统一放在 `frontend/.env`
- `admin`（Vite）与 `miniapp`（Taro）都会读取该文件
