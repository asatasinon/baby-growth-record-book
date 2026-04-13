import { request } from '@/services/http'
import type {
  AlertEvent,
  AlertRule,
  AiAnswer,
  AuthSession,
  BabyInfo,
  DailySummary,
  EventType,
  ExportReportType,
  ExportTask,
  ExportTaskCreateResult,
  FamilyInfo,
  FamilyMemberInviteResult,
  GrowthEvent,
  MonthlySummary,
  TrendResult,
  WeeklySummary
} from '@/types/domain'

interface SessionContext {
  session: AuthSession
  familyId: string
}

interface SessionBabyContext extends SessionContext {
  babyId: string
}

export async function loginWithPassword(phone: string, password: string): Promise<AuthSession> {
  return request<AuthSession>({
    path: '/auth/password/login',
    method: 'POST',
    data: { phone, password }
  })
}

export async function registerWithPassword(
  phone: string,
  password: string,
  displayName?: string
): Promise<AuthSession> {
  return request<AuthSession>({
    path: '/auth/register',
    method: 'POST',
    data: {
      phone,
      password,
      display_name: displayName || undefined
    }
  })
}

interface CreateFamilyPayload {
  name: string
  timezone?: string
  familyAlias?: string
  city?: string
  address?: string
  notes?: string
}

export async function createFamily(
  session: AuthSession,
  payload: CreateFamilyPayload
): Promise<FamilyInfo> {
  return request<FamilyInfo>({
    path: '/families',
    method: 'POST',
    token: session.access_token,
    data: {
      name: payload.name,
      timezone: payload.timezone || 'Asia/Shanghai',
      family_alias: payload.familyAlias,
      city: payload.city,
      address: payload.address,
      notes: payload.notes
    }
  })
}

interface UpdateFamilyPayload {
  name?: string
  timezone?: string
  familyAlias?: string
  city?: string
  address?: string
  notes?: string
}

export async function updateFamily(
  session: AuthSession,
  familyId: string,
  payload: UpdateFamilyPayload
): Promise<FamilyInfo> {
  return request<FamilyInfo>({
    path: `/families/${familyId}`,
    method: 'PATCH',
    token: session.access_token,
    data: {
      name: payload.name,
      timezone: payload.timezone,
      family_alias: payload.familyAlias,
      city: payload.city,
      address: payload.address,
      notes: payload.notes
    }
  })
}

interface InviteFamilyMemberPayload {
  inviteePhone: string
  role: 'owner' | 'caregiver' | 'viewer'
  relationLabel?: string
}

export async function inviteFamilyMember(
  session: AuthSession,
  familyId: string,
  payload: InviteFamilyMemberPayload
): Promise<FamilyMemberInviteResult> {
  return request<FamilyMemberInviteResult>({
    path: `/families/${familyId}/members`,
    method: 'POST',
    token: session.access_token,
    data: {
      invitee_phone: payload.inviteePhone,
      role: payload.role,
      relation_label: payload.relationLabel
    }
  })
}

export async function listFamilyMembers(
  session: AuthSession,
  familyId: string
): Promise<FamilyMemberInviteResult[]> {
  return request<FamilyMemberInviteResult[]>({
    path: `/families/${familyId}/members`,
    token: session.access_token
  })
}

interface UpdateFamilyMemberPayload {
  role?: 'owner' | 'caregiver' | 'viewer'
  status?: 'pending' | 'active' | 'removed'
  relationLabel?: string
}

export async function updateFamilyMember(
  session: AuthSession,
  familyId: string,
  memberId: string,
  payload: UpdateFamilyMemberPayload
): Promise<FamilyMemberInviteResult> {
  return request<FamilyMemberInviteResult>({
    path: `/families/${familyId}/members/${memberId}`,
    method: 'PATCH',
    token: session.access_token,
    data: {
      role: payload.role,
      status: payload.status,
      relation_label: payload.relationLabel
    }
  })
}

export async function listBabies(context: SessionContext): Promise<BabyInfo[]> {
  return request<BabyInfo[]>({
    path: '/babies',
    token: context.session.access_token,
    query: {
      family_id: context.familyId
    }
  })
}

interface CreateBabyPayload {
  name: string
  nickname?: string
  gender?: 'male' | 'female' | 'unknown'
  birthDateMs: number
  birthPlace?: string
  birthWeightG?: number
  birthHeightCm?: number
  birthHeadCircumferenceCm?: number
}

