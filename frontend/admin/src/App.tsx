import { Layout, Menu, Typography } from 'antd'

const menuItems = [
  { key: 'dashboard', label: '工作台' },
  { key: 'families', label: '家庭管理' },
  { key: 'babies', label: '宝宝管理' },
  { key: 'events', label: '事件审计' },
  { key: 'rules', label: '提醒规则模板' },
  { key: 'ai', label: 'AI 会话日志' },
  { key: 'exports', label: '导出任务' },
  { key: 'dict', label: '字典配置' },
  { key: 'settings', label: '系统设置' }
]

const { Header, Sider, Content } = Layout

export default function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={240}>
        <div style={{ padding: 16, fontWeight: 600 }}>Baby Growth Admin</div>
        <Menu mode="inline" defaultSelectedKeys={['dashboard']} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
          管理后台
        </Header>
        <Content style={{ padding: 24 }}>
          <Typography.Title level={4}>运营控制台基础骨架</Typography.Title>
          <Typography.Paragraph>
            当前已按架构文档初始化模块入口，后续可逐个接入真实 API 与表格页。
          </Typography.Paragraph>
        </Content>
      </Layout>
    </Layout>
  )
}
