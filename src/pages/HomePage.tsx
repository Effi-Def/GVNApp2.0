import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventService, farmService } from '../services/firestore'
import { useFarmContext } from '../contexts/FarmContext'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { useAppStore } from '../stores/AppStore'
import { refreshActiveFarmData, useAuthStore } from '../stores/useAuthStore'
import type { Event, EventParticipant, FarmMembership } from '../types'
import TutorialModal, { shouldShowTutorial } from '../components/TutorialModal'
import { getUserKeys, getUserEventParticipation, userCanViewEvent } from '../utils/events'

type RsvpStatus = 'yes' | 'maybe' | 'no'

type ActivityItem = {
  key: string
  ts: number
  title: string
  onClick?: () => void
}

function formatHeroDate(ev: Pick<Event, 'date' | 'endDate'>) {
  const start = ev.date
  const end = ev.endDate
  const fmt = (d: Date) => {
    try {
      return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })
    } catch {
      return ''
    }
  }
  if (end && end instanceof Date && !Number.isNaN(end.getTime()) && end.getTime() !== start.getTime()) {
    return `${fmt(start)} → ${fmt(end)}`
  }
  return fmt(start)
}

function formatCompactDate(d: Date) {
  try {
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

function initialFromName(name?: string) {
  const t = (name || '').trim()
  return (t ? t.slice(0, 1) : 'G').toUpperCase()
}

function AvatarCircle({ name, src, size = 28 }: { name?: string; src?: string; size?: number }) {
  const dim = size
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        className="rounded-full border border-[--border-base]"
        style={{ width: dim, height: dim, objectFit: 'cover' }}
      />
    )
  }
  return (
    <div
      className="rounded-full border border-[--border-base] bg-[--bg-raised] text-[--text-muted] flex items-center justify-center text-xs font-semibold"
      style={{ width: dim, height: dim }}
      aria-label={name || 'avatar'}
      title={name || ''}
    >
      {initialFromName(name)}
    </div>
  )
}

