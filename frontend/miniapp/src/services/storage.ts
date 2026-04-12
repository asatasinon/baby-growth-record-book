import Taro from '@tarojs/taro'

import type { AuthSession } from '@/types/domain'

const KEY_SESSION = 'baby-growth:mvp:session'
const KEY_ACTIVE_FAMILY = 'baby-growth:mvp:active-family'
const KEY_ACTIVE_BABY = 'baby-growth:mvp:active-baby'

export function getSession(): AuthSession | null {
  try {
    const raw = Taro.getStorageSync(KEY_SESSION)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as AuthSession
  } catch (_error) {
    return null
  }
}

export function saveSession(session: AuthSession): void {
  Taro.setStorageSync(KEY_SESSION, JSON.stringify(session))
}

export function clearSession(): void {
  Taro.removeStorageSync(KEY_SESSION)
  Taro.removeStorageSync(KEY_ACTIVE_FAMILY)
  Taro.removeStorageSync(KEY_ACTIVE_BABY)
}

export function getActiveFamilyId(session?: AuthSession | null): string | null {
  const activeFamilyId = Taro.getStorageSync(KEY_ACTIVE_FAMILY) as string
  if (activeFamilyId) {
    return activeFamilyId
  }
  if (session && session.families.length > 0) {
    return session.families[0].id
  }
  return null
}

export function setActiveFamilyId(familyId: string): void {
  Taro.setStorageSync(KEY_ACTIVE_FAMILY, familyId)
}

export function getActiveBabyId(): string | null {
  return (Taro.getStorageSync(KEY_ACTIVE_BABY) as string) || null
}

export function setActiveBabyId(babyId: string): void {
  Taro.setStorageSync(KEY_ACTIVE_BABY, babyId)
}

export function clearActiveBabyId(): void {
  Taro.removeStorageSync(KEY_ACTIVE_BABY)
}
