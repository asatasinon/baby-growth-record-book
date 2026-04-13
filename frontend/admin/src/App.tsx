import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from 'antd'

import {
  createAlertRule,
  listAdminBabies,
  listAdminEvents,
  listAdminFamilies,
  listAiConversations,
  listAlertRules,
  listAlerts,
  listExportTasks,
  loginWithPassword,
  updateAlertRule
} from './api'
import type {
  AiConversation,
  AlertEvent,
  AlertRule,
  AuthSession,
  BabyInfo,
  DictConfigItem,
  ExportTask,
  FamilyInfo,
  GrowthEvent,
  SystemSettingItem
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

const RULE_OPTIONS = [
  { value: 'feeding_interval_too_long', label: '喂养间隔过长' },
  { value: 'low_feeding_volume_rolling', label: '喂养量偏低' },
  { value: 'abnormal_temperature', label: '体温异常' },
  { value: 'low_excretion_count_rolling', label: '排泄次数偏少' },
  { value: 'weight_growth_stagnation', label: '体重增长停滞' },
  { value: 'medication_due', label: '用药提醒' },
  { value: 'vaccine_due', label: '疫苗提醒' },
  { value: 'measurement_due', label: '测量提醒' }
]

const MOCK_DICT_ITEMS: DictConfigItem[] = [
  {
    key: 'timezone.default',
    value: 'Asia/Shanghai',
    description: '默认时区',
    editable: true
  },
  {
    key: 'alerts.default_window_hours',
    value: '24',
    description: '规则默认窗口（小时）',
    editable: true
  },
  {
    key: 'ai.disclaimer',
    value: '结果仅基于记录数据生成，不替代医生建议。',
    description: 'AI 默认免责声明',
    editable: true
  }
]

const MOCK_SYSTEM_SETTINGS: SystemSettingItem[] = [
  {
    key: 'ops.audit_retention_days',
    value: '180',
    description: '审计日志保留天数'
  },
  {
    key: 'ops.export_url_expire_hours',
    value: '24',
    description: '导出下载链接过期时长（小时）'
  },
  {
    key: 'ops.max_alert_rules_per_family',
    value: '20',
    description: '每个家庭可配置规则上限'
  }
]

interface RuleFormValue {
  familyId: string
  ruleType: string
  thresholdValue?: number
  windowHours?: number
  windowDays?: number
  severity: 'info' | 'warning' | 'high'
  enabled: boolean
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

function formatDateTime(ms: number | null | undefined): string {
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

function summarizeText(text: string, max = 56): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) {
    return normalized || '-'
  }
  return `${normalized.slice(0, max)}...`
}

function startOfTodayMs(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const { Header, Sider, Content } = Layout

export default function App() {
  const [messageApi, contextHolder] = message.useMessage()
  const [ruleForm] = Form.useForm<RuleFormValue>()

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
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [aiConversations, setAiConversations] = useState<AiConversation[]>([])

  const [dictItems, setDictItems] = useState<DictConfigItem[]>(MOCK_DICT_ITEMS)
  const [systemSettings, setSystemSettings] = useState<SystemSettingItem[]>(MOCK_SYSTEM_SETTINGS)

  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('')
  const [selectedAiBabyId, setSelectedAiBabyId] = useState<string>('all')

  const [isCoreLoading, setIsCoreLoading] = useState(false)
  const [isAlertsLoading, setIsAlertsLoading] = useState(false)
  const [isExportsLoading, setIsExportsLoading] = useState(false)
  const [isRulesLoading, setIsRulesLoading] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [togglingRuleId, setTogglingRuleId] = useState<string>('')

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [isRuleSaving, setIsRuleSaving] = useState(false)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)

  const activeFamilyOptions = useMemo(
    () => families.map((item) => ({ label: item.name, value: item.id })),
    [families]
  )

  const aiBabyOptions = useMemo(() => {
    const filtered =
      selectedFamilyId === '' ? babies : babies.filter((item) => item.family_id === selectedFamilyId)
    return [
      { label: '全部宝宝', value: 'all' },
      ...filtered.map((item) => ({ label: item.name, value: item.id }))
    ]
  }, [babies, selectedFamilyId])

  const filteredRules = useMemo(
    () =>
      selectedFamilyId
        ? alertRules.filter((item) => item.family_id === selectedFamilyId)
        : alertRules,
    [alertRules, selectedFamilyId]
  )

  const filteredAiConversations = useMemo(() => {
    let nextRows = aiConversations
    if (selectedFamilyId) {
      nextRows = nextRows.filter((item) => item.family_id === selectedFamilyId)
    }
    if (selectedAiBabyId !== 'all') {
      nextRows = nextRows.filter((item) => item.baby_id === selectedAiBabyId)
    }
    return nextRows
  }, [aiConversations, selectedFamilyId, selectedAiBabyId])

  async function loadCoreData(token: string): Promise<void> {
    setIsCoreLoading(true)
    setIsRulesLoading(true)
    setIsAiLoading(true)
    try {
      const [familyData, babyData, eventData, ruleData, aiData] = await Promise.all([
        listAdminFamilies(token),
        listAdminBabies(token),
        listAdminEvents(token),
        listAlertRules(token),
        listAiConversations(token)
      ])

      setFamilies(familyData)
      setBabies(babyData)
      setEvents(eventData)
      setAlertRules(ruleData)
      setAiConversations(aiData)

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
      setIsRulesLoading(false)
      setIsAiLoading(false)
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
    setAlertRules([])
    setAiConversations([])
    setSelectedFamilyId('')
    setSelectedAiBabyId('all')
  }

  function openRuleCreateModal(): void {
    const defaultFamilyId = selectedFamilyId || families[0]?.id || ''
    setEditingRule(null)
    ruleForm.setFieldsValue({
      familyId: defaultFamilyId,
      ruleType: 'feeding_interval_too_long',
      thresholdValue: 4,
      windowHours: 24,
      windowDays: undefined,
      severity: 'warning',
      enabled: true
    })
    setIsRuleModalOpen(true)
  }

  function openRuleEditModal(rule: AlertRule): void {
    setEditingRule(rule)
    ruleForm.setFieldsValue({
      familyId: rule.family_id,
      ruleType: rule.rule_type,
      thresholdValue: rule.threshold_value ?? undefined,
      windowHours: rule.window_hours ?? undefined,
      windowDays: rule.window_days ?? undefined,
      severity: rule.severity,
      enabled: rule.enabled
    })
    setIsRuleModalOpen(true)
  }

  async function handleRuleSubmit(): Promise<void> {
    if (!session?.access_token) {
      return
    }

    try {
      const values = await ruleForm.validateFields()
      setIsRuleSaving(true)

      if (editingRule) {
        const updated = await updateAlertRule(session.access_token, editingRule.id, {
          thresholdValue: values.thresholdValue,
          windowHours: values.windowHours,
          windowDays: values.windowDays,
          severity: values.severity,
          enabled: values.enabled
        })
        setAlertRules((current) => current.map((item) => (item.id === editingRule.id ? { ...item, ...updated } : item)))
        messageApi.success('规则已更新')
      } else {
        const created = await createAlertRule(session.access_token, {
          familyId: values.familyId,
          ruleType: values.ruleType,
          thresholdValue: values.thresholdValue,
          windowHours: values.windowHours,
          windowDays: values.windowDays,
          severity: values.severity,
          enabled: values.enabled
        })
        setAlertRules((current) => [{ ...created, updated_at: Date.now() }, ...current])
        messageApi.success('规则创建成功')
      }

      setIsRuleModalOpen(false)
      setEditingRule(null)
      ruleForm.resetFields()
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message || '保存规则失败')
      }
    } finally {
      setIsRuleSaving(false)
    }
  }

  async function handleRuleToggle(rule: AlertRule, enabled: boolean): Promise<void> {
    if (!session?.access_token) {
      return
    }
    setTogglingRuleId(rule.id)
    try {
      const updated = await updateAlertRule(session.access_token, rule.id, { enabled })
      setAlertRules((current) => current.map((item) => (item.id === rule.id ? { ...item, ...updated } : item)))
      messageApi.success(enabled ? '规则已启用' : '规则已禁用')
    } catch (error) {
      messageApi.error((error as Error).message || '规则状态更新失败')
    } finally {
      setTogglingRuleId('')
    }
  }

  function updateDictItem(key: string, value: string): void {
    setDictItems((current) => current.map((item) => (item.key === key ? { ...item, value } : item)))
  }

  function updateSystemSetting(key: string, value: string): void {
    setSystemSettings((current) => current.map((item) => (item.key === key ? { ...item, value } : item)))
  }

  function renderDashboard(): ReactNode {
    const pendingExports = exportTasks.filter((item) => item.status === 'pending' || item.status === 'running')
    const openAlerts = alerts.filter((item) => item.status === 'open')
    const todayEventCount = events.filter((item) => item.occurred_at >= startOfTodayMs()).length

    return (
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        <Alert type='info' showIcon message='工作台数据来自真实 API，规则与 AI 日志模块已接入可用接口。' />
        <Space size={16} wrap>
          <Card className='admin-card'>
            <Statistic title='家庭数' value={families.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='宝宝数' value={babies.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='今日事件数' value={todayEventCount} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='提醒规则数' value={alertRules.length} />
          </Card>
          <Card className='admin-card'>
            <Statistic title='AI 会话数' value={aiConversations.length} />
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
            render: (value: Record<string, unknown>) => <Typography.Text code>{formatPayload(value)}</Typography.Text>
          }
        ]}
      />
    )
  }

  function renderRules(): ReactNode {
    return (
      <Space direction='vertical' size={14} style={{ width: '100%' }}>
        <div className='list-toolbar'>
          <Space>
            <Typography.Text>家庭：</Typography.Text>
            <Select
              allowClear
              style={{ minWidth: 240 }}
              options={activeFamilyOptions}
              value={selectedFamilyId || undefined}
              onChange={(value) => setSelectedFamilyId(value || '')}
              placeholder='全部家庭'
            />
          </Space>
          <Space>
            <Button onClick={() => session?.access_token && void loadCoreData(session.access_token)} loading={isRulesLoading}>
              刷新
            </Button>
            <Button type='primary' onClick={openRuleCreateModal}>
              新建规则
            </Button>
          </Space>
        </div>
        <Table
          rowKey='id'
          loading={isRulesLoading}
          dataSource={filteredRules}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1200 }}
          columns={[
            { title: '规则 ID', dataIndex: 'id', width: 160 },
            { title: '家庭 ID', dataIndex: 'family_id', width: 160 },
            {
              title: '规则类型',
              dataIndex: 'rule_type',
              width: 220,
              render: (value: string) => RULE_OPTIONS.find((item) => item.value === value)?.label || value
            },
            {
              title: '阈值',
              dataIndex: 'threshold_value',
              width: 100,
              render: (value: number | null) => (value === null ? '-' : value)
            },
            {
              title: '窗口',
              width: 160,
              render: (_value: unknown, record: AlertRule) => {
                if (record.window_hours) {
                  return `${record.window_hours}h`
                }
                if (record.window_days) {
                  return `${record.window_days}d`
                }
                return '-'
              }
            },
            {
              title: '级别',
              dataIndex: 'severity',
              width: 100,
              render: (value: AlertRule['severity']) => <Tag color={ALERT_SEVERITY_COLOR[value] || 'default'}>{value}</Tag>
            },
            {
              title: '启用',
              dataIndex: 'enabled',
              width: 120,
              render: (value: boolean, record: AlertRule) => (
                <Switch
                  checked={value}
                  loading={togglingRuleId === record.id}
                  onChange={(checked) => void handleRuleToggle(record, checked)}
                />
              )
            },
            {
              title: '更新时间',
              dataIndex: 'updated_at',
              width: 180,
              render: (value: number | undefined) => formatDateTime(value)
            },
            {
              title: '操作',
              width: 100,
              render: (_value: unknown, record: AlertRule) => (
                <Button size='small' onClick={() => openRuleEditModal(record)}>
                  编辑
                </Button>
              )
            }
          ]}
        />
      </Space>
    )
  }

  function renderAiConversations(): ReactNode {
    return (
      <Space direction='vertical' size={14} style={{ width: '100%' }}>
        <div className='list-toolbar'>
          <Space>
            <Typography.Text>家庭：</Typography.Text>
            <Select
              allowClear
              style={{ minWidth: 220 }}
              options={activeFamilyOptions}
              value={selectedFamilyId || undefined}
              onChange={(value) => {
                setSelectedFamilyId(value || '')
                setSelectedAiBabyId('all')
              }}
              placeholder='全部家庭'
            />
            <Typography.Text>宝宝：</Typography.Text>
            <Select
              style={{ minWidth: 220 }}
              options={aiBabyOptions}
              value={selectedAiBabyId}
              onChange={(value) => setSelectedAiBabyId(value)}
            />
          </Space>
          <Button onClick={() => session?.access_token && void loadCoreData(session.access_token)} loading={isAiLoading}>
            刷新
          </Button>
        </div>
        <Table
          rowKey='id'
          loading={isAiLoading}
          dataSource={filteredAiConversations}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1300 }}
          columns={[
            { title: '会话 ID', dataIndex: 'id', width: 160 },
            { title: '家庭 ID', dataIndex: 'family_id', width: 150 },
            { title: '宝宝 ID', dataIndex: 'baby_id', width: 150 },
            {
              title: '提问用户',
              dataIndex: 'asked_by',
              width: 120,
              render: (value: string | null) => value || '-'
            },
            {
              title: '问题',
              dataIndex: 'question',
              width: 260,
              render: (value: string) => <Typography.Text>{summarizeText(value, 80)}</Typography.Text>
            },
            {
              title: '回答摘要',
              dataIndex: 'answer',
              width: 320,
              render: (value: string) => <Typography.Text>{summarizeText(value, 100)}</Typography.Text>
            },
            {
              title: '模型',
              dataIndex: 'model_name',
              width: 140,
              render: (value: string | null) => value || '-'
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (value: string) => (
                <Tag color={value === 'failed' ? 'red' : 'green'}>{value}</Tag>
              )
            },
            {
              title: '时间',
              dataIndex: 'created_at',
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
              render: (value: ExportTask['status']) => <Tag className={EXPORT_STATUS_CLASS[value]}>{value}</Tag>
            },
            {
              title: '时间范围',
              width: 260,
              render: (_value: unknown, record: ExportTask) => `${formatDate(record.date_from)} - ${formatDate(record.date_to)}`
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

  function renderDictConfig(): ReactNode {
    return (
      <Space direction='vertical' size={14} style={{ width: '100%' }}>
        <Alert
          type='info'
          showIcon
          message='后端字典接口尚未提供，当前为可编辑 Mock 骨架，便于先完成页面与交互。'
        />
        <Table
          rowKey='key'
          dataSource={dictItems}
          pagination={false}
          columns={[
            { title: '配置键', dataIndex: 'key', width: 260 },
            {
              title: '配置值',
              dataIndex: 'value',
              render: (value: string, record: DictConfigItem) =>
                record.editable ? (
                  <Input value={value} onChange={(event) => updateDictItem(record.key, event.target.value)} />
                ) : (
                  value
                )
            },
            { title: '说明', dataIndex: 'description' }
          ]}
        />
      </Space>
    )
  }

  function renderSettings(): ReactNode {
    return (
      <Space direction='vertical' size={14} style={{ width: '100%' }}>
        <Alert
          type='info'
          showIcon
          message='系统设置后端接口暂未开放，当前展示可编辑设置骨架，后续可直接替换为真实 API。'
        />
        <Table
          rowKey='key'
          dataSource={systemSettings}
          pagination={false}
          columns={[
            { title: '设置项', dataIndex: 'key', width: 280 },
            {
              title: '值',
              dataIndex: 'value',
              width: 220,
              render: (value: string, record: SystemSettingItem) => (
                <Input value={value} onChange={(event) => updateSystemSetting(record.key, event.target.value)} />
              )
            },
            { title: '说明', dataIndex: 'description' }
          ]}
        />
      </Space>
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
      return renderRules()
    }
    if (activeMenu === 'ai') {
      return renderAiConversations()
    }
    if (activeMenu === 'exports') {
      return renderExports()
    }
    if (activeMenu === 'dict') {
      return renderDictConfig()
    }
    return renderSettings()
  }

  if (!session) {
    return (
      <div className='login-shell'>
        {contextHolder}
        <Card className='login-card' title='Baby Growth Admin 登录'>
          <Space direction='vertical' size={12} style={{ width: '100%' }}>
            <Typography.Paragraph type='secondary'>使用后端 `POST /auth/password/login` 登录并拉取后台管理数据。</Typography.Paragraph>
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
        <Menu mode='inline' selectedKeys={[activeMenu]} items={menuItems} onSelect={(event) => setActiveMenu(event.key as MenuKey)} />
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

      <Modal
        open={isRuleModalOpen}
        title={editingRule ? '编辑提醒规则' : '新建提醒规则'}
        onCancel={() => {
          setIsRuleModalOpen(false)
          setEditingRule(null)
          ruleForm.resetFields()
        }}
        onOk={() => void handleRuleSubmit()}
        confirmLoading={isRuleSaving}
      >
        <Form form={ruleForm} layout='vertical'>
          <Form.Item label='家庭' name='familyId' rules={[{ required: true, message: '请选择家庭' }]}>
            <Select options={activeFamilyOptions} disabled={Boolean(editingRule)} />
          </Form.Item>
          <Form.Item label='规则类型' name='ruleType' rules={[{ required: true, message: '请选择规则类型' }]}>
            <Select options={RULE_OPTIONS} disabled={Boolean(editingRule)} />
          </Form.Item>
          <Form.Item label='阈值（可选）' name='thresholdValue'>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label='窗口小时（可选）' name='windowHours'>
            <InputNumber style={{ width: '100%' }} min={1} precision={0} />
          </Form.Item>
          <Form.Item label='窗口天数（可选）' name='windowDays'>
            <InputNumber style={{ width: '100%' }} min={1} precision={0} />
          </Form.Item>
          <Form.Item label='严重级别' name='severity' rules={[{ required: true, message: '请选择严重级别' }]}>
            <Select
              options={[
                { label: '信息', value: 'info' },
                { label: '提醒', value: 'warning' },
                { label: '高风险', value: 'high' }
              ]}
            />
          </Form.Item>
          <Form.Item label='启用状态' name='enabled' valuePropName='checked'>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
