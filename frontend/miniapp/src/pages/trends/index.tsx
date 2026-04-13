import { useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

import { getTrendPoints } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { TrendResult } from '@/types/domain'
import { dayWindow, formatMonthDay } from '@/utils/time'

import './index.scss'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const RANGE_OPTIONS = [7, 30, 90] as const

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

export default function TrendsPage() {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(7)
  const [metricCode, setMetricCode] = useState<MetricCode>('feeding_total_ml')
  const [trend, setTrend] = useState<TrendResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isChartReady, setIsChartReady] = useState(false)

  const chartRef = useRef<echarts.EChartsType | null>(null)

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

  const points = trend?.points || []
  const averageValue = useMemo(() => {
    if (points.length === 0) {
      return 0
    }
    return points.reduce((acc, item) => acc + item.value, 0) / points.length
  }, [points])

  const latestValue = points.length > 0 ? points[points.length - 1].value : 0

  function disposeChart(): void {
    if (chartRef.current) {
      chartRef.current.dispose()
      chartRef.current = null
    }
    setIsChartReady(false)
  }

  useEffect(() => {
    return () => {
      disposeChart()
    }
  }, [])

  useEffect(() => {
    if (isLoading || points.length === 0) {
      disposeChart()
      return
    }

    const timer = setTimeout(() => {
      const query = Taro.createSelectorQuery()
      query
        .select('#trend-canvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          const canvasInfo = (result?.[0] || null) as {
            node?: unknown
            width?: number
            height?: number
          } | null

          if (!canvasInfo || !canvasInfo.node || !canvasInfo.width || !canvasInfo.height) {
            setIsChartReady(false)
            return
          }

          disposeChart()

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

          chart.setOption({
            animation: true,
            tooltip: { trigger: 'axis' },
            grid: { left: 32, right: 18, top: 24, bottom: 34 },
            xAxis: {
              type: 'category',
              boundaryGap: false,
              data: points.map((item) => formatMonthDay(item.bucket_date)),
              axisLabel: { color: '#5e6b84', fontSize: 10 }
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
          })

          chartRef.current = chart
          setIsChartReady(true)
        })
    }, 80)

    return () => clearTimeout(timer)
  }, [isLoading, metricCode, points])

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
        {!isLoading && points.length === 0 && <Text className='muted'>当前时间范围内无可展示数据。</Text>}

        {!isLoading && points.length > 0 ? (
          <View>
            <Text className='chart-title'>
              {getMetricLabel(metricCode)}趋势（{rangeDays} 天）
            </Text>
            <Canvas
              id='trend-canvas'
              canvasId='trend-canvas'
              type='2d'
              className='trend-canvas'
              disableScroll
            />
            {!isChartReady ? (
              <View className='fallback-list'>
                {points.map((point) => (
                  <View key={`${point.bucket_date}-${point.value}`} className='fallback-row'>
                    <Text className='muted'>{formatMonthDay(point.bucket_date)}</Text>
                    <Text>
                      {point.value.toFixed(1)} {trend?.unit || ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}
