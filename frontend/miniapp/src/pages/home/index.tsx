import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'

import { EVENT_TYPE_LABEL_MAP, EXCRETION_LABEL_MAP, QUICK_EVENT_TYPES } from '@/constants/event'
import { createEvent, getDailySummary, getMonthlySummary, getWeeklySummary } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { DailySummary, EventType, PeriodSummaryPayload } from '@/types/domain'
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  resolveTimezone,
  startOfDayMs,
  startOfMonthMs,
  startOfWeekMs
} from '@/utils/time'

import './index.scss'

interface ReadyContext {
  sessionToken: string
  familyId: string
  babyId: string
}

function resolveReadyContext(): ReadyContext | null {
  const session = getSession()
  if (!session) {
    return null
  }

  const familyId = getActiveFamilyId(session)
  const babyId = getActiveBabyId()

  if (!familyId || !babyId) {
    return null
  }

  return {
    sessionToken: session.access_token,
    familyId,
    babyId
  }
}

export default function HomePage() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPeriodLoading, setIsPeriodLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quickType, setQuickType] = useState<EventType>('feeding')
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly')
  const [weeklySummary, setWeeklySummary] = useState<PeriodSummaryPayload | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<PeriodSummaryPayload | null>(null)

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

  async function loadSummary(): Promise<void> {
    const context = resolveReadyContext()
    if (!context) {
      setSummary(null)
      return
    }

    const session = getSession()
    if (!session) {
      return
    }

    setIsLoading(true)
    try {
      const data = await getDailySummary({
        session,
        familyId: context.familyId,
        babyId: context.babyId,
        date: startOfDayMs()
      })
      setSummary(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载今日汇总失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadSummary()
    void loadPeriodSummary()
  })

  async function loadPeriodSummary(): Promise<void> {
    const context = resolveReadyContext()
    if (!context) {
      setWeeklySummary(null)
      setMonthlySummary(null)
      return
    }

    const session = getSession()
    if (!session) {
      return
    }

    setIsPeriodLoading(true)
    try {
      const [weekly, monthly] = await Promise.all([
        getWeeklySummary({
          session,
          familyId: context.familyId,
          babyId: context.babyId,
          weekStart: startOfWeekMs()
        }),
        getMonthlySummary({
          session,
          familyId: context.familyId,
          babyId: context.babyId,
          monthStart: startOfMonthMs()
        })
      ])

      setWeeklySummary(weekly.summary_payload)
      setMonthlySummary(monthly.summary_payload)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载周/月汇总失败', icon: 'none' })
    } finally {
      setIsPeriodLoading(false)
    }
  }

  const latestWeightText = useMemo(() => {
    const weight = summary?.last_measurement_snapshot?.weight_g
    if (typeof weight === 'number') {
      return `${weight} g`
    }
    if (typeof weight === 'string' && weight.trim()) {
      return `${weight} g`
    }
    return '暂无'
  }, [summary])

  async function submitQuickRecord(): Promise<void> {
    const session = getSession()
    const context = resolveReadyContext()

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
      await Promise.all([loadSummary(), loadPeriodSummary()])
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '记录失败', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const periodSummary = periodType === 'weekly' ? weeklySummary : monthlySummary

  if (!resolveReadyContext()) {
    return (
      <View className='page-shell home-page'>
        <View className='card empty-card'>
          <Text className='empty-title'>先完成登录与宝宝选择</Text>
          <Text className='muted'>MVP 已接入真实 API，请在“我的”页面先登录并创建或选择宝宝。</Text>
          <Button className='btn-primary' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
            前往我的
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell home-page'>
      <View className='card summary-card'>
        <View className='h-stack'>
          <Text className='summary-title'>今日摘要</Text>
          <Text className='muted'>{isLoading ? '加载中...' : '实时更新'}</Text>
        </View>
        <View className='metrics-grid'>
          <View className='metric-item'>
            <Text className='metric-label'>喂养总量</Text>
            <Text className='metric-value'>{summary?.feeding_total_ml ?? 0} ml</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>排泄次数</Text>
            <Text className='metric-value'>{summary?.excretion_count_total ?? 0} 次</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>睡眠时长</Text>
            <Text className='metric-value'>{formatMinutes(summary?.sleep_total_minutes ?? 0)}</Text>
          </View>
          <View className='metric-item'>
            <Text className='metric-label'>最近体重</Text>
            <Text className='metric-value'>{latestWeightText}</Text>
          </View>
        </View>
      </View>

      <Text className='section-title'>周/月汇总</Text>
      <View className='pill-row'>
        <View
          className={`pill ${periodType === 'weekly' ? 'active' : ''}`}
          onClick={() => setPeriodType('weekly')}
        >
          <Text>本周</Text>
        </View>
        <View
          className={`pill ${periodType === 'monthly' ? 'active' : ''}`}
          onClick={() => setPeriodType('monthly')}
        >
          <Text>本月</Text>
        </View>
      </View>
      <View className='card period-card'>
        {isPeriodLoading ? (
          <Text className='muted'>周/月汇总加载中...</Text>
        ) : periodSummary ? (
          <View>
            <Text className='muted'>
              {periodType === 'weekly'
                ? `周起始：${formatDate(startOfWeekMs())}`
                : `月份：${formatDate(startOfMonthMs()).slice(0, 7)}`}
            </Text>
            <View className='metrics-grid'>
              <View className='metric-item'>
                <Text className='metric-label'>喂养总量</Text>
                <Text className='metric-value'>{periodSummary.feeding_total_ml} ml</Text>
              </View>
              <View className='metric-item'>
                <Text className='metric-label'>排泄次数</Text>
                <Text className='metric-value'>{periodSummary.excretion_count_total} 次</Text>
              </View>
              <View className='metric-item'>
                <Text className='metric-label'>睡眠时长</Text>
                <Text className='metric-value'>{formatMinutes(periodSummary.sleep_total_minutes)}</Text>
              </View>
              <View className='metric-item'>
                <Text className='metric-label'>最近体重</Text>
                <Text className='metric-value'>
                  {typeof periodSummary.last_measurement_snapshot?.weight_g === 'number'
                    ? `${periodSummary.last_measurement_snapshot.weight_g} g`
                    : '暂无'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <Text className='muted'>当前周期暂无汇总数据。</Text>
        )}
      </View>

      <Text className='section-title'>快速记录</Text>
      <View className='pill-row'>
        {QUICK_EVENT_TYPES.map((type) => (
          <View
            key={type}
            className={`pill ${quickType === type ? 'active' : ''}`}
            onClick={() => setQuickType(type)}
          >
            <Text>{EVENT_TYPE_LABEL_MAP[type]}</Text>
          </View>
        ))}
      </View>

      <View className='card quick-form-card'>
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
      </View>

      <Text className='section-title'>提醒</Text>
      <View className='card alerts-card'>
        {summary?.alerts?.length ? (
          summary.alerts.slice(0, 3).map((alert) => (
            <View key={alert.id} className='alert-item'>
              <Text className='alert-title'>{alert.title}</Text>
              <Text className='muted'>{formatDateTime(alert.triggered_at)}</Text>
            </View>
          ))
        ) : (
          <Text className='muted'>当前没有提醒，继续保持。</Text>
        )}

        <View className='quick-nav-row'>
          <Button plain size='mini' onClick={() => Taro.navigateTo({ url: '/pages/alerts/index' })}>
            查看全部提醒
          </Button>
          <Button plain size='mini' onClick={() => Taro.navigateTo({ url: '/pages/reports/index' })}>
            前往报告中心
          </Button>
        </View>
      </View>
    </View>
  )
}
