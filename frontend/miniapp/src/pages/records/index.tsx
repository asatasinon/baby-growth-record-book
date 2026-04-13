import { useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'

import {
  EVENT_TYPE_COLOR_MAP,
  EVENT_TYPE_LABEL_MAP,
  EVENT_TYPE_OPTIONS,
  EXCRETION_LABEL_MAP,
  FEEDING_TYPE_LABEL_MAP
} from '@/constants/event'
import { deleteEvent, listEvents } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { EventType, GrowthEvent } from '@/types/domain'
import { MINUTE_MS, dayWindow, formatDateTime, formatMinutes } from '@/utils/time'

import './index.scss'

type EventFilterType = 'all' | EventType

type FeedingTypeValue = 'formula_bottle' | 'breast_bottle' | 'breast_direct'

interface FloatingButtonMetrics {
  windowWidth: number
  windowHeight: number
  safeBottom: number
  fabSize: number
  margin: number
  minBottomGap: number
}

function resolveFloatingButtonMetrics(): FloatingButtonMetrics {
  try {
    const systemInfo = Taro.getSystemInfoSync()
    const windowWidth = systemInfo.windowWidth || 375
    const windowHeight = systemInfo.windowHeight || 667
    const pxPerRpx = windowWidth / 750
    const safeBottom = systemInfo.safeArea ? Math.max(0, windowHeight - systemInfo.safeArea.bottom) : 0

    return {
      windowWidth,
      windowHeight,
      safeBottom,
      fabSize: 76 * pxPerRpx,
      margin: 24 * pxPerRpx,
      minBottomGap: 100 * pxPerRpx
    }
  } catch {
    return {
      windowWidth: 375,
      windowHeight: 667,
      safeBottom: 0,
      fabSize: 38,
      margin: 12,
      minBottomGap: 50
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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

function isBottleFeedingType(type: FeedingTypeValue): boolean {
  return type === 'formula_bottle' || type === 'breast_bottle'
}

function resolveFeedingDurationMinutes(
  startAt: number | null,
  endAt: number | null,
  payload: Record<string, unknown>
): number {
  const payloadDuration = Number(payload.duration_minutes)
  if (Number.isFinite(payloadDuration) && payloadDuration > 0) {
    return Math.round(payloadDuration)
  }
  if (startAt !== null && endAt !== null && endAt > startAt) {
    return Math.max(1, Math.round((endAt - startAt) / MINUTE_MS))
  }
  return 0
}

function summarizeEvent(event: GrowthEvent): string {
  const payload = event.payload || {}

  if (event.event_type === 'feeding') {
    const feedingType = resolveFeedingType(payload)
    const duration = resolveFeedingDurationMinutes(event.start_at, event.end_at, payload)
    const volume = Number(payload.volume)
    const parts = [FEEDING_TYPE_LABEL_MAP[feedingType] || '喂养']
    if (isBottleFeedingType(feedingType) && Number.isFinite(volume) && volume > 0) {
      parts.push(`${volume} ml`)
    }
    if (duration > 0) {
      parts.push(`${duration} 分钟`)
    }
    return parts.join(' · ')
  }

  if (event.event_type === 'excretion') {
    const eventType = String(payload.excretion_type || 'unknown')
    return EXCRETION_LABEL_MAP[eventType] || eventType
  }

  if (event.event_type === 'sleep') {
    const duration = Number(payload.duration_minutes || 0)
    return `总时长 ${formatMinutes(duration)}`
  }

  if (event.event_type === 'measurement') {
    const parts: string[] = []
    if (payload.weight_g !== undefined) {
      parts.push(`体重 ${payload.weight_g} g`)
    }
    if (payload.temperature_c !== undefined) {
      parts.push(`体温 ${payload.temperature_c} ℃`)
    }
    return parts.length > 0 ? parts.join(' · ') : '测量记录'
  }

  return '已记录'
}

export default function RecordsPage() {
  const [floatingMetrics] = useState<FloatingButtonMetrics>(() => resolveFloatingButtonMetrics())
  const [events, setEvents] = useState<GrowthEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [filterType, setFilterType] = useState<EventFilterType>('all')
  const [isDraggingFab, setIsDraggingFab] = useState(false)
  const [fabPos, setFabPos] = useState(() => {
    const initialX = floatingMetrics.windowWidth - floatingMetrics.fabSize - floatingMetrics.margin
    const initialY =
      floatingMetrics.windowHeight -
      floatingMetrics.fabSize -
      floatingMetrics.safeBottom -
      floatingMetrics.margin -
      40
    return {
      x: clamp(initialX, 0, Math.max(0, floatingMetrics.windowWidth - floatingMetrics.fabSize)),
      y: clamp(
        initialY,
        0,
        Math.max(0, floatingMetrics.windowHeight - floatingMetrics.fabSize - floatingMetrics.safeBottom)
      )
    }
  })
  const fabDragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    blockClickUntil: 0
  })

  const hasContext = Boolean(
    getSession() && getActiveFamilyId(getSession() || undefined) && getActiveBabyId()
  )

  async function loadRecords(nextFilterType: EventFilterType = filterType): Promise<void> {
    const session = getSession()
    const familyId = getActiveFamilyId(session || undefined)
    const babyId = getActiveBabyId()

    if (!session || !familyId || !babyId) {
      setEvents([])
      return
    }

    const { dateFrom, dateTo } = dayWindow(30)

    setIsLoading(true)
    try {
      const data = await listEvents({
        session,
        familyId,
        babyId,
        eventType: nextFilterType === 'all' ? undefined : nextFilterType,
        dateFrom,
        dateTo
      })
      setEvents(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载记录失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadRecords()
  })

  async function handleDelete(eventId: string): Promise<void> {
    const session = getSession()
    if (!session) {
      return
    }

    setDeletingId(eventId)
    try {
      await deleteEvent(session, eventId)
      Taro.showToast({ title: '已删除', icon: 'success' })
      await loadRecords()
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '删除失败', icon: 'none' })
    } finally {
      setDeletingId('')
    }
  }

  function goToUpdatePage(eventId: string): void {
    void Taro.navigateTo({ url: `/pages/update-record/index?eventId=${eventId}` })
  }

  function goToCreatePage(): void {
    void Taro.navigateTo({ url: '/pages/quick-record/index' })
  }

  function handleFabTouchStart(event: any): void {
    const point = event.touches?.[0] || event.changedTouches?.[0]
    if (!point) {
      return
    }

    fabDragRef.current.dragging = true
    fabDragRef.current.startX = Number(point.clientX ?? point.pageX ?? 0)
    fabDragRef.current.startY = Number(point.clientY ?? point.pageY ?? 0)
    fabDragRef.current.originX = fabPos.x
    fabDragRef.current.originY = fabPos.y
    fabDragRef.current.moved = false
    setIsDraggingFab(true)
  }

  function handleFabTouchMove(event: any): void {
    if (!fabDragRef.current.dragging) {
      return
    }
    const point = event.touches?.[0] || event.changedTouches?.[0]
    if (!point) {
      return
    }

    const clientX = Number(point.clientX ?? point.pageX ?? 0)
    const clientY = Number(point.clientY ?? point.pageY ?? 0)
    const deltaX = clientX - fabDragRef.current.startX
    const deltaY = clientY - fabDragRef.current.startY

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      fabDragRef.current.moved = true
    }

    const maxX = Math.max(0, floatingMetrics.windowWidth - floatingMetrics.fabSize)
    const maxY = Math.max(
      0,
      floatingMetrics.windowHeight - floatingMetrics.fabSize - floatingMetrics.safeBottom - floatingMetrics.minBottomGap
    )

    setFabPos({
      x: clamp(fabDragRef.current.originX + deltaX, 0, maxX),
      y: clamp(fabDragRef.current.originY + deltaY, 0, maxY)
    })
  }

  function handleFabTouchEnd(): void {
    if (fabDragRef.current.moved) {
      fabDragRef.current.blockClickUntil = Date.now() + 220
    }
    fabDragRef.current.dragging = false
    setIsDraggingFab(false)
  }

  function handleFabClick(): void {
    if (Date.now() < fabDragRef.current.blockClickUntil) {
      return
    }
    goToCreatePage()
  }

  if (!hasContext) {
    return (
      <View className='page-shell records-page'>
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
    <View className='page-shell records-page'>
      <Text className='section-title'>最近 30 天记录</Text>
      <View className='pill-row'>
        <View
          className={`pill ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => {
            setFilterType('all')
            void loadRecords('all')
          }}
        >
          <Text>全部</Text>
        </View>
        {EVENT_TYPE_OPTIONS.map((item) => (
          <View
            key={item.value}
            className={`pill ${filterType === item.value ? 'active' : ''}`}
            onClick={() => {
              setFilterType(item.value)
              void loadRecords(item.value)
            }}
          >
            <Text>{item.label}</Text>
          </View>
        ))}
      </View>

      <View className='records-list'>
        {isLoading && <Text className='muted'>加载中...</Text>}

        {!isLoading && events.length === 0 && (
          <View className='card empty-card'>
            <Text className='muted'>当前筛选条件下没有记录，点击右下角 + 新增一条吧。</Text>
          </View>
        )}

        {events.map((event) => {
          const isDeletingThis = deletingId === event.id

          return (
            <View key={event.id} className='card event-card'>
              <View className='h-stack'>
                <Text className='inline-tag' style={{ backgroundColor: EVENT_TYPE_COLOR_MAP[event.event_type] }}>
                  {EVENT_TYPE_LABEL_MAP[event.event_type]}
                </Text>
                <Text className='muted'>{formatDateTime(event.occurred_at)}</Text>
              </View>
              <Text className='event-summary'>{summarizeEvent(event)}</Text>
              {event.notes ? <Text className='event-notes'>备注：{event.notes}</Text> : null}

              <View className='event-actions'>
                <View
                  className={`icon-action ${isDeletingThis ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isDeletingThis) {
                      return
                    }
                    goToUpdatePage(event.id)
                  }}
                >
                  <View className='icon-glyph icon-glyph-edit' />
                </View>
                <View
                  className={`icon-action danger ${isDeletingThis ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isDeletingThis) {
                      return
                    }
                    void handleDelete(event.id)
                  }}
                >
                  <View className='icon-glyph icon-glyph-delete' />
                </View>
              </View>
            </View>
          )
        })}
      </View>

      <View
        className={`floating-add-btn ${isDraggingFab ? 'dragging' : ''}`}
        style={{
          left: `${fabPos.x}px`,
          top: `${fabPos.y}px`
        }}
        catchMove
        onClick={handleFabClick}
        onTouchStart={handleFabTouchStart}
        onTouchMove={handleFabTouchMove}
        onTouchEnd={handleFabTouchEnd}
        onTouchCancel={handleFabTouchEnd}
      >
        <View className='add-icon' />
      </View>
    </View>
  )
}
