import { useEffect, useMemo, useState } from 'react'
import Taro, { ENV_TYPE, useDidShow } from '@tarojs/taro'
import { Button, Input, Picker, Text, View } from '@tarojs/components'

import {
  createFamily,
  inviteFamilyMember,
  listFamilyMembers,
  updateFamily,
  updateFamilyMember
} from '@/services/api'
import { getActiveFamilyId, getSession, saveSession, setActiveFamilyId } from '@/services/storage'
import type {
  AuthSession,
  FamilyInfo,
  FamilyMemberInviteResult,
  FamilyMemberRole,
  FamilyMemberStatus
} from '@/types/domain'

import './index.scss'

const isWeb = Taro.getEnv() === ENV_TYPE.WEB

const manageTabs: Array<{ value: '' | 'create' | 'update' | 'invite' | 'members'; label: string }> = [
  { value: 'create', label: '创建家庭' },
  { value: 'update', label: '更新家庭' },
  { value: 'invite', label: '邀请成员' },
  { value: 'members', label: '成员管理' }
]

const roleOptions: Array<{ value: FamilyMemberRole; label: string }> = [
  { value: 'caregiver', label: '照护者' },
  { value: 'viewer', label: '查看者' },
  { value: 'owner', label: '管理员' }
]

const roleLabelMap: Record<FamilyMemberRole, string> = {
  caregiver: '照护者',
  viewer: '查看者',
  owner: '管理员'
}

const statusLabelMap: Record<FamilyMemberStatus, string> = {
  pending: '待接受',
  active: '已加入',
  removed: '已移除'
}

const relationPresets = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆', '叔叔', '阿姨']

const timezoneOptions: Array<{ label: string; value: string }> = [
  { label: '中国·上海', value: 'Asia/Shanghai' },
  { label: '中国·香港', value: 'Asia/Hong_Kong' },
  { label: '新加坡', value: 'Asia/Singapore' },
  { label: '美国·洛杉矶', value: 'America/Los_Angeles' },
  { label: '美国·纽约', value: 'America/New_York' },
  { label: '英国·伦敦', value: 'Europe/London' }
]

interface FamilyFormState {
  name: string
  timezone: string
  familyAlias: string
  city: string
  address: string
  notes: string
}

interface MemberDraftState {
  role: FamilyMemberRole
  relationLabel: string
}

function buildFamilyForm(family?: FamilyInfo | null): FamilyFormState {
  return {
    name: family?.name || '',
    timezone: family?.timezone || 'Asia/Shanghai',
    familyAlias: family?.family_alias || '',
    city: family?.city || '',
    address: family?.address || '',
    notes: family?.notes || ''
  }
}

