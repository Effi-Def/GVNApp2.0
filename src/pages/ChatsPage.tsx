import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { chatService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { Event } from '../types'
import { getUserKeys, userCanChat, userCanViewEvent } from '../utils/events'

interface ChatSummary {
  event: Event
  hasNew: boolean
  lastActivity: number
}

export default function ChatsPage() {
  const { user } = useAuthStore()
  const storeEvents = useAppStore(s => s.events)
  const farms = useActiveFarmStore(s => s.farms)
  const [farmFilter, setFarmFilter] = useState<'all' | string>('all')
  const [events, setEvents] = useState<Event[]>([])
  const [myReads, setMyReads] = useState<Record<string, Date | undefined>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const countedRef = useRef<Record<string, string>>({})
  const meId = user?.id || user?.email || ''

  // All accessible chats — no farm filter on load, user picks farm manually
  useEffect(() => {
    if (!meId) return
    const keys = getUserKeys(user)
    const mine = (storeEvents || []).filter(event => userCanChat(event, keys))
    setEvents(mine)
  }, [meId, storeEvents, user?.id, user?.email])

  useEffect(() => {
    if (!events.length || !meId) return
    const unsubs = events.map(e => chatService.listenParticipants(e.id, parts => {
      const me = parts.find(p => p.uid === meId)
      setMyReads(prev => ({ ...prev, [e.id]: me?.lastReadAt }))
    }))
    return () => { unsubs.forEach(u => u()) }
  }, [events, meId])

  // Numeric badge only for chats with new activity. Each count is a server read,
  // so it runs once per state of the chat, not at every participants snapshot.
  useEffect(() => {
    for (const e of events) {
      if (!(e.id in myReads)) continue
      const lastActivity = e.chatLastActivityAt?.getTime?.() || 0
      const lastRead = myReads[e.id]
      if (lastActivity <= (lastRead?.getTime() || 0)) continue
      const countKey = `${lastActivity}:${lastRead?.getTime() || 0}`
      if (countedRef.current[e.id] === countKey) continue
      countedRef.current[e.id] = countKey
      chatService.getUnreadCount(e.id, lastRead ?? new Date(0), meId)
        .then(count => setUnreadCounts(prev => ({ ...prev, [e.id]: count })))
        .catch(() => setUnreadCounts(prev => ({ ...prev, [e.id]: 0 })))
    }
  }, [events, myReads, meId])

  // Apply optional farm filter
  const filteredEvents = useMemo(() => {
    if (farmFilter === 'all') return events
    const keys = getUserKeys(user)
    const ctx = { userKeys: keys, farmIds: [farmFilter] }
    return events.filter(e => userCanViewEvent(e, ctx))
  }, [events, farmFilter, user])

  const summaries: ChatSummary[] = useMemo(() => {
    const mapped = filteredEvents.map(e => {
      const lastActivity = e.chatLastActivityAt?.getTime?.() || 0
      const lastRead = myReads[e.id]?.getTime?.() || 0
      const hasNew = lastActivity > 0 && lastActivity > lastRead
      return { event: e, hasNew, lastActivity }
    })
    mapped.sort((a, b) => {
      if (a.hasNew !== b.hasNew) return a.hasNew ? -1 : 1
      if (b.lastActivity !== a.lastActivity) return b.lastActivity - a.lastActivity
      return (b.event.date?.getTime?.() || 0) - (a.event.date?.getTime?.() || 0)
    })
    return mapped
  }, [filteredEvents, myReads])

  // Farm options — only farms that have at least one chat event
  const farmOptions = useMemo(() => {
    const keys = getUserKeys(user)
    return (farms || []).filter(f => {
      const ctx = { userKeys: keys, farmIds: [f.id] }
      return events.some(e => userCanViewEvent(e, ctx))
    })
  }, [farms, events, user])

  return (
    <div className="pt-16 px-4 pb-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Chat degli eventi</h1>
        <span className="text-xs text-[--text-muted]">{summaries.filter(s => s.hasNew).length} con nuovi messaggi</span>
      </div>

      {/* Farm filter pills — only shown when user has multiple farms with chats */}
      {farmOptions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
          <button
            type="button"
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              farmFilter === 'all'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-[--bg-subtle]'
            }`}
            onClick={() => setFarmFilter('all')}
          >
            Tutte le fattorie
          </button>
          {farmOptions.map(f => (
            <button
              key={f.id}
              type="button"
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                farmFilter === f.id
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-[--bg-card] text-[--text-muted] border-[--border-base] hover:bg-[--bg-subtle]'
              }`}
              onClick={() => setFarmFilter(prev => prev === f.id ? 'all' : f.id)}
            >
              {f.iconEmoji ? `${f.iconEmoji} ` : ''}{f.name}
            </button>
          ))}
        </div>
      )}

      {summaries.length === 0 && (
        <div className="text-sm text-[--text-muted]">Nessuna chat attiva al momento.</div>
      )}
      <div className="space-y-2">
        {summaries.map(s => {
          const eventFarm = (farms || []).find(f =>
            Array.isArray(s.event.visibility?.farms) && s.event.visibility!.farms.includes(f.id)
          )
          return (
            <Link key={s.event.id} to={`/events/${s.event.id}/chat`} className="flex items-center gap-3 p-3 bg-[--bg-card] rounded-xl border border-[--border-base] hover:shadow">
              <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 font-bold">
                {s.event.title?.[0]?.toUpperCase?.() || 'E'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold text-[--text-base] flex items-center gap-2">
                  <span className="truncate max-w-[55vw]">{s.event.title}</span>
                  {s.hasNew && (
                    <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full bg-primary-600 text-white flex items-center justify-center">
                      {unreadCounts[s.event.id] ? (unreadCounts[s.event.id] > 99 ? '99+' : unreadCounts[s.event.id]) : 'Nuovi'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[--text-muted] flex items-center gap-1.5 mt-0.5">
                  {eventFarm && farmOptions.length > 1 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[--bg-subtle] text-[--text-muted]">
                      {eventFarm.iconEmoji || '🐷'} {eventFarm.name}
                    </span>
                  )}
                  <span>
                    {s.event.chatLastActivityAt
                      ? `Ultimo messaggio: ${s.event.chatLastActivityAt.toLocaleString()}`
                      : 'Nessun messaggio ancora'}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

