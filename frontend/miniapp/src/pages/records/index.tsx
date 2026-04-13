import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'

import {
  EVENT_TYPE_COLOR_MAP,
  EVENT_TYPE_LABEL_MAP,
  EVENT_TYPE_OPTIONS,
  EXCRETION_LABEL_MAP
} from '@/constants/event'
import { deleteEvent, getEvent, listEvents, updateEvent } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { EventType, GrowthEvent } from '@/types/domain'
import { dayWindow, formatDate, formatDateTime, formatMinutes, formatTime, parseDateTimeToMs } from '@/utils/time'

import './index.scss'

type EventFilterType = 'all' | EventType

function summarizeEvent(event: GrowthEvent): string {
  const payload = event.payload || {}

  if (event.event_type === 'feeding') {
    const volume = payload.volume
    return `${volume ?? 0} ml · ${String(payload.mode || '未标注方式')}`
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
  const [events, setEvents] = useState<GrowthEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string>('')
  const [editingId, setEditingId] = useState<string>('')
  const [isEditingLoading, setIsEditingLoading] = useState(false)
  const [filterType, setFilterType] = useState<EventFilterType>('all')
  const [editDate, setEditDate] = useState(formatDate(Date.now()))
  const [editTime, setEditTime] = useState(formatTime(Date.now()))
  const [editNotes, setEditNotes] = useState('')
  const [editPayloadText, setEditPayloadText] = useState('{}')

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

  async function handleEditStart(eventId: string): Promise<void> {
    const session = getSession()
    if (!session) {
      return
    }
    setEditingId(eventId)
    setIsEditingLoading(true)
    try {
      const detail = await getEvent(session, eventId)
      setEditDate(formatDate(detail.occurred_at))
      setEditTime(formatTime(detail.occurred_at))
      setEditNotes(detail.notes || '')
      setEditPayloadText(JSON.stringify(detail.payload || {}, null, 2))
    } catch (error) {
      setEditingId('')
      Taro.showToast({ title: (error as Error).message || '加载事件详情失败', icon: 'none' })
    } finally {
      setIsEditingLoading(false)
    }
  }

  function handleEditCancel(): void {
    setEditingId('')
    setEditNotes('')
    setEditPayloadText('{}')
  }

  async function handleEditSave(eventId: string): Promise<void> {
    const session = getSession()
    if (!session) {
      return
    }

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(editPayloadText) as Record<string, unknown>
      if (Array.isArray(parsedPayload) || parsedPayload === null) {
        throw new Error('payload 必须是 JSON 对象')
      }
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || 'payload 不是有效 JSON', icon: 'none' })
      return
    }

    setIsEditingLoading(true)
    try {
      await updateEvent(session, eventId, {
        occurredAt: parseDateTimeToMs(editDate, editTime),
        notes: editNotes.trim() || undefined,
        payload: parsedPayload
      })
      Taro.showToast({ title: '事件已更新', icon: 'success' })
      handleEditCancel()
      await loadRecords()
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新失败', icon: 'none' })
    } finally {
      setIsEditingLoading(false)
    }
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
            <Text className='muted'>当前筛选条件下没有记录，去首页快速新增一条吧。</Text>
          </View>
        )}

        {events.map((event) => (
          <View key={event.id} className='card event-card'>
            <View className='h-stack'>
              <Text
                className='inline-tag'
                style={{ backgroundColor: EVENT_TYPE_COLOR_MAP[event.event_type] }}
              >
                {EVENT_TYPE_LABEL_MAP[event.event_type]}
              </Text>
              <Text className='muted'>{formatDateTime(event.occurred_at)}</Text>
            </View>
            <Text className='event-summary'>{summarizeEvent(event)}</Text>
            {event.notes ? <Text className='event-notes'>备注：{event.notes}</Text> : null}
            <View className='event-actions'>
              <Button
                size='mini'
                plain
                loading={isEditingLoading && editingId === event.id}
                onClick={() => void handleEditStart(event.id)}
              >
                编辑
              </Button>
              <Button
                size='mini'
                plain
                loading={deletingId === event.id}
                onClick={() => void handleDelete(event.id)}
              >
                删除
              </Button>
            </View>
            {editingId === event.id ? (
              <View className='edit-panel'>
                <Text className='form-label'>发生日期</Text>
                <Picker mode='date' value={editDate} onChange={(evt) => setEditDate(evt.detail.value)}>
                  <View className='input picker-like'>{editDate}</View>
                </Picker>
                <Text className='form-label'>发生时间</Text>
                <Picker mode='time' value={editTime} onChange={(evt) => setEditTime(evt.detail.value)}>
                  <View className='input picker-like'>{editTime}</View>
                </Picker>
                <Text className='form-label'>备注</Text>
                <Input
                  className='input'
                  value={editNotes}
                  onInput={(evt) => setEditNotes(evt.detail.value)}
                  placeholder='可选备注'
                />
                <Text className='form-label'>Payload（JSON）</Text>
                <Textarea
                  className='input payload-textarea'
                  value={editPayloadText}
                  onInput={(evt) => setEditPayloadText(evt.detail.value)}
                  maxlength={-1}
                />
                <View className='edit-actions'>
                  <Button size='mini' onClick={handleEditCancel}>
                    取消
                  </Button>
                  <Button
                    size='mini'
                    type='primary'
                    loading={isEditingLoading}
                    onClick={() => void handleEditSave(event.id)}
                  >
                    保存
                  </Button>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}
