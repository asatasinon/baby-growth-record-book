import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

import {
  EVENT_TYPE_COLOR_MAP,
  EVENT_TYPE_LABEL_MAP,
  EXCRETION_LABEL_MAP,
  FEEDING_TYPE_OPTIONS
} from '@/constants/event'
import { getEvent, updateEvent } from '@/services/api'
import { getSession } from '@/services/storage'
import type { EventType } from '@/types/domain'
import { DAY_MS, MINUTE_MS, formatDate, formatTime, parseDateTimeToMs } from '@/utils/time'

import './index.scss'

type FeedingTypeValue = (typeof FEEDING_TYPE_OPTIONS)[number]['value']

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

function normalizeEndAt(startAt: number, endAt: number): number {
  if (endAt > startAt) {
    return endAt
  }
  return endAt + DAY_MS
}

export default function UpdateRecordPage() {
  const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB
  const [eventId, setEventId] = useState('')
  const [eventType, setEventType] = useState<EventType>('feeding')
  const [isLoadingDetail, setIsLoadingDetail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editDate, setEditDate] = useState(formatDate(Date.now()))
  const [editTime, setEditTime] = useState(formatTime(Date.now()))
  const [editNotes, setEditNotes] = useState('')
  const [editPayloadBase, setEditPayloadBase] = useState<Record<string, unknown>>({})

  const [editFeedingVolume, setEditFeedingVolume] = useState('')
  const [editFeedingType, setEditFeedingType] = useState<FeedingTypeValue>('formula_bottle')
  const [editFeedingStartDate, setEditFeedingStartDate] = useState(formatDate(Date.now() - 15 * MINUTE_MS))
  const [editFeedingStartTime, setEditFeedingStartTime] = useState(formatTime(Date.now() - 15 * MINUTE_MS))
  const [editExcretionType, setEditExcretionType] = useState('unknown')
  const [editSleepMinutes, setEditSleepMinutes] = useState('')
  const [editWeightG, setEditWeightG] = useState('')
  const [editTemperatureC, setEditTemperatureC] = useState('')
  const [editMedicationName, setEditMedicationName] = useState('')
  const [editMedicationDosage, setEditMedicationDosage] = useState('')
  const [editVaccineName, setEditVaccineName] = useState('')
  const [editMilestoneText, setEditMilestoneText] = useState('')

  async function loadEventDetail(nextEventId: string): Promise<void> {
    const session = getSession()
    if (!session) {
      setIsLoadingDetail(false)
      return
    }

    setIsLoadingDetail(true)
    try {
      const detail = await getEvent(session, nextEventId)
      const payload = detail.payload || {}
      const endAt = detail.end_at || detail.occurred_at
      const startAt = detail.start_at || endAt - 15 * MINUTE_MS

      setEventType(detail.event_type)
      setEditDate(formatDate(endAt))
      setEditTime(formatTime(endAt))
      setEditNotes(detail.notes || '')
      setEditPayloadBase(payload)

      setEditFeedingVolume(payload.volume !== undefined ? String(payload.volume) : '')
      setEditFeedingType(resolveFeedingType(payload))
      setEditFeedingStartDate(formatDate(startAt))
      setEditFeedingStartTime(formatTime(startAt))
      setEditExcretionType(String(payload.excretion_type || 'unknown'))
      setEditSleepMinutes(payload.duration_minutes !== undefined ? String(payload.duration_minutes) : '')
      setEditWeightG(payload.weight_g !== undefined ? String(payload.weight_g) : '')
      setEditTemperatureC(payload.temperature_c !== undefined ? String(payload.temperature_c) : '')
      setEditMedicationName(String(payload.medication_name || ''))
      setEditMedicationDosage(String(payload.dosage || ''))
      setEditVaccineName(String(payload.vaccine_name || ''))
      setEditMilestoneText(String(payload.milestone || ''))
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载事件详情失败', icon: 'none' })
    } finally {
      setIsLoadingDetail(false)
    }
  }

  useLoad((options) => {
    const nextEventId = options?.eventId ? String(options.eventId) : ''
    setEventId(nextEventId)
    if (!nextEventId) {
      setIsLoadingDetail(false)
      Taro.showToast({ title: '缺少记录 ID', icon: 'none' })
      return
    }
    void loadEventDetail(nextEventId)
  })

  function buildEditedPayload(): {
    payload: Record<string, unknown>
    occurredAt: number
    startAt?: number
    endAt?: number
  } | null {
    const nextPayload: Record<string, unknown> = { ...editPayloadBase }
    const defaultOccurredAt = parseDateTimeToMs(editDate, editTime)

    if (eventType === 'feeding') {
      const startAt = parseDateTimeToMs(editFeedingStartDate, editFeedingStartTime)
      const rawEndAt = parseDateTimeToMs(editDate, editTime)
      const endAt = normalizeEndAt(startAt, rawEndAt)
      if (endAt <= startAt) {
        Taro.showToast({ title: '喂养结束时间必须晚于开始时间', icon: 'none' })
        return null
      }

      if (isBottleFeedingType(editFeedingType)) {
        const volume = Number(editFeedingVolume)
        if (!Number.isFinite(volume) || volume <= 0) {
          Taro.showToast({ title: '请输入有效喂养毫升数', icon: 'none' })
          return null
        }
        nextPayload.volume = volume
        nextPayload.unit = 'ml'
      } else {
        delete nextPayload.volume
        delete nextPayload.unit
      }
      nextPayload.feeding_type = editFeedingType
      nextPayload.mode = editFeedingType
      nextPayload.duration_minutes = Math.max(1, Math.round((endAt - startAt) / MINUTE_MS))
      return { payload: nextPayload, occurredAt: endAt, startAt, endAt }
    }

    if (eventType === 'excretion') {
      nextPayload.excretion_type = editExcretionType || 'unknown'
      return { payload: nextPayload, occurredAt: defaultOccurredAt }
    }

    if (eventType === 'sleep') {
      const duration = Number(editSleepMinutes)
      if (!Number.isFinite(duration) || duration <= 0) {
        Taro.showToast({ title: '请输入有效睡眠分钟数', icon: 'none' })
        return null
      }
      nextPayload.duration_minutes = duration
      return { payload: nextPayload, occurredAt: defaultOccurredAt }
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
      return { payload: nextPayload, occurredAt: defaultOccurredAt }
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
      return { payload: nextPayload, occurredAt: defaultOccurredAt }
    }

    if (eventType === 'vaccine') {
      const vaccineName = editVaccineName.trim()
      if (!vaccineName) {
        Taro.showToast({ title: '请输入疫苗名称', icon: 'none' })
        return null
      }
      nextPayload.vaccine_name = vaccineName
      return { payload: nextPayload, occurredAt: defaultOccurredAt }
    }

    const milestoneText = editMilestoneText.trim()
    if (!milestoneText) {
      Taro.showToast({ title: '请输入里程碑描述', icon: 'none' })
      return null
    }
    nextPayload.milestone = milestoneText
    return { payload: nextPayload, occurredAt: defaultOccurredAt }
  }

  function navigateBackOrRecords(): void {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack({ delta: 1 })
      return
    }
    void Taro.switchTab({ url: '/pages/records/index' })
  }

  async function handleSubmit(): Promise<void> {
    const session = getSession()
    if (!session) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    if (!eventId) {
      Taro.showToast({ title: '缺少记录 ID', icon: 'none' })
      return
    }

    const edited = buildEditedPayload()
    if (!edited) {
      return
    }

    setIsSubmitting(true)
    try {
      await updateEvent(session, eventId, {
        occurredAt: edited.occurredAt,
        startAt: edited.startAt,
        endAt: edited.endAt,
        notes: editNotes.trim() || undefined,
        payload: edited.payload
      })
      Taro.showToast({ title: '记录已更新', icon: 'success' })
      setTimeout(() => {
        navigateBackOrRecords()
      }, 300)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!eventId && !isLoadingDetail) {
    return (
      <View className='page-shell update-record-page'>
        <View className='card empty-card'>
          <Text className='muted'>未找到要更新的记录，请从记录列表进入。</Text>
          <Button className='btn-primary' onClick={navigateBackOrRecords}>
            返回记录页
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell update-record-page'>
      {isWeb ? (
        <View className='card subpage-nav'>
          <View className='subpage-back-btn' onClick={navigateBackOrRecords}>
            <View className='subpage-back-icon' />
            <Text>返回</Text>
          </View>
          <Text className='subpage-nav-title'>更新记录</Text>
          <View />
        </View>
      ) : null}

      <Text className='section-title'>更新记录</Text>

      {isLoadingDetail ? (
        <View className='card empty-card'>
          <Text className='muted'>加载记录中...</Text>
        </View>
      ) : (
        <View className='card record-card'>
          <View className='event-type-bar'>
            <Text className='muted'>事件类型</Text>
            <Text className='inline-tag' style={{ backgroundColor: EVENT_TYPE_COLOR_MAP[eventType] }}>
              {EVENT_TYPE_LABEL_MAP[eventType]}
            </Text>
          </View>

          {eventType === 'feeding' ? (
            <View>
              <View className='form-item'>
                <Text className='form-label'>喂养类型</Text>
                <View className='pill-row'>
                  {FEEDING_TYPE_OPTIONS.map((item) => (
                    <View
                      key={item.value}
                      className={`pill ${editFeedingType === item.value ? 'active' : ''}`}
                      onClick={() => setEditFeedingType(item.value)}
                    >
                      <Text>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {isBottleFeedingType(editFeedingType) ? (
                <View className='form-item'>
                  <Text className='form-label'>喂养毫升数</Text>
                  <Input
                    className='input'
                    type='number'
                    value={editFeedingVolume}
                    onInput={(event) => setEditFeedingVolume(event.detail.value)}
                    placeholder='例如 90'
                  />
                </View>
              ) : null}

              <View className='form-item'>
                <Text className='form-label'>开始日期</Text>
                <Picker mode='date' value={editFeedingStartDate} onChange={(event) => setEditFeedingStartDate(event.detail.value)}>
                  <View className='input picker-like'>{editFeedingStartDate}</View>
                </Picker>
              </View>

              <View className='form-item'>
                <Text className='form-label'>开始时间</Text>
                <Picker mode='time' value={editFeedingStartTime} onChange={(event) => setEditFeedingStartTime(event.detail.value)}>
                  <View className='input picker-like'>{editFeedingStartTime}</View>
                </Picker>
              </View>
            </View>
          ) : null}

          {eventType === 'excretion' ? (
            <View className='form-item'>
              <Text className='form-label'>排泄类型</Text>
              <View className='pill-row'>
                {['urine', 'stool', 'unknown', ...(editExcretionType === 'mixed' ? ['mixed'] : [])].map((item) => (
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
          ) : null}

          {eventType === 'sleep' ? (
            <View className='form-item'>
              <Text className='form-label'>睡眠分钟数</Text>
              <Input
                className='input'
                type='number'
                value={editSleepMinutes}
                onInput={(event) => setEditSleepMinutes(event.detail.value)}
                placeholder='例如 75'
              />
            </View>
          ) : null}

          {eventType === 'measurement' ? (
            <View>
              <View className='form-item'>
                <Text className='form-label'>体重（g）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={editWeightG}
                  onInput={(event) => setEditWeightG(event.detail.value)}
                  placeholder='例如 6386'
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>体温（℃）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={editTemperatureC}
                  onInput={(event) => setEditTemperatureC(event.detail.value)}
                  placeholder='例如 36.7'
                />
              </View>
            </View>
          ) : null}

          {eventType === 'medication' ? (
            <View>
              <View className='form-item'>
                <Text className='form-label'>用药名称</Text>
                <Input
                  className='input'
                  value={editMedicationName}
                  onInput={(event) => setEditMedicationName(event.detail.value)}
                  placeholder='例如 维生素D'
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>剂量（可选）</Text>
                <Input
                  className='input'
                  value={editMedicationDosage}
                  onInput={(event) => setEditMedicationDosage(event.detail.value)}
                  placeholder='例如 400 IU'
                />
              </View>
            </View>
          ) : null}

          {eventType === 'vaccine' ? (
            <View className='form-item'>
              <Text className='form-label'>疫苗名称</Text>
              <Input
                className='input'
                value={editVaccineName}
                onInput={(event) => setEditVaccineName(event.detail.value)}
                placeholder='例如 五联疫苗'
              />
            </View>
          ) : null}

          {eventType === 'milestone' ? (
            <View className='form-item'>
              <Text className='form-label'>里程碑描述</Text>
              <Input
                className='input'
                value={editMilestoneText}
                onInput={(event) => setEditMilestoneText(event.detail.value)}
                placeholder='例如 今天会翻身了'
              />
            </View>
          ) : null}

          <View className='form-item'>
            <Text className='form-label'>{eventType === 'feeding' ? '结束日期' : '发生日期'}</Text>
            <Picker mode='date' value={editDate} onChange={(event) => setEditDate(event.detail.value)}>
              <View className='input picker-like'>{editDate}</View>
            </Picker>
          </View>

          <View className='form-item'>
            <Text className='form-label'>{eventType === 'feeding' ? '结束时间' : '发生时间'}</Text>
            <Picker mode='time' value={editTime} onChange={(event) => setEditTime(event.detail.value)}>
              <View className='input picker-like'>{editTime}</View>
            </Picker>
          </View>

          <View className='form-item'>
            <Text className='form-label'>备注（可选）</Text>
            <Input
              className='input'
              value={editNotes}
              onInput={(event) => setEditNotes(event.detail.value)}
              placeholder='可选备注'
            />
          </View>

          <Button className='btn-primary' loading={isSubmitting} onClick={handleSubmit}>
            保存更新
          </Button>

          <Button className='back-btn' plain onClick={navigateBackOrRecords}>
            取消并返回
          </Button>
        </View>
      )}
    </View>
  )
}
