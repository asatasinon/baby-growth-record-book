import Taro from '@tarojs/taro'

import type { ApiEnvelope } from '@/types/domain'

declare const __API_BASE_URL__: string

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  path: string
  method?: HttpMethod
  token?: string
  data?: Record<string, unknown>
  query?: Record<string, string | number | undefined | null>
}

function resolveApiBaseUrl(): string {
  const normalized = __API_BASE_URL__?.trim()
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    throw new Error('Invalid __API_BASE_URL__ injected at build time')
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
    .filter(([_key, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)

  if (params.length === 0) {
    return base
  }
  return `${base}?${params.join('&')}`
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const response = await Taro.request<ApiEnvelope<T>>({
    url: buildUrl(options.path, options.query),
    method: options.method || 'GET',
    data: options.data,
    header: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    }
  })

  if (response.statusCode >= 400) {
    const message = (response.data as ApiEnvelope<T> | undefined)?.message || '请求失败'
    throw new Error(message)
  }

  const payload = response.data
  if (!payload || typeof payload !== 'object') {
    throw new Error('服务返回格式错误')
  }

  if (payload.code !== 'OK') {
    throw new Error(payload.message || '请求失败')
  }

  return payload.data
}
