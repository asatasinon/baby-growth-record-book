# Frontend Workspace

前端统一使用 `pnpm` 管理依赖：

- `miniapp`: Taro 用户端
- `web`: H5 分享端
- `admin`: 运营后台

```bash
pnpm install
pnpm --filter @baby-growth/web dev
pnpm --filter @baby-growth/admin dev
pnpm --filter @baby-growth/miniapp dev:weapp
```
