import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

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

const FEEDING_MODE_OPTIONS = [
  { value: 'bottle', label: '奶瓶' },
  { value: 'formula', label: '配方奶' },
  { value: 'breastfeeding', label: '母乳' }
]

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
  const [editPayloadBase, setEditPayloadBase] = useState<Record<string, unknown>>({})

  const [editFeedingVolume, setEditFeedingVolume] = useState('')
  const [editFeedingMode, setEditFeedingMode] = useState('bottle')
  const [editExcretionType, setEditExcretionType] = useState('unknown')
  const [editSleepMinutes, setEditSleepMinutes] = useState('')
  const [editWeightG, setEditWeightG] = useState('')
  const [editTemperatureC, setEditTemperatureC] = useState('')
  const [editMedicationName, setEditMedicationName] = useState('')
  const [editMedicationDosage, setEditMedicationDosage] = useState('')
  const [editVaccineName, setEditVaccineName] = useState('')
  const [editMilestoneText, setEditMilestoneText] = useState('')

  const hasContext = Boolean(
    getSession() && getActiveFamilyId(getSession() || undefined) && getActiveBabyId()
  )

  function resetEditForm(): void {
    setEditingId('')
    setEditDate(formatDate(Date.now()))
    setEditTime(formatTime(Date.now()))
    setEditNotes('')
    setEditPayloadBase({})
    setEditFeedingVolume('')
    setEditFeedingMode('bottle')
    setEditExcretionType('unknown')
    setEditSleepMinutes('')
    setEditWeightG('')
    setEditTemperatureC('')
    setEditMedicationName('')
    setEditMedicationDosage('')
    setEditVaccineName('')
    setEditMilestoneText('')
  }

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
      const payload = detail.payload || {}

      setEditDate(formatDate(detail.occurred_at))
      setEditTime(formatTime(detail.occurred_at))
      setEditNotes(detail.notes || '')
      setEditPayloadBase(payload)

      setEditFeedingVolume(payload.volume !== undefined ? String(payload.volume) : '')
      setEditFeedingMode(String(payload.mode || 'bottle'))
      setEditExcretionType(String(payload.excretion_type || 'unknown'))
      setEditSleepMinutes(payload.duration_minutes !== undefined ? String(payload.duration_minutes) : '')
      setEditWeightG(payload.weight_g !== undefined ? String(payload.weight_g) : '')
      setEditTemperatureC(payload.temperature_c !== undefined ? String(payload.temperature_c) : '')
      setEditMedicationName(String(payload.medication_name || ''))
      setEditMedicationDosage(String(payload.dosage || ''))
      setEditVaccineName(String(payload.vaccine_name || ''))
      setEditMilestoneText(String(payload.milestone || ''))
    } catch (error) {
      setEditingId('')
      Taro.showToast({ title: (error as Error).message || '加载事件详情失败', icon: 'none' })
    } finally {
      setIsEditingLoading(false)
    }
  }

  function buildEditedPayload(eventType: EventType): Record<string, unknown> | null {
    const nextPayload: Record<string, unknown> = { ...editPayloadBase }

    if (eventType === 'feeding') {
      const volume = Number(editFeedingVolume)
      if (!Number.isFinite(volume) || volume <= 0) {
        Taro.showToast({ title: '请输入有效喂养毫升数', icon: 'none' })
        return null
      }
      nextPayload.volume = volume
      nextPayload.mode = editFeedingMode || 'bottle'
      if (!nextPayload.unit) {
        nextPayload.unit = 'ml'
      }
      return nextPayload
    }

    if (eventType === 'excretion') {
      nextPayload.excretion_type = editExcretionType || 'unknown'
      return nextPayload
    }

    if (eventType === 'sleep') {
      const duration = Number(editSleepMinutes)
      if (!Number.isFinite(duration) || duration <= 0) {
        Taro.showToast({ title: '请输入有效睡眠分钟数', icon: 'none' })
        return null
      }
      nextPayload.duration_minutes = duration
      return nextPayload
    }

    if (eventType === 'measurement') {
      const hasWeight = Boolean(editWeightG.trim())
      const hasTemp = Boolean(editTemperatureC.trim())
      if (!hasWeight && !hasTemp) {
        Taro.showToast({ title: '请至少填写体重或体温', icon: 'none' })
        return null
      }

      if (hasWeight) {
        const weight = Number(editWeightG)
        if (!Number.isFinite(weight) || weight <= 0) {
          Taro.showToast({ title: '体重格式不正确', icon: 'none' })
          return null
        }
        nextPayload.weight_g = weight
      } else {
        delete nextPayload.weight_g
      }

      if (hasTemp) {
        const temperature = Number(editTemperatureC)
        if (!Number.isFinite(temperature) || temperature <= 0) {
          Taro.showToast({ title: '体温格式不正确', icon: 'none' })
          return null
        }
        nextPayload.temperature_c = temperature
      } else {
        delete nextPayload.temperature_c
      }
      return nextPayload
    }

    if (eventType === 'medication') {
      const medicationName = editMedicationName.trim()
      if (!medicationName) {
        Taro.showToast({ title: '请输入用药名称', icon: 'none' })
        return null
      }
      nextPayload.medication_name = medicationName
      if (editMedicationDosage.trim()) {
        nextPayload.dosage = editMedicationDosage.trim()
      } else {
        delete nextPayload.dosage
      }
      return nextPayload
    }

    if (eventType === 'vaccine') {
      const vaccineName = editVaccineName.trim()
      if (!vaccineName) {
        Taro.showToast({ title: '请输入疫苗名称', icon: 'none' })
        return null
      }
      nextPayload.vaccine_name = vaccineName
      return nextPayload
    }

    if (eventType === 'milestone') {
      const milestoneText = editMilestoneText.trim()
      if (!milestoneText) {
        Taro.showToast({ title: '请输入里程碑描述', icon: 'none' })
        return null
      }
      nextPayload.milestone = milestoneText
      return nextPayload
    }

    return nextPayload
  }

  async function handleEditSave(eventId: string, eventType: EventType): Promise<void> {
    const session = getSession()
    if (!session) {
      return
    }

    const nextPayload = buildEditedPayload(eventType)
    if (!nextPayload) {
      return
    }

    setIsEditingLoading(true)
    try {
      await updateEvent(session, eventId, {
        occurredAt: parseDateTimeToMs(editDate, editTime),
        notes: editNotes.trim() || undefined,
        payload: nextPayload
      })
      Taro.showToast({ title: '事件已更新', icon: 'success' })
      resetEditForm()
      await loadRecords()
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新失败', icon: 'none' })
    } finally {
      setIsEditingLoading(false)
    }
  }

  function renderPayloadEditor(eventType: EventType): JSX.Element {
    if (eventType === 'feeding') {
      return (
        <View>
          <Text className='form-label'>喂养毫升数</Text>
          <Input
            className='input'
            type='number'
            value={editFeedingVolume}
            onInput={(evt) => setEditFeedingVolume(evt.detail.value)}
            placeholder='例如 90'
          />
          <Text className='form-label'>喂养方式</Text>
          <View className='pill-row'>
            {FEEDING_MODE_OPTIONS.map((item) => (
              <View
                key={item.value}
                className={`pill ${editFeedingMode === item.value ? 'active' : ''}`}
                onClick={() => setEditFeedingMode(item.value)}
              >
                <Text>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )
    }

    if (eventType === 'excretion') {
      return (
        <View>
          <Text className='form-label'>排泄类型</Text>
          <View className='pill-row'>
            {['urine', 'stool', 'mixed', 'unknown'].map((item) => (
              <View
                key={item}
                className={`pill ${editExcretionType === item ? 'active' : ''}`}
                onClick={() => setEditExcretionType(item)}
              >
                <Text>{EXCRETION_LABEL_MAP[item]}</Text>
              </View>
            ))}
          </View>
        </View>
      )
    }

    if (eventType === 'sleep') {
      return (
        <View>
          <Text className='form-label'>睡眠分钟数</Text>
          <Input
            className='input'
            type='number'
            value={editSleepMinutes}
            onInput={(evt) => setEditSleepMinutes(evt.detail.value)}
            placeholder='例如 75'
          />
        </View>
      )
    }

    if (eventType === 'measurement') {
      return (
        <View>
          <Text className='form-label'>体重（g）</Text>
          <Input
            className='input'
            type='digit'
            value={editWeightG}
            onInput={(evt) => setEditWeightG(evt.detail.value)}
            placeholder='例如 6386'
          />
          <Text className='form-label'>体温（℃）</Text>
          <Input
            className='input'
            type='digit'
            value={editTemperatureC}
            onInput={(evt) => setEditTemperatureC(evt.detail.value)}
            placeholder='例如 36.7'
          />
        </View>
      )
    }

    if (eventType === 'medication') {
      return (
        <View>
          <Text className='form-label'>用药名称</Text>
          <Input
            className='input'
            value={editMedicationName}
            onInput={(evt) => setEditMedicationName(evt.detail.value)}
            placeholder='例如 维生素D'
          />
          <Text className='form-label'>剂量（可选）</Text>
          <Input
            className='input'
            value={editMedicationDosage}
            onInput={(evt) => setEditMedicationDosage(evt.detail.value)}
            placeholder='例如 400 IU'
          />
        </View>
      )
    }

    if (eventType === 'vaccine') {
      return (
        <View>
          <Text className='form-label'>疫苗名称</Text>
          <Input
            className='input'
            value={editVaccineName}
            onInput={(evt) => setEditVaccineName(evt.detail.value)}
            placeholder='例如 五联疫苗'
          />
        </View>
      )
    }

    return (
      <View>
        <Text className='form-label'>里程碑描述</Text>
        <Input
          className='input'
          value={editMilestoneText}
          onInput={(evt) => setEditMilestoneText(evt.detail.value)}
          placeholder='例如 今天会翻身了'
        />
      </View>
    )
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
      <View className='entry-row'>
        <Button className='entry-btn' onClick={() => Taro.navigateTo({ url: '/pages/quick-record/index' })}>
          新增记录
        </Button>
      </View>
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
            <Text className='muted'>当前筛选条件下没有记录，去“新增记录”创建第一条吧。</Text>
          </View>
        )}

        {events.map((event) => {
          const isEditingThis = editingId === event.id
          const isDeletingThis = deletingId === event.id
          const isActionLoading = isEditingLoading && isEditingThis

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
                  className={`icon-action ${isActionLoading ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isActionLoading || isDeletingThis) {
                      return
                    }
                    void handleEditStart(event.id)
                  }}
                >
                  <View className='icon-glyph icon-glyph-edit' />
                </View>
                <View
                  className={`icon-action danger ${isDeletingThis ? 'disabled' : ''}`}
                  onClick={() => {
                    if (isDeletingThis || isActionLoading) {
                      return
                    }
                    void handleDelete(event.id)
                  }}
                >
                  <View className='icon-glyph icon-glyph-delete' />
                </View>
              </View>

              {isEditingThis ? (
                <View className='edit-panel'>
                  <Text className='form-label'>发生日期</Text>
                  <Picker mode='date' value={editDate} onChange={(evt) => setEditDate(evt.detail.value)}>
                    <View className='input picker-like'>{editDate}</View>
                  </Picker>

                  <Text className='form-label'>发生时间</Text>
                  <Picker mode='time' value={editTime} onChange={(evt) => setEditTime(evt.detail.value)}>
                    <View className='input picker-like'>{editTime}</View>
                  </Picker>

                  {renderPayloadEditor(event.event_type)}

                  <Text className='form-label'>备注</Text>
                  <Input
                    className='input'
                    value={editNotes}
                    onInput={(evt) => setEditNotes(evt.detail.value)}
                    placeholder='可选备注'
                  />

                  <View className='edit-actions'>
                    <Button className='edit-btn cancel-btn' onClick={resetEditForm}>
                      取消
                    </Button>
                    <Button
                      className='edit-btn save-btn'
                      loading={isEditingLoading}
                      onClick={() => void handleEditSave(event.id, event.event_type)}
                    >
                      保存
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}
