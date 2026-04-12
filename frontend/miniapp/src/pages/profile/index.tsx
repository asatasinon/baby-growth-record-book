import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

import { createBaby, listBabies, loginWithPassword } from '@/services/api'
import {
  clearActiveBabyId,
  clearSession,
  getActiveBabyId,
  getActiveFamilyId,
  getSession,
  saveSession,
  setActiveBabyId,
  setActiveFamilyId
} from '@/services/storage'
import type { AuthSession, BabyInfo } from '@/types/domain'
import { formatDate, parseDateToStartMs, startOfDayMs } from '@/utils/time'

import './index.scss'

export default function ProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(getSession())
  const [activeFamilyId, setActiveFamilyIdState] = useState<string>(
    getActiveFamilyId(getSession() || undefined) || ''
  )
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [activeBabyId, setActiveBabyIdState] = useState<string>(getActiveBabyId() || '')

  const [phone, setPhone] = useState('13800138000')
  const [password, setPassword] = useState('Passw0rd!')
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [isBabyLoading, setIsBabyLoading] = useState(false)

  const [newBabyName, setNewBabyName] = useState('')
  const [newBabyBirthDate, setNewBabyBirthDate] = useState(formatDate(startOfDayMs()))
  const [newBabyWeight, setNewBabyWeight] = useState('')

  async function loadBabies(targetSession: AuthSession, familyId: string): Promise<void> {
    if (!familyId) {
      setBabies([])
      setActiveBabyIdState('')
      return
    }

    setIsBabyLoading(true)
    try {
      const data = await listBabies({
        session: targetSession,
        familyId
      })
      setBabies(data)

      const storedActiveId = getActiveBabyId()
      const matched = storedActiveId ? data.find((item) => item.id === storedActiveId) : undefined
      const finalActiveBaby = matched?.id || data[0]?.id || ''

      if (finalActiveBaby) {
        setActiveBabyId(finalActiveBaby)
      } else {
        clearActiveBabyId()
      }
      setActiveBabyIdState(finalActiveBaby)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载宝宝列表失败', icon: 'none' })
    } finally {
      setIsBabyLoading(false)
    }
  }

  useDidShow(() => {
    const currentSession = getSession()
    setSession(currentSession)

    if (!currentSession) {
      setActiveFamilyIdState('')
      setBabies([])
      setActiveBabyIdState('')
      return
    }

    const familyId = getActiveFamilyId(currentSession) || ''
    setActiveFamilyIdState(familyId)
    void loadBabies(currentSession, familyId)
  })

  async function handleLogin(): Promise<void> {
    const nextPhone = phone.trim()
    const nextPassword = password.trim()
    if (!nextPhone || !nextPassword) {
      Taro.showToast({ title: '请输入手机号和密码', icon: 'none' })
      return
    }

    setIsLoginLoading(true)
    try {
      const nextSession = await loginWithPassword(nextPhone, nextPassword)
      saveSession(nextSession)
      setSession(nextSession)

      const preferredFamilyId = getActiveFamilyId(nextSession) || nextSession.families[0]?.id || ''
      if (preferredFamilyId) {
        setActiveFamilyId(preferredFamilyId)
      }
      setActiveFamilyIdState(preferredFamilyId)

      await loadBabies(nextSession, preferredFamilyId)
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '登录失败', icon: 'none' })
    } finally {
      setIsLoginLoading(false)
    }
  }

  async function handleFamilySwitch(familyId: string): Promise<void> {
    if (!session || !familyId) {
      return
    }

    setActiveFamilyId(familyId)
    setActiveFamilyIdState(familyId)
    clearActiveBabyId()
    setActiveBabyIdState('')
    await loadBabies(session, familyId)
  }

  async function handleCreateBaby(): Promise<void> {
    if (!session || !activeFamilyId) {
      Taro.showToast({ title: '请先登录并选择家庭', icon: 'none' })
      return
    }

    const babyName = newBabyName.trim()
    if (!babyName) {
      Taro.showToast({ title: '请输入宝宝姓名', icon: 'none' })
      return
    }

    setIsBabyLoading(true)
    try {
      const birthWeight = Number(newBabyWeight)
      const created = await createBaby(
        {
          session,
          familyId: activeFamilyId
        },
        {
          name: babyName,
          birthDateMs: parseDateToStartMs(newBabyBirthDate),
          birthWeightG: Number.isFinite(birthWeight) && birthWeight > 0 ? birthWeight : undefined
        }
      )

      setNewBabyName('')
      setNewBabyWeight('')

      await loadBabies(session, activeFamilyId)
      setActiveBabyId(created.id)
      setActiveBabyIdState(created.id)
      Taro.showToast({ title: '宝宝创建成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '创建宝宝失败', icon: 'none' })
    } finally {
      setIsBabyLoading(false)
    }
  }

  function handleLogout(): void {
    clearSession()
    setSession(null)
    setBabies([])
    setActiveFamilyIdState('')
    setActiveBabyIdState('')
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  return (
    <View className='page-shell profile-page'>
      <Text className='section-title'>账号与家庭</Text>

      {!session ? (
        <View className='card login-card'>
          <Text className='hint'>MVP 登录（默认已填测试账号，可直接点登录）</Text>
          <View className='form-item'>
            <Text className='form-label'>手机号</Text>
            <Input
              className='input'
              value={phone}
              type='number'
              maxlength={11}
              onInput={(event) => setPhone(event.detail.value)}
              placeholder='请输入 11 位手机号'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>密码</Text>
            <Input
              className='input'
              value={password}
              password
              onInput={(event) => setPassword(event.detail.value)}
              placeholder='请输入密码'
            />
          </View>
          <Button className='btn-primary' loading={isLoginLoading} onClick={() => void handleLogin()}>
            登录并初始化家庭
          </Button>
        </View>
      ) : (
        <View>
          <View className='card user-card'>
            <Text className='user-name'>{session.user.display_name}</Text>
            <Text className='muted'>用户 ID：{session.user.id}</Text>
            <Button size='mini' plain onClick={handleLogout}>
              退出登录
            </Button>
          </View>

          <Text className='section-title'>家庭选择</Text>
          <View className='pill-row'>
            {session.families.map((family) => (
              <View
                key={family.id}
                className={`pill ${family.id === activeFamilyId ? 'active' : ''}`}
                onClick={() => void handleFamilySwitch(family.id)}
              >
                <Text>{family.name}</Text>
              </View>
            ))}
          </View>

          <Text className='section-title'>宝宝选择</Text>
          {isBabyLoading && <Text className='muted'>宝宝数据加载中...</Text>}

          {!isBabyLoading && babies.length > 0 && (
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
          )}

          {!isBabyLoading && babies.length === 0 && (
            <View className='card empty-card'>
              <Text className='muted'>当前家庭还没有宝宝档案，请先创建。</Text>
            </View>
          )}

          <Text className='section-title'>创建宝宝</Text>
          <View className='card create-baby-card'>
            <View className='form-item'>
              <Text className='form-label'>宝宝姓名</Text>
              <Input
                className='input'
                value={newBabyName}
                onInput={(event) => setNewBabyName(event.detail.value)}
                placeholder='例如 小麦'
              />
            </View>

            <View className='form-item'>
              <Text className='form-label'>出生日期</Text>
              <Picker
                mode='date'
                value={newBabyBirthDate}
                start='2010-01-01'
                end='2035-12-31'
                onChange={(event) => setNewBabyBirthDate(event.detail.value)}
              >
                <View className='input picker-like'>{newBabyBirthDate}</View>
              </Picker>
            </View>

            <View className='form-item'>
              <Text className='form-label'>出生体重（g，可选）</Text>
              <Input
                className='input'
                value={newBabyWeight}
                type='number'
                onInput={(event) => setNewBabyWeight(event.detail.value)}
                placeholder='例如 3200'
              />
            </View>

            <Button className='btn-primary' loading={isBabyLoading} onClick={() => void handleCreateBaby()}>
              创建宝宝档案
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
