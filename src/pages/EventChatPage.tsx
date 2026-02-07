import { useEffect, useState } from 'react'
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
  const { events } = useAppStore()
  const { user } = useAuthStore()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        const cached = events.find(e => e.id === id)
        if (cached) {
          setEvent(cached)
        } else {
          const all = await eventService.getAll()
          const found = all.find(e => e.id === id) || null
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
  }, [id, events])

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto">Caricamento chat...</div>
  }

  if (!event) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <p className="text-sm text-neutral-600">Evento non trovato.</p>
        <button onClick={() => navigate('/chats')} className="text-sm text-primary-600 hover:underline">← Torna alle chat</button>
      </div>
    )
  }

  if (!canChat) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-lg text-sm">
          La chat è disponibile solo dopo aver confermato la partecipazione (✅).
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/events/${event.id}/summary`)} className="text-sm text-primary-600 hover:underline">Vai al riepilogo evento</button>
          <button onClick={() => navigate(-1)} className="text-sm text-neutral-600 hover:text-neutral-800">← Indietro</button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        <button onClick={() => navigate(-1)} className="text-sm text-neutral-600 hover:text-neutral-800">← Indietro</button>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-white dark:bg-gray-900 max-w-screen-md mx-auto shadow-2xl flex flex-col">
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
