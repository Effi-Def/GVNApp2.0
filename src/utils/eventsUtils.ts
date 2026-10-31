import { Event } from '../types'

export type ComputedEventStatus = 'today' | 'upcoming' | 'future' | 'past'

export type EventStatusInfo = {
  status: ComputedEventStatus
  label: string
  daysUntil?: number
  countdownText?: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function safeToDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeToDate = (value as any).toDate
    if (typeof maybeToDate === 'function') {
      const d = maybeToDate.call(value)
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
    }
  }

  return null
}

export function getEventStatus(event: Pick<Event, 'date'>, now: Date = new Date()): EventStatusInfo {
  const eventDate = safeToDate((event as any).date)
  if (!eventDate) {
    return { status: 'future', label: 'Futuro' }
  }

  const today = startOfDay(now)
  const eventDay = startOfDay(eventDate)

  const diffMs = eventDay.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / MS_PER_DAY)

  if (diffDays < 0) return { status: 'past', label: 'Passato' }
  if (diffDays === 0) return { status: 'today', label: 'Oggi' }

  if (diffDays <= 3) {
    const countdownText = diffDays === 1 ? 'Tra 1 giorno' : `Tra ${diffDays} giorni`
    return { status: 'upcoming', label: 'In arrivo', daysUntil: diffDays, countdownText }
  }

  return { status: 'future', label: 'Futuro', daysUntil: diffDays }
}
