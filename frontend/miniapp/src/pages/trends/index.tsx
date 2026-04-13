import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Canvas, Text, View } from '@tarojs/components'

import {
  EXCRETION_TYPE_COLOR_MAP,
  EXCRETION_TYPE_OPTIONS,
  FEEDING_TYPE_COLOR_MAP,
  FEEDING_TYPE_OPTIONS
} from '@/constants/event'
import { listEvents } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { GrowthEvent, TrendPoint } from '@/types/domain'
import { MINUTE_MS, dayWindow, formatDateTime, formatMonthDayTime } from '@/utils/time'

import './index.scss'

const RANGE_OPTIONS = [7, 15, 30, 60, 90] as const
const METRIC_OPTIONS = [
  { code: 'feeding', label: '喂养' },
  { code: 'excretion', label: '排泄' }
] as const

type RangeDays = (typeof RANGE_OPTIONS)[number]
type MetricCode = (typeof METRIC_OPTIONS)[number]['code']
type ReadyMap = Partial<Record<RangeDays, boolean>>
type ChartMap = Partial<Record<RangeDays, RangeChartData | null>>
type TooltipMap = Partial<Record<RangeDays, ActiveTooltip | null>>

type FeedingTypeValue = (typeof FEEDING_TYPE_OPTIONS)[number]['value']
type ExcretionTypeValue = (typeof EXCRETION_TYPE_OPTIONS)[number]['value']

interface CanvasRect {
  width: number
  height: number
  left: number
  top: number
}

interface ChartSeries {
  key: string
  label: string
  color: string
  points: TrendPoint[]
  extraByBucket?: Record<number, number>
}

interface RangeChartData {
  title: string
  unit: string
  series: ChartSeries[]
  stats: {
    average: number
    latest: number
    averageDuration?: number
    latestDuration?: number
  }
  tooltipMode: MetricCode
}

interface DrawnSeriesMeta {
  key: string
  label: string
  color: string
  values: Array<number | null>
  extras: Array<number | null>
}

interface DrawnChartMeta {
  rect: CanvasRect
  xValues: number[]
  xPositions: number[]
  series: DrawnSeriesMeta[]
}

interface TooltipEntry {
  key: string
  label: string
  color: string
  value: number | null
  duration: number | null
}

interface ActiveTooltip {
  left: number
  top: number
  timeText: string
  entries: TooltipEntry[]
}

function buildReadyMap(value: boolean): ReadyMap {
  return RANGE_OPTIONS.reduce((acc, range) => {
    acc[range] = value
    return acc
  }, {} as ReadyMap)
}

function buildChartMap(value: RangeChartData | null): ChartMap {
  return RANGE_OPTIONS.reduce((acc, range) => {
    acc[range] = value
    return acc
  }, {} as ChartMap)
}

function buildTooltipMap(value: ActiveTooltip | null): TooltipMap {
  return RANGE_OPTIONS.reduce((acc, range) => {
    acc[range] = value
    return acc
  }, {} as TooltipMap)
}

function toMinuteBucket(ms: number): number {
  return Math.floor(ms / MINUTE_MS) * MINUTE_MS
}

