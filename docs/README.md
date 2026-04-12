# 婴儿成长记录平台文档总览

> 文档编号：DOC-ROOT
> 状态：草案
> 版本号：v0.1.0
> 最后更新时间：2026-04-12
> 审核人：待定
> 生效日期：2026-04-12
> 负责人：待定

## 变更记录

| 版本号 | 日期 | 变更人 | 变更说明 |
| --- | --- | --- | --- |
| v0.1.0 | 2026-04-12 | Codex | 初始化文档结构、分类、编号与元信息模板。 |

## 文档目的
- 为 `baby-growth-record-book` 提供一套可直接用于立项评审、研发开工、联调测试和容器化部署的完整文档。

## 目标读者
- 产品经理
- 小程序/H5 前端工程师
- 后端工程师
- 测试工程师
- 运维工程师

## 关联文档
- [产品类文档](./product/README.md)
- [架构类文档](./architecture/README.md)
- [设计类文档](./design/README.md)
- [任务类文档](./task/README.md)
- [质量与验收类文档](./quality/README.md)
- [规范与脚本类文档](./specs/README.md)

## 分类目录

### 产品类
- [P01 产品总览](./product/P01-product-overview.md)
- [P02 需求与范围](./product/P02-requirements-and-scope.md)
- [P03 Roadmap](./product/P03-roadmap.md)

### 架构类
- [A01 系统架构](./architecture/A01-system-architecture.md)
- [A02 部署与运维](./architecture/A02-deployment-and-ops.md)
- [A03 安全与合规](./architecture/A03-security-and-compliance.md)

### 设计类
- [D01 信息架构](./design/D01-information-architecture.md)
- [D02 业务流程](./design/D02-business-flows.md)
- [D03 接口设计](./design/D03-api-design.md)
- [D04 领域数据模型](./design/D04-domain-data-model.md)
- [D05 数据库设计](./design/D05-database-design.md)
- [D06 AI 与规则引擎](./design/D06-ai-and-rule-engine.md)

### 任务类
- [T00 任务类文档索引](./task/README.md)

### 质量与验收类
- [Q01 测试与验收](./quality/Q01-testing-and-acceptance.md)

### 规范与脚本类
- [S01 OpenAPI 规范](./specs/S01-openapi.yaml)
- [S02 数据库 DDL 草案](./specs/S02-db-schema.sql)
- [规范与脚本类索引](./specs/README.md)

## 阅读顺序
1. 先读产品类中的 [P01 产品总览](./product/P01-product-overview.md) 和 [P02 需求与范围](./product/P02-requirements-and-scope.md)，明确业务目标和首版边界。
2. 再读设计类中的 [D01 信息架构](./design/D01-information-architecture.md) 与 [D02 业务流程](./design/D02-business-flows.md)，统一页面流转和业务口径。
3. 研发侧依次阅读架构类中的 [A01 系统架构](./architecture/A01-system-architecture.md)，以及设计类中的 [D03 接口设计](./design/D03-api-design.md)、[D04 领域数据模型](./design/D04-domain-data-model.md)、[D05 数据库设计](./design/D05-database-design.md)。
4. AI、部署、安全、测试分别对应 [D06 AI 与规则引擎](./design/D06-ai-and-rule-engine.md)、[A02 部署与运维](./architecture/A02-deployment-and-ops.md)、[A03 安全与合规](./architecture/A03-security-and-compliance.md)、[Q01 测试与验收](./quality/Q01-testing-and-acceptance.md)。
5. 迭代排期与阶段目标参考产品类中的 [P03 Roadmap](./product/P03-roadmap.md)。

## 关键决策摘要
- 产品形态：多家庭 SaaS，首发聚焦微信小程序，同时复用能力到 H5 和基础管理后台。
- 技术路线：`Taro + React + TypeScript`、`FastAPI + SQLAlchemy + PostgreSQL`、`Docker Compose` 单机容器化首发。
- 架构策略：模块化单体，不上微服务；通过异步任务完成汇总、导出、提醒和 AI 摘要。
- 业务重点：喂养、排泄、测量、睡眠、用药、疫苗、里程碑、自动汇总、趋势图、提醒、导出、AI 问答。
- 成本控制：单云单地域单实例，H5/后台静态资源走对象存储 + CDN，数据库首版可与应用同机部署。

## 文档使用约束
- 所有时间字段默认采用 UTC 存储，按家庭时区展示，默认时区为 `Asia/Shanghai`。
- 所有业务口径以“宝宝”为统计主体，不允许跨宝宝混算。
- AI 只做记录解读、问答和总结，不提供医疗诊断。
