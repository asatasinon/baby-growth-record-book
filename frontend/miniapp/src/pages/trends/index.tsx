import { useEffect, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'

import { getTrendPoints } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { TrendPoint, TrendResult } from '@/types/domain'
import { dayWindow, formatDateTime, formatMonthDayTime } from '@/utils/time'

import './index.scss'

const RANGE_OPTIONS = [7, 15, 30, 60, 90] as const

type RangeDays = (typeof RANGE_OPTIONS)[number]
type TrendMap = Partial<Record<RangeDays, TrendResult | null>>
type ReadyMap = Partial<Record<RangeDays, boolean>>

const METRIC_OPTIONS = [
  { code: 'feeding_total_ml' as const, label: '喂养总量' },
  { code: 'sleep_total_minutes' as const, label: '睡眠时长' },
  { code: 'excretion_count_total' as const, label: '排泄次数' },
  { code: 'weight_g' as const, label: '体重' }
]

type MetricCode = (typeof METRIC_OPTIONS)[number]['code']

function getMetricLabel(metricCode: MetricCode): string {
  return METRIC_OPTIONS.find((item) => item.code === metricCode)?.label || metricCode
}

function buildTrendMap(value: TrendResult | null): TrendMap {
  return RANGE_OPTIONS.reduce((acc, range) => {
    acc[range] = value
    return acc
  }, {} as TrendMap)
}

function buildReadyMap(value: boolean): ReadyMap {
  return RANGE_OPTIONS.reduce((acc, range) => {
    acc[range] = value
    return acc
  }, {} as ReadyMap)
}

function calcStats(points: TrendPoint[]): { average: number; latest: number } {
  if (points.length === 0) {
    return { average: 0, latest: 0 }
  }

  const average = points.reduce((acc, item) => acc + item.value, 0) / points.length
  const latest = points[points.length - 1].value
  return { average, latest }
}

function getCanvasRect(range: RangeDays): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const query = Taro.createSelectorQuery()
    query.select(`#trend-canvas-${range}`).boundingClientRect()
    query.exec((result) => {
      const rect = (result?.[0] || null) as { width?: number; height?: number } | null
      if (!rect || !rect.width || !rect.height) {
        resolve(null)
        return
      }
      resolve({ width: rect.width, height: rect.height })
    })
  })
}

async function drawTrendCanvas(range: RangeDays, points: TrendPoint[]): Promise<void> {
  const rect = await getCanvasRect(range)
  if (!rect) {
    throw new Error('canvas size missing')
  }

  const width = rect.width
  const height = rect.height
  const padding = { left: 40, right: 16, top: 20, bottom: 30 }
  const plotWidth = Math.max(1, width - padding.left - padding.right)
  const plotHeight = Math.max(1, height - padding.top - padding.bottom)

  const values = points.map((item) => item.value)
  let minValue = Math.min(...values)
  let maxValue = Math.max(...values)
  if (maxValue === minValue) {
    maxValue += 1
    minValue -= 1
  }

  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const pointPositions = points.map((point, index) => {
    const x = points.length === 1 ? padding.left + plotWidth / 2 : padding.left + xStep * index
    const ratio = (point.value - minValue) / (maxValue - minValue)
    const y = padding.top + (1 - ratio) * plotHeight
    return { x, y, raw: point }
  })

  const ctx = Taro.createCanvasContext(`trend-canvas-${range}`)

  ctx.setFillStyle('#f8fcff')
  ctx.fillRect(0, 0, width, height)

  ctx.setStrokeStyle('#dbe5f5')
  ctx.setLineWidth(1)
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  if (pointPositions.length > 0) {
    ctx.beginPath()
    pointPositions.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    })
    const lastPoint = pointPositions[pointPositions.length - 1]
    const firstPoint = pointPositions[0]
    ctx.lineTo(lastPoint.x, padding.top + plotHeight)
    ctx.lineTo(firstPoint.x, padding.top + plotHeight)
    ctx.closePath()
    ctx.setFillStyle('rgba(15, 107, 216, 0.16)')
    ctx.fill()

    ctx.beginPath()
    pointPositions.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    })
    ctx.setStrokeStyle('#0f6bd8')
    ctx.setLineWidth(2)
    ctx.stroke()

    pointPositions.forEach((point) => {
      ctx.beginPath()
      ctx.setFillStyle('#16a4d8')
      ctx.arc(point.x, point.y, 2.8, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  const labelIndexes = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), Math.max(points.length - 1, 0)])
  )

  ctx.setFontSize(10)
  ctx.setFillStyle('#5e6b84')
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  labelIndexes.forEach((index) => {
    const target = pointPositions[index]
    if (!target) {
      return
    }
    ctx.fillText(formatMonthDayTime(target.raw.bucket_date), target.x, padding.top + plotHeight + 8)
  })

  await new Promise<void>((resolve) => {
    ctx.draw(false, () => resolve())
  })
}

