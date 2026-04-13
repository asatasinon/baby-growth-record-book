import type { EventType } from '@/types/domain'

export const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: 'feeding', label: '喂养' },
  { value: 'excretion', label: '排泄' },
  { value: 'sleep', label: '睡眠' },
  { value: 'measurement', label: '测量' },
  { value: 'medication', label: '用药' },
  { value: 'vaccine', label: '疫苗' },
  { value: 'milestone', label: '里程碑' }
]

export const QUICK_EVENT_TYPES: EventType[] = [
  'feeding',
  'excretion',
  'sleep',
  'measurement',
  'medication',
  'vaccine',
  'milestone'
]

export const EVENT_TYPE_LABEL_MAP: Record<EventType, string> = {
  feeding: '喂养',
  excretion: '排泄',
  measurement: '测量',
  sleep: '睡眠',
  medication: '用药',
  vaccine: '疫苗',
  milestone: '里程碑'
}

export const EXCRETION_LABEL_MAP: Record<string, string> = {
  urine: '小便',
  stool: '大便',
  mixed: '混合',
  unknown: '未标注'
}

export const EVENT_TYPE_COLOR_MAP: Record<EventType, string> = {
  feeding: '#0e8fd1',
  excretion: '#0eae79',
  measurement: '#f59f2f',
  sleep: '#3e63c9',
  medication: '#ef5350',
  vaccine: '#1f9fb8',
  milestone: '#ff815f'
}
