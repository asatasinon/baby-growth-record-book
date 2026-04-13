import { useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

import {
  createBaby,
  createFamily,
  inviteFamilyMember,
  listBabies,
  loginWithPassword,
  loginWithWechat,
  updateBaby
} from '@/services/api'
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
import type { AuthSession, BabyInfo, FamilyMemberRole } from '@/types/domain'
import { formatDate, parseDateToStartMs, startOfDayMs } from '@/utils/time'

import './index.scss'

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
  const [isWechatLoading, setIsWechatLoading] = useState(false)
  const [isBabyLoading, setIsBabyLoading] = useState(false)
  const [isFamilyLoading, setIsFamilyLoading] = useState(false)
  const [isInviteLoading, setIsInviteLoading] = useState(false)
  const [isUpdatingBaby, setIsUpdatingBaby] = useState(false)

  const [newBabyName, setNewBabyName] = useState('')
  const [newBabyBirthDate, setNewBabyBirthDate] = useState(formatDate(startOfDayMs()))
  const [newBabyWeight, setNewBabyWeight] = useState('')

  const [newFamilyName, setNewFamilyName] = useState('')
  const [newFamilyTimezone, setNewFamilyTimezone] = useState('Asia/Shanghai')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteRole, setInviteRole] = useState<FamilyMemberRole>('caregiver')

  const [editNickname, setEditNickname] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editHeight, setEditHeight] = useState('')
  const [editHeadCircumference, setEditHeadCircumference] = useState('')

  const activeBaby = useMemo(
    () => babies.find((item) => item.id === activeBabyId) || null,
    [babies, activeBabyId]
  )
  const activeFamilyRole = useMemo(
    () => session?.families.find((item) => item.id === activeFamilyId)?.role || '',
    [session, activeFamilyId]
  )

  useEffect(() => {
    if (!activeBaby) {
      setEditNickname('')
      setEditWeight('')
      setEditHeight('')
      setEditHeadCircumference('')
      return
    }
    setEditNickname(activeBaby.nickname || '')
    setEditWeight(activeBaby.birth_weight_g ? String(activeBaby.birth_weight_g) : '')
    setEditHeight(activeBaby.birth_height_cm ? String(activeBaby.birth_height_cm) : '')
    setEditHeadCircumference(
      activeBaby.birth_head_circumference_cm ? String(activeBaby.birth_head_circumference_cm) : ''
    )
  }, [activeBaby])

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

  async function handleWechatLogin(): Promise<void> {
    const nextPhone = phone.trim()
    if (!nextPhone) {
      Taro.showToast({ title: '请先填写手机号', icon: 'none' })
      return
    }

    setIsWechatLoading(true)
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) {
        throw new Error('未获取到微信登录 code')
      }
      const nextSession = await loginWithWechat(loginResult.code, nextPhone)
      await applySession(nextSession)
      Taro.showToast({ title: '微信登录成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '微信登录失败', icon: 'none' })
    } finally {
      setIsWechatLoading(false)
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

  async function handleCreateFamily(): Promise<void> {
    if (!session) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const name = newFamilyName.trim()
    if (!name) {
      Taro.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }

    setIsFamilyLoading(true)
    try {
      const created = await createFamily(session, {
        name,
        timezone: newFamilyTimezone.trim() || 'Asia/Shanghai'
      })
      const nextSession: AuthSession = {
        ...session,
        families: [...session.families.filter((item) => item.id !== created.id), created]
      }
      setNewFamilyName('')
      await applySession(nextSession, created.id)
      Taro.showToast({ title: '家庭创建成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '创建家庭失败', icon: 'none' })
    } finally {
      setIsFamilyLoading(false)
    }
  }

  async function handleInviteMember(): Promise<void> {
    if (!session || !activeFamilyId) {
      Taro.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    const targetPhone = invitePhone.trim()
    if (targetPhone.length !== 11) {
      Taro.showToast({ title: '请输入 11 位手机号', icon: 'none' })
      return
    }

    setIsInviteLoading(true)
    try {
      const result = await inviteFamilyMember(session, activeFamilyId, {
        inviteePhone: targetPhone,
        role: inviteRole
      })
      setInvitePhone('')
      Taro.showToast({
        title: result.status === 'pending' ? '邀请已发送（待加入）' : '成员已添加',
        icon: 'success'
      })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '邀请失败', icon: 'none' })
    } finally {
      setIsInviteLoading(false)
    }
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
      const created = await createBaby(
        {
          session,
          familyId: activeFamilyId
        },
        {
          name: babyName,
          birthDateMs: parseDateToStartMs(newBabyBirthDate),
          birthWeightG: parsePositiveNumber(newBabyWeight)
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

  async function handleUpdateBaby(): Promise<void> {
    if (!session || !activeBaby) {
      Taro.showToast({ title: '请先选择宝宝', icon: 'none' })
      return
    }

    const weight = editWeight.trim() ? parsePositiveNumber(editWeight) : undefined
    const height = editHeight.trim() ? parsePositiveNumber(editHeight) : undefined
    const head = editHeadCircumference.trim() ? parsePositiveNumber(editHeadCircumference) : undefined

    if (editWeight.trim() && weight === undefined) {
      Taro.showToast({ title: '体重格式不正确', icon: 'none' })
      return
    }
    if (editHeight.trim() && height === undefined) {
      Taro.showToast({ title: '身高格式不正确', icon: 'none' })
      return
    }
    if (editHeadCircumference.trim() && head === undefined) {
      Taro.showToast({ title: '头围格式不正确', icon: 'none' })
      return
    }

    setIsUpdatingBaby(true)
    try {
      await updateBaby(session, activeBaby.id, {
        nickname: editNickname.trim() || undefined,
        birthWeightG: weight,
        birthHeightCm: height,
        birthHeadCircumferenceCm: head
      })
      await loadBabies(session, activeFamilyId)
      Taro.showToast({ title: '宝宝档案已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新失败', icon: 'none' })
    } finally {
      setIsUpdatingBaby(false)
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
          <Text className='hint'>支持密码登录和微信 code 登录（手机号归一）</Text>
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
            密码登录
          </Button>
          <Button plain loading={isWechatLoading} onClick={() => void handleWechatLogin()}>
            微信登录（wx.login）
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

          <View className='card profile-form-card'>
            <Text className='form-title'>创建家庭</Text>
            <View className='form-item'>
              <Text className='form-label'>家庭名称</Text>
              <Input
                className='input'
                value={newFamilyName}
                onInput={(event) => setNewFamilyName(event.detail.value)}
                placeholder='例如 张家'
              />
            </View>
            <View className='form-item'>
              <Text className='form-label'>时区</Text>
              <Input
                className='input'
                value={newFamilyTimezone}
                onInput={(event) => setNewFamilyTimezone(event.detail.value)}
                placeholder='Asia/Shanghai'
              />
            </View>
            <Button className='btn-primary' loading={isFamilyLoading} onClick={() => void handleCreateFamily()}>
              创建并切换家庭
            </Button>
          </View>

          {activeFamilyRole === 'owner' ? (
            <View className='card profile-form-card'>
              <Text className='form-title'>邀请成员</Text>
              <View className='form-item'>
                <Text className='form-label'>成员手机号</Text>
                <Input
                  className='input'
                  type='number'
                  maxlength={11}
                  value={invitePhone}
                  onInput={(event) => setInvitePhone(event.detail.value)}
                  placeholder='请输入 11 位手机号'
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>角色</Text>
                <View className='pill-row'>
                  {(['caregiver', 'viewer', 'owner'] as FamilyMemberRole[]).map((role) => (
                    <View
                      key={role}
                      className={`pill ${inviteRole === role ? 'active' : ''}`}
                      onClick={() => setInviteRole(role)}
                    >
                      <Text>{role}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Button plain loading={isInviteLoading} onClick={() => void handleInviteMember()}>
                发送邀请
              </Button>
            </View>
          ) : null}

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

          <View className='card profile-form-card'>
            <Text className='form-title'>创建宝宝</Text>
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

          {activeBaby ? (
            <View className='card profile-form-card'>
              <Text className='form-title'>编辑宝宝档案</Text>
              <View className='form-item'>
                <Text className='form-label'>昵称</Text>
                <Input
                  className='input'
                  value={editNickname}
                  onInput={(event) => setEditNickname(event.detail.value)}
                  placeholder='例如 小麦同学'
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>体重（g）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={editWeight}
                  onInput={(event) => setEditWeight(event.detail.value)}
                  placeholder='例如 5600'
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>身高（cm）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={editHeight}
                  onInput={(event) => setEditHeight(event.detail.value)}
                  placeholder='例如 61.5'
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>头围（cm）</Text>
                <Input
                  className='input'
                  type='digit'
                  value={editHeadCircumference}
                  onInput={(event) => setEditHeadCircumference(event.detail.value)}
                  placeholder='例如 40.2'
                />
              </View>
              <Button className='btn-primary' loading={isUpdatingBaby} onClick={() => void handleUpdateBaby()}>
                保存宝宝信息
              </Button>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}
