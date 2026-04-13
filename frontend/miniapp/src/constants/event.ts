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

export const FEEDING_TYPE_OPTIONS = [
  { value: 'formula_bottle', label: '配方奶瓶喂' },
  { value: 'breast_bottle', label: '母乳瓶喂' },
  { value: 'breast_direct', label: '母乳亲喂' }
] as const

export type FeedingTypeValue = (typeof FEEDING_TYPE_OPTIONS)[number]['value']

export const FEEDING_TYPE_LABEL_MAP: Record<FeedingTypeValue, string> = {
  formula_bottle: '配方奶瓶喂',
  breast_bottle: '母乳瓶喂',
  breast_direct: '母乳亲喂'
}

export const FEEDING_TYPE_COLOR_MAP: Record<FeedingTypeValue, string> = {
  formula_bottle: '#0f6bd8',
  breast_bottle: '#26c1b4',
  breast_direct: '#ff815f'
}

export const EXCRETION_TYPE_OPTIONS = [
  { value: 'urine', label: '小便' },
  { value: 'stool', label: '大便' }
] as const

export type ExcretionTypeValue = (typeof EXCRETION_TYPE_OPTIONS)[number]['value']

export const EXCRETION_TYPE_COLOR_MAP: Record<ExcretionTypeValue, string> = {
  urine: '#0eae79',
  stool: '#f59f2f'
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