export default function TrendsPage() {
  const [metricCode, setMetricCode] = useState<MetricCode>('feeding_total_ml')
  const [trends, setTrends] = useState<TrendMap>(() => buildTrendMap(null))
  const [isLoading, setIsLoading] = useState(false)
  const [chartReadyMap, setChartReadyMap] = useState<ReadyMap>(() => buildReadyMap(false))
  const [chartAttemptedMap, setChartAttemptedMap] = useState<ReadyMap>(() => buildReadyMap(false))

  function resetChartState(): void {
    setChartReadyMap(buildReadyMap(false))
    setChartAttemptedMap(buildReadyMap(false))
  }

  function markChartReady(range: RangeDays, ready: boolean): void {
    setChartReadyMap((prev) => ({ ...prev, [range]: ready }))
  }

  function markChartAttempted(range: RangeDays, attempted: boolean): void {
    setChartAttemptedMap((prev) => ({ ...prev, [range]: attempted }))
  }

  async function loadTrends(nextMetric = metricCode): Promise<void> {
    const session = getSession()
    const familyId = getActiveFamilyId(session || undefined)
    const babyId = getActiveBabyId()

    if (!session || !familyId || !babyId) {
      setTrends(buildTrendMap(null))
      resetChartState()
      return
    }

    setIsLoading(true)
    resetChartState()

    try {
      const trendEntries = await Promise.all(
        RANGE_OPTIONS.map(async (range) => {
          const { dateFrom, dateTo } = dayWindow(range)
          const data = await getTrendPoints({
            session,
            familyId,
            babyId,
            metricCode: nextMetric,
            dateFrom,
            dateTo
          })
          return [range, data] as const
        })
      )

      const nextTrends = buildTrendMap(null)
      trendEntries.forEach(([range, data]) => {
        nextTrends[range] = data
      })
      setTrends(nextTrends)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载趋势失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadTrends()
  })

  useEffect(() => {
    if (isLoading) {
      resetChartState()
      return
    }

    let canceled = false
    const timer = setTimeout(() => {
      RANGE_OPTIONS.forEach((range) => {
        const trend = trends[range]
        const points = trend?.points || []

        if (points.length === 0) {
          markChartReady(range, false)
          markChartAttempted(range, true)
          return
        }

        void drawTrendCanvas(range, points)
          .then(() => {
            if (canceled) {
              return
            }
            markChartReady(range, true)
            markChartAttempted(range, true)
          })
          .catch(() => {
            if (canceled) {
              return
            }
            markChartReady(range, false)
            markChartAttempted(range, true)
          })
      })
    }, 80)

    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [isLoading, trends])

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

      <View className='pill-row metric-row'>
        {METRIC_OPTIONS.map((metric) => (
          <View
            key={metric.code}
            className={`pill ${metricCode === metric.code ? 'active' : ''}`}
            onClick={() => {
              setMetricCode(metric.code)
              void loadTrends(metric.code)
            }}
          >
            <Text>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View className='chart-list'>
        {RANGE_OPTIONS.map((range) => {
          const trend = trends[range]
          const points = trend?.points || []
          const unit = trend?.unit || ''
          const { average, latest } = calcStats(points)

          return (
            <View key={range} className='card chart-card'>
              <Text className='chart-title'>
                {getMetricLabel(metricCode)}趋势（{range} 天）
              </Text>

              <View className='metric-overview'>
                <View>
                  <Text className='muted'>平均值</Text>
                  <Text className='overview-value'>
                    {average.toFixed(1)} {unit}
                  </Text>
                </View>
                <View>
                  <Text className='muted'>最新值</Text>
                  <Text className='overview-value'>
                    {latest.toFixed(1)} {unit}
                  </Text>
                </View>
              </View>

              {isLoading ? <Text className='muted'>趋势加载中...</Text> : null}
              {!isLoading && points.length === 0 ? <Text className='muted'>当前时间范围内无可展示数据。</Text> : null}

              {!isLoading && points.length > 0 ? (
                <View>
                  {!chartAttemptedMap[range] || chartReadyMap[range] ? (
                    <Canvas id={`trend-canvas-${range}`} canvasId={`trend-canvas-${range}`} className='trend-canvas' />
                  ) : null}
                  {chartAttemptedMap[range] && !chartReadyMap[range] ? (
                    <View className='fallback-list'>
                      <Text className='muted fallback-tip'>图表渲染失败，已切换为明细列表。</Text>
                      {points.map((point) => (
                        <View key={`${range}-${point.bucket_date}-${point.value}`} className='fallback-row'>
                          <Text className='muted'>{formatDateTime(point.bucket_date)}</Text>
                          <Text>
                            {point.value.toFixed(1)} {unit}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}
