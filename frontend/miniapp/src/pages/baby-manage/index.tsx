import { useEffect, useMemo, useState } from 'react'
import Taro, { ENV_TYPE, useDidShow } from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

import { createBaby, listBabies, updateBaby } from '@/services/api'
import {
  clearActiveBabyId,
  getActiveBabyId,
  getActiveFamilyId,
  getSession,
  setActiveBabyId
} from '@/services/storage'
import type { AuthSession, BabyInfo } from '@/types/domain'
import { formatDate, parseDateTimeToMs } from '@/utils/time'

import './index.scss'

const isWeb = Taro.getEnv() === ENV_TYPE.WEB

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateText(ms: number): string {
  return formatDate(ms)
}

function toTimeText(ms: number): string {
  const date = new Date(ms)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parsePositiveNumber(text: string): number | undefined {
  if (!text.trim()) {
    return undefined
  }
  const value = Number(text)
  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

interface BabyFormState {
  name: string
  nickname: string
  gender: 'male' | 'female' | 'unknown'
  birthDateText: string
  birthTimeText: string
  birthPlace: string
  birthWeight: string
  birthHeight: string
  headCircumference: string
}

function createDefaultBabyForm(): BabyFormState {
  const now = Date.now()
  return {
    name: '',
    nickname: '',
    gender: 'unknown',
    birthDateText: toDateText(now),
    birthTimeText: toTimeText(now),
    birthPlace: '',
    birthWeight: '',
    birthHeight: '',
    headCircumference: ''
  }
}

function buildBabyFormFromEntity(baby: BabyInfo): BabyFormState {
  return {
    name: baby.name || '',
    nickname: baby.nickname || '',
    gender: baby.gender,
    birthDateText: toDateText(baby.birth_date),
    birthTimeText: toTimeText(baby.birth_date),
    birthPlace: baby.birth_place || '',
    birthWeight: baby.birth_weight_g ? String(baby.birth_weight_g) : '',
    birthHeight: baby.birth_height_cm ? String(baby.birth_height_cm) : '',
    headCircumference: baby.birth_head_circumference_cm ? String(baby.birth_head_circumference_cm) : ''
  }
}

export default function BabyManagePage() {
  const [session, setSession] = useState<AuthSession | null>(getSession())
  const [activeFamilyId, setActiveFamilyIdState] = useState<string>(
    getActiveFamilyId(getSession() || undefined) || ''
  )
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [activeBabyId, setActiveBabyIdState] = useState<string>(getActiveBabyId() || '')
  const [activeTab, setActiveTab] = useState<'' | 'create' | 'update'>('create')

  const [createForm, setCreateForm] = useState<BabyFormState>(createDefaultBabyForm())
  const [updateForm, setUpdateForm] = useState<BabyFormState>(createDefaultBabyForm())
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const activeFamily = useMemo(
    () => session?.families.find((item) => item.id === activeFamilyId) || null,
    [session, activeFamilyId]
  )
  const activeBaby = useMemo(
    () => babies.find((item) => item.id === activeBabyId) || null,
    [babies, activeBabyId]
  )

  useEffect(() => {
    if (!activeBaby) {
      setUpdateForm(createDefaultBabyForm())
      return
    }
    setUpdateForm(buildBabyFormFromEntity(activeBaby))
  }, [activeBaby])

  useDidShow(() => {
    const current = getSession()
    setSession(current)
    if (!current) {
      setActiveFamilyIdState('')
      setBabies([])
      setActiveBabyIdState('')
      return
    }
    const familyId = getActiveFamilyId(current) || current.families[0]?.id || ''
    setActiveFamilyIdState(familyId)
    if (!familyId) {
      return
    }
    void loadBabies(current, familyId)
  })

  async function loadBabies(nextSession: AuthSession, familyId: string): Promise<void> {
    setIsLoading(true)
    try {
      const data = await listBabies({ session: nextSession, familyId })
      setBabies(data)
      const storedActive = getActiveBabyId()
      const matched = storedActive ? data.find((item) => item.id === storedActive) : undefined
      const finalId = matched?.id || data[0]?.id || ''
      if (finalId) {
        setActiveBabyId(finalId)
      } else {
        clearActiveBabyId()
      }
      setActiveBabyIdState(finalId)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载宝宝失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate(): Promise<void> {
    if (!session || !activeFamilyId) {
      Taro.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    const name = createForm.name.trim()
    if (!name) {
      Taro.showToast({ title: '请输入宝宝姓名', icon: 'none' })
      return
    }
    setIsCreating(true)
    try {
      const created = await createBaby(
        { session, familyId: activeFamilyId },
        {
          name,
          nickname: createForm.nickname.trim() || undefined,
          gender: createForm.gender,
          birthDateMs: parseDateTimeToMs(createForm.birthDateText, createForm.birthTimeText),
          birthPlace: createForm.birthPlace.trim() || undefined,
          birthWeightG: parsePositiveNumber(createForm.birthWeight),
          birthHeightCm: parsePositiveNumber(createForm.birthHeight),
          birthHeadCircumferenceCm: parsePositiveNumber(createForm.headCircumference)
        }
      )
      setCreateForm(createDefaultBabyForm())
      setActiveTab('')
      await loadBabies(session, activeFamilyId)
      setActiveBabyId(created.id)
      setActiveBabyIdState(created.id)
      Taro.showToast({ title: '宝宝档案创建成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '创建失败', icon: 'none' })
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!session || !activeBaby) {
      Taro.showToast({ title: '请先选择宝宝', icon: 'none' })
      return
    }
    const name = updateForm.name.trim()
    if (!name) {
      Taro.showToast({ title: '请输入宝宝姓名', icon: 'none' })
      return
    }
    setIsUpdating(true)
    try {
      await updateBaby(session, activeBaby.id, {
        name,
        nickname: updateForm.nickname.trim() || undefined,
        gender: updateForm.gender,
        birthDateMs: parseDateTimeToMs(updateForm.birthDateText, updateForm.birthTimeText),
        birthPlace: updateForm.birthPlace.trim() || undefined,
        birthWeightG: parsePositiveNumber(updateForm.birthWeight),
        birthHeightCm: parsePositiveNumber(updateForm.birthHeight),
        birthHeadCircumferenceCm: parsePositiveNumber(updateForm.headCircumference)
      })
      setActiveTab('')
      await loadBabies(session, activeFamilyId)
      Taro.showToast({ title: '宝宝档案已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新失败', icon: 'none' })
    } finally {
      setIsUpdating(false)
    }
  }

  function navigateBackOrProfile(): void {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack({ delta: 1 })
      return
    }
    void Taro.switchTab({ url: '/pages/profile/index' })
  }

  if (!session) {
    return (
      <View className='page-shell baby-manage-page'>
        <View className='card empty-card'>
          <Text className='muted'>请先在“我的”页面登录。</Text>
          <Button className='btn-primary' onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}>
            去登录
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='page-shell baby-manage-page'>
      {isWeb ? (
        <View className='card subpage-nav'>
          <View className='subpage-back-btn' onClick={navigateBackOrProfile}>
            <View className='subpage-back-icon' />
            <Text>返回</Text>
          </View>
          <Text className='subpage-nav-title'>宝宝档案管理</Text>
          <View />
        </View>
      ) : null}

      <Text className='section-title'>当前家庭</Text>
      <View className='card family-switch-card'>
        <View className='pill-row'>
          {session.families.map((family) => (
            <View
              key={family.id}
              className={`pill ${family.id === activeFamilyId ? 'active' : ''}`}
              onClick={() => {
                setActiveFamilyId(family.id)
                setActiveFamilyIdState(family.id)
                void loadBabies(session, family.id)
              }}
            >
              <Text>{family.name}</Text>
            </View>
          ))}
        </View>
        <Text className='muted'>当前家庭：{activeFamily?.name || '未选择'}</Text>
      </View>

      <Text className='section-title'>档案操作</Text>
      <View className='card manage-tab-card'>
        <View className='manage-tab-row'>
          <View
            className={`manage-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab((prev) => (prev === 'create' ? '' : 'create'))}
          >
            <Text>创建宝宝档案</Text>
          </View>
          <View
            className={`manage-tab ${activeTab === 'update' ? 'active' : ''}`}
            onClick={() => setActiveTab((prev) => (prev === 'update' ? '' : 'update'))}
          >
            <Text>更新宝宝档案</Text>
          </View>
        </View>
        {activeTab === '' ? <Text className='tab-hint'>点击上方 Tab 展开对应功能。</Text> : null}
      </View>

      {activeTab === 'create' ? (
        <View className='card form-card'>
          <Text className='form-title'>创建宝宝档案</Text>
          <View className='form-item'>
            <Text className='form-label'>宝宝姓名</Text>
            <Input
              className='input'
              value={createForm.name}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, name: event.detail.value }))}
              placeholder='例如 小麦'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>昵称</Text>
            <Input
              className='input'
              value={createForm.nickname}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, nickname: event.detail.value }))}
              placeholder='例如 麦麦'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>性别</Text>
            <View className='pill-row'>
              {[
                { value: 'unknown', label: '未知' },
                { value: 'male', label: '男' },
                { value: 'female', label: '女' }
              ].map((item) => (
                <View
                  key={item.value}
                  className={`pill ${createForm.gender === item.value ? 'active' : ''}`}
                  onClick={() =>
                    setCreateForm((prev) => ({ ...prev, gender: item.value as BabyInfo['gender'] }))
                  }
                >
                  <Text>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className='time-grid'>
            <View className='form-item'>
              <Text className='form-label'>出生日期</Text>
              <Picker
                mode='date'
                value={createForm.birthDateText}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, birthDateText: event.detail.value }))}
              >
                <View className='input picker-like'>{createForm.birthDateText}</View>
              </Picker>
            </View>
            <View className='form-item'>
              <Text className='form-label'>出生时间</Text>
              <Picker
                mode='time'
                value={createForm.birthTimeText}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, birthTimeText: event.detail.value }))}
              >
                <View className='input picker-like'>{createForm.birthTimeText}</View>
              </Picker>
            </View>
          </View>
          <View className='form-item'>
            <Text className='form-label'>出生地址</Text>
            <Input
              className='input'
              value={createForm.birthPlace}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, birthPlace: event.detail.value }))}
              placeholder='例如 上海浦东'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>出生体重（g）</Text>
            <Input
              className='input'
              type='digit'
              value={createForm.birthWeight}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, birthWeight: event.detail.value }))}
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>出生身高（cm）</Text>
            <Input
              className='input'
              type='digit'
              value={createForm.birthHeight}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, birthHeight: event.detail.value }))}
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>出生头围（cm）</Text>
            <Input
              className='input'
              type='digit'
              value={createForm.headCircumference}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, headCircumference: event.detail.value }))}
            />
          </View>
          <Button className='btn-primary' loading={isCreating} onClick={() => void handleCreate()}>
            创建档案
          </Button>
        </View>
      ) : null}

      {activeTab === 'update' ? (
        <View className='card form-card'>
          <Text className='form-title'>更新宝宝档案</Text>
          <View className='form-item'>
            <Text className='form-label'>选择宝宝</Text>
            {isLoading ? <Text className='muted'>宝宝列表加载中...</Text> : null}
            <View className='pill-row'>
              {babies.map((baby) => (
                <View
                  key={baby.id}
                  className={`pill ${baby.id === activeBabyId ? 'active' : ''}`}
                  onClick={() => {
                    setActiveBabyId(baby.id)
                    setActiveBabyIdState(baby.id)
                  }}
                >
                  <Text>{baby.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {!activeBaby ? (
            <Text className='muted'>请先选择一个宝宝。</Text>
          ) : (
            <View>
              <View className='form-item'>
                <Text className='form-label'>宝宝姓名</Text>
                <Input
                  className='input'
                  value={updateForm.name}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, name: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>昵称</Text>
                <Input
                  className='input'
                  value={updateForm.nickname}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, nickname: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>性别</Text>
                <View className='pill-row'>
                  {[
                    { value: 'unknown', label: '未知' },
                    { value: 'male', label: '男' },
                    { value: 'female', label: '女' }
                  ].map((item) => (
                    <View
                      key={item.value}
                      className={`pill ${updateForm.gender === item.value ? 'active' : ''}`}
                      onClick={() =>
                        setUpdateForm((prev) => ({ ...prev, gender: item.value as BabyInfo['gender'] }))
                      }
                    >
                      <Text>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className='time-grid'>
                <View className='form-item'>
                  <Text className='form-label'>出生日期</Text>
                  <Picker
                    mode='date'
                    value={updateForm.birthDateText}
                    onChange={(event) =>
                      setUpdateForm((prev) => ({ ...prev, birthDateText: event.detail.value }))
                    }
                  >
                    <View className='input picker-like'>{updateForm.birthDateText}</View>
                  </Picker>
                </View>
                <View className='form-item'>
                  <Text className='form-label'>出生时间</Text>
                  <Picker
                    mode='time'
                    value={updateForm.birthTimeText}
                    onChange={(event) =>
                      setUpdateForm((prev) => ({ ...prev, birthTimeText: event.detail.value }))
                    }
                  >
                    <View className='input picker-like'>{updateForm.birthTimeText}</View>
                  </Picker>
                </View>
              </View>
              <View className='form-item'>
                <Text className='form-label'>出生地址</Text>
                <Input
                  className='input'
                  value={updateForm.birthPlace}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, birthPlace: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>出生体重（g）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={updateForm.birthWeight}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, birthWeight: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>出生身高（cm）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={updateForm.birthHeight}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, birthHeight: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>出生头围（cm）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={updateForm.headCircumference}
                  onInput={(event) =>
                    setUpdateForm((prev) => ({ ...prev, headCircumference: event.detail.value }))
                  }
                />
              </View>
              <Button className='btn-primary' loading={isUpdating} onClick={() => void handleUpdate()}>
                保存档案
              </Button>
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
}