function AvatarStack({ people, max = 6 }: { people: Array<{ name?: string; photoURL?: string }>; max?: number }) {
  const shown = people.slice(0, max)
  const extra = Math.max(0, people.length - shown.length)
  return (
    <div className="flex items-center">
      {shown.map((p, idx) => (
        <div key={idx} className={idx === 0 ? '' : '-ml-2'}>
          <AvatarCircle name={p.name} src={p.photoURL} size={28} />
        </div>
      ))}
      {extra > 0 ? (
        <div className="-ml-2">
          <div className="h-7 w-7 rounded-full border border-[--border-base] bg-[--bg-card] text-[11px] font-semibold text-[--text-muted] flex items-center justify-center">
            +{extra}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function FarmSwitcherModal({
  open,
  onClose,
  farms,
  activeFarmId,
  onSelect,
  onManage,
  busy,
}: {
  open: boolean
  onClose: () => void
  farms: Array<{ id: string; name?: string; memberCount?: number }>
  activeFarmId: string | null
  onSelect: (farmId: string) => Promise<void>
  onManage: () => void
  busy?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Chiudi" />
      <div className="absolute left-0 right-0 bottom-0 sm:bottom-auto sm:left-1/2 sm:top-24 sm:-translate-x-1/2 w-full sm:w-[420px] max-w-[96vw]">
        <div className="bg-[--bg-card] rounded-t-3xl sm:rounded-3xl border border-[--border-base] shadow-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[--text-base]">Cambia gruppo</div>
              <div className="text-xs text-[--text-muted]">Scegli con chi stai organizzando</div>
            </div>
            <button type="button" className="text-sm text-[--text-muted] hover:text-[--text-base]" onClick={onClose}>
              Chiudi
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {farms.map((f) => {
              const active = f.id === activeFarmId
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={busy}
                  className={
                    'w-full text-left px-3 py-3 rounded-2xl border transition flex items-center justify-between gap-3 ' +
                    (active
                      ? 'border-primary-200 bg-primary-50 text-primary-800'
                      : 'border-[--border-base] bg-[--bg-card] hover:bg-[--bg-subtle] text-[--text-base]')
                  }
                  onClick={() => onSelect(f.id)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{f.name || 'Gruppo'}</div>
                    <div className="text-xs text-[--text-muted]">
                      {typeof f.memberCount === 'number' ? `${f.memberCount} membri` : 'Membri'}
                    </div>
                  </div>
                  {active ? (
                    <div className="text-xs font-semibold">Attivo</div>
                  ) : (
                    <div className="text-xs text-[--text-muted]">Apri</div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-[--bg-raised] text-[--text-base] hover:bg-[--bg-raised]"
              onClick={onManage}
            >
              Gestisci gruppi
            </button>
            {busy ? (
              <div className="text-xs text-[--text-muted] flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                <span>Aggiorno…</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { farms, activeFarmId, activeFarm } = useFarmContext()

  const initializing = useActiveFarmStore((s) => s.initializing)
  const setActiveFarmId = useActiveFarmStore((s) => s.setActiveFarmId)

  const events = useAppStore((s) => s.events)
  const expenses = useAppStore((s) => s.expenses)
  const polls = useAppStore((s) => s.polls)
  const lists = useAppStore((s) => s.lists)
  const updateEvent = useAppStore((s) => s.updateEvent)

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switcherBusy, setSwitcherBusy] = useState(false)
  const [members, setMembers] = useState<FarmMembership[]>([])
  const [rsvpLoading, setRsvpLoading] = useState<{ eventId: string; status: RsvpStatus } | null>(null)
  const [rsvpError, setRsvpError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    try {
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
      const on = () => setIsOnline(true)
      const off = () => setIsOnline(false)
      window.addEventListener('online', on)
      window.addEventListener('offline', off)
      return () => {
        window.removeEventListener('online', on)
        window.removeEventListener('offline', off)
      }
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    if (!activeFarmId || !user?.id) {
      setMembers([])
      return
    }

    let alive = true
    ;(async () => {
      try {
        const next = await farmService.listMembers(activeFarmId)
        if (!alive) return
        setMembers(Array.isArray(next) ? next : [])
      } catch {
        if (!alive) return
        setMembers([])
      }
    })()

    return () => {
      alive = false
    }
  }, [activeFarmId, user?.id])

  const hasFarms = (farms || []).length > 0

  // Show tutorial once for new users who just created/joined their first farm
  useEffect(() => {
    if (hasFarms && shouldShowTutorial()) {
      setShowTutorial(true)
    }
  }, [hasFarms])

  const meKeys = useMemo(() => getUserKeys(user), [user?.id, user?.email])

  const sortedEvents = useMemo(() => {
    const farmCtx = { userKeys: meKeys, farmIds: activeFarmId ? [activeFarmId] : [] }
    const base = (Array.isArray(events) ? [...events] : []).filter(e => userCanViewEvent(e, farmCtx))
    base.sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0))
    return base
  }, [events, activeFarmId, meKeys])

  const heroEvent = useMemo(() => {
    const now = Date.now()
    const graceMs = 1000 * 60 * 60 * 2
    return sortedEvents.find((e) => (e.date?.getTime?.() || 0) >= now - graceMs) || null
  }, [sortedEvents])

  const upcomingEvents = useMemo(() => {
    const now = Date.now()
    return sortedEvents.filter((e) => (e.date?.getTime?.() || 0) >= now).slice(0, 10)
  }, [sortedEvents])

  const membersById = useMemo(() => {
    const map = new Map<string, FarmMembership>()
    for (const m of members || []) {
      if (m?.userId) map.set(m.userId, m)
    }
    return map
  }, [members])

  const heroRsvp = useMemo(() => {
    if (!heroEvent) return null

    const ps = Array.isArray(heroEvent.participants) ? heroEvent.participants : []
    const yesIds = ps.filter((p) => p.status === 'yes').map((p) => p.userId)
    const maybeIds = ps.filter((p) => p.status === 'maybe').map((p) => p.userId)
    const responded = new Set(ps.map((p) => p.userId))
    const pendingIds = (members || []).map((m) => m.userId).filter((uid) => uid && !responded.has(uid))

    const toPerson = (uid: string) => {
      const m = membersById.get(uid)
      const fallbackName = ps.find((x) => x.userId === uid)?.name
      return {
        name: m?.displayName || fallbackName || uid,
        photoURL: m?.photoURL,
      }
    }

    return {
      yes: yesIds.map(toPerson),
      maybe: maybeIds.map(toPerson),
      pending: pendingIds.map(toPerson),
    }
  }, [heroEvent?.id, heroEvent?.participants, members, membersById])

  const myHeroRsvpStatus = useMemo(() => {
    if (!heroEvent) return undefined
    const p = getUserEventParticipation(heroEvent, meKeys)
    return p.status === 'none' ? undefined : p.status
  }, [heroEvent, meKeys])

  const activityItems = useMemo((): ActivityItem[] => {
    const now = Date.now()
    const dayMs = 1000 * 60 * 60 * 24
    const items: ActivityItem[] = []

    // Use farm-filtered sortedEvents to avoid showing activity from other farms
    const activeFarmEventIds = new Set(sortedEvents.map(e => e.id))

    for (const e of sortedEvents) {
      const t = e.updatedAt?.getTime?.() || 0
      if (!t || now - t > dayMs) continue
      const dateStr = e.date ? ` · ${formatCompactDate(e.date)}` : ''
      items.push({
        key: `ev:${e.id}`,
        ts: t,
        title: `📅 ${e.title || 'Evento'}${dateStr}`,
        onClick: () => navigate(`/events/${e.id}/summary`),
      })
    }

    for (const x of expenses || []) {
      if (x.eventId && !activeFarmEventIds.has(x.eventId)) continue
      const t = x.updatedAt?.getTime?.() || 0
      if (!t || now - t > dayMs) continue
      const amountStr = typeof (x as any).amount === 'number' ? ` · €${(x as any).amount}` : ''
      items.push({
        key: `ex:${x.id}`,
        ts: t,
        title: `💸 ${x.title || 'Spesa'}${amountStr}`,
        onClick: () => (x.eventId ? navigate(`/events/${x.eventId}/summary`) : navigate('/farm/settlement')),
      })
    }

    for (const p of polls || []) {
      if (p.eventId && !activeFarmEventIds.has(p.eventId)) continue
      const t = p.updatedAt?.getTime?.() || 0
      if (!t || now - t > dayMs) continue
      const votesStr = Array.isArray((p as any).votes) && (p as any).votes.length > 0
        ? ` · ${(p as any).votes.length} risposte`
        : ''
      items.push({
        key: `po:${p.id}`,
        ts: t,
        title: `🗳️ ${p.title || 'Sondaggio'}${votesStr}`,
        onClick: () => (p.eventId ? navigate(`/events/${p.eventId}/summary`) : navigate('/events')),
      })
    }

    for (const l of lists || []) {
      if (l.eventId && !activeFarmEventIds.has(l.eventId)) continue
      const t = l.updatedAt?.getTime?.() || 0
      if (!t || now - t > dayMs) continue
      items.push({
        key: `li:${l.id}`,
        ts: t,
        title: `📋 ${l.title || 'Lista'}`,
        onClick: () => (l.eventId ? navigate(`/events/${l.eventId}/summary`) : navigate('/events')),
      })
    }

    items.sort((a, b) => b.ts - a.ts)
    return items.slice(0, 5)
  }, [sortedEvents, expenses, polls, lists, navigate])

  const showActivity = activityItems.length >= 2

  const handleSwitchFarm = async (farmId: string) => {
    if (!user?.id) return
    setSwitcherBusy(true)
    try {
      await setActiveFarmId({ userId: user.id, farmId })
      await refreshActiveFarmData()
      setSwitcherOpen(false)
    } finally {
      setSwitcherBusy(false)
    }
  }

  const setRsvp = async (eventId: string, status: RsvpStatus) => {
    if (!user?.id || rsvpLoading !== null) return

    setRsvpLoading({ eventId, status })
    setRsvpError(null)
    const errorMsg = 'Impossibile aggiornare la partecipazione. Riprova.'
    let rollbackParticipants: Event['participants'] | null = null

    try {
      const name = user.displayName || user.email || 'Io'

      // Optimistic local update
      const cur = (events || []).find((e) => e.id === eventId)
      if (cur) {
        rollbackParticipants = Array.isArray(cur.participants) ? [...cur.participants] : []

        const nextParticipants = (() => {
          const ps: EventParticipant[] = Array.isArray(cur.participants) ? [...cur.participants] : []
          const idx = ps.findIndex((p) => p.userId === user.id)
          if (idx >= 0) {
            ps[idx] = { ...ps[idx], userId: user.id, name, status, respondedAt: new Date() }
          } else {
            ps.push({ userId: user.id, name, status, respondedAt: new Date() })
          }
          return ps
        })()

        updateEvent(eventId, { participants: nextParticipants })
      }

      await eventService.updateParticipation(eventId, user.id, name, status)
      const remote = await eventService.getById(eventId)
      if (remote) updateEvent(eventId, remote)
    } catch {
      const remote = await eventService.getById(eventId).catch(() => null)
      if (remote) {
        updateEvent(eventId, remote)
      } else if (rollbackParticipants) {
        updateEvent(eventId, { participants: rollbackParticipants })
      }

      setRsvpError(errorMsg)
      setTimeout(() => setRsvpError(null), 3500)
    } finally {
      setRsvpLoading(null)
    }
  }

  return (
    <div className="w-full pt-16 space-y-3">

      {/* ── Sezione 1: intestazione gruppo ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-xs text-[--text-muted] uppercase tracking-wide">Gruppo</div>
          <div className="text-lg font-semibold text-[--text-base] truncate">
            {activeFarm?.name || (hasFarms ? 'Seleziona un gruppo' : 'Nessun gruppo')}
          </div>
          {activeFarm && typeof activeFarm.memberCount === 'number' ? (
            <div className="text-xs text-[--text-muted]">{activeFarm.memberCount} membri</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 text-xs text-[--text-muted] bg-[--bg-raised] px-2 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-[--text-muted]" />
              Offline
            </span>
          )}
          {initializing && (
            <span className="inline-block h-4 w-4 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
          )}
          {hasFarms && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-[--bg-raised] border border-[--border-base] text-sm font-medium text-[--text-muted] hover:bg-[--bg-raised] transition"
              onClick={() => setSwitcherOpen(true)}
              disabled={!user?.id}
            >
              Cambia
            </button>
          )}
        </div>
      </div>

      {/* ── Sezione 2: stato (no farm / hero evento / vuoto) ── */}
      {(!activeFarmId || !activeFarm) ? (
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-5">
          {hasFarms ? (
            <>
              <div className="text-base font-semibold text-[--text-base]">Scegli un gruppo per iniziare</div>
              <div className="mt-1 text-sm text-[--text-muted]">Seleziona con chi stai organizzando.</div>
              <button
                type="button"
                className="mt-4 px-4 py-2 rounded-xl bg-[--text-base] text-[--bg-card] text-sm font-semibold"
                onClick={() => setSwitcherOpen(true)}
              >
                Apri gruppi
              </button>
            </>
          ) : (
            <>
              <div className="text-base font-semibold text-[--text-base]">Crea il vostro gruppo</div>
              <div className="mt-1 text-sm text-[--text-muted]">Il posto degli amici: eventi, sondaggi, chat. Tutto insieme.</div>
              <button
                type="button"
                className="mt-4 px-4 py-2 rounded-xl bg-[--text-base] text-[--bg-card] text-sm font-semibold"
                onClick={() => navigate('/settings/farms')}
              >
                Crea / Unisciti
              </button>
            </>
          )}
        </div>
      ) : heroEvent ? (
        /* Hero: prossimo evento */
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] overflow-hidden">
          {/* Titolo + azioni */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[--text-muted]">Prossimo</div>
                <div className="mt-0.5 text-xl font-semibold text-[--text-base] leading-tight truncate">{heroEvent.title || 'Evento'}</div>
                <div className="mt-1 text-sm text-[--text-muted]">
                  {formatHeroDate(heroEvent)}{heroEvent.location ? ` · ${heroEvent.location}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 px-3 py-1.5 rounded-xl bg-[--bg-raised] text-[--text-base] text-sm font-medium hover:bg-[--bg-raised] transition"
                onClick={() => navigate(`/events/${heroEvent.id}/summary`)}
              >
                Dettagli
              </button>
            </div>

            {/* Chi viene — riga compatta */}
            {heroRsvp && (
              <div className="mt-3 flex items-center gap-3">
                <AvatarStack people={[...heroRsvp.yes, ...heroRsvp.maybe]} max={5} />
                <div className="text-xs text-[--text-muted]">
                  {heroRsvp.yes.length > 0
                    ? `${heroRsvp.yes.length} confermati`
                    : 'Nessuno ha ancora confermato'}
                  {heroRsvp.maybe.length > 0 ? `, ${heroRsvp.maybe.length} forse` : ''}
                  {heroRsvp.pending.length > 0 ? ` · ${heroRsvp.pending.length} in attesa` : ''}
                </div>
              </div>
            )}
          </div>

          {/* RSVP: separatore + azione */}
          <div className="border-t border-neutral-100 px-4 py-3">
            {rsvpError && (
              <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                {rsvpError}
              </div>
            )}
            {myHeroRsvpStatus ? (
              <div className="flex items-center justify-between gap-3">
                <span className={
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ' +
                  (myHeroRsvpStatus === 'yes' ? 'bg-green-500/10 text-green-600' :
                   myHeroRsvpStatus === 'maybe' ? 'bg-amber-500/10 text-amber-600' :
                   'bg-[--bg-raised] text-[--text-muted]')
                }>
                  {myHeroRsvpStatus === 'yes' ? '✓ Partecipi' :
                   myHeroRsvpStatus === 'maybe' ? '~ Forse' :
                   '✗ Non partecipi'}
                </span>
                <button
                  type="button"
                  className="text-xs text-[--text-muted] hover:text-[--text-muted] transition"
                  onClick={() => navigate(`/events/${heroEvent.id}/summary`)}
                >
                  Cambia risposta
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[--text-muted] mr-1">Partecipo?</span>
                {([
                  { k: 'yes' as const, label: 'Sì', active: 'bg-green-600 text-white border-green-600' },
                  { k: 'maybe' as const, label: 'Forse', active: 'bg-amber-500 text-white border-amber-500' },
                  { k: 'no' as const, label: 'No', active: 'bg-neutral-700 text-white border-neutral-700' },
                ]).map(({ k, label, active }) => (
                  <button
                    key={k}
                    type="button"
                    className={
                      'flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition ' +
                      (rsvpLoading?.eventId === heroEvent.id && rsvpLoading?.status === k ? active : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-[--bg-subtle]')
                    }
                    disabled={!isOnline || rsvpLoading !== null}
                    onClick={() => setRsvp(heroEvent.id, k)}
                  >
                    {rsvpLoading?.eventId === heroEvent.id && rsvpLoading?.status === k ? '…' : label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Nessun evento: empty state con CTA */
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-5">
          <div className="text-base font-semibold text-[--text-base]">Cosa state organizzando?</div>
          <div className="mt-1 text-sm text-[--text-muted]">Proponi una data o crea un evento se la sai già.</div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 px-3 py-2.5 rounded-xl bg-[--text-base] text-[--bg-card] text-sm font-semibold"
              onClick={() => navigate('/polls?create=1&type=date')}
            >
              🗳️ Quando siete liberi?
            </button>
            <button
              type="button"
              className="flex-1 px-3 py-2.5 rounded-xl border border-[--border-base] text-[--text-base] text-sm font-semibold"
              onClick={() => navigate('/events?create=1')}
            >
              📅 Ho una data
            </button>
          </div>
        </div>
      )}

      {/* ── Sezione 3: lista eventi in arrivo ── */}
      {activeFarmId && activeFarm && (
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card]">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
            <div className="text-sm font-semibold text-[--text-base]">In arrivo</div>
            <button
              type="button"
              className="text-xs text-[--text-muted] hover:text-[--text-muted] transition"
              onClick={() => navigate('/events')}
            >
              Vedi tutti
            </button>
          </div>
          <div className="divide-y divide-[--border-base]">
            {upcomingEvents.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[--text-muted]">
                Niente in programma.{' '}
                <button
                  type="button"
                  className="text-[--text-base] font-medium underline"
                  onClick={() => navigate('/events?create=1')}
                >
                  Crea qualcosa
                </button>
              </div>
            ) : (
              upcomingEvents.slice(0, 6).map((e) => {
                const myStatus = (e.participants || []).find(p => p.userId === user?.id)?.status
                return (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-[--bg-subtle] transition flex items-center justify-between gap-3"
                    onClick={() => navigate(`/events/${e.id}/summary`)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[--text-base] truncate">{e.title || 'Evento'}</div>
                      {e.location ? (
                        <div className="text-xs text-[--text-muted] truncate">{e.location}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {myStatus && (
                        <span className={
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full ' +
                          (myStatus === 'yes' ? 'bg-green-500/10 text-green-600' :
                           myStatus === 'maybe' ? 'bg-amber-500/10 text-amber-600' :
                           'bg-[--bg-raised] text-[--text-muted]')
                        }>
                          {myStatus === 'yes' ? 'Sì' : myStatus === 'maybe' ? 'Forse' : 'No'}
                        </span>
                      )}
                      <div className="text-xs text-[--text-muted] whitespace-nowrap">{formatCompactDate(e.date)}</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── Sezione 4: attività recente (solo se presente) ── */}
      {showActivity && (
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card]">
          <div className="px-4 pt-4 pb-2 text-sm font-semibold text-[--text-base]">Aggiornamenti recenti</div>
          <div className="divide-y divide-[--border-base]">
            {activityItems.map((a) => (
              <button
                key={a.key}
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-[--bg-subtle] transition text-sm text-[--text-muted]"
                onClick={() => a.onClick?.()}
              >
                {a.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <FarmSwitcherModal
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        farms={(farms || []).map((f) => ({ id: f.id, name: f.name, memberCount: f.memberCount }))}
        activeFarmId={activeFarmId}
        onSelect={handleSwitchFarm}
        onManage={() => navigate('/settings/farms')}
        busy={switcherBusy}
      />

      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} />
      )}
    </div>
  )
}


