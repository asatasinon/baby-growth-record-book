export const MINUTE_MS = 60 * 1000
export const DAY_MS = 24 * 60 * 60 * 1000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function startOfDayMs(input: number = Date.now()): number {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function formatDate(input: number): string {
  const date = new Date(input)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatMonthDay(input: number): string {
  const date = new Date(input)
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatMonthDayTime(input: number): string {
  const date = new Date(input)
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDateTime(input: number): string {
  const date = new Date(input)
  return `${formatDate(input)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatTime(input: number): string {
  const date = new Date(input)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return '0 分钟'
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) {
    return `${minutes} 分钟`
  }
  if (minutes <= 0) {
    return `${hours} 小时`
  }
  return `${hours} 小时 ${minutes} 分钟`
}

export function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
  } catch (_error) {
    return 'Asia/Shanghai'
  }
}

export function dayWindow(days: number): { dateFrom: number; dateTo: number } {
  const dateTo = Date.now()
  const dateFrom = startOfDayMs(dateTo - (days - 1) * DAY_MS)
  return { dateFrom, dateTo }
}

export function startOfWeekMs(input: number = Date.now()): number {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const offset = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - offset)
  return date.getTime()
}

export function startOfMonthMs(input: number = Date.now()): number {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  return date.getTime()
}

export function parseDateToStartMs(dateText: string): number {
  const normalized = `${dateText}T00:00:00`
  const parsed = new Date(normalized).getTime()
  if (Number.isNaN(parsed)) {
    return startOfDayMs()
  }
  return startOfDayMs(parsed)
}

export function parseDateTimeToMs(dateText: string, timeText: string): number {
  const normalized = `${dateText}T${timeText}:00`
  const parsed = new Date(normalized).getTime()
  if (Number.isNaN(parsed)) {
    return Date.now()
  }
  return parsed
}
