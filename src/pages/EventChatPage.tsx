import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EventChat from '../components/Chat/EventChat'
import { useAppStore } from '../stores/AppStore'
import { eventService } from '../services/firestore'
import { Event } from '../types'

const EventChatPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { events } = useAppStore()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        <button onClick={() => navigate(-1)} className="text-sm text-neutral-600 hover:text-neutral-800">← Indietro</button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-neutral-600 hover:text-neutral-800">← Indietro</button>
        </div>
        <button
          onClick={() => navigate(`/events/${event.id}/summary`)}
          className="text-sm text-primary-600 hover:underline"
        >Apri riepilogo evento</button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">{event.title} <span>💬</span></h1>
          <span className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-full border border-primary-100">
            {event.participants?.filter(p => p.status === 'yes').length || 0} confermati
          </span>
        </div>
        <div className="text-sm text-neutral-600 flex flex-wrap items-center gap-3">
          <span>📅 {new Date(event.date).toLocaleDateString('it-IT')}</span>
          {event.time && <span>🕒 {event.time}</span>}
          <span>📍 {event.location}</span>
        </div>
      </div>

      <EventChat eventId={event.id} />
    </div>
  )
}

export default EventChatPage
