import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { eventService, chatService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { Event } from '../types'

interface ChatSummary {
  event: Event
  hasNew: boolean
  lastActivity: number
}

export default function ChatsPage() {
  const { user } = useAuthStore()
  const [events, setEvents] = useState<Event[]>([])
  const [myReads, setMyReads] = useState<Record<string, Date | undefined>>({})
  const meId = user?.id || user?.email || ''

  useEffect(() => {
    if (!meId) return
    // Fetch only events where the user is a participant or creator
    eventService.getAll().then(evts => {
      const mine = evts.filter(event => {
        if (event.createdBy === meId) return true
        return event.participants?.some?.(p => p.userId === meId)
      })
      setEvents(mine)
    })
  }, [meId])

  useEffect(() => {
    // Listen to my lastReadAt per event via participants snapshot
    if (!events.length || !meId) return
    const unsubs = events.map(e => chatService.listenParticipants(e.id, parts => {
      const me = parts.find(p => p.uid === meId)
      setMyReads(prev => ({ ...prev, [e.id]: me?.lastReadAt }))
    }))
    return () => { unsubs.forEach(u => u()) }
  }, [events, meId])

  const summaries: ChatSummary[] = useMemo(() => {
    const mapped = events.map(e => {
      const lastActivity = e.chatLastActivityAt?.getTime?.() || 0
      const lastRead = myReads[e.id]?.getTime?.() || 0
      const hasNew = lastActivity > 0 && lastActivity > lastRead
      return { event: e, hasNew, lastActivity }
    })

    mapped.sort((a, b) => {
      if (a.hasNew !== b.hasNew) return a.hasNew ? -1 : 1
      if (b.lastActivity !== a.lastActivity) return b.lastActivity - a.lastActivity
      const aDate = a.event.date?.getTime?.() || 0
      const bDate = b.event.date?.getTime?.() || 0
      return bDate - aDate
    })

    return mapped
  }, [events, myReads])

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Chat degli eventi</h1>
      {summaries.length === 0 && (
        <div className="text-sm text-neutral-600">Nessuna chat attiva al momento.</div>
      )}
      <div className="space-y-2">
        {summaries.map(s => (
          <Link key={s.event.id} to={`/events/${s.event.id}/chat`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-neutral-200 hover:shadow">
            <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 font-bold">
              {s.event.title?.[0]?.toUpperCase?.() || 'E'}
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold text-neutral-900 flex items-center gap-2">
                <span className="truncate max-w-[60vw]">{s.event.title}</span>
                {s.hasNew && <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">Nuovi</span>}
              </div>
              <div className="text-xs text-neutral-500">
                {s.event.chatLastActivityAt
                  ? `Ultimo messaggio: ${s.event.chatLastActivityAt.toLocaleString()}`
                  : 'Nessun messaggio ancora'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
