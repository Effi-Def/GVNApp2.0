import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useFarmContext } from '../contexts/FarmContext'
import { useAppStore } from '../stores/AppStore'
import { eventService, farmService, userPrivateService } from '../services/firestore'
import type { FarmMembership, FarmRole, UserPrivate } from '../types'
import MvpEventCreateModal from '../components/MvpEventCreateModal'
import { getUserKeys, userCanViewEvent } from '../utils/events'
import { usePresence } from '../hooks/usePresence'

function formatShortDate(d: Date) {
  try {
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

function parseLocalDate(yyyyMmDd: string): Date {
  const [y, m, d] = (yyyyMmDd || '').split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d)
}

export default function FarmDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { activeFarmId, activeFarm } = useFarmContext()

  const events = useAppStore(s => s.events)

  const addEvent = useAppStore(s => s.addEvent)

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)

  const [myRole, setMyRole] = useState<FarmRole>('member')
  const isOwner = !!(user?.id && activeFarm?.ownerId && user.id === activeFarm.ownerId)
  const isAdmin = isOwner || myRole === 'owner'

  const [members, setMembers] = useState<FarmMembership[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const memberUids = useMemo(() => members.map(m => m.userId), [members])
  const presence = usePresence(memberUids)
  const onlineCount = useMemo(
    () => memberUids.filter(uid => presence.get(uid)?.online).length,
    [memberUids, presence],
  )

  useEffect(() => {
    const fid = activeFarmId
    const uid = user?.id
    if (!fid || !uid) {
      setMyRole('member')
      return
    }

    let alive = true
    ;(async () => {
      try {
        const up: UserPrivate = await userPrivateService.get(uid)
        const role = up.farms?.[fid]?.role
        const next: FarmRole = (role === 'owner' || role === 'member') ? role : 'member'
        if (!alive) return
        setMyRole(next)
      } catch {
        if (!alive) return
        setMyRole('member')
      }
    })()

    return () => { alive = false }
  }, [activeFarmId, user?.id])

  useEffect(() => {
    if (!activeFarmId || !user?.id) {
      setMembers([])
      return
    }

    let alive = true
    setMembersLoading(true)
    ;(async () => {
      try {
        const next = await farmService.listMembers(activeFarmId)
        if (!alive) return
        setMembers(next)
      } catch {
        if (!alive) return
        setMembers([])
      } finally {
        if (alive) setMembersLoading(false)
      }
    })()

    return () => { alive = false }
  }, [activeFarmId, user?.id])

  const upcomingEvents = useMemo(() => {
    const now = Date.now()
    const meKeys = getUserKeys(user)
    const farmCtx = { userKeys: meKeys, farmIds: activeFarmId ? [activeFarmId] : [] }
    return [...(events || [])]
      .filter(e => userCanViewEvent(e, farmCtx))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .filter(e => e.date.getTime() >= (now - 1000 * 60 * 60 * 24))
      .slice(0, 10)
  }, [events, activeFarmId, user])

  const createEvent = async (values: { title: string; location: string; notes: string; proposedDates: string[] }) => {
    if (!user?.id || !activeFarmId) return
    setCreateLoading(true)
    try {
      const proposed = (values.proposedDates || []).filter(Boolean)
      const first = proposed[0]
      const date = first ? parseLocalDate(first) : new Date()

      const meName = user.displayName || user.email || 'Io'

      const newEvent = await eventService.create({
        title: values.title,
        description: values.notes || '',
        category: 'altro',
        date,
        time: '',
        location: values.location || '',
        createdBy: user.id,
        visibility: { type: 'restricted', farms: [activeFarmId] },
        proposedDates: proposed,
        dateVotes: {},
        status: 'planning',
        dateFinalized: false,
        participants: [{ userId: user.id, name: meName, status: 'yes', respondedAt: new Date() }],
        priority: 'medium',
        publicShareEnabled: true,
      } as any)

      addEvent(newEvent)
      setCreateOpen(false)
      navigate(`/events/${newEvent.id}/summary`)
    } finally {
      setCreateLoading(false)
    }
  }

  if (!activeFarmId || !activeFarm) {
    return (
      <div className="pt-16 w-full">
        <div className="rounded-3xl border border-[--border-base] bg-[--bg-card] p-6">
          <div className="text-lg font-semibold">Nessuna fattoria attiva</div>
          <div className="mt-1 text-sm text-[--text-muted]">Seleziona una fattoria dalla Home per continuare.</div>
          <div className="mt-4 flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-primary-600 text-white"
              onClick={() => navigate('/')}
            >
              Vai alla Home
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-[--bg-raised] text-[--text-base]"
              onClick={() => navigate('/settings/farms')}
            >
              Gestisci fattorie
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 w-full">
      <div className="rounded-3xl border border-[--border-base] bg-[--bg-card]/80 backdrop-blur p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[--text-muted]">Fattoria</div>
            <div className="text-xl font-semibold text-[--text-base]">{activeFarm.name || 'Fattoria'}</div>
            <div className="mt-1 text-sm text-[--text-muted]">
              {typeof activeFarm.memberCount === 'number' ? `${activeFarm.memberCount} ${activeFarm.memberCount === 1 ? 'maiale' : 'maiali'}` : 'Maiali'}
              {isAdmin ? ' • Re Maiale' : ''}
            </div>
          </div>

          <button
            className="px-3 py-2 rounded-xl bg-[--bg-raised] text-[--text-base] hover:bg-[--bg-subtle]"
            onClick={() => navigate('/')}
            title="Cambia fattoria"
          >
            Cambia
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="px-4 py-2 rounded-xl bg-[--text-base] text-[--bg-card] text-sm font-semibold hover:opacity-90"
            onClick={() => navigate('/chats')}
          >
            💬 Chat della fattoria
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-[--bg-raised] text-[--text-base] text-sm font-semibold hover:bg-[--bg-subtle]"
            onClick={() => navigate('/farm/media')}
          >
            📸 Foto &amp; Video
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-[--bg-raised] text-[--text-base] text-sm font-semibold hover:bg-[--bg-subtle]"
            onClick={() => navigate('/farm/settlement')}
          >
            ⚖️ Spese
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[--text-base]">Prossimi eventi</div>
                  <div className="text-xs text-[--text-muted]">Organizza in 2 minuti: titolo, date, luogo.</div>
                </div>
                <button
                  className="px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
                  onClick={() => setCreateOpen(true)}
                >
                  Crea evento
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {upcomingEvents.length === 0 ? (
                  <div className="space-y-3 pt-1">
                    <div className="text-sm text-[--text-muted]">Niente in programma. Da dove partiamo?</div>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[--text-base] text-[--bg-card] text-xs font-semibold hover:opacity-90 transition"
                        onClick={() => navigate('/polls?create=1&type=date')}
                      >
                        🗳️ Quando siete liberi?
                      </button>
                      <button
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[--bg-raised] text-[--text-base] text-xs font-semibold hover:bg-[--bg-subtle] transition"
                        onClick={() => setCreateOpen(true)}
                      >
                        📅 Ho già una data
                      </button>
                    </div>
                  </div>
                ) : upcomingEvents.map(e => (
                  <button
                    key={e.id}
                    className="w-full text-left p-3 rounded-xl bg-[--bg-subtle] hover:bg-[--bg-raised] transition"
                    onClick={() => navigate(`/events/${e.id}/summary`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[--text-base] truncate">{e.title || 'Evento'}</div>
                        <div className="text-xs text-[--text-muted] truncate">
                          {formatShortDate(e.date)}{e.location ? ` • ${e.location}` : ''}
                        </div>
                      </div>
                      <div className="text-xs text-[--text-muted] whitespace-nowrap">{formatShortDate(e.date)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-[--text-base]">Maiali</div>
                  {onlineCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      {onlineCount} online
                    </span>
                  )}
                </div>
                <button
                  className="text-sm text-[--text-muted] hover:text-[--text-base]"
                  onClick={() => navigate('/settings/farms')}
                >
                  Gestisci
                </button>
              </div>

              {membersLoading ? (
                <div className="mt-2 text-sm text-[--text-muted]">Caricamento...</div>
              ) : members.length === 0 ? (
                <div className="mt-2 text-sm text-[--text-muted]">Nessun maiale trovato.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {members.slice(0, 12).map(m => {
                    const isOnline = presence.get(m.userId)?.online ?? false
                    return (
                      <div key={m.userId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[--bg-subtle]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Online dot */}
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-[--border-base]'}`}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[--text-base] truncate">
                              {m.displayName || m.userId}
                            </div>
                            <div className="text-xs text-[--text-muted]">
                              {m.role === 'owner' ? 'Re Maiale' : 'Maiale'}
                            </div>
                          </div>
                        </div>
                        {m.role === 'owner' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-[--text-base] text-[--bg-card] flex-shrink-0">Re Maiale</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <MvpEventCreateModal
        isOpen={createOpen}
        isLoading={createLoading}
        onClose={() => (createLoading ? null : setCreateOpen(false))}
        onSubmit={createEvent}
      />
    </div>
  )
}


