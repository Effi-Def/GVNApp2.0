import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventChat from '../components/Chat/EventChat'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { eventService } from '../services/firestore'
import { Event } from '../types'
import { getUserKeys, getUserEventParticipation, userCanChat } from '../utils/events'

const EventChatPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Visual Viewport: resize container when software keyboard opens/closes ──
  // On iOS Safari/PWA, `fixed inset-0` doesn't shrink when the keyboard opens
  // because `window.innerHeight` stays constant. Only `visualViewport.height`
  // reflects the actual visible area above the keyboard.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const el = containerRef.current
      if (!el) return
      // Only apply to the fixed (mobile) element; on desktop it's md:relative
      if (window.getComputedStyle(el).position === 'fixed') {
        el.style.height = `${vv.height}px`
        el.style.top = `${vv.offsetTop}px`
      } else {
        el.style.height = ''
        el.style.top = ''
      }
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const meKeys = getUserKeys(user)
  const canChat = !!event && userCanChat(event, meKeys)
  const myP = event ? getUserEventParticipation(event, meKeys) : { status: 'none', accessLevel: 'none' as const }
  const canWrite = !!event && (
    meKeys.includes(event.createdBy) || (myP.status === 'yes' && myP.accessLevel === 'full')
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        setLoading(true)
        // Use imperative store access so this effect only re-runs when the
        // event ID changes, not every time the global events list is refreshed.
        const cached = useAppStore.getState().events.find(e => e.id === id)
        if (cached) {
          setEvent(cached)
        } else {
          const found = await eventService.getById(id)
          setEvent(found)
        }
        setError(null)
      } catch (e) {
        console.error('Failed to load event for chat', e)
        setError('Impossibile caricare la chat di questo evento. Riprova più tardi.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id]) // intentionally omit `events` — we use imperative getState() to avoid re-runs on store refresh

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto">Caricamento chat...</div>
  }

  if (!event) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <p className="text-sm text-[--text-muted]">Evento non trovato.</p>
        <button onClick={() => navigate('/chats')} className="text-sm text-primary-600 hover:underline">← Torna alle chat</button>
      </div>
    )
  }

  if (!canChat) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <div className="bg-[--bg-subtle] border border-[--border-base] text-[--text-muted] px-4 py-3 rounded-lg text-sm">
          La chat è disponibile solo dopo aver confermato la partecipazione (✅).
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/events/${event.id}/summary`)} className="text-sm text-primary-600 hover:underline">Vai al riepilogo evento</button>
          <button onClick={() => navigate(-1)} className="text-sm text-[--text-muted] hover:text-[--text-base]">← Indietro</button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        <button onClick={() => navigate(-1)} className="text-sm text-[--text-muted] hover:text-[--text-base]">← Indietro</button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-0 right-0 h-[100dvh] bg-[--bg-card] dark:bg-gray-900 flex flex-col overflow-hidden md:relative md:top-auto md:mt-20 md:h-[calc(100dvh-5rem)] md:max-w-screen-md md:mx-auto md:shadow-2xl"
    >
      <EventChat 
        eventId={event.id} 
        eventName={event.title}
        onBack={() => navigate(-1)}
        canWrite={canWrite}
        className="flex-1 border-none rounded-none" 
      />
    </div>
  )
}

export default EventChatPage


