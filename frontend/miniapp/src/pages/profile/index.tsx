import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'

import { listBabies, loginWithPassword, registerWithPassword } from '@/services/api'
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
import { formatDateTime } from '@/utils/time'

import './index.scss'

const TIMEZONE_LABELS: Record<string, string> = {
  'Asia/Shanghai': '中国·上海',
  'Asia/Hong_Kong': '中国·香港',
  'Asia/Singapore': '新加坡',
  'America/Los_Angeles': '美国·洛杉矶',
  'America/New_York': '美国·纽约',
  'Europe/London': '英国·伦敦'
}

function getGenderLabel(gender: BabyInfo['gender']): string {
  if (gender === 'male') {
    return '男'
  }
  if (gender === 'female') {
    return '女'
  }
  return '未知'
}

function formatOptional(value: number | null, suffix: string): string {
  if (value === null) {
    return '未设置'
  }
  return `${value}${suffix}`
}

export default function ProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(getSession())
  const [activeFamilyId, setActiveFamilyIdState] = useState<string>(
    getActiveFamilyId(getSession() || undefined) || ''
  )
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [activeBabyId, setActiveBabyIdState] = useState<string>(getActiveBabyId() || '')

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [isRegisterLoading, setIsRegisterLoading] = useState(false)
  const [isBabyLoading, setIsBabyLoading] = useState(false)

  const activeFamily = useMemo(
    () => session?.families.find((item) => item.id === activeFamilyId) || null,
    [session, activeFamilyId]
  )
  const activeBaby = useMemo(
    () => babies.find((item) => item.id === activeBabyId) || null,
    [babies, activeBabyId]
  )

  async function loadBabies(targetSession: AuthSession, familyId: string): Promise<void> {
    if (!familyId) {
      setBabies([])
      setActiveBabyIdState('')
      return
    }

    setIsBabyLoading(true)
    try {
      const data = await listBabies({ session: targetSession, familyId })
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

  async function applySession(nextSession: AuthSession, preferredFamilyId?: string): Promise<void> {
    saveSession(nextSession)
    setSession(nextSession)
    const familyId = preferredFamilyId || getActiveFamilyId(nextSession) || nextSession.families[0]?.id || ''
    if (familyId) {
      setActiveFamilyId(familyId)
    }
    setActiveFamilyIdState(familyId)
    await loadBabies(nextSession, familyId)
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
    if (!/^1\d{10}$/.test(nextPhone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }

    setIsLoginLoading(true)
    try {
      const nextSession = await loginWithPassword(nextPhone, nextPassword)
      await applySession(nextSession)
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '登录失败', icon: 'none' })
    } finally {
      setIsLoginLoading(false)
    }
  }

  async function handleRegister(): Promise<void> {
    const nextPhone = phone.trim()
    const nextPassword = password.trim()
    const nextConfirmPassword = confirmPassword.trim()
    const nextDisplayName = displayName.trim()

    if (!nextPhone || !nextPassword || !nextConfirmPassword) {
      Taro.showToast({ title: '请填写完整注册信息', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(nextPhone)) {
      Taro.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    if (nextPassword.length < 8) {
      Taro.showToast({ title: '密码至少 8 位', icon: 'none' })
      return
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(nextPassword)) {
      Taro.showToast({ title: '密码需同时包含字母和数字', icon: 'none' })
      return
    }
    if (nextPassword !== nextConfirmPassword) {
      Taro.showToast({ title: '两次输入密码不一致', icon: 'none' })
      return
    }

    setIsRegisterLoading(true)
    try {
      const nextSession = await registerWithPassword(nextPhone, nextPassword, nextDisplayName || undefined)
      await applySession(nextSession)
      Taro.showToast({ title: '注册成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '注册失败', icon: 'none' })
    } finally {
      setIsRegisterLoading(false)
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
      <Text className='section-title'>我的账号</Text>

      {!session ? (
        <View className='card login-card'>
          <Text className='hint'>仅支持手机号 + 密码。首次使用请先注册账号。</Text>
          <View className='pill-row auth-mode-row'>
            <View className={`pill ${authMode === 'login' ? 'active' : ''}`} onClick={() => setAuthMode('login')}>
              <Text>密码登录</Text>
            </View>
            <View
              className={`pill ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => setAuthMode('register')}
            >
              <Text>账号注册</Text>
            </View>
          </View>
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
          {authMode === 'register' ? (
            <View className='form-item'>
              <Text className='form-label'>确认密码</Text>
              <Input
                className='input'
                value={confirmPassword}
                password
                onInput={(event) => setConfirmPassword(event.detail.value)}
                placeholder='请再次输入密码'
              />
            </View>
          ) : null}
          {authMode === 'register' ? (
            <View className='form-item'>
              <Text className='form-label'>昵称（可选）</Text>
              <Input
                className='input'
                value={displayName}
                onInput={(event) => setDisplayName(event.detail.value)}
                placeholder='例如：宝宝爸爸'
              />
            </View>
          ) : null}
          {authMode === 'login' ? (
            <Button className='btn-primary' loading={isLoginLoading} onClick={() => void handleLogin()}>
              密码登录
            </Button>
          ) : (
            <Button className='btn-primary' loading={isRegisterLoading} onClick={() => void handleRegister()}>
              注册并登录
            </Button>
          )}
          <Text className='hint minor-hint'>密码要求：至少 8 位，且同时包含字母和数字。</Text>
        </View>
      ) : (
        <View className='profile-content'>
          <View className='card user-card'>
            <View className='h-stack user-header'>
              <Text className='user-name'>{session.user.display_name}</Text>
              <Button className='logout-btn' size='mini' plain onClick={handleLogout}>
                退出登录
              </Button>
            </View>
            <View className='meta-grid'>
              <View className='meta-item'>
                <Text className='meta-label'>当前家庭</Text>
                <Text className='meta-value'>{activeFamily?.name || '未选择'}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>时区</Text>
                <Text className='meta-value'>
                  {activeFamily ? TIMEZONE_LABELS[activeFamily.timezone] || activeFamily.timezone : '未设置'}
                </Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>家庭角色</Text>
                <Text className='meta-value'>{activeFamily?.role || '未设置'}</Text>
              </View>
              <View className='meta-item'>
                <Text className='meta-label'>家庭关系</Text>
                <Text className='meta-value'>{activeFamily?.relationship || '未设置'}</Text>
              </View>
            </View>
          </View>

          <View className='card quick-switch-card'>
            <Text className='form-title'>日常使用</Text>
            <View className='quick-block'>
              <Text className='form-label'>切换家庭</Text>
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
            </View>

            <View className='quick-block'>
              <Text className='form-label'>切换宝宝</Text>
              {isBabyLoading ? <Text className='muted'>宝宝数据加载中...</Text> : null}
              {!isBabyLoading && babies.length > 0 ? (
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
              ) : null}
              {!isBabyLoading && babies.length === 0 ? (
                <Text className='muted'>当前家庭暂无宝宝档案，请先进入宝宝档案管理创建。</Text>
              ) : null}
            </View>

            {activeBaby ? (
              <View className='baby-brief'>
                <Text className='baby-brief-title'>宝宝基础信息</Text>
                <View className='brief-grid'>
                  <View className='brief-item'>
                    <Text className='brief-label'>姓名</Text>
                    <Text className='brief-value'>{activeBaby.name}</Text>
                  </View>
                  <View className='brief-item'>
                    <Text className='brief-label'>昵称</Text>
                    <Text className='brief-value'>{activeBaby.nickname || '未设置'}</Text>
                  </View>
                  <View className='brief-item'>
                    <Text className='brief-label'>性别</Text>
                    <Text className='brief-value'>{getGenderLabel(activeBaby.gender)}</Text>
                  </View>
                  <View className='brief-item'>
                    <Text className='brief-label'>出生时间</Text>
                    <Text className='brief-value'>{formatDateTime(activeBaby.birth_date)}</Text>
                  </View>
                  <View className='brief-item'>
                    <Text className='brief-label'>出生地址</Text>
                    <Text className='brief-value'>{activeBaby.birth_place || '未设置'}</Text>
                  </View>
                  <View className='brief-item'>
                    <Text className='brief-label'>出生体重</Text>
                    <Text className='brief-value'>{formatOptional(activeBaby.birth_weight_g, 'g')}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <View className='card manage-entry-card'>
            <Text className='form-title'>信息管理入口</Text>
            <View className='entry-grid'>
              <Button className='entry-btn' onClick={() => Taro.navigateTo({ url: '/pages/family-manage/index' })}>
                家庭管理
              </Button>
              <Button className='entry-btn' onClick={() => Taro.navigateTo({ url: '/pages/baby-manage/index' })}>
                宝宝档案管理
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
