export type EventType =
  | 'feeding'
  | 'excretion'
  | 'measurement'
  | 'sleep'
  | 'medication'
  | 'vaccine'
  | 'milestone'

export interface ApiEnvelope<T> {
  code: string
  message: string
  data: T
}

export interface FamilyInfo {
  id: string
  name: string
  role: 'owner' | 'caregiver' | 'viewer'
  timezone: string
}

export type FamilyMemberRole = 'owner' | 'caregiver' | 'viewer'

export type FamilyMemberStatus = 'pending' | 'active' | 'removed'

export interface UserInfo {
  id: string
  display_name: string
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

export interface DailyAlert {
  id: string
  severity: 'info' | 'warning' | 'high'
  title: string
  status: 'open' | 'acknowledged' | 'resolved'
  triggered_at: number
}

export interface AlertEvent extends DailyAlert {
  family_id: string
  baby_id: string
  content: string
  acknowledged_at: number | null
  resolved_at: number | null
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
}

export interface FamilyMemberInviteResult {
  id: string
  family_id: string
  user_id: string
  role: FamilyMemberRole
  status: FamilyMemberStatus
}

export interface DailySummary {
  summary_date: number
  feeding_total_ml: number
  feeding_breakdown: Record<string, number>
  excretion_count_total: number
  excretion_breakdown: Record<string, number>
  sleep_total_minutes: number
  last_measurement_snapshot: Record<string, unknown>
  alerts: DailyAlert[]
}

export interface TrendPoint {
  bucket_date: number
  value: number
}

export interface TrendResult {
  family_id: string
  baby_id: string
  metric_code: string
  unit: string
  bucket: 'day' | 'week' | 'month'
  window: {
    date_from: number
    date_to: number
  }
  points: TrendPoint[]
}

export interface AiAnswer {
  answer: string
  window_start: number
  window_end: number
  disclaimer: string
}

export interface PeriodSummaryPayload {
  feeding_total_ml: number
  feeding_breakdown: Record<string, number>
  excretion_count_total: number
  excretion_breakdown: Record<string, number>
  sleep_total_minutes: number
  last_measurement_snapshot: Record<string, unknown>
}

export interface WeeklySummary {
  family_id: string
  baby_id: string
  week_start: number
  summary_payload: PeriodSummaryPayload
}

export interface MonthlySummary {
  family_id: string
  baby_id: string
  month: number
  summary_payload: PeriodSummaryPayload
}

export type ExportReportType = 'daily' | 'weekly' | 'monthly' | 'custom'

export type ExportTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'expired'

export interface ExportTask {
  id: string
  family_id: string
  baby_id: string
  report_type: ExportReportType
  status: ExportTaskStatus
  date_from: number
  date_to: number
  download_url: string | null
  expires_at: number | null
}

export interface ExportTaskCreateResult {
  id: string
  status: ExportTaskStatus
  download_url: string | null
  expires_at: number | null
}
