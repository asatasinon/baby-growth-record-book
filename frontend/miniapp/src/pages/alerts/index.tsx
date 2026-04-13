import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'

import { acknowledgeAlert, createAlertRule, listAlerts } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { AlertEvent } from '@/types/domain'
import { formatDateTime } from '@/utils/time'

import './index.scss'

const STATUS_LABEL_MAP: Record<AlertEvent['status'], string> = {
  open: '待处理',
  acknowledged: '已确认',
  resolved: '已解决'
}

const SEVERITY_LABEL_MAP: Record<AlertEvent['severity'], string> = {
  info: '信息',
  warning: '提醒',
  high: '高风险'
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

function resolveContext():
  | {
      familyId: string
      babyId: string
      token: string
    }
  | null {
  const session = getSession()
  const familyId = getActiveFamilyId(session || undefined)
  const babyId = getActiveBabyId()

  if (!session || !familyId || !babyId) {
    return null
  }

  return {
    familyId,
    babyId,
    token: session.access_token
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [ackingId, setAckingId] = useState('')
  const [isCreatingRule, setIsCreatingRule] = useState(false)
  const [ruleType, setRuleType] = useState('feeding_interval_too_long')
  const [thresholdValue, setThresholdValue] = useState('4')
  const [windowHours, setWindowHours] = useState('24')
  const [windowDays, setWindowDays] = useState('')
  const [severity, setSeverity] = useState<AlertEvent['severity']>('warning')

  async function loadData(): Promise<void> {
    const session = getSession()
    const context = resolveContext()
    if (!session || !context) {
      setAlerts([])
      return
    }

    setIsLoading(true)
    try {
      const data = await listAlerts({
        session,
        familyId: context.familyId,
        babyId: context.babyId
      })
      setAlerts(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载提醒失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadData()
  })

  async function handleAck(alertId: string): Promise<void> {
    const session = getSession()
    if (!session) {
      return
    }

    setAckingId(alertId)
    try {
      await acknowledgeAlert(session, alertId)
      Taro.showToast({ title: '已确认提醒', icon: 'success' })
      await loadData()
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '确认失败', icon: 'none' })
    } finally {
      setAckingId('')
    }
  }

  async function handleCreateRule(): Promise<void> {
    const session = getSession()
    const context = resolveContext()
    if (!session || !context) {
      Taro.showToast({ title: '请先登录并选择宝宝', icon: 'none' })
      return
    }

    const threshold = thresholdValue.trim() ? Number(thresholdValue) : undefined
    const hours = windowHours.trim() ? Number(windowHours) : undefined
    const days = windowDays.trim() ? Number(windowDays) : undefined

    if (thresholdValue.trim() && !Number.isFinite(threshold)) {
      Taro.showToast({ title: '阈值格式不正确', icon: 'none' })
      return
    }
    if (windowHours.trim() && (!Number.isInteger(hours) || (hours || 0) <= 0)) {
      Taro.showToast({ title: '小时窗口需为正整数', icon: 'none' })
      return
    }
    if (windowDays.trim() && (!Number.isInteger(days) || (days || 0) <= 0)) {
      Taro.showToast({ title: '天窗口需为正整数', icon: 'none' })
      return
    }

    setIsCreatingRule(true)
    try {
      await createAlertRule({
        session,
        familyId: context.familyId,
        ruleType,
        thresholdValue: threshold,
        windowHours: hours,
        windowDays: days,
        severity
      })
      setThresholdValue('4')
      setWindowHours('24')
      setWindowDays('')
      Taro.showToast({ title: '规则创建成功', icon: 'success' })
      await loadData()
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '创建规则失败', icon: 'none' })
    } finally {
      setIsCreatingRule(false)
    }
  }

  const summary = useMemo(() => {
    const openCount = alerts.filter((item) => item.status === 'open').length
    const ackCount = alerts.filter((item) => item.status === 'acknowledged').length
    const resolvedCount = alerts.filter((item) => item.status === 'resolved').length
    return {
      openCount,
      ackCount,
      resolvedCount
    }
  }, [alerts])

  if (!resolveContext()) {
    return (
      <View className='page-shell alerts-page'>
        <View className='card empty-card'>
          <Text className='muted'>请先在“我的”页面登录并选择宝宝。</Text>
          <Button className='btn-primary' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
            去设置
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell alerts-page'>
      <Text className='section-title'>新建提醒规则</Text>
      <View className='card create-rule-card'>
        <View className='form-item'>
          <Text className='form-label'>规则类型</Text>
          <View className='pill-row'>
            {RULE_OPTIONS.map((item) => (
              <View
                key={item.value}
                className={`pill ${ruleType === item.value ? 'active' : ''}`}
                onClick={() => setRuleType(item.value)}
              >
                <Text>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className='form-item'>
          <Text className='form-label'>阈值（可选）</Text>
          <Input
            className='input'
            type='digit'
            value={thresholdValue}
            onInput={(event) => setThresholdValue(event.detail.value)}
            placeholder='例如 4'
          />
        </View>
        <View className='window-grid'>
          <View className='form-item'>
            <Text className='form-label'>窗口小时（可选）</Text>
            <Input
              className='input'
              type='number'
              value={windowHours}
              onInput={(event) => setWindowHours(event.detail.value)}
              placeholder='例如 24'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>窗口天数（可选）</Text>
            <Input
              className='input'
              type='number'
              value={windowDays}
              onInput={(event) => setWindowDays(event.detail.value)}
              placeholder='例如 7'
            />
          </View>
        </View>
        <View className='form-item'>
          <Text className='form-label'>严重级别</Text>
          <View className='pill-row'>
            {(['info', 'warning', 'high'] as AlertEvent['severity'][]).map((item) => (
              <View
                key={item}
                className={`pill ${severity === item ? 'active' : ''}`}
                onClick={() => setSeverity(item)}
              >
                <Text>{SEVERITY_LABEL_MAP[item]}</Text>
              </View>
            ))}
          </View>
        </View>
        <Button className='btn-primary' loading={isCreatingRule} onClick={() => void handleCreateRule()}>
          创建规则
        </Button>
      </View>

      <Text className='section-title'>提醒概览</Text>
      <View className='card summary-card'>
        <View className='summary-grid'>
          <View className='summary-item'>
            <Text className='summary-label'>待处理</Text>
            <Text className='summary-value'>{summary.openCount}</Text>
          </View>
          <View className='summary-item'>
            <Text className='summary-label'>已确认</Text>
            <Text className='summary-value'>{summary.ackCount}</Text>
          </View>
          <View className='summary-item'>
            <Text className='summary-label'>已解决</Text>
            <Text className='summary-value'>{summary.resolvedCount}</Text>
          </View>
        </View>
      </View>

      <Text className='section-title'>全部提醒</Text>
      <View className='alert-list'>
        {isLoading && <Text className='muted'>提醒加载中...</Text>}

        {!isLoading && alerts.length === 0 && (
          <View className='card empty-card'>
            <Text className='muted'>当前没有提醒记录。</Text>
          </View>
        )}

        {alerts.map((item) => (
          <View key={item.id} className='card alert-card'>
            <View className='h-stack'>
              <View>
                <Text className={`severity-tag severity-${item.severity}`}>
                  {SEVERITY_LABEL_MAP[item.severity]}
                </Text>
                <Text className='status-tag'>{STATUS_LABEL_MAP[item.status]}</Text>
              </View>
              <Text className='muted'>{formatDateTime(item.triggered_at)}</Text>
            </View>
            <Text className='alert-title'>{item.title}</Text>
            <Text className='alert-content'>{item.content}</Text>
            {item.status === 'open' ? (
              <View className='action-row'>
                <Button size='mini' loading={ackingId === item.id} onClick={() => void handleAck(item.id)}>
                  标记已确认
                </Button>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}