export async function createBaby(
  context: SessionContext,
  payload: CreateBabyPayload
): Promise<BabyInfo> {
  return request<BabyInfo>({
    path: '/babies',
    method: 'POST',
    token: context.session.access_token,
    data: {
      family_id: context.familyId,
      name: payload.name,
      nickname: payload.nickname,
      gender: payload.gender || 'unknown',
      birth_date: payload.birthDateMs,
      birth_place: payload.birthPlace,
      birth_weight_g: payload.birthWeightG,
      birth_height_cm: payload.birthHeightCm,
      birth_head_circumference_cm: payload.birthHeadCircumferenceCm
    }
  })
}

interface UpdateBabyPayload {
  name?: string
  nickname?: string
  gender?: 'male' | 'female' | 'unknown'
  birthDateMs?: number
  birthPlace?: string
  birthWeightG?: number
  birthHeightCm?: number
  birthHeadCircumferenceCm?: number
}

export async function updateBaby(
  session: AuthSession,
  babyId: string,
  payload: UpdateBabyPayload
): Promise<BabyInfo> {
  return request<BabyInfo>({
    path: `/babies/${babyId}`,
    method: 'PATCH',
    token: session.access_token,
    data: {
      name: payload.name,
      nickname: payload.nickname,
      gender: payload.gender,
      birth_date: payload.birthDateMs,
      birth_place: payload.birthPlace,
      birth_weight_g: payload.birthWeightG,
      birth_height_cm: payload.birthHeightCm,
      birth_head_circumference_cm: payload.birthHeadCircumferenceCm
    }
  })
}

interface ListEventsParams extends SessionBabyContext {
  eventType?: EventType
  dateFrom?: number
  dateTo?: number
}

export async function listEvents(params: ListEventsParams): Promise<GrowthEvent[]> {
  return request<GrowthEvent[]>({
    path: '/events',
    token: params.session.access_token,
    query: {
      family_id: params.familyId,
      baby_id: params.babyId,
      event_type: params.eventType,
      date_from: params.dateFrom,
      date_to: params.dateTo
    }
  })
}

interface CreateEventPayload extends SessionBabyContext {
  eventType: EventType
  occurredAt: number
  startAt?: number
  endAt?: number
  notes?: string
  payload: Record<string, unknown>
}

export async function createEvent(payload: CreateEventPayload): Promise<GrowthEvent> {
  return request<GrowthEvent>({
    path: '/events',
    method: 'POST',
    token: payload.session.access_token,
    data: {
      family_id: payload.familyId,
      baby_id: payload.babyId,
      event_type: payload.eventType,
      occurred_at: payload.occurredAt,
      start_at: payload.startAt,
      end_at: payload.endAt,
      timezone: 'Asia/Shanghai',
      notes: payload.notes,
      payload: payload.payload
    }
  })
}

export async function getEvent(session: AuthSession, eventId: string): Promise<GrowthEvent> {
  return request<GrowthEvent>({
    path: `/events/${eventId}`,
    token: session.access_token
  })
}

interface UpdateEventPayload {
  occurredAt?: number
  startAt?: number
  endAt?: number
  notes?: string
  payload?: Record<string, unknown>
}

export async function updateEvent(
  session: AuthSession,
  eventId: string,
  payload: UpdateEventPayload
): Promise<GrowthEvent> {
  return request<GrowthEvent>({
    path: `/events/${eventId}`,
    method: 'PATCH',
    token: session.access_token,
    data: {
      occurred_at: payload.occurredAt,
      start_at: payload.startAt,
      end_at: payload.endAt,
      notes: payload.notes,
      payload: payload.payload
    }
  })
}

export async function deleteEvent(
  session: AuthSession,
  eventId: string
): Promise<{ id: string; status: 'deleted' }> {
  return request<{ id: string; status: 'deleted' }>({
    path: `/events/${eventId}`,
    method: 'DELETE',
    token: session.access_token
  })
}

interface DailySummaryParams extends SessionBabyContext {
  date: number
}

export async function getDailySummary(params: DailySummaryParams): Promise<DailySummary> {
  return request<DailySummary>({
    path: '/summaries/daily',
    token: params.session.access_token,
    query: {
      family_id: params.familyId,
      baby_id: params.babyId,
      date: params.date
    }
  })
}

