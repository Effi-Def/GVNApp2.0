import { APP_CONFIG } from '../constants'
import { Event, EventParticipation, EventParticipationAccessLevel, EventParticipationStatus } from '../types'

export function getUserKeys(user: { id?: string; email?: string } | null | undefined): string[] {
  return [user?.id, user?.email].filter((v): v is string => typeof v === 'string' && v.length > 0)
}

export type UserVisibilityContext = {
  userKeys: string[]
  farmIds: string[]
}

function _ctx(keysOrCtx: string[] | UserVisibilityContext): UserVisibilityContext {
  if (Array.isArray(keysOrCtx)) return { userKeys: keysOrCtx, farmIds: [] }
  return { userKeys: keysOrCtx.userKeys || [], farmIds: keysOrCtx.farmIds || [] }
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

export function userCanViewEvent(event: Event, userKeysOrCtx: string[] | UserVisibilityContext): boolean {
  const { userKeys, farmIds } = _ctx(userKeysOrCtx)

  // Determine whether the event declares explicit farm ownership.
  const eventFarms: string[] = Array.isArray(event.visibility?.farms) && event.visibility!.farms.length > 0
    ? event.visibility!.farms
    : []

  // "Globally public" = { type: 'public' } with no farm tags → visible in all contexts.
  // "Unscoped"        = legacy/restricted events with no farm tags → personal/farm-unknown.
  const isGlobalPublic = event.visibility?.type === 'public' && eventFarms.length === 0
  const isUnscoped = eventFarms.length === 0 && !isGlobalPublic
  const inFarmCtx = farmIds.length > 0

  // Hard farm gate: applies when a farm context is active AND the event has an explicit farm list.
  if (inFarmCtx && eventFarms.length > 0) {
    if (!eventFarms.some(fid => farmIds.includes(fid))) return false
    // Gate passed → continue to permission checks.
  }

  if (userKeys.length === 0) return true

  // Globally-public events: visible to everyone in any context.
  if (isGlobalPublic) return true

  // Unscoped events in an active farm context: skip the creator bypass and rely only on
  // explicit participant/participation records. This prevents old/legacy events (created
  // before farm scoping existed) from bleeding into every farm the user navigates to.
  // Note: the creator is always added to the participants array at creation time, so they
  // will still see their own events through the participation check below.
  if (isUnscoped && inFarmCtx) {
    // Check new-style participation map
    const participationMap = event.participation
    if (participationMap && typeof participationMap === 'object') {
      for (const key of userKeys) {
        const entry = (participationMap as any)[key] as EventParticipation | undefined
        if (entry?.status && entry?.accessLevel) return true
      }
    }
    // Check legacy participants array (creator is added here at event-creation time)
    return (event.participants || []).some(p => userKeys.includes(p.userId))
  }

  // From here: no farm context, OR event has explicit farm declaration that passed the gate.

  // Creator can always view.
  if (userKeys.includes(event.createdBy)) return true

  if (event.visibility?.type === 'restricted') {
    const users = event.visibility.users || []
    if (users.some(u => userKeys.includes(u))) return true

    const farms = event.visibility.farms || []
    if (farms.length > 0 && farmIds.length > 0) {
      if (farms.some(fid => farmIds.includes(fid))) return true
    }
  }

  // Participation fallback (any status implies visibility, including 'no')
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
  userKeysOrCtx: string[] | UserVisibilityContext,
  now: Date = new Date(),
  endedGraceDays: number = APP_CONFIG.EVENT_ENDED_GRACE_DAYS
): Event[] {
  return events
    .filter(ev => userCanViewEvent(ev, userKeysOrCtx))
    .filter(ev => !isEventExpiredForSelection(ev, now, endedGraceDays))
}

// Canonical name (backlog item [007]).
// Keep filterSelectableEvents as a backward-compatible alias.
export function getSelectableEvents(
  events: Event[],
  userKeysOrCtx: string[] | UserVisibilityContext,
  now: Date = new Date(),
  endedGraceDays: number = APP_CONFIG.EVENT_ENDED_GRACE_DAYS
): Event[] {
  return filterSelectableEvents(events, userKeysOrCtx, now, endedGraceDays)
}
