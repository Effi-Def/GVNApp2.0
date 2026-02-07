import { APP_CONFIG } from '../constants'
import { Event, EventParticipation, EventParticipationAccessLevel, EventParticipationStatus } from '../types'

export function getUserKeys(user: { id?: string; email?: string } | null | undefined): string[] {
  return [user?.id, user?.email].filter((v): v is string => typeof v === 'string' && v.length > 0)
}

export type UserEventParticipation = {
  status: EventParticipationStatus | 'none'
  accessLevel: EventParticipationAccessLevel
  entry?: EventParticipation
}

export function getUserEventParticipation(event: Event, userKeys: string[]): UserEventParticipation {
  if (userKeys.length === 0) {
    return { status: 'none', accessLevel: 'none' }
  }

  // Creator always has full access
  if (userKeys.includes(event.createdBy)) {
    return { status: 'yes', accessLevel: 'full' }
  }

  // Prefer explicit participation map
  const participationMap = event.participation
  if (participationMap && typeof participationMap === 'object') {
    for (const key of userKeys) {
      const entry = (participationMap as any)[key] as EventParticipation | undefined
      if (entry?.status && entry?.accessLevel) {
        return { status: entry.status, accessLevel: entry.accessLevel, entry }
      }
    }
  }

  // Fallback: legacy participants array
  const legacy = (event.participants || []).find(p => userKeys.includes(p.userId))
  if (legacy) {
    return {
      status: legacy.status,
      accessLevel: legacy.status === 'no' ? 'readonly' : 'full',
    }
  }

  return { status: 'none', accessLevel: 'none' }
}

export function userCanViewEvent(event: Event, userKeys: string[]): boolean {
  if (userKeys.length === 0) return true

  // Creator can always view
  if (userKeys.includes(event.createdBy)) return true

  // Visibility rules (P0 groundwork: public or restricted-to-users)
  if (event.visibility?.type === 'public') return true
  if (event.visibility?.type === 'restricted') {
    const users = event.visibility.users || []
    if (users.some(u => userKeys.includes(u))) return true
  }

  // Participation (any status implies visibility, including 'no')
  const p = getUserEventParticipation(event, userKeys)
  return p.status !== 'none'
}

// Historical name: used for event selection (expenses/polls/lists).
// Keep it as "selectable from dropdowns".
// NOTE: Full write permissions are enforced elsewhere (and will be refined with farms/accessLevel).
export function userCanSeeEvent(event: Event, userKeys: string[]): boolean {
  return userCanViewEvent(event, userKeys)
}

export function userCanChat(event: Event, userKeys: string[]): boolean {
  const p = getUserEventParticipation(event, userKeys)
  return p.accessLevel === 'full' && p.status === 'yes'
}

export function isEventExpiredForSelection(
  event: Event,
  now: Date = new Date(),
  endedGraceDays: number = APP_CONFIG.EVENT_ENDED_GRACE_DAYS
): boolean {
  const end = new Date(event.endDate ?? event.date)
  end.setHours(23, 59, 59, 999)
  const cutoff = end.getTime() + endedGraceDays * 24 * 60 * 60 * 1000
  return now.getTime() > cutoff
}

export function filterSelectableEvents(
  events: Event[],
  userKeys: string[],
  now: Date = new Date(),
  endedGraceDays: number = APP_CONFIG.EVENT_ENDED_GRACE_DAYS
): Event[] {
  return events
    .filter(ev => userCanSeeEvent(ev, userKeys))
    .filter(ev => !isEventExpiredForSelection(ev, now, endedGraceDays))
}
