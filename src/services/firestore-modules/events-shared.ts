import { Event, EventParticipation, EventParticipationStatus } from '../../types'
import { toDate, toDateOrNow, cleanUndefinedDeep } from '../firestoreMappers'

export function mapFirestoreEvent(id: string, data: any): Event {
  const participants = Array.isArray(data.participants)
    ? data.participants.map((p: any) => ({
        ...p,
        respondedAt: toDateOrNow(p?.respondedAt),
        days: p?.days || undefined,
      }))
    : []

  const participation: Record<string, EventParticipation> | undefined = (() => {
    const raw = data.participation
    if (!raw || typeof raw !== 'object') return undefined
    const out: Record<string, EventParticipation> = {}
    for (const [uid, entry] of Object.entries(raw)) {
      const e: any = entry
      if (!e || typeof e !== 'object') continue
      const status = e.status as EventParticipationStatus | undefined
      const accessLevel = e.accessLevel as any
      if (!status || !accessLevel) continue
      out[uid] = {
        status,
        accessLevel,
        role: e.role,
        respondedAt: toDate(e.respondedAt),
      }
    }
    return Object.keys(out).length ? out : undefined
  })()

  return {
    id,
    ...data,
    participants,
    participation,
    publicShareEnabled: data.publicShareEnabled !== false,
    createdAt: toDateOrNow(data.createdAt),
    updatedAt: toDateOrNow(data.updatedAt),
    date: toDateOrNow(data.date),
    endDate: toDate(data.endDate),
    finalizedAt: toDate((data as any).finalizedAt),
    chatLastActivityAt: toDate((data as any).chatLastActivityAt),
  } as Event
}

export function buildParticipantIds(participants: any[] | undefined, createdBy?: string): string[] {
  const raw = Array.isArray(participants) ? participants.map((p: any) => p?.userId) : []
  const merged = createdBy ? [createdBy, ...raw] : raw
  return Array.from(new Set(merged.filter((v): v is string => typeof v === 'string' && v.length > 0)))
}

export { cleanUndefinedDeep }
