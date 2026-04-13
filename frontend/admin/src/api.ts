import type {
  AlertEvent,
  ApiEnvelope,
  AuthSession,
  BabyInfo,
  ExportTask,
  FamilyInfo,
  GrowthEvent
} from './types'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  path: string
  method?: HttpMethod
  token?: string
  query?: Record<string, string | number | undefined | null>
  data?: Record<string, unknown>
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1'

function resolveApiBaseUrl(): string {
  const rawValue = import.meta.env.VITE_API_BASE_URL as string | undefined
  const normalized = rawValue?.trim()
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return DEFAULT_API_BASE_URL
  }
  return normalized.replace(/\/+$/, '')
}

const API_BASE_URL = resolveApiBaseUrl()

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = `${API_BASE_URL}${normalizedPath}`

  if (!query) {
    return base
  }

  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)

  if (params.length === 0) {
    return base
  }

  return `${base}?${params.join('&')}`
}

async function request<T>(options: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(options.path, options.query), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.data ? JSON.stringify(options.data) : undefined
  })

  const envelope = (await response.json()) as ApiEnvelope<T>

  if (!response.ok) {
    throw new Error(envelope.message || '请求失败')
  }

  if (!envelope || envelope.code !== 'OK') {
    throw new Error(envelope?.message || '服务返回错误')
  }

  return envelope.data
}

export function loginWithPassword(phone: string, password: string): Promise<AuthSession> {
  return request<AuthSession>({
    path: '/auth/password/login',
    method: 'POST',
    data: {
      phone,
      password
    }
  })
}

export function listAdminFamilies(token: string): Promise<FamilyInfo[]> {
  return request<FamilyInfo[]>({
    path: '/admin/families',
    token
  })
}

export function listAdminBabies(token: string): Promise<BabyInfo[]> {
  return request<BabyInfo[]>({
    path: '/admin/babies',
    token
  })
}

export function listAdminEvents(token: string): Promise<GrowthEvent[]> {
  return request<GrowthEvent[]>({
    path: '/admin/events',
    token
  })
}

export function listAlerts(token: string, familyId: string): Promise<AlertEvent[]> {
  return request<AlertEvent[]>({
    path: '/alerts',
    token,
    query: {
      family_id: familyId
    }
  })
}

export function listExportTasks(token: string, familyId: string): Promise<ExportTask[]> {
  return request<ExportTask[]>({
    path: '/reports/exports',
    token,
    query: {
      family_id: familyId
    }
  })
}