export default function FamilyManagePage() {
  const [session, setSession] = useState<AuthSession | null>(getSession())
  const [activeFamilyId, setActiveFamilyIdState] = useState<string>(
    getActiveFamilyId(getSession() || undefined) || ''
  )
  const [activeTab, setActiveTab] = useState<'' | 'create' | 'update' | 'invite' | 'members'>('update')
  const [members, setMembers] = useState<FamilyMemberInviteResult[]>([])
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraftState>>({})

  const [createForm, setCreateForm] = useState<FamilyFormState>(buildFamilyForm())
  const [updateForm, setUpdateForm] = useState<FamilyFormState>(buildFamilyForm())
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteRole, setInviteRole] = useState<FamilyMemberRole>('caregiver')
  const [inviteRelation, setInviteRelation] = useState('爸爸')

  const [isCreateLoading, setIsCreateLoading] = useState(false)
  const [isUpdateLoading, setIsUpdateLoading] = useState(false)
  const [isInviteLoading, setIsInviteLoading] = useState(false)
  const [isMemberLoading, setIsMemberLoading] = useState(false)
  const [savingMemberId, setSavingMemberId] = useState('')
  const [deletingMemberId, setDeletingMemberId] = useState('')
  const [editingMemberId, setEditingMemberId] = useState('')

  const activeFamily = useMemo(
    () => session?.families.find((item) => item.id === activeFamilyId) || null,
    [session, activeFamilyId]
  )

  useEffect(() => {
    setUpdateForm(buildFamilyForm(activeFamily))
  }, [activeFamily])

  useEffect(() => {
    setMemberDrafts(
      Object.fromEntries(
        members.map((member) => [
          member.id,
          {
            role: member.role,
            relationLabel: member.relation_label || ''
          }
        ])
      )
    )
  }, [members])

  useEffect(() => {
    if (!editingMemberId) {
      return
    }
    const stillExists = members.some((member) => member.id === editingMemberId)
    if (!stillExists) {
      setEditingMemberId('')
    }
  }, [members, editingMemberId])

  useDidShow(() => {
    const current = getSession()
    setSession(current)
    if (!current) {
      setActiveFamilyIdState('')
      return
    }
    const familyId = getActiveFamilyId(current) || current.families[0]?.id || ''
    setActiveFamilyIdState(familyId)
    if (!familyId) {
      setActiveTab('create')
      return
    }
    void loadMembers(current, familyId)
  })

  async function loadMembers(nextSession: AuthSession, familyId: string): Promise<void> {
    setIsMemberLoading(true)
    try {
      const data = await listFamilyMembers(nextSession, familyId)
      setMembers(data)
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '加载成员失败', icon: 'none' })
    } finally {
      setIsMemberLoading(false)
    }
  }

  function syncSessionFamily(nextFamily: FamilyInfo): void {
    if (!session) {
      return
    }
    const nextSession: AuthSession = {
      ...session,
      families: [...session.families.filter((item) => item.id !== nextFamily.id), nextFamily]
    }
    saveSession(nextSession)
    setSession(nextSession)
  }

  async function handleCreateFamily(): Promise<void> {
    if (!session) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const name = createForm.name.trim()
    if (!name) {
      Taro.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }
    setIsCreateLoading(true)
    try {
      const created = await createFamily(session, {
        name,
        timezone: createForm.timezone,
        familyAlias: createForm.familyAlias.trim() || undefined,
        city: createForm.city.trim() || undefined,
        address: createForm.address.trim() || undefined,
        notes: createForm.notes.trim() || undefined
      })
      const nextSession: AuthSession = {
        ...session,
        families: [...session.families.filter((item) => item.id !== created.id), created]
      }
      saveSession(nextSession)
      setSession(nextSession)
      setActiveFamilyId(created.id)
      setActiveFamilyIdState(created.id)
      setCreateForm(buildFamilyForm())
      setActiveTab('')
      await loadMembers(nextSession, created.id)
      Taro.showToast({ title: '家庭创建成功', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '创建家庭失败', icon: 'none' })
    } finally {
      setIsCreateLoading(false)
    }
  }

  async function handleUpdateFamily(): Promise<void> {
    if (!session || !activeFamily) {
      Taro.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    const name = updateForm.name.trim()
    if (!name) {
      Taro.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }
    setIsUpdateLoading(true)
    try {
      const updated = await updateFamily(session, activeFamily.id, {
        name,
        timezone: updateForm.timezone,
        familyAlias: updateForm.familyAlias.trim() || undefined,
        city: updateForm.city.trim() || undefined,
        address: updateForm.address.trim() || undefined,
        notes: updateForm.notes.trim() || undefined
      })
      syncSessionFamily(updated)
      setActiveTab('')
      Taro.showToast({ title: '家庭信息已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新失败', icon: 'none' })
    } finally {
      setIsUpdateLoading(false)
    }
  }

  async function handleInvite(): Promise<void> {
    if (!session || !activeFamily) {
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
      await inviteFamilyMember(session, activeFamily.id, {
        inviteePhone: targetPhone,
        role: inviteRole,
        relationLabel: inviteRelation.trim() || undefined
      })
      setInvitePhone('')
      setActiveTab('members')
      await loadMembers(session, activeFamily.id)
      Taro.showToast({ title: '邀请已发送', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '邀请失败', icon: 'none' })
    } finally {
      setIsInviteLoading(false)
    }
  }

  async function handleSaveMember(member: FamilyMemberInviteResult): Promise<void> {
    if (!session || !activeFamily) {
      return
    }
    const draft = memberDrafts[member.id]
    if (!draft) {
      return
    }
    setSavingMemberId(member.id)
    try {
      await updateFamilyMember(session, activeFamily.id, member.id, {
        role: activeFamily.role === 'owner' ? draft.role : undefined,
        relationLabel: draft.relationLabel.trim() || undefined
      })
      await loadMembers(session, activeFamily.id)
      setEditingMemberId('')
      Taro.showToast({ title: '成员信息已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '更新成员失败', icon: 'none' })
    } finally {
      setSavingMemberId('')
    }
  }

  function canEditMember(member: FamilyMemberInviteResult): boolean {
    if (!session || !activeFamily) {
      return false
    }
    return activeFamily.role === 'owner' || member.user_id === session.user.id
  }

  function canDeleteMember(member: FamilyMemberInviteResult): boolean {
    if (!session || !activeFamily) {
      return false
    }
    if (activeFamily.role !== 'owner') {
      return false
    }
    if (member.user_id === session.user.id) {
      return false
    }
    return member.status !== 'removed'
  }

  async function handleRemoveMember(member: FamilyMemberInviteResult): Promise<void> {
    if (!session || !activeFamily || !canDeleteMember(member)) {
      return
    }

    const targetName = member.user_display_name || `成员 ${member.user_id}`
    const confirmResult = await Taro.showModal({
      title: '移除成员',
      content: `确认将“${targetName}”移出当前家庭吗？`,
      confirmText: '确认移除',
      confirmColor: '#ef5350'
    })
    if (!confirmResult.confirm) {
      return
    }

    setDeletingMemberId(member.id)
    try {
      await updateFamilyMember(session, activeFamily.id, member.id, { status: 'removed' })
      if (editingMemberId === member.id) {
        setEditingMemberId('')
      }
      await loadMembers(session, activeFamily.id)
      Taro.showToast({ title: '成员已移除', icon: 'success' })
    } catch (error) {
      Taro.showToast({ title: (error as Error).message || '移除成员失败', icon: 'none' })
    } finally {
      setDeletingMemberId('')
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
      <View className='page-shell family-manage-page'>
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
    <View className='page-shell family-manage-page'>
      {isWeb ? (
        <View className='card subpage-nav'>
          <View className='subpage-back-btn' onClick={navigateBackOrProfile}>
            <View className='subpage-back-icon' />
            <Text>返回</Text>
          </View>
          <Text className='subpage-nav-title'>家庭管理</Text>
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
                void loadMembers(session, family.id)
              }}
            >
              <Text>{family.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text className='section-title'>管理操作</Text>
      <View className='card manage-tab-card'>
        <View className='manage-tab-row'>
          {manageTabs.map((tab) => (
            <View
              key={tab.value || 'none'}
              className={`manage-tab ${activeTab === tab.value ? 'active' : ''}`}
              onClick={() => setActiveTab((prev) => (prev === tab.value ? '' : tab.value))}
            >
              <Text>{tab.label}</Text>
            </View>
          ))}
        </View>
        {activeTab === '' ? <Text className='tab-hint'>点击上方 Tab 展开对应功能。</Text> : null}
      </View>

      {activeTab === 'create' ? (
        <View className='card form-card'>
          <Text className='form-title'>创建家庭</Text>
          <View className='form-item'>
            <Text className='form-label'>家庭名称</Text>
            <Input
              className='input'
              value={createForm.name}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, name: event.detail.value }))}
              placeholder='例如 张家'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>时区</Text>
            <Picker
              mode='selector'
              range={timezoneOptions.map((item) => item.label)}
              value={Math.max(
                0,
                timezoneOptions.findIndex((item) => item.value === createForm.timezone)
              )}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  timezone: timezoneOptions[Number(event.detail.value)]?.value || 'Asia/Shanghai'
                }))
              }
            >
              <View className='input picker-like'>
                {timezoneOptions.find((item) => item.value === createForm.timezone)?.label || '中国·上海'}
              </View>
            </Picker>
          </View>
          <View className='form-item'>
            <Text className='form-label'>家庭别名</Text>
            <Input
              className='input'
              value={createForm.familyAlias}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, familyAlias: event.detail.value }))}
              placeholder='例如 幸福小家'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>所在城市</Text>
            <Input
              className='input'
              value={createForm.city}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, city: event.detail.value }))}
              placeholder='例如 上海'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>详细地址</Text>
            <Input
              className='input'
              value={createForm.address}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, address: event.detail.value }))}
              placeholder='例如 浦东新区 XX 路'
            />
          </View>
          <View className='form-item'>
            <Text className='form-label'>备注</Text>
            <Input
              className='input'
              value={createForm.notes}
              onInput={(event) => setCreateForm((prev) => ({ ...prev, notes: event.detail.value }))}
              placeholder='例如 家庭照护偏好'
            />
          </View>
          <Button className='btn-primary' loading={isCreateLoading} onClick={() => void handleCreateFamily()}>
            创建家庭
          </Button>
        </View>
      ) : null}

      {activeTab === 'update' ? (
        <View className='card form-card'>
          <Text className='form-title'>更新家庭信息</Text>
          {!activeFamily ? (
            <Text className='muted'>暂无可更新家庭，请先创建。</Text>
          ) : (
            <View>
              <View className='form-item'>
                <Text className='form-label'>家庭名称</Text>
                <Input
                  className='input'
                  value={updateForm.name}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, name: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>时区</Text>
                <Picker
                  mode='selector'
                  range={timezoneOptions.map((item) => item.label)}
                  value={Math.max(
                    0,
                    timezoneOptions.findIndex((item) => item.value === updateForm.timezone)
                  )}
                  onChange={(event) =>
                    setUpdateForm((prev) => ({
                      ...prev,
                      timezone: timezoneOptions[Number(event.detail.value)]?.value || 'Asia/Shanghai'
                    }))
                  }
                >
                  <View className='input picker-like'>
                    {timezoneOptions.find((item) => item.value === updateForm.timezone)?.label || '中国·上海'}
                  </View>
                </Picker>
              </View>
              <View className='form-item'>
                <Text className='form-label'>家庭别名</Text>
                <Input
                  className='input'
                  value={updateForm.familyAlias}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, familyAlias: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>所在城市</Text>
                <Input
                  className='input'
                  value={updateForm.city}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, city: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>详细地址</Text>
                <Input
                  className='input'
                  value={updateForm.address}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, address: event.detail.value }))}
                />
              </View>
              <View className='form-item'>
                <Text className='form-label'>备注</Text>
                <Input
                  className='input'
                  value={updateForm.notes}
                  onInput={(event) => setUpdateForm((prev) => ({ ...prev, notes: event.detail.value }))}
                />
              </View>
              <Button className='btn-primary' loading={isUpdateLoading} onClick={() => void handleUpdateFamily()}>
                保存家庭信息
              </Button>
            </View>
          )}
        </View>
      ) : null}

      {activeTab === 'invite' ? (
        <View className='card form-card'>
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
            <Text className='form-label'>成员角色</Text>
            <View className='pill-row'>
              {roleOptions.map((role) => (
                <View
                  key={role.value}
                  className={`pill ${inviteRole === role.value ? 'active' : ''}`}
                  onClick={() => setInviteRole(role.value)}
                >
                  <Text>{role.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className='form-item'>
            <Text className='form-label'>关系名称（可自定义）</Text>
            <View className='pill-row relation-preset-row'>
              {relationPresets.map((relation) => (
                <View
                  key={relation}
                  className={`pill ${inviteRelation === relation ? 'active' : ''}`}
                  onClick={() => setInviteRelation(relation)}
                >
                  <Text>{relation}</Text>
                </View>
              ))}
            </View>
            <Input
              className='input invite-relation-input'
              value={inviteRelation}
              onInput={(event) => setInviteRelation(event.detail.value)}
              placeholder='可输入自定义关系，如：二舅'
            />
          </View>
          <Button className='btn-primary' loading={isInviteLoading} onClick={() => void handleInvite()}>
            发起邀请
          </Button>
        </View>
      ) : null}

      {activeTab === 'members' ? (
        <View className='card member-list-card'>
          <Text className='form-title'>成员管理</Text>
          {isMemberLoading ? <Text className='muted'>成员加载中...</Text> : null}
          {!isMemberLoading && members.length === 0 ? <Text className='muted'>暂无成员数据。</Text> : null}

          <View className='member-list'>
            {members.map((member) => {
              const draft = memberDrafts[member.id]
              const isEditing = editingMemberId === member.id
              const editable = canEditMember(member)
              const deletable = canDeleteMember(member)
              return (
                <View key={member.id} className='member-item'>
                  <View className='member-head'>
                    <View className='member-summary'>
                      <Text className='member-name'>{member.user_display_name || `成员 ${member.user_id}`}</Text>
                      <Text className='member-meta'>
                        状态：{statusLabelMap[member.status] || member.status} / 角色：
                        {roleLabelMap[member.role] || member.role}
                      </Text>
                      {member.relation_label ? (
                        <Text className='member-relation'>关系名称：{member.relation_label}</Text>
                      ) : (
                        <Text className='member-relation muted'>关系名称：未设置</Text>
                      )}
                    </View>
                    <View className='member-actions'>
                      <Button
                        className='member-action-btn'
                        size='mini'
                        disabled={!editable}
                        onClick={() => setEditingMemberId((prev) => (prev === member.id ? '' : member.id))}
                      >
                        {isEditing ? '收起' : '编辑'}
                      </Button>
                      <Button
                        className='member-action-btn danger'
                        size='mini'
                        disabled={!deletable}
                        loading={deletingMemberId === member.id}
                        onClick={() => void handleRemoveMember(member)}
                      >
                        删除
                      </Button>
                    </View>
                  </View>

                  {isEditing ? (
                    <View className='member-editor'>
                      <View className='form-item member-relation-item'>
                        <Text className='form-label'>关系名称</Text>
                        <Input
                          className='input'
                          value={draft?.relationLabel || ''}
                          onInput={(event) =>
                            setMemberDrafts((prev) => ({
                              ...prev,
                              [member.id]: {
                                role: draft?.role || member.role,
                                relationLabel: event.detail.value
                              }
                            }))
                          }
                          placeholder='例如 爸爸、妈妈、二舅'
                        />
                      </View>

                      {activeFamily?.role === 'owner' ? (
                        <View className='member-role-item'>
                          <Text className='form-label'>成员角色</Text>
                          <View className='pill-row member-role-row'>
                            {roleOptions.map((role) => (
                              <View
                                key={role.value}
                                className={`pill ${draft?.role === role.value ? 'active' : ''}`}
                                onClick={() =>
                                  setMemberDrafts((prev) => ({
                                    ...prev,
                                    [member.id]: {
                                      role: role.value,
                                      relationLabel: draft?.relationLabel || ''
                                    }
                                  }))
                                }
                              >
                                <Text>{role.label}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ) : null}

                      <View className='member-editor-actions'>
                        <Button className='member-cancel-btn' onClick={() => setEditingMemberId('')}>
                          取消
                        </Button>
                        <Button
                          className='member-save-btn'
                          loading={savingMemberId === member.id}
                          onClick={() => void handleSaveMember(member)}
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
      ) : null}
    </View>
  )
}