function formatAxisValue(value: number): string {
  if (value >= 100) {
    return String(Math.round(value))
  }
  const fixed = value.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

function formatTooltipNumeric(value: number): string {
  const fixed = value.toFixed(1)
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

function resolveFeedingType(payload: Record<string, unknown>): FeedingTypeValue {
  const rawType = String(payload.feeding_type || payload.mode || '')
  if (rawType === 'formula_bottle' || rawType === 'breast_bottle' || rawType === 'breast_direct') {
    return rawType
  }
  if (rawType === 'formula') {
    return 'formula_bottle'
  }
  if (rawType === 'bottle') {
    return 'breast_bottle'
  }
  if (rawType === 'breastfeeding') {
    return 'breast_direct'
  }
  return 'formula_bottle'
}

function resolveDurationMinutes(event: GrowthEvent, payload: Record<string, unknown>): number {
  const payloadDuration = Number(payload.duration_minutes)
  if (Number.isFinite(payloadDuration) && payloadDuration > 0) {
    return payloadDuration
  }

  if (typeof event.start_at === 'number' && typeof event.end_at === 'number' && event.end_at > event.start_at) {
    return Math.max(1, Math.round((event.end_at - event.start_at) / MINUTE_MS))
  }

  return 0
}

function calcStatsByBucket(buckets: Record<number, number>): { average: number; latest: number } {
  const keys = Object.keys(buckets)
    .map((key) => Number(key))
    .filter((key) => Number.isFinite(key))
    .sort((a, b) => a - b)

  if (keys.length === 0) {
    return { average: 0, latest: 0 }
  }

  const total = keys.reduce((sum, key) => sum + (buckets[key] || 0), 0)
  const latest = buckets[keys[keys.length - 1]] || 0
  return { average: total / keys.length, latest }
}

function toSeriesPoints(bucketValues: Record<number, number>): TrendPoint[] {
  return Object.keys(bucketValues)
    .map((key) => Number(key))
    .filter((key) => Number.isFinite(key))
    .sort((a, b) => a - b)
    .map((bucketDate) => ({
      bucket_date: bucketDate,
      value: Number((bucketValues[bucketDate] || 0).toFixed(2))
    }))
}

function buildFeedingChartData(range: RangeDays, events: GrowthEvent[]): RangeChartData {
  const volumeByType = FEEDING_TYPE_OPTIONS.reduce(
    (acc, item) => ({ ...acc, [item.value]: {} as Record<number, number> }),
    {} as Record<FeedingTypeValue, Record<number, number>>
  )
  const durationByType = FEEDING_TYPE_OPTIONS.reduce(
    (acc, item) => ({ ...acc, [item.value]: {} as Record<number, number> }),
    {} as Record<FeedingTypeValue, Record<number, number>>
  )
  const totalVolumeByBucket: Record<number, number> = {}
  const totalDurationByBucket: Record<number, number> = {}

  events.forEach((event) => {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
    const feedingType = resolveFeedingType(payload)
    const bucket = toMinuteBucket(event.occurred_at)
    const duration = resolveDurationMinutes(event, payload)
    const volume = Number(payload.volume)
    const safeVolume = Number.isFinite(volume) && volume > 0 ? volume : 0

    durationByType[feedingType][bucket] = (durationByType[feedingType][bucket] || 0) + duration
    volumeByType[feedingType][bucket] = (volumeByType[feedingType][bucket] || 0) + safeVolume

    totalDurationByBucket[bucket] = (totalDurationByBucket[bucket] || 0) + duration
    totalVolumeByBucket[bucket] = (totalVolumeByBucket[bucket] || 0) + safeVolume
  })

  const series: ChartSeries[] = FEEDING_TYPE_OPTIONS.map((item) => ({
    key: item.value,
    label: item.label,
    color: FEEDING_TYPE_COLOR_MAP[item.value],
    points: toSeriesPoints(volumeByType[item.value]),
    extraByBucket: durationByType[item.value]
  }))

  const volumeStats = calcStatsByBucket(totalVolumeByBucket)
  const durationStats = calcStatsByBucket(totalDurationByBucket)

  return {
    title: `喂养趋势（${range} 天）`,
    unit: 'ml',
    series,
    stats: {
      average: volumeStats.average,
      latest: volumeStats.latest,
      averageDuration: durationStats.average,
      latestDuration: durationStats.latest
    },
    tooltipMode: 'feeding'
  }
}

function buildExcretionChartData(range: RangeDays, events: GrowthEvent[]): RangeChartData {
  const countByType = EXCRETION_TYPE_OPTIONS.reduce(
    (acc, item) => ({ ...acc, [item.value]: {} as Record<number, number> }),
    {} as Record<ExcretionTypeValue, Record<number, number>>
  )
  const totalCountByBucket: Record<number, number> = {}

  events.forEach((event) => {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {}
    const excretionType = String(payload.excretion_type || '')
    const bucket = toMinuteBucket(event.occurred_at)

    if (excretionType === 'urine' || excretionType === 'stool') {
      countByType[excretionType][bucket] = (countByType[excretionType][bucket] || 0) + 1
      totalCountByBucket[bucket] = (totalCountByBucket[bucket] || 0) + 1
      return
    }

    if (excretionType === 'mixed') {
      countByType.urine[bucket] = (countByType.urine[bucket] || 0) + 1
      countByType.stool[bucket] = (countByType.stool[bucket] || 0) + 1
      totalCountByBucket[bucket] = (totalCountByBucket[bucket] || 0) + 2
    }
  })

  const series: ChartSeries[] = EXCRETION_TYPE_OPTIONS.map((item) => ({
    key: item.value,
    label: item.label,
    color: EXCRETION_TYPE_COLOR_MAP[item.value],
    points: toSeriesPoints(countByType[item.value])
  }))

  const countStats = calcStatsByBucket(totalCountByBucket)

  return {
    title: `排泄趋势（${range} 天）`,
    unit: '次',
    series,
    stats: {
      average: countStats.average,
      latest: countStats.latest
    },
    tooltipMode: 'excretion'
  }
}

function getChartRect(range: RangeDays): Promise<CanvasRect | null> {
  return new Promise((resolve) => {
    const query = Taro.createSelectorQuery()
    query.select(`#trend-canvas-${range}`).boundingClientRect()
    query.exec((result) => {
      const rect = (result?.[0] || null) as
        | { width?: number; height?: number; left?: number; top?: number }
        | null

      if (!rect || !rect.width || !rect.height) {
        resolve(null)
        return
      }

      resolve({
        width: rect.width,
        height: rect.height,
        left: rect.left ?? 0,
        top: rect.top ?? 0
      })
    })
  })
}

async function drawTrendCanvas(range: RangeDays, chartData: RangeChartData): Promise<DrawnChartMeta> {
  const rect = await getChartRect(range)
  if (!rect) {
    throw new Error('canvas size missing')
  }

  const width = rect.width
  const height = rect.height
  const padding = { left: 56, right: 16, top: 20, bottom: 30 }
  const plotWidth = Math.max(1, width - padding.left - padding.right)
  const plotHeight = Math.max(1, height - padding.top - padding.bottom)

  const xValues = Array.from(
    new Set(chartData.series.flatMap((series) => series.points.map((point) => point.bucket_date)))
  ).sort((a, b) => a - b)

  if (xValues.length === 0) {
    throw new Error('empty chart points')
  }

  const maxRawValue = Math.max(
    0,
    ...chartData.series.flatMap((series) => series.points.map((point) => point.value))
  )
  const maxValue = maxRawValue <= 0 ? 1 : maxRawValue

  const xStep = xValues.length > 1 ? plotWidth / (xValues.length - 1) : 0
  const xPositions = xValues.map((_, index) =>
    xValues.length === 1 ? padding.left + plotWidth / 2 : padding.left + xStep * index
  )

  const seriesMeta: DrawnSeriesMeta[] = chartData.series.map((series) => {
    const pointByBucket = series.points.reduce(
      (acc, point) => ({ ...acc, [point.bucket_date]: point.value }),
      {} as Record<number, number>
    )
    const values = xValues.map((bucket) =>
      pointByBucket[bucket] !== undefined ? Number((pointByBucket[bucket] || 0).toFixed(2)) : null
    )
    const extras = xValues.map((bucket) =>
      series.extraByBucket && series.extraByBucket[bucket] !== undefined
        ? Number((series.extraByBucket[bucket] || 0).toFixed(2))
        : null
    )

    return {
      key: series.key,
      label: series.label,
      color: series.color,
      values,
      extras
    }
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

  ctx.setFontSize(10)
  ctx.setFillStyle('#5e6b84')
  ctx.setTextAlign('right')
  ctx.setTextBaseline('middle')
  for (let i = 0; i <= 4; i += 1) {
    const ratio = 1 - i / 4
    const y = padding.top + (plotHeight / 4) * i
    ctx.fillText(formatAxisValue(maxValue * ratio), padding.left - 8, y)
  }

  seriesMeta.forEach((series) => {
    ctx.setStrokeStyle(series.color)
    ctx.setLineWidth(2)

    let drawing = false
    ctx.beginPath()
    series.values.forEach((value, index) => {
      if (value === null) {
        if (drawing) {
          ctx.stroke()
          drawing = false
          ctx.beginPath()
        }
        return
      }

      const x = xPositions[index]
      const y = padding.top + (1 - value / maxValue) * plotHeight
      if (!drawing) {
        ctx.moveTo(x, y)
        drawing = true
      } else {
        ctx.lineTo(x, y)
      }
    })
    if (drawing) {
      ctx.stroke()
    }

    series.values.forEach((value, index) => {
      if (value === null) {
        return
      }
      const x = xPositions[index]
      const y = padding.top + (1 - value / maxValue) * plotHeight
      ctx.beginPath()
      ctx.setFillStyle(series.color)
      ctx.arc(x, y, 2.6, 0, Math.PI * 2)
      ctx.fill()
    })
  })

  const labelIndexes = Array.from(new Set([0, Math.floor((xValues.length - 1) / 2), Math.max(xValues.length - 1, 0)]))
  ctx.setFontSize(10)
  ctx.setFillStyle('#5e6b84')
  ctx.setTextAlign('center')
  ctx.setTextBaseline('top')
  labelIndexes.forEach((index) => {
    const x = xPositions[index]
    const bucketDate = xValues[index]
    if (!x || !bucketDate) {
      return
    }
    ctx.fillText(formatMonthDayTime(bucketDate), x, padding.top + plotHeight + 8)
  })

  await new Promise<void>((resolve) => {
    ctx.draw(false, () => resolve())
  })

  return {
    rect,
    xValues,
    xPositions,
    series: seriesMeta
  }
}

function resolveTouchLocalX(touchX: number, rect: CanvasRect): number {
  const offsetX = touchX - rect.left
  if (offsetX >= -24 && offsetX <= rect.width + 24) {
    return offsetX
  }
  return touchX
}

function pickNearestIndex(xPositions: number[], localX: number): number {
  if (xPositions.length === 0) {
    return -1
  }
  let nearestIndex = 0
  let nearestDistance = Math.abs(localX - xPositions[0])
  for (let index = 1; index < xPositions.length; index += 1) {
    const distance = Math.abs(localX - xPositions[index])
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }
  return nearestIndex
}

function resolveTooltipPosition(rect: CanvasRect, anchorX: number): { left: number; top: number } {
  const tooltipWidth = 210
  const minEdge = 8
  const maxLeft = Math.max(minEdge, rect.width - tooltipWidth - minEdge)
  return {
    left: Math.min(maxLeft, Math.max(minEdge, anchorX - tooltipWidth / 2)),
    top: 8
  }
}

function hasAnySeriesValue(entries: TooltipEntry[]): boolean {
  return entries.some((entry) => typeof entry.value === 'number')
}

export default function TrendsPage() {
  const [metricCode, setMetricCode] = useState<MetricCode>('feeding')
  const [chartMap, setChartMap] = useState<ChartMap>(() => buildChartMap(null))
  const [isLoading, setIsLoading] = useState(false)
  const [chartReadyMap, setChartReadyMap] = useState<ReadyMap>(() => buildReadyMap(false))
  const [chartAttemptedMap, setChartAttemptedMap] = useState<ReadyMap>(() => buildReadyMap(false))
  const [tooltipMap, setTooltipMap] = useState<TooltipMap>(() => buildTooltipMap(null))
  const chartMetaRef = useRef<Partial<Record<RangeDays, DrawnChartMeta>>>({})

  function resetChartState(): void {
    chartMetaRef.current = {}
    setChartReadyMap(buildReadyMap(false))
    setChartAttemptedMap(buildReadyMap(false))
    setTooltipMap(buildTooltipMap(null))
  }

  function markChartReady(range: RangeDays, ready: boolean): void {
    setChartReadyMap((prev) => ({ ...prev, [range]: ready }))
  }

  function markChartAttempted(range: RangeDays, attempted: boolean): void {
    setChartAttemptedMap((prev) => ({ ...prev, [range]: attempted }))
  }

  function hideTooltip(range: RangeDays): void {
    setTooltipMap((prev) => ({ ...prev, [range]: null }))
  }

  async function loadCharts(nextMetricCode = metricCode): Promise<void> {
    const session = getSession()
    const familyId = getActiveFamilyId(session || undefined)
    const babyId = getActiveBabyId()

    if (!session || !familyId || !babyId) {
      setChartMap(buildChartMap(null))
      resetChartState()
      return
    }

    setIsLoading(true)
    resetChartState()

    try {
      const entries = await Promise.all(
        RANGE_OPTIONS.map(async (range) => {
          const { dateFrom, dateTo } = dayWindow(range)
          const events = await listEvents({
            session,
            familyId,
            babyId,
            eventType: nextMetricCode === 'feeding' ? 'feeding' : 'excretion',
            dateFrom,
            dateTo
          })

          const chartData =
            nextMetricCode === 'feeding'
              ? buildFeedingChartData(range, events)
              : buildExcretionChartData(range, events)

          return [range, chartData] as const
        })
      )

      const nextChartMap = buildChartMap(null)
      entries.forEach(([range, chartData]) => {
        nextChartMap[range] = chartData
      })
      setChartMap(nextChartMap)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载趋势失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadCharts()
  })

  useEffect(() => {
    if (isLoading) {
      resetChartState()
      return
    }

    let canceled = false
    const timer = setTimeout(() => {
      RANGE_OPTIONS.forEach((range) => {
        const chartData = chartMap[range]
        const pointCount = chartData ? chartData.series.reduce((sum, series) => sum + series.points.length, 0) : 0

        if (!chartData || pointCount === 0) {
          markChartReady(range, false)
          markChartAttempted(range, true)
          return
        }

        void drawTrendCanvas(range, chartData)
          .then((chartMeta) => {
            if (canceled) {
              return
            }
            chartMetaRef.current[range] = chartMeta
            markChartReady(range, true)
            markChartAttempted(range, true)
          })
          .catch(() => {
            if (canceled) {
              return
            }
            delete chartMetaRef.current[range]
            hideTooltip(range)
            markChartReady(range, false)
            markChartAttempted(range, true)
          })
      })
    }, 80)

    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [isLoading, chartMap])

  function updateTooltipByTouch(range: RangeDays, event: unknown): void {
    const chartMeta = chartMetaRef.current[range]
    const chartData = chartMap[range]
    if (!chartMeta || !chartData) {
      hideTooltip(range)
      return
    }

    const typedEvent = event as {
      detail?: { x?: number; clientX?: number; offsetX?: number }
      changedTouches?: Array<{ x?: number; clientX?: number; pageX?: number }>
      touches?: Array<{ x?: number; clientX?: number; pageX?: number }>
      nativeEvent?: { offsetX?: number; x?: number; clientX?: number }
    }

    const detailTouchX = typedEvent.detail?.x ?? typedEvent.detail?.clientX ?? typedEvent.detail?.offsetX
    const touch = typedEvent.changedTouches?.[0] ?? typedEvent.touches?.[0] ?? null
    const touchX =
      detailTouchX ??
      touch?.x ??
      touch?.clientX ??
      touch?.pageX ??
      typedEvent.nativeEvent?.offsetX ??
      typedEvent.nativeEvent?.x ??
      typedEvent.nativeEvent?.clientX

    if (typeof touchX !== 'number') {
      return
    }

    const localX = resolveTouchLocalX(touchX, chartMeta.rect)
    const index = pickNearestIndex(chartMeta.xPositions, localX)
    if (index < 0 || !chartMeta.xValues[index]) {
      hideTooltip(range)
      return
    }

    const entries: TooltipEntry[] = chartMeta.series.map((series) => ({
      key: series.key,
      label: series.label,
      color: series.color,
      value: series.values[index],
      duration: series.extras[index]
    }))

    if (!hasAnySeriesValue(entries)) {
      hideTooltip(range)
      return
    }

    const tooltipPosition = resolveTooltipPosition(chartMeta.rect, chartMeta.xPositions[index])
    setTooltipMap((prev) => ({
      ...prev,
      [range]: {
        left: tooltipPosition.left,
        top: tooltipPosition.top,
        timeText: formatDateTime(chartMeta.xValues[index]),
        entries
      }
    }))
  }

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
              void loadCharts(metric.code)
            }}
          >
            <Text>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View className='chart-list'>
        {RANGE_OPTIONS.map((range) => {
          const chartData = chartMap[range]
          const unit = chartData?.unit || ''
          const tooltip = tooltipMap[range]
          const hasDurationStats = chartData?.tooltipMode === 'feeding'
          const pointCount = chartData ? chartData.series.reduce((sum, series) => sum + series.points.length, 0) : 0

          return (
            <View key={range} className='card chart-card'>
              <Text className='chart-title'>{chartData?.title || `${range} 天趋势`}</Text>

              <View className='metric-overview'>
                <View>
                  <Text className='muted'>平均值</Text>
                  <Text className='overview-value'>
                    {(chartData?.stats.average || 0).toFixed(1)} {unit}
                  </Text>
                </View>
                <View>
                  <Text className='muted'>最新值</Text>
                  <Text className='overview-value'>
                    {(chartData?.stats.latest || 0).toFixed(1)} {unit}
                  </Text>
                </View>
                {hasDurationStats ? (
                  <View>
                    <Text className='muted'>平均时长</Text>
                    <Text className='overview-value'>
                      {(chartData?.stats.averageDuration || 0).toFixed(1)} 分钟
                    </Text>
                  </View>
                ) : null}
                {hasDurationStats ? (
                  <View>
                    <Text className='muted'>最新时长</Text>
                    <Text className='overview-value'>
                      {(chartData?.stats.latestDuration || 0).toFixed(1)} 分钟
                    </Text>
                  </View>
                ) : null}
              </View>

              {chartData ? (
                <View className='legend-row'>
                  {chartData.series.map((series) => (
                    <View key={series.key} className='legend-item'>
                      <View className='legend-dot' style={{ backgroundColor: series.color }} />
                      <Text className='legend-text'>{series.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {isLoading ? <Text className='muted'>趋势加载中...</Text> : null}
              {!isLoading && pointCount === 0 ? <Text className='muted'>当前时间范围内无可展示数据。</Text> : null}

              {!isLoading && pointCount > 0 ? (
                <View>
                  {!chartAttemptedMap[range] || chartReadyMap[range] ? (
                    <View
                      id={`trend-chart-${range}`}
                      className='chart-canvas-wrapper'
                      onTouchStart={(event) => updateTooltipByTouch(range, event)}
                      onTouchMove={(event) => updateTooltipByTouch(range, event)}
                      onTap={(event) => updateTooltipByTouch(range, event)}
                      onClick={(event) => updateTooltipByTouch(range, event)}
                    >
                      <Canvas id={`trend-canvas-${range}`} canvasId={`trend-canvas-${range}`} className='trend-canvas' />

                      {tooltip ? (
                        <View className='point-tooltip' style={{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }}>
                          <Text className='point-tooltip-time'>{tooltip.timeText}</Text>
                          {tooltip.entries.map((entry) => (
                            <View key={entry.key} className='point-tooltip-row'>
                              <View className='point-tooltip-dot' style={{ backgroundColor: entry.color }} />
                              <Text className='point-tooltip-label'>{entry.label}</Text>
                              {entry.value !== null ? (
                                <Text className='point-tooltip-value'>
                                  {chartData?.tooltipMode === 'feeding'
                                    ? `${formatTooltipNumeric(entry.value)} ml / ${formatTooltipNumeric(entry.duration || 0)} 分钟`
                                    : `${formatTooltipNumeric(entry.value)} 次`}
                                </Text>
                              ) : (
                                <Text className='point-tooltip-value'>-</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {chartAttemptedMap[range] && !chartReadyMap[range] ? (
                    <View className='fallback-list'>
                      <Text className='muted fallback-tip'>图表渲染失败，已切换为明细列表。</Text>
                      {chartData?.series.map((series) =>
                        series.points.map((point) => (
                          <View key={`${range}-${series.key}-${point.bucket_date}-${point.value}`} className='fallback-row'>
                            <Text className='muted'>
                              {series.label} · {formatDateTime(point.bucket_date)}
                            </Text>
                            <Text>
                              {point.value.toFixed(1)} {unit}
                            </Text>
                          </View>
                        ))
                      )}
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
