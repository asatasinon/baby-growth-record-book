import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Layout,
  Menu,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from 'antd'

import {
  listAdminBabies,
  listAdminEvents,
  listAdminFamilies,
  listAlerts,
  listExportTasks,
  loginWithPassword
} from './api'
import type {
  AlertEvent,
  AuthSession,
  BabyInfo,
  ExportTask,
  FamilyInfo,
  GrowthEvent
} from './types'

import './App.css'

const SESSION_STORAGE_KEY = 'baby-growth:admin:session'

type MenuKey =
  | 'dashboard'
  | 'families'
  | 'babies'
  | 'events'
  | 'rules'
  | 'ai'
  | 'exports'
  | 'dict'
  | 'settings'

const menuItems: Array<{ key: MenuKey; label: string }> = [
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

const EVENT_TYPE_LABEL: Record<string, string> = {
  feeding: '喂养',
  excretion: '排泄',
  measurement: '测量',
  sleep: '睡眠',
  medication: '用药',
  vaccine: '疫苗',
  milestone: '里程碑'
}

const ALERT_SEVERITY_COLOR: Record<string, string> = {
  info: 'blue',
  warning: 'gold',
  high: 'red'
}

const EXPORT_STATUS_CLASS: Record<ExportTask['status'], string> = {
  pending: 'status-tag-pending',
  running: 'status-tag-running',
  succeeded: 'status-tag-succeeded',
  failed: 'status-tag-failed',
  expired: 'status-tag-expired'
}

function parseStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthSession
  } catch (_error) {
    return null
  }
}

function formatDateTime(ms: number | null): string {
  if (!ms) {
    return '-'
  }

  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString('zh-CN', {
    hour12: false
  })
}

function formatDate(ms: number): string {
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString('zh-CN')
}

function formatPayload(value: Record<string, unknown>): string {
  const text = JSON.stringify(value)
  if (text.length <= 100) {
    return text
  }
  return `${text.slice(0, 100)}...`
}

const { Header, Sider, Content } = Layout

