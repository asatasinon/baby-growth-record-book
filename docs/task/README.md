# 任务文档索引（T00）

> 文档编号：T00
> 状态：已生效
> 版本号：v0.1.0
> 最后更新时间：2026-04-13
> 审核人：待定
> 生效日期：2026-04-13
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-13 | Codex | 初始化任务文档体系，基于现有实现与架构文档差距分析生成首批执行任务。 |

## 文档目的
- 作为 `docs/task` 任务文档体系的索引与总看板。
- 汇总各执行任务的状态、owner 和阻塞，提供统一的派单视图。

## 关联文档
- [系统架构](../architecture/A01-system-architecture.md)
- [接口设计](../design/D03-api-design.md)
- [AI 与规则引擎设计](../design/D06-ai-and-rule-engine.md)
- [产品需求](../product/P02-requirements-and-scope.md)

---

## 总看板视图

| 文档编号 | 文档名称 | 执行状态 | owner | 优先级 | ETA | 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| [T01](./T01-backend-core.md) | 后端核心模块补全 | 未开始 | `backend-agent` | P1 | 待定 | 无 |
| [T02](./T02-backend-ai.md) | 后端 AI 模块真实接入 | 未开始 | `backend-agent` | P2 | 待定 | T01 |
| [T03](./T03-worker-jobs.md) | Worker 任务真实实现 | 未开始 | `backend-agent` | P1 | 待定 | T01、T06 |
| [T04](./T04-frontend-miniapp.md) | 前端小程序缺失功能 | 未开始 | `frontend-agent` | P1 | 待定 | T01 |
| [T05](./T05-frontend-admin.md) | 前端管理后台补全 | 未开始 | `frontend-agent` | P2 | 待定 | T01 |
| [T06](./T06-infra-oss.md) | 基础设施与 OSS 集成 | 未开始 | `backend-agent` | P1 | 待定 | 无 |

---

## 按 owner 聚合视图

### backend-agent
- T01：后端核心模块补全（P1）
- T02：后端 AI 模块真实接入（P2，依赖 T01）
- T03：Worker 任务真实实现（P1，依赖 T01、T06）
- T06：基础设施与 OSS 集成（P1）

### frontend-agent
- T04：前端小程序缺失功能（P1，依赖 T01）
- T05：前端管理后台补全（P2，依赖 T01）

---

## 按阻塞聚合视图

| 被阻塞任务 | 阻塞原因 | 解除条件 |
| --- | --- | --- |
| T02 | 需要 T01 完成 summary/analytics 聚合层 | T01 summary weekly/monthly + analytics temperature_c 完成 |
| T03 | 需要 T01 事件写入后 task_jobs 派发；需要 T06 OSS 客户端 | T01 task_jobs 派发 + T06 OSS 集成完成 |
| T04 | 需要后端 PATCH 事件、家庭管理、宝宝编辑接口稳定 | T01 相关接口完成 |
| T05 | 需要 AI 日志、规则模板后端接口稳定 | T01 + T02 相关接口完成 |

---

## 推荐执行顺序

```
T06（OSS 集成）
    ↓ 并行
T01（后端核心补全）
    ↓
T03（Worker 任务）← 依赖 T06
T04（小程序前端）← 依赖 T01
    ↓
T02（AI 模块）← 依赖 T01
T05（管理后台）← 依赖 T01、T02
```

**建议**：T06 和 T01 可并行启动；T03、T04 待 T01 核心完成后并行推进；T02、T05 最后收尾。

---

## 派单规则
- 每个执行任务文档有且只有一个 `执行 owner`。
- 执行 owner 是唯一有权修改对应任务文档的角色。
- 跨任务阻塞须记录在 `外部依赖登记表` 中，不得直接修改其他任务文档。
- 执行状态变更须同步更新本 T00 总看板视图。
- 任何排期或 owner 变更须在对应执行文档的 `变更记录` 中追加一行。
