import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'

import { getDailySummary } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { DailySummary } from '@/types/domain'
import { formatMinutes, startOfDayMs } from '@/utils/time'

import './index.scss'

interface ReadyContext {
  familyId: string
  babyId: string
}

function resolveReadyContext(): ReadyContext | null {
  const session = getSession()
  if (!session) {
    return null
  }

  const familyId = getActiveFamilyId(session)
  const babyId = getActiveBabyId()

  if (!familyId || !babyId) {
    return null
  }

  return {
    familyId,
    babyId
  }
}

type HomeAction = {
  key: string
  title: string
  description: string
  kind: 'tab' | 'page'
  url: string
}

const HOME_ACTIONS: HomeAction[] = [
  {
    key: 'quick-record',
    title: '快速记录',
    description: '进入独立页面新增喂养、睡眠等记录',
    kind: 'page',
    url: '/pages/quick-record/index'
  },
  {
    key: 'records',
    title: '记录管理',
    description: '查看、筛选、编辑最近 30 天记录',
    kind: 'tab',
    url: '/pages/records/index'
  },
  {
    key: 'trends',
    title: '趋势中心',
    description: '按指标查看 7~90 天趋势图',
    kind: 'tab',
    url: '/pages/trends/index'
  },
  {
    key: 'ai',
    title: 'AI 助手',
    description: '针对宝宝数据发起智能问答',
    kind: 'tab',
    url: '/pages/ai/index'
  },
  {
    key: 'alerts',
    title: '提醒中心',
    description: '查看提醒并维护提醒规则',
    kind: 'page',
    url: '/pages/alerts/index'
  },
  {
    key: 'reports',
    title: '报告中心',
    description: '创建并下载日报、周报、月报',
    kind: 'page',
    url: '/pages/reports/index'
  }
]

export default function HomePage() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function loadSummary(): Promise<void> {
    const context = resolveReadyContext()
    if (!context) {
      setSummary(null)
      return
    }

    const session = getSession()
    if (!session) {
      return
    }

    setIsLoading(true)
    try {
      const data = await getDailySummary({
        session,
        familyId: context.familyId,
        babyId: context.babyId,
        date: startOfDayMs()
      })
      setSummary(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载今日汇总失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadSummary()
  })

  const latestWeightText = useMemo(() => {
    const weight = summary?.last_measurement_snapshot?.weight_g
    if (typeof weight === 'number') {
      return `${weight} g`
    }
    if (typeof weight === 'string' && weight.trim()) {
      return `${weight} g`
    }
    return '暂无'
  }, [summary])

  function handleActionClick(action: HomeAction): void {
    if (action.kind === 'tab') {
      void Taro.switchTab({ url: action.url })
      return
    }
    void Taro.navigateTo({ url: action.url })
  }

  if (!resolveReadyContext()) {
    return (
      <View className='page-shell home-page'>
        <View className='card empty-card'>
          <Text className='empty-title'>先完成登录与宝宝选择</Text>
          <Text className='muted'>MVP 已接入真实 API，请在“我的”页面先登录并创建或选择宝宝。</Text>
          <Button className='btn-primary' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
            前往我的
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell home-page'>
      <View className='card summary-card'>
        <View className='h-stack'>
          <Text className='summary-title'>今日摘要</Text>
          <Text className='muted'>{isLoading ? '加载中...' : '实时更新'}</Text>
        </View>
        <View className='metrics-grid'>
          <View className='metric-item'>
            <Text className='metric-label'>喂养总量</Text>
            <Text className='metric-value'>{summary?.feeding_total_ml ?? 0} ml</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>排泄次数</Text>
            <Text className='metric-value'>{summary?.excretion_count_total ?? 0} 次</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>睡眠时长</Text>
            <Text className='metric-value'>{formatMinutes(summary?.sleep_total_minutes ?? 0)}</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>最近体重</Text>
            <Text className='metric-value'>{latestWeightText}</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>待处理提醒</Text>
            <Text className='metric-value'>{summary?.alerts?.length ?? 0} 条</Text>
          </View>
        </View>
      </View>

      <Text className='section-title'>功能入口</Text>
      <View className='card action-card'>
        <View className='action-grid'>
          {HOME_ACTIONS.map((action) => (
            <Button key={action.key} className='action-btn' onClick={() => handleActionClick(action)}>
              <Text className='action-title'>{action.title}</Text>
              <Text className='action-desc'>{action.description}</Text>
            </Button>
          ))}
        </View>
      </View>
    </View>
  )
}
