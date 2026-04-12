import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'

import { getTrendPoints } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { TrendResult } from '@/types/domain'
import { dayWindow, formatMonthDay } from '@/utils/time'

import './index.scss'

const RANGE_OPTIONS = [7, 30, 90] as const

const METRIC_OPTIONS = [
  { code: 'feeding_total_ml' as const, label: '喂养总量' },
  { code: 'sleep_total_minutes' as const, label: '睡眠时长' },
  { code: 'excretion_count_total' as const, label: '排泄次数' },
  { code: 'weight_g' as const, label: '体重' }
]

type MetricCode = (typeof METRIC_OPTIONS)[number]['code']

export default function TrendsPage() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(7)
  const [metricCode, setMetricCode] = useState<MetricCode>('feeding_total_ml')
  const [trend, setTrend] = useState<TrendResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function loadTrend(nextRange = rangeDays, nextMetric = metricCode): Promise<void> {
    const session = getSession()
    const familyId = getActiveFamilyId(session || undefined)
    const babyId = getActiveBabyId()

    if (!session || !familyId || !babyId) {
      setTrend(null)
      return
    }

    const { dateFrom, dateTo } = dayWindow(nextRange)
    setIsLoading(true)
    try {
      const data = await getTrendPoints({
        session,
        familyId,
        babyId,
        metricCode: nextMetric,
        dateFrom,
        dateTo
      })
      setTrend(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载趋势失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadTrend()
  })

  const bars = trend?.points || []
  const maxValue = useMemo(() => {
    if (bars.length === 0) {
      return 1
    }
    return Math.max(...bars.map((item) => item.value), 1)
  }, [bars])

  const averageValue = useMemo(() => {
    if (bars.length === 0) {
      return 0
    }
    return bars.reduce((acc, item) => acc + item.value, 0) / bars.length
  }, [bars])

  const latestValue = bars.length > 0 ? bars[bars.length - 1].value : 0

  const hasContext = Boolean(getSession() && getActiveFamilyId(getSession() || undefined) && getActiveBabyId())

  if (!hasContext) {
    return (
      <View className='page-shell trends-page'>
        <View className='card empty-card'>
          <Text className='muted'>请先在“我的”页面登录并选择宝宝后查看趋势。</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell trends-page'>
      <Text className='section-title'>趋势中心</Text>

      <View className='pill-row'>
        {RANGE_OPTIONS.map((item) => (
          <View
            key={item}
            className={`pill ${rangeDays === item ? 'active' : ''}`}
            onClick={() => {
              setRangeDays(item)
              void loadTrend(item, metricCode)
            }}
          >
            <Text>{item} 天</Text>
          </View>
        ))}
      </View>

      <View className='pill-row metric-row'>
        {METRIC_OPTIONS.map((metric) => (
          <View
            key={metric.code}
            className={`pill ${metricCode === metric.code ? 'active' : ''}`}
            onClick={() => {
              setMetricCode(metric.code)
              void loadTrend(rangeDays, metric.code)
            }}
          >
            <Text>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View className='card trend-summary'>
        <View className='metric-overview'>
          <View>
            <Text className='muted'>平均值</Text>
            <Text className='overview-value'>
              {averageValue.toFixed(1)} {trend?.unit || ''}
            </Text>
          </View>
          <View>
            <Text className='muted'>最新值</Text>
            <Text className='overview-value'>
              {latestValue.toFixed(1)} {trend?.unit || ''}
            </Text>
          </View>
        </View>
      </View>

      <View className='card chart-card'>
        {isLoading && <Text className='muted'>趋势加载中...</Text>}

        {!isLoading && bars.length === 0 && <Text className='muted'>当前时间范围内无可展示数据。</Text>}

        {bars.map((point) => {
          const ratio = Math.max((point.value / maxValue) * 100, 4)
          return (
            <View key={`${point.bucket_date}-${point.value}`} className='chart-row'>
              <Text className='chart-date'>{formatMonthDay(point.bucket_date)}</Text>
              <View className='track'>
                <View className='bar' style={{ width: `${ratio}%` }} />
              </View>
              <Text className='chart-value'>
                {point.value.toFixed(1)} {trend?.unit || ''}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