export default function App() {
  const [messageApi, contextHolder] = message.useMessage()
  const [session, setSession] = useState<AuthSession | null>(parseStoredSession())
  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard')

  const [phone, setPhone] = useState('13800138000')
  const [password, setPassword] = useState('Passw0rd!')
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const [families, setFamilies] = useState<FamilyInfo[]>([])
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [events, setEvents] = useState<GrowthEvent[]>([])
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([])

  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')

  const [isCoreLoading, setIsCoreLoading] = useState(false)
  const [isAlertsLoading, setIsAlertsLoading] = useState(false)
  const [isExportsLoading, setIsExportsLoading] = useState(false)

  const activeFamilyOptions = useMemo(
    () => families.map((item) => ({ label: item.name, value: item.id })),
    [families]
  )

  async function loadCoreData(token: string): Promise<void> {
    setIsCoreLoading(true)
    try {
      const [familyData, babyData, eventData] = await Promise.all([
        listAdminFamilies(token),
        listAdminBabies(token),
        listAdminEvents(token)
      ])

      setFamilies(familyData)
      setBabies(babyData)
      setEvents(eventData)

      setSelectedFamilyId((current) => {
        if (current && familyData.some((item) => item.id === current)) {
          return current
        }
        return familyData[0]?.id || ''
      })
    } catch (error) {
      messageApi.error((error as Error).message || '加载后台数据失败')
    } finally {
      setIsCoreLoading(false)
    }
  }

  async function loadFamilyScopedData(token: string, familyId: string): Promise<void> {
    if (!familyId) {
      setAlerts([])
      setExportTasks([])
      return
    }

    setIsAlertsLoading(true)
    setIsExportsLoading(true)

    try {
      const [alertData, exportData] = await Promise.all([
        listAlerts(token, familyId),
        listExportTasks(token, familyId)
      ])
      setAlerts(alertData)
      setExportTasks(exportData)
    } catch (error) {
      messageApi.error((error as Error).message || '加载家庭维度数据失败')
    } finally {
      setIsAlertsLoading(false)
      setIsExportsLoading(false)
    }
  }

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    void loadCoreData(session.access_token)
  }, [session?.access_token])

  useEffect(() => {
    if (!session?.access_token || !selectedFamilyId) {
      return
    }

    void loadFamilyScopedData(session.access_token, selectedFamilyId)
  }, [session?.access_token, selectedFamilyId])

  async function handleLogin(): Promise<void> {
    const nextPhone = phone.trim()
    const nextPassword = password.trim()
    if (!nextPhone || !nextPassword) {
      messageApi.warning('请输入手机号和密码')
      return
    }

    setIsLoginLoading(true)
    try {
      const nextSession = await loginWithPassword(nextPhone, nextPassword)
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession))
      setSession(nextSession)
      messageApi.success('登录成功')
    } catch (error) {
      messageApi.error((error as Error).message || '登录失败')
    } finally {
      setIsLoginLoading(false)
    }
  }

  function handleLogout(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
    setFamilies([])
    setBabies([])
    setEvents([])
    setAlerts([])
    setExportTasks([])
    setSelectedFamilyId('')
  }

  function renderDashboard(): ReactNode {
    const pendingExports = exportTasks.filter((item) => item.status === 'pending' || item.status === 'running')
    const openAlerts = alerts.filter((item) => item.status === 'open')

    return (
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        <Alert
          type='info'
          showIcon
          message='本页数据已接入真实 API，默认展示当前账号可访问的家庭范围。'
        />
        <Space size={16} wrap>
          <Card className='admin-card'>
            <Statistic title='家庭数' value={families.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='宝宝数' value={babies.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='事件总量' value={events.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='未处理提醒' value={openAlerts.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='待完成导出' value={pendingExports.length} />
          </Card>
        </Space>
      </Space>
    )
  }

  function renderFamilies(): ReactNode {
    return (
      <Table
        rowKey='id'
        loading={isCoreLoading}
        dataSource={families}
        pagination={{ pageSize: 8 }}
        columns={[
          { title: '家庭 ID', dataIndex: 'id', width: 180 },
          { title: '家庭名称', dataIndex: 'name', width: 220 },
          { title: '角色', dataIndex: 'role', width: 140 },
          { title: '时区', dataIndex: 'timezone' }
        ]}
      />
    )
  }

  function renderBabies(): ReactNode {
    return (
      <Table
        rowKey='id'
        loading={isCoreLoading}
        dataSource={babies}
        pagination={{ pageSize: 8 }}
        columns={[
          { title: '宝宝 ID', dataIndex: 'id', width: 160 },
          { title: '家庭 ID', dataIndex: 'family_id', width: 160 },
          { title: '姓名', dataIndex: 'name', width: 160 },
          {
            title: '性别',
            dataIndex: 'gender',
            width: 120,
            render: (value: BabyInfo['gender']) => {
              if (value === 'male') {
                return '男'
              }
              if (value === 'female') {
                return '女'
              }
              return '未知'
            }
          },
          {
            title: '出生日期',
            dataIndex: 'birth_date',
            width: 140,
            render: (value: number) => formatDate(value)
          },
          {
            title: '出生体重(g)',
            dataIndex: 'birth_weight_g',
            render: (value: number | null) => value ?? '-'
          }
        ]}
      />
    )
  }

  function renderEvents(): ReactNode {
    return (
      <Table
        rowKey='id'
        loading={isCoreLoading}
        dataSource={events}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1200 }}
        columns={[
          { title: '事件 ID', dataIndex: 'id', width: 160 },
          {
            title: '类型',
            dataIndex: 'event_type',
            width: 120,
            render: (value: string) => EVENT_TYPE_LABEL[value] || value
          },
          { title: '家庭 ID', dataIndex: 'family_id', width: 160 },
          { title: '宝宝 ID', dataIndex: 'baby_id', width: 160 },
          {
            title: '发生时间',
            dataIndex: 'occurred_at',
            width: 180,
            render: (value: number) => formatDateTime(value)
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: GrowthEvent['status']) =>
              value === 'active' ? <Tag color='green'>active</Tag> : <Tag color='default'>{value}</Tag>
          },
          {
            title: '备注',
            dataIndex: 'notes',
            width: 180,
            render: (value: string | null) => value || '-'
          },
          {
            title: 'Payload',
            dataIndex: 'payload',
            render: (value: Record<string, unknown>) => (
              <Typography.Text code>{formatPayload(value)}</Typography.Text>
            )
          }
        ]}
      />
    )
  }

  function renderAlerts(): ReactNode {
    return (
      <Space direction='vertical' size={14} style={{ width: '100%' }}>
        <Alert
          type='info'
          showIcon
          message='当前后端已提供提醒事件查询接口。本模块先用于排查提醒触发结果，规则模板 CRUD 将在后续接口补齐后接入。'
        />
        <div className='list-toolbar'>
          <Space>
            <Typography.Text>家庭：</Typography.Text>
            <Select
              style={{ minWidth: 220 }}
              options={activeFamilyOptions}
              value={selectedFamilyId || undefined}
              onChange={(value) => setSelectedFamilyId(value)}
              placeholder='请选择家庭'
            />
          </Space>
          <Button
            onClick={() => {
              if (session?.access_token && selectedFamilyId) {
                void loadFamilyScopedData(session.access_token, selectedFamilyId)
              }
            }}
          >
            刷新
          </Button>
        </div>

        <Table
          rowKey='id'
          loading={isAlertsLoading}
          dataSource={alerts}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: '提醒 ID', dataIndex: 'id', width: 170 },
            {
              title: '严重级别',
              dataIndex: 'severity',
              width: 110,
              render: (value: AlertEvent['severity']) => (
                <Tag color={ALERT_SEVERITY_COLOR[value] || 'default'}>{value}</Tag>
              )
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 130,
              render: (value: AlertEvent['status']) => {
                if (value === 'open') {
                  return <Tag color='red'>open</Tag>
                }
                if (value === 'acknowledged') {
                  return <Tag color='gold'>acknowledged</Tag>
                }
                return <Tag color='green'>resolved</Tag>
              }
            },
            { title: '标题', dataIndex: 'title', width: 260 },
            { title: '内容', dataIndex: 'content' },
            {
              title: '触发时间',
              dataIndex: 'triggered_at',
              width: 180,
              render: (value: number) => formatDateTime(value)
            }
          ]}
        />
      </Space>
    )
  }

  function renderExports(): ReactNode {
    return (
      <Space direction='vertical' size={14} style={{ width: '100%' }}>
        <div className='list-toolbar'>
          <Space>
            <Typography.Text>家庭：</Typography.Text>
            <Select
              style={{ minWidth: 220 }}
              options={activeFamilyOptions}
              value={selectedFamilyId || undefined}
              onChange={(value) => setSelectedFamilyId(value)}
              placeholder='请选择家庭'
            />
          </Space>
          <Button
            onClick={() => {
              if (session?.access_token && selectedFamilyId) {
                void loadFamilyScopedData(session.access_token, selectedFamilyId)
              }
            }}
          >
            刷新
          </Button>
        </div>

        <Table
          rowKey='id'
          loading={isExportsLoading}
          dataSource={exportTasks}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: '任务 ID', dataIndex: 'id', width: 170 },
            { title: '宝宝 ID', dataIndex: 'baby_id', width: 160 },
            {
              title: '类型',
              dataIndex: 'report_type',
              width: 100,
              render: (value: ExportTask['report_type']) => value
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (value: ExportTask['status']) => (
                <Tag className={EXPORT_STATUS_CLASS[value]}>{value}</Tag>
              )
            },
            {
              title: '时间范围',
              width: 260,
              render: (_value: unknown, record: ExportTask) =>
                `${formatDate(record.date_from)} - ${formatDate(record.date_to)}`
            },
            {
              title: '过期时间',
              dataIndex: 'expires_at',
              width: 180,
              render: (value: number | null) => formatDateTime(value)
            },
            {
              title: '下载链接',
              dataIndex: 'download_url',
              render: (value: string | null) => {
                if (!value) {
                  return <Typography.Text type='secondary'>待生成</Typography.Text>
                }
                return (
                  <Typography.Link href={value} target='_blank' rel='noreferrer'>
                    打开链接
                  </Typography.Link>
                )
              }
            }
          ]}
        />
      </Space>
    )
  }

  function renderPlaceholder(title: string, description: string): ReactNode {
    return (
      <Card className='admin-card'>
        <Typography.Title level={4}>{title}</Typography.Title>
        <Typography.Paragraph type='secondary'>{description}</Typography.Paragraph>
      </Card>
    )
  }

  function renderContentByMenu(): ReactNode {
    if (activeMenu === 'dashboard') {
      return renderDashboard()
    }
    if (activeMenu === 'families') {
      return renderFamilies()
    }
    if (activeMenu === 'babies') {
      return renderBabies()
    }
    if (activeMenu === 'events') {
      return renderEvents()
    }
    if (activeMenu === 'rules') {
      return renderAlerts()
    }
    if (activeMenu === 'exports') {
      return renderExports()
    }
    if (activeMenu === 'ai') {
      return renderPlaceholder(
        'AI 会话日志',
        '当前后端暂未提供后台 AI 会话日志查询接口，已保留模块入口，待接口补齐后直接接入表格页。'
      )
    }
    if (activeMenu === 'dict') {
      return renderPlaceholder('字典配置', '字典管理属于后台配置项，当前版本先保留导航与扩展位。')
    }
    return renderPlaceholder('系统设置', '系统级参数配置将在权限与审计流程完善后接入。')
  }

  if (!session) {
    return (
      <div className='login-shell'>
        {contextHolder}
        <Card className='login-card' title='Baby Growth Admin 登录'>
          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            <Typography.Paragraph type='secondary'>
              使用后端 `POST /auth/password/login` 登录并拉取后台查询数据。
            </Typography.Paragraph>
            <Form layout='vertical' onFinish={() => void handleLogin()}>
              <Form.Item label='手机号' required>
                <Input
                  value={phone}
                  maxLength={11}
                  placeholder='请输入手机号'
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Form.Item>
              <Form.Item label='密码' required>
                <Input.Password
                  value={password}
                  placeholder='请输入密码'
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Form.Item>
              <Button type='primary' htmlType='submit' loading={isLoginLoading} block>
                登录
              </Button>
            </Form>
          </Space>
        </Card>
      </div>
    )
  }

  return (
    <Layout className='admin-shell'>
      {contextHolder}
      <Sider theme='light' width={240}>
        <div className='admin-logo'>Baby Growth Admin</div>
        <Menu
          mode='inline'
          selectedKeys={[activeMenu]}
          items={menuItems}
          onSelect={(event) => setActiveMenu(event.key as MenuKey)}
        />
      </Sider>
      <Layout>
        <Header className='admin-header'>
          <h1 className='admin-title'>运营控制台</h1>
          <Space>
            <Typography.Text>{session.user.display_name}</Typography.Text>
            <Button
              onClick={() => {
                if (session?.access_token) {
                  void loadCoreData(session.access_token)
                }
              }}
              loading={isCoreLoading}
            >
              刷新基础数据
            </Button>
            <Button danger onClick={handleLogout}>
              退出登录
            </Button>
          </Space>
        </Header>
        <Content className='admin-content'>{renderContentByMenu()}</Content>
      </Layout>
    </Layout>
  )
}