interface TrendParams extends SessionBabyContext {
  metricCode: 'feeding_total_ml' | 'sleep_total_minutes' | 'excretion_count_total' | 'weight_g'
  dateFrom: number
  dateTo: number
}

export async function getTrendPoints(params: TrendParams): Promise<TrendResult> {
  return request<TrendResult>({
    path: '/analytics/trends',
    token: params.session.access_token,
    query: {
      family_id: params.familyId,
      baby_id: params.babyId,
      metric_code: params.metricCode,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      bucket: 'minute'
    }
  })
}

interface AiQueryParams extends SessionBabyContext {
  question: string
}

export async function queryAi(params: AiQueryParams): Promise<AiAnswer> {
  return request<AiAnswer>({
    path: '/ai/query',
    method: 'POST',
    token: params.session.access_token,
    data: {
      family_id: params.familyId,
      baby_id: params.babyId,
      question: params.question
    }
  })
}

interface ListAlertsParams extends SessionContext {
  babyId?: string
}

export async function listAlerts(params: ListAlertsParams): Promise<AlertEvent[]> {
  return request<AlertEvent[]>({
    path: '/alerts',
    token: params.session.access_token,
    query: {
      family_id: params.familyId,
      baby_id: params.babyId
    }
  })
}

interface CreateAlertRuleParams extends SessionContext {
  ruleType: string
  thresholdValue?: number
  windowHours?: number
  windowDays?: number
  severity: 'info' | 'warning' | 'high'
  enabled?: boolean
}

export async function createAlertRule(params: CreateAlertRuleParams): Promise<AlertRule> {
  return request<AlertRule>({
    path: '/alerts/rules',
    method: 'POST',
    token: params.session.access_token,
    data: {
      family_id: params.familyId,
      rule_type: params.ruleType,
      threshold_value: params.thresholdValue,
      window_hours: params.windowHours,
      window_days: params.windowDays,
      severity: params.severity,
      enabled: params.enabled ?? true
    }
  })
}

export async function acknowledgeAlert(
  session: AuthSession,
  alertId: string
): Promise<{ id: string; status: 'open' | 'acknowledged' | 'resolved'; acknowledged_at: number | null }> {
  return request<{ id: string; status: 'open' | 'acknowledged' | 'resolved'; acknowledged_at: number | null }>({
    path: `/alerts/${alertId}/ack`,
    method: 'PATCH',
    token: session.access_token
  })
}

interface CreateExportTaskParams extends SessionBabyContext {
  reportType: ExportReportType
  dateFrom: number
  dateTo: number
}

export async function createExportTask(params: CreateExportTaskParams): Promise<ExportTaskCreateResult> {
  return request<ExportTaskCreateResult>({
    path: '/reports/export',
    method: 'POST',
    token: params.session.access_token,
    data: {
      family_id: params.familyId,
      baby_id: params.babyId,
      report_type: params.reportType,
      date_from: params.dateFrom,
      date_to: params.dateTo
    }
  })
}

export async function listExportTasks(context: SessionContext): Promise<ExportTask[]> {
  return request<ExportTask[]>({
    path: '/reports/exports',
    token: context.session.access_token,
    query: {
      family_id: context.familyId
    }
  })
}

export async function getExportTask(
  session: AuthSession,
  taskId: string
): Promise<ExportTaskCreateResult> {
  return request<ExportTaskCreateResult>({
    path: `/reports/exports/${taskId}`,
    token: session.access_token
  })
}

interface WeeklySummaryParams extends SessionBabyContext {
  weekStart: number
}

export async function getWeeklySummary(params: WeeklySummaryParams): Promise<WeeklySummary> {
  return request<WeeklySummary>({
    path: '/summaries/weekly',
    token: params.session.access_token,
    query: {
      family_id: params.familyId,
      baby_id: params.babyId,
      week_start: params.weekStart
    }
  })
}

interface MonthlySummaryParams extends SessionBabyContext {
  monthStart: number
}

export async function getMonthlySummary(params: MonthlySummaryParams): Promise<MonthlySummary> {
  return request<MonthlySummary>({
    path: '/summaries/monthly',
    token: params.session.access_token,
    query: {
      family_id: params.familyId,
      baby_id: params.babyId,
      month: params.monthStart
    }
  })
}
