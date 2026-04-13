import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'

import { EVENT_TYPE_LABEL_MAP, EXCRETION_LABEL_MAP, QUICK_EVENT_TYPES } from '@/constants/event'
import { createEvent } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { EventType } from '@/types/domain'
import { resolveTimezone } from '@/utils/time'

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

  const [feedingVolume, setFeedingVolume] = useState('90')
  const [excretionType, setExcretionType] = useState('urine')
  const [sleepMinutes, setSleepMinutes] = useState('60')
  const [weightG, setWeightG] = useState('4000')
  const [temperatureC, setTemperatureC] = useState('')
  const [medicationName, setMedicationName] = useState('')
  const [medicationDosage, setMedicationDosage] = useState('')
  const [vaccineName, setVaccineName] = useState('')
  const [milestoneText, setMilestoneText] = useState('')
  const [notes, setNotes] = useState('')

  async function submitQuickRecord(): Promise<void> {
    const session = getSession()
    const context = resolveContext()

    if (!session || !context) {
      Taro.showToast({ title: '请先在“我的”页面登录并选择宝宝', icon: 'none' })
      return
    }

    let payload: Record<string, unknown>

    if (quickType === 'feeding') {
      const volume = Number(feedingVolume)
      if (!Number.isFinite(volume) || volume <= 0) {
        Taro.showToast({ title: '请输入有效喂养毫升数', icon: 'none' })
        return
      }
      payload = {
        mode: 'bottle',
        volume,
        unit: 'ml'
      }
    } else if (quickType === 'excretion') {
      payload = {
        excretion_type: excretionType || 'unknown'
      }
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
        occurredAt: Date.now(),
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
        )}

        {quickType === 'excretion' && (
          <View className='form-item'>
            <Text className='form-label'>排泄类型</Text>
            <View className='pill-row'>
              {['urine', 'stool', 'mixed'].map((item) => (
                <View
                  key={item}
                  className={`pill ${excretionType === item ? 'active' : ''}`}
                  onClick={() => setExcretionType(item)}
                >
                  <Text>{EXCRETION_LABEL_MAP[item]}</Text>
                </View>
              ))}
            </View>
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

        <Button className='btn-primary' loading={isSubmitting} onClick={submitQuickRecord}>
          提交 {EVENT_TYPE_LABEL_MAP[quickType]} 记录
        </Button>

        <View className='helper-actions'>
          <Button className='link-btn' plain onClick={() => Taro.switchTab({ url: '/pages/records/index' })}>
            去记录页查看
          </Button>
        </View>
      </View>
    </View>
  )
}
