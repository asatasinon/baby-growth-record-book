import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

import {
  EVENT_TYPE_LABEL_MAP,
  EXCRETION_TYPE_OPTIONS,
  FEEDING_TYPE_OPTIONS,
  QUICK_EVENT_TYPES,
  STOOL_COLOR_OPTIONS,
  STOOL_TEXTURE_OPTIONS
} from '@/constants/event'
import { createEvent } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { EventType } from '@/types/domain'
import { DAY_MS, MINUTE_MS, formatDate, formatTime, parseDateTimeToMs, resolveTimezone } from '@/utils/time'

import './index.scss'

function resolveContext():
  | {
      familyId: string
      babyId: string
    }
  | null {
  const session = getSession()
  const familyId = getActiveFamilyId(session || undefined)
  const babyId = getActiveBabyId()

  if (!session || !familyId || !babyId) {
    return null
  }

  return {
    familyId,
    babyId
  }
}

export default function QuickRecordPage() {
  const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quickType, setQuickType] = useState<EventType>('feeding')

  const [feedingType, setFeedingType] = useState<(typeof FEEDING_TYPE_OPTIONS)[number]['value']>('formula_bottle')
  const [feedingVolume, setFeedingVolume] = useState('90')
  const [feedingStartDate, setFeedingStartDate] = useState(() => formatDate(Date.now() - 15 * MINUTE_MS))
  const [feedingStartTime, setFeedingStartTime] = useState(() => formatTime(Date.now() - 15 * MINUTE_MS))
  const [feedingEndDate, setFeedingEndDate] = useState(() => formatDate(Date.now()))
  const [feedingEndTime, setFeedingEndTime] = useState(() => formatTime(Date.now()))
  const [excretionTypes, setExcretionTypes] = useState<Array<(typeof EXCRETION_TYPE_OPTIONS)[number]['value']>>([
    'urine'
  ])
  const [stoolColor, setStoolColor] = useState<string>('')
  const [stoolTexture, setStoolTexture] = useState<string>('')
  const [sleepMinutes, setSleepMinutes] = useState('60')
  const [weightG, setWeightG] = useState('4000')
  const [temperatureC, setTemperatureC] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [medicationDosage, setMedicationDosage] = useState('')
  const [vaccineName, setVaccineName] = useState('')
  const [milestoneText, setMilestoneText] = useState('')
  const [notes, setNotes] = useState('')

  function isBottleFeedingType(type: (typeof FEEDING_TYPE_OPTIONS)[number]['value']): boolean {
    return type === 'formula_bottle' || type === 'breast_bottle'
  }

  function toggleExcretionType(type: (typeof EXCRETION_TYPE_OPTIONS)[number]['value']): void {
    setExcretionTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type)
      }
      return [...prev, type]
    })
  }

  function resolveFeedingDurationMinutes(startAt: number, endAt: number): number {
    return Math.max(1, Math.round((endAt - startAt) / MINUTE_MS))
  }

  function normalizeEndAt(startAt: number, endAt: number): number {
    if (endAt > startAt) {
      return endAt
    }
    return endAt + DAY_MS
  }

  async function submitQuickRecord(): Promise<void> {
    const session = getSession()
    const context = resolveContext()

    if (!session || !context) {
      Taro.showToast({ title: '请先在“我的”页面登录并选择宝宝', icon: 'none' })
      return
    }

    let payload: Record<string, unknown>
    let occurredAt = Date.now()
    let startAt: number | undefined
    let endAt: number | undefined

    if (quickType === 'feeding') {
      const rawStartAt = parseDateTimeToMs(feedingStartDate, feedingStartTime)
      const rawEndAt = parseDateTimeToMs(feedingEndDate, feedingEndTime)
      const normalizedEndAt = normalizeEndAt(rawStartAt, rawEndAt)
      if (normalizedEndAt <= rawStartAt) {
        Taro.showToast({ title: '喂养结束时间必须晚于开始时间', icon: 'none' })
        return
      }

      const duration = resolveFeedingDurationMinutes(rawStartAt, normalizedEndAt)

      const nextPayload: Record<string, unknown> = {
        feeding_type: feedingType,
        mode: feedingType,
        duration_minutes: duration
      }

      if (isBottleFeedingType(feedingType)) {
        const volume = Number(feedingVolume)
        if (!Number.isFinite(volume) || volume <= 0) {
          Taro.showToast({ title: '请输入有效喂养毫升数', icon: 'none' })
          return
        }
        nextPayload.volume = volume
        nextPayload.unit = 'ml'
      }

      payload = nextPayload
      startAt = rawStartAt
      endAt = normalizedEndAt
      occurredAt = normalizedEndAt
    } else if (quickType === 'excretion') {
      if (excretionTypes.length === 0) {
        Taro.showToast({ title: '请至少选择一种排泄类型', icon: 'none' })
        return
      }

      setIsSubmitting(true)
      try {
        await Promise.all(
          excretionTypes.map((excretionType) => {
            const excretionPayload: Record<string, unknown> = {
              excretion_type: excretionType,
              timezone: resolveTimezone()
            }
            if (excretionType === 'stool') {
              if (stoolColor) excretionPayload.color = stoolColor
              if (stoolTexture) excretionPayload.texture = stoolTexture
            }
            return createEvent({
              session,
              familyId: context.familyId,
              babyId: context.babyId,
              eventType: quickType,
              occurredAt,
              notes: notes.trim() || undefined,
              payload: excretionPayload
            })
          })
        )

        setNotes('')
        Taro.showToast({ title: `记录成功（${excretionTypes.length} 条）`, icon: 'success' })
      } catch (error) {
        Taro.showToast({ title: (error as Error).message || '记录失败', icon: 'none' })
      } finally {
        setIsSubmitting(false)
      }
      return
    } else if (quickType === 'sleep') {
      const duration = Number(sleepMinutes)
      if (!Number.isFinite(duration) || duration <= 0) {
        Taro.showToast({ title: '请输入有效睡眠分钟数', icon: 'none' })
        return
      }
      payload = {
        duration_minutes: duration
      }
    } else if (quickType === 'measurement') {
      const nextPayload: Record<string, unknown> = {}
      const weight = Number(weightG)
      if (Number.isFinite(weight) && weight > 0) {
        nextPayload.weight_g = weight
      }
      const temperature = Number(temperatureC)
      if (Number.isFinite(temperature) && temperature > 0) {
        nextPayload.temperature_c = temperature
      }

      if (Object.keys(nextPayload).length === 0) {
        Taro.showToast({ title: '请至少填写体重或体温', icon: 'none' })
        return
      }
      payload = nextPayload
    } else if (quickType === 'medication') {
      const finalName = medicationName.trim()
      if (!finalName) {
        Taro.showToast({ title: '请输入用药名称', icon: 'none' })
        return
      }
      payload = {
        medication_name: finalName,
        dosage: medicationDosage.trim() || undefined
      }
    } else if (quickType === 'vaccine') {
      const finalName = vaccineName.trim()
      if (!finalName) {
        Taro.showToast({ title: '请输入疫苗名称', icon: 'none' })
        return
      }
      payload = {
        vaccine_name: finalName
      }
    } else {
      const milestone = milestoneText.trim()
      if (!milestone) {
        Taro.showToast({ title: '请输入里程碑描述', icon: 'none' })
        return
      }
      payload = {
        milestone
      }
    }

    setIsSubmitting(true)
    try {
      await createEvent({
        session,
        familyId: context.familyId,
        babyId: context.babyId,
        eventType: quickType,
        occurredAt,
        startAt,
        endAt,
        notes: notes.trim() || undefined,
        payload: {
          ...payload,
          timezone: resolveTimezone()
        }
      })

      setNotes('')
      if (quickType === 'medication') {
        setMedicationName('')
        setMedicationDosage('')
      }
      if (quickType === 'feeding') {
        const now = Date.now()
        setFeedingType('formula_bottle')
        setFeedingStartDate(formatDate(now - 15 * MINUTE_MS))
        setFeedingStartTime(formatTime(now - 15 * MINUTE_MS))
        setFeedingEndDate(formatDate(now))
        setFeedingEndTime(formatTime(now))
      }
      if (quickType === 'vaccine') {
        setVaccineName('')
      }
      if (quickType === 'milestone') {
        setMilestoneText('')
      }
      Taro.showToast({ title: '记录成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '记录失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function navigateBackOrHome(): void {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack({ delta: 1 })
      return
    }
    void Taro.switchTab({ url: '/pages/home/index' })
  }

  if (!resolveContext()) {
    return (
      <View className='page-shell quick-record-page'>
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
    <View className='page-shell quick-record-page'>
      {isWeb ? (
        <View className='card subpage-nav'>
          <View className='subpage-back-btn' onClick={navigateBackOrHome}>
            <View className='subpage-back-icon' />
            <Text>返回</Text>
          </View>
          <Text className='subpage-nav-title'>快速记录</Text>
          <View />
        </View>
      ) : null}

      <Text className='section-title'>新增记录</Text>
      <View className='card record-card'>
        <Text className='form-label'>事件类型</Text>
        <View className='pill-row type-row'>
          {QUICK_EVENT_TYPES.map((type) => (
            <View key={type} className={`pill ${quickType === type ? 'active' : ''}`} onClick={() => setQuickType(type)}>
              <Text>{EVENT_TYPE_LABEL_MAP[type]}</Text>
            </View>
          ))}
        </View>

        {quickType === 'feeding' && (
          <View>
            <View className='form-item'>
              <Text className='form-label'>喂养类型</Text>
              <View className='pill-row'>
                {FEEDING_TYPE_OPTIONS.map((item) => (
                  <View
                    key={item.value}
                    className={`pill ${feedingType === item.value ? 'active' : ''}`}
                    onClick={() => setFeedingType(item.value)}
                  >
                    <Text>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {isBottleFeedingType(feedingType) ? (
              <View className='form-item'>
                <Text className='form-label'>喂养毫升数</Text>
                <Input
                  className='input'
                  type='number'
                  value={feedingVolume}
                  onInput={(event) => setFeedingVolume(event.detail.value)}
                  placeholder='例如 90'
                />
              </View>
            ) : null}

            <View className='form-item'>
              <Text className='form-label'>开始日期</Text>
              <Picker mode='date' value={feedingStartDate} onChange={(event) => setFeedingStartDate(event.detail.value)}>
                <View className='input picker-like'>{feedingStartDate}</View>
              </Picker>
            </View>

            <View className='form-item'>
              <Text className='form-label'>开始时间</Text>
              <Picker mode='time' value={feedingStartTime} onChange={(event) => setFeedingStartTime(event.detail.value)}>
                <View className='input picker-like'>{feedingStartTime}</View>
              </Picker>
            </View>

            <View className='form-item'>
              <Text className='form-label'>结束日期</Text>
              <Picker mode='date' value={feedingEndDate} onChange={(event) => setFeedingEndDate(event.detail.value)}>
                <View className='input picker-like'>{feedingEndDate}</View>
              </Picker>
            </View>

            <View className='form-item'>
              <Text className='form-label'>结束时间</Text>
              <Picker mode='time' value={feedingEndTime} onChange={(event) => setFeedingEndTime(event.detail.value)}>
                <View className='input picker-like'>{feedingEndTime}</View>
              </Picker>
            </View>

            <Text className='muted'>
              当前时长：
              {resolveFeedingDurationMinutes(
                parseDateTimeToMs(feedingStartDate, feedingStartTime),
                normalizeEndAt(parseDateTimeToMs(feedingStartDate, feedingStartTime), parseDateTimeToMs(feedingEndDate, feedingEndTime))
              )}{' '}
              分钟
            </Text>
          </View>
        )}

        {quickType === 'excretion' && (
          <View>
            <View className='form-item'>
              <Text className='form-label'>排泄类型</Text>
              <View className='pill-row'>
                {EXCRETION_TYPE_OPTIONS.map((item) => (
                  <View
                    key={item.value}
                    className={`pill ${excretionTypes.includes(item.value) ? 'active' : ''}`}
                    onClick={() => toggleExcretionType(item.value)}
                  >
                    <Text>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='muted'>可多选，多选会一次创建多条记录。</Text>
            </View>

            {excretionTypes.includes('stool') && (
              <View>
                <View className='form-item'>
                  <Text className='form-label'>大便颜色（可选）</Text>
                  <View className='pill-row'>
                    {STOOL_COLOR_OPTIONS.map((item) => (
                      <View
                        key={item.value}
                        className={`pill ${stoolColor === item.value ? 'active' : ''}`}
                        onClick={() => setStoolColor((prev) => (prev === item.value ? '' : item.value))}
                      >
                        <Text>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className='form-item'>
                  <Text className='form-label'>大便状态（可选）</Text>
                  <View className='pill-row'>
                    {STOOL_TEXTURE_OPTIONS.map((item) => (
                      <View
                        key={item.value}
                        className={`pill ${stoolTexture === item.value ? 'active' : ''}`}
                        onClick={() => setStoolTexture((prev) => (prev === item.value ? '' : item.value))}
                      >
                        <Text>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {quickType === 'sleep' && (
          <View className='form-item'>
            <Text className='form-label'>睡眠分钟数</Text>
            <Input
              className='input'
              type='number'
              value={sleepMinutes}
              onInput={(event) => setSleepMinutes(event.detail.value)}
              placeholder='例如 75'
            />
          </View>
        )}

        {quickType === 'measurement' && (
          <View>
            <View className='form-item'>
              <Text className='form-label'>体重（g）</Text>
              <Input
                className='input'
                type='number'
                value={weightG}
                onInput={(event) => setWeightG(event.detail.value)}
                placeholder='例如 5300'
              />
            </View>
            <View className='form-item'>
              <Text className='form-label'>体温（℃，可选）</Text>
              <Input
                className='input'
                type='digit'
                value={temperatureC}
                onInput={(event) => setTemperatureC(event.detail.value)}
                placeholder='例如 36.7'
              />
            </View>
          </View>
        )}

        {quickType === 'medication' && (
          <View>
            <View className='form-item'>
              <Text className='form-label'>用药名称</Text>
              <Input
                className='input'
                value={medicationName}
                onInput={(event) => setMedicationName(event.detail.value)}
                placeholder='例如 维生素D'
              />
            </View>
            <View className='form-item'>
              <Text className='form-label'>剂量（可选）</Text>
              <Input
                className='input'
                value={medicationDosage}
                onInput={(event) => setMedicationDosage(event.detail.value)}
                placeholder='例如 400 IU'
              />
            </View>
          </View>
        )}

        {quickType === 'vaccine' && (
          <View className='form-item'>
            <Text className='form-label'>疫苗名称</Text>
            <Input
              className='input'
              value={vaccineName}
              onInput={(event) => setVaccineName(event.detail.value)}
              placeholder='例如 五联疫苗'
            />
          </View>
        )}

        {quickType === 'milestone' && (
          <View className='form-item'>
            <Text className='form-label'>里程碑描述</Text>
            <Input
              className='input'
              value={milestoneText}
              onInput={(event) => setMilestoneText(event.detail.value)}
              placeholder='例如 今天会翻身了'
            />
          </View>
        )}

        <View className='form-item'>
          <Text className='form-label'>备注（可选）</Text>
          <Input
            className='input'
            value={notes}
            onInput={(event) => setNotes(event.detail.value)}
            placeholder='例如 夜间喂养'
          />
        </View>

        <View className='form-actions'>
          <Button className='btn-secondary' disabled={isSubmitting} onClick={navigateBackOrHome}>
            取消
          </Button>
          <Button className='btn-primary' loading={isSubmitting} onClick={submitQuickRecord}>
            保存
          </Button>
        </View>
      </View>
    </View>
  )
}
