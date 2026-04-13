import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Picker, Text, View } from '@tarojs/components'

import { createExportTask, getExportTask, listExportTasks } from '@/services/api'
import { getActiveBabyId, getActiveFamilyId, getSession } from '@/services/storage'
import type { ExportReportType, ExportTask } from '@/types/domain'
import { DAY_MS, formatDate, formatDateTime, parseDateToStartMs, startOfDayMs } from '@/utils/time'

import './index.scss'

const REPORT_TYPE_OPTIONS: Array<{ value: ExportReportType; label: string }> = [
  { value: 'daily', label: '日报' },
  { value: 'weekly', label: '周报' },
  { value: 'monthly', label: '月报' },
  { value: 'custom', label: '自定义' }
]

const STATUS_LABEL_MAP: Record<ExportTask['status'], string> = {
  pending: '排队中',
  running: '处理中',
  succeeded: '已完成',
  failed: '失败',
  expired: '已过期'
}

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

export default function ReportsPage() {
  const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB
  const [tasks, setTasks] = useState<ExportTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [checkingTaskId, setCheckingTaskId] = useState('')

  const [reportType, setReportType] = useState<ExportReportType>('weekly')
  const [dateFromText, setDateFromText] = useState(formatDate(startOfDayMs(Date.now() - 6 * DAY_MS)))
  const [dateToText, setDateToText] = useState(formatDate(startOfDayMs()))

  async function loadTasks(): Promise<void> {
    const session = getSession()
    const context = resolveContext()
    if (!session || !context) {
      setTasks([])
      return
    }

    setIsLoading(true)
    try {
      const data = await listExportTasks({
        session,
        familyId: context.familyId
      })
      setTasks(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载导出任务失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  useDidShow(() => {
    void loadTasks()
  })

  async function handleCreateTask(): Promise<void> {
    const session = getSession()
    const context = resolveContext()
    if (!session || !context) {
      Taro.showToast({ title: '请先登录并选择宝宝', icon: 'none' })
      return
    }

    const dateFrom = parseDateToStartMs(dateFromText)
    const dateTo = parseDateToStartMs(dateToText) + DAY_MS - 1

    if (dateFrom > dateTo) {
      Taro.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
      return
    }

    setIsCreating(true)
    try {
      await createExportTask({
        session,
        familyId: context.familyId,
        babyId: context.babyId,
        reportType,
        dateFrom,
        dateTo
      })
      Taro.showToast({ title: '已创建导出任务', icon: 'success' })
      await loadTasks()
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '创建任务失败', icon: 'none' })
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopyLink(url: string): Promise<void> {
    try {
      await Taro.setClipboardData({ data: url })
      Taro.showToast({ title: '下载链接已复制', icon: 'success' })
    } catch (_error) {
      Taro.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    }
  }

  async function handleOpenLink(url: string): Promise<void> {
    try {
      if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
        window.open(url, '_blank')
        return
      }

      const downloadResult = await Taro.downloadFile({ url })
      if (downloadResult.statusCode !== 200 || !downloadResult.tempFilePath) {
        throw new Error('下载文件失败')
      }
      await Taro.openDocument({ filePath: downloadResult.tempFilePath, showMenu: true })
    } catch (_error) {
      await handleCopyLink(url)
    }
  }

  async function handleRefreshTask(taskId: string): Promise<void> {
    const session = getSession()
    if (!session) {
      return
    }

    setCheckingTaskId(taskId)
    try {
      const latest = await getExportTask(session, taskId)
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: latest.status,
                download_url: latest.download_url,
                expires_at: latest.expires_at
              }
            : task
        )
      )
      Taro.showToast({ title: '状态已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '刷新状态失败', icon: 'none' })
    } finally {
      setCheckingTaskId('')
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
      <View className='page-shell reports-page'>
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
    <View className='page-shell reports-page'>
      {isWeb ? (
        <View className='card subpage-nav'>
          <View className='subpage-back-btn' onClick={navigateBackOrHome}>
            <View className='subpage-back-icon' />
            <Text>返回</Text>
          </View>
          <Text className='subpage-nav-title'>报告中心</Text>
          <View />
        </View>
      ) : null}

      <Text className='section-title'>发起导出</Text>
      <View className='card create-card'>
        <View className='form-item report-type-row'>
          <Text className='form-label'>报告类型</Text>
          <View className='pill-row'>
            {REPORT_TYPE_OPTIONS.map((option) => (
              <View
                key={option.value}
                className={`pill ${reportType === option.value ? 'active' : ''}`}
                onClick={() => setReportType(option.value)}
              >
                <Text>{option.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='time-row'>
          <View className='form-item'>
            <Text className='form-label'>开始日期</Text>
            <Picker mode='date' value={dateFromText} onChange={(event) => setDateFromText(event.detail.value)}>
              <View className='input picker-like'>{dateFromText}</View>
            </Picker>
          </View>
          <View className='form-item'>
            <Text className='form-label'>结束日期</Text>
            <Picker mode='date' value={dateToText} onChange={(event) => setDateToText(event.detail.value)}>
              <View className='input picker-like'>{dateToText}</View>
            </Picker>
          </View>
        </View>

        <Button className='btn-primary' loading={isCreating} onClick={() => void handleCreateTask()}>
          创建导出任务
        </Button>
      </View>

      <Text className='section-title'>导出历史</Text>
      <View className='card list-card'>
        {isLoading && <Text className='muted'>导出任务加载中...</Text>}
        {!isLoading && tasks.length === 0 && <Text className='muted'>暂无导出任务。</Text>}

        <View className='tasks-list'>
          {tasks.map((task) => (
            <View key={task.id} className='task-card'>
              <Text className='task-title'>任务 #{task.id}</Text>
              <Text className={`status-tag status-${task.status}`}>{STATUS_LABEL_MAP[task.status]}</Text>
              <Text className='task-line'>类型：{task.report_type}</Text>
              <Text className='task-line'>
                区间：{formatDate(task.date_from)} 至 {formatDate(task.date_to)}
              </Text>
              <Text className='task-line'>
                过期时间：{task.expires_at ? formatDateTime(task.expires_at) : '待生成'}
              </Text>
              {task.download_url ? (
                <View className='task-actions'>
                  <Button className='task-action-btn' onClick={() => void handleOpenLink(task.download_url || '')}>
                    打开下载
                  </Button>
                  <Button className='task-action-btn' onClick={() => void handleCopyLink(task.download_url || '')}>
                    复制下载链接
                  </Button>
                </View>
              ) : (
                <View className='task-actions'>
                  <Button
                    className='task-action-btn'
                    loading={checkingTaskId === task.id}
                    onClick={() => void handleRefreshTask(task.id)}
                  >
                    刷新状态
                  </Button>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
