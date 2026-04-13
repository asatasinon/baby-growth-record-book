import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

import { getTrendPoints } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { TrendPoint, TrendResult } from '@/types/domain'
import { dayWindow, formatDateTime, formatMonthDayTime } from '@/utils/time'

import './index.scss'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

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

export default function TrendsPage() {
  const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB
  const [metricCode, setMetricCode] = useState<MetricCode>('feeding_total_ml')
  const [trends, setTrends] = useState<TrendMap>(() => buildTrendMap(null))
  const [isLoading, setIsLoading] = useState(false)
  const [chartReadyMap, setChartReadyMap] = useState<ReadyMap>(() => buildReadyMap(false))

  const chartRefs = useRef<Partial<Record<RangeDays, echarts.EChartsType>>>({})

  function disposeChart(range: RangeDays): void {
    const chart = chartRefs.current[range]
    if (chart) {
      chart.dispose()
      delete chartRefs.current[range]
    }
  }

  function disposeAllCharts(resetReady = true): void {
    RANGE_OPTIONS.forEach((range) => disposeChart(range))
    if (resetReady) {
      setChartReadyMap(buildReadyMap(false))
    }
  }

  function markChartReady(range: RangeDays, ready: boolean): void {
    setChartReadyMap((prev) => ({ ...prev, [range]: ready }))
  }

  async function loadTrends(nextMetric = metricCode): Promise<void> {
    const session = getSession()
    const familyId = getActiveFamilyId(session || undefined)
    const babyId = getActiveBabyId()

    if (!session || !familyId || !babyId) {
      setTrends(buildTrendMap(null))
      disposeAllCharts(true)
      return
    }

    setIsLoading(true)
    setChartReadyMap(buildReadyMap(false))

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
    return () => {
      disposeAllCharts(false)
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      disposeAllCharts(true)
      return
    }

    const timer = setTimeout(() => {
      disposeAllCharts(true)

      RANGE_OPTIONS.forEach((range) => {
        const trend = trends[range]
        const points = trend?.points || []

        if (points.length === 0) {
          return
        }

        const chartOption = {
          animation: true,
          tooltip: { trigger: 'axis' },
          grid: { left: 32, right: 18, top: 24, bottom: 34 },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: points.map((item) => formatMonthDayTime(item.bucket_date)),
            axisLabel: { color: '#5e6b84', fontSize: 10, hideOverlap: true }
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: '#5e6b84', fontSize: 10 },
            splitLine: { lineStyle: { color: '#dbe5f5' } }
          },
          series: [
            {
              type: 'line',
              smooth: true,
              showSymbol: true,
              symbolSize: 5,
              lineStyle: { width: 3, color: '#0f6bd8' },
              itemStyle: { color: '#16a4d8' },
              areaStyle: {
                color: 'rgba(15, 107, 216, 0.15)'
              },
              data: points.map((item) => Number(item.value.toFixed(2)))
            }
          ]
        } as const

        try {
          if (isWeb && typeof document !== 'undefined') {
            const container = document.getElementById(`trend-dom-${range}`)
            if (!container) {
              return
            }
            const chart = echarts.init(container)
            chart.setOption(chartOption)
            chartRefs.current[range] = chart
            markChartReady(range, true)
            return
          }

          const query = Taro.createSelectorQuery()
          query
            .select(`#trend-canvas-${range}`)
            .fields({ node: true, size: true })
            .exec((result) => {
              const canvasInfo = (result?.[0] || null) as {
                node?: unknown
                width?: number
                height?: number
              } | null

              if (!canvasInfo || !canvasInfo.node || !canvasInfo.width || !canvasInfo.height) {
                return
              }

              const dpr = Taro.getSystemInfoSync().pixelRatio || 1
              const canvas = canvasInfo.node as { width: number; height: number }
              canvas.width = canvasInfo.width * dpr
              canvas.height = canvasInfo.height * dpr

              const chart = echarts.init(canvas as never, undefined, {
                renderer: 'canvas',
                width: canvasInfo.width,
                height: canvasInfo.height,
                devicePixelRatio: dpr
              })
              chart.setOption(chartOption)
              chartRefs.current[range] = chart
              markChartReady(range, true)
            })
        } catch (_error) {
          markChartReady(range, false)
        }
      })
    }, 80)

    return () => clearTimeout(timer)
  }, [isLoading, isWeb, trends])

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
                  {isWeb ? (
                    <View id={`trend-dom-${range}`} className='trend-dom' />
                  ) : (
                    <Canvas
                      id={`trend-canvas-${range}`}
                      canvasId={`trend-canvas-${range}`}
                      type='2d'
                      className='trend-canvas'
                      disableScroll
                    />
                  )}
                  {!chartReadyMap[range] ? (
                    <View className='fallback-list'>
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
