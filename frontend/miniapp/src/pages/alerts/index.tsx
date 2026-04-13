import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'

import { acknowledgeAlert, listAlerts } from '@/services/api'
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
