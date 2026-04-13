export interface ApiEnvelope<T> {
  code: string
  message: string
  data: T
}

export type FamilyRole = 'owner' | 'caregiver' | 'viewer'

export interface UserInfo {
  id: string
  display_name: string
}

export interface FamilyInfo {
  id: string
  name: string
  role: FamilyRole
  timezone: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  user: UserInfo
  families: FamilyInfo[]
}

export interface BabyInfo {
  id: string
  family_id: string
  name: string
  nickname: string | null
  gender: 'male' | 'female' | 'unknown'
  birth_date: number
  birth_weight_g: number | null
  birth_height_cm: number | null
  birth_head_circumference_cm: number | null
}

export type EventType =
  | 'feeding'
  | 'excretion'
  | 'measurement'
  | 'sleep'
  | 'medication'
  | 'vaccine'
  | 'milestone'

export interface GrowthEvent {
  id: string
  family_id: string
  baby_id: string
  event_type: EventType
  occurred_at: number
  start_at: number | null
  end_at: number | null
  timezone: string
  notes: string | null
  payload: Record<string, unknown>
  status: 'active' | 'deleted'
}

export interface AlertEvent {
  id: string
  family_id: string
  baby_id: string
  severity: 'info' | 'warning' | 'high'
  title: string
  content: string
  status: 'open' | 'acknowledged' | 'resolved'
  triggered_at: number
  acknowledged_at: number | null
  resolved_at: number | null
}

export interface ExportTask {
  id: string
  family_id: string
  baby_id: string
  report_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'expired'
  date_from: number
  date_to: number
  download_url: string | null
  expires_at: number | null
}

export interface AlertRule {
  id: string
  family_id: string
  rule_type: string
  threshold_value: number | null
  window_hours: number | null
  window_days: number | null
  severity: 'info' | 'warning' | 'high'
  enabled: boolean
  config?: Record<string, unknown>
  created_by?: string | null
  created_at?: number
  updated_at?: number
}

export interface AiConversation {
  id: string
  family_id: string
  baby_id: string
  asked_by: string | null
  question: string
  answer: string
  model_name: string | null
  context_window: Record<string, unknown> | null
  status: string
  error_message: string | null
  created_at: number
}

export interface DictConfigItem {
  key: string
  value: string
  description: string
  editable: boolean
}

export interface SystemSettingItem {
  key: string
  value: string
  description: string
}
