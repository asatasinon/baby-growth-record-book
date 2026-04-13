import { request } from '@/services/http'
import type {
  AlertEvent,
  AiAnswer,
  AuthSession,
  BabyInfo,
  DailySummary,
  EventType,
  ExportReportType,
  ExportTask,
  ExportTaskCreateResult,
  GrowthEvent,
  TrendResult
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
  birthWeightG?: number
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
      birth_weight_g: payload.birthWeightG
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
      timezone: 'Asia/Shanghai',
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
      bucket: 'day'
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
