import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { eventService } from '../services/firestore'
import { Event } from '../types'

const EventsPage = () => {
  const { user } = useAuthStore()
  const { events, setEvents } = useAppStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadEvents = async () => {
      if (user && events.length === 0) {
        setLoading(true)
        try {
          const eventsData = await eventService.getAll()
          setEvents(eventsData)
        } catch (error) {
          console.error('Error loading events:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    
    loadEvents()
  }, [user, events.length, setEvents])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.date)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate >= today
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const pastEvents = events.filter(event => {
    const eventDate = new Date(event.date)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate < today
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const EventCard = ({ event }: { event: Event }) => (
    <div className="gvn-card p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-neutral-800 mb-2">{event.title}</h3>
          <p className="text-neutral-600 mb-3">{event.description}</p>
        </div>
        <div className="text-3xl ml-4">
          {event.category === 'cena' && '🍽️'}
          {event.category === 'aperitivo' && '🍻'}
          {event.category === 'viaggio' && '✈️'}
          {event.category === 'sport' && '⚽'}
          {event.category === 'festa' && '🎉'}
          {event.category === 'cinema' && '🎬'}
          {event.category === 'shopping' && '🛍️'}
          {event.category === 'altro' && '🎯'}
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span>📅</span>
          <span>{new Date(event.date).toLocaleDateString('it-IT', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          })}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span>🕐</span>
          <span>{event.time}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span>📍</span>
          <span>{event.location}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600">👥</span>
          <span className="text-sm text-neutral-600">{event.participants.length} partecipanti</span>
        </div>
        <div className="gvn-badge-secondary text-xs">
          {event.category}
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="gvn-title text-3xl mb-2">📅 I Tuoi Eventi</h1>
              <p className="text-neutral-600">Organizza e partecipa agli eventi con i tuoi amici</p>
            </div>
            <button className="gvn-btn-primary">
              ➕ Nuovo Evento
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-neutral-600">Caricamento eventi...</p>
          </div>
        ) : (
          <>
            {/* Eventi in programma */}
            {upcomingEvents.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                  🚀 Eventi in Programma
                  <span className="gvn-badge-pig">{upcomingEvents.length}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}

            {/* Eventi passati */}
            {pastEvents.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-neutral-800 mb-6 flex items-center gap-2">
                  📚 Eventi Passati
                  <span className="gvn-badge-secondary">{pastEvents.length}</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastEvents.slice(0, 6).map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
                {pastEvents.length > 6 && (
                  <div className="text-center mt-6">
                    <button className="text-primary-600 hover:text-primary-700 font-medium">
                      Mostra altri eventi passati...
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stato vuoto */}
            {events.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="text-6xl mb-6">🎪</div>
                <h3 className="text-2xl font-semibold text-neutral-700 mb-4">Nessun evento ancora</h3>
                <p className="text-neutral-500 mb-8 max-w-md mx-auto">
                  Inizia creando il tuo primo evento! Invita i tuoi amici e organizza momenti indimenticabili.
                </p>
                <button className="gvn-btn-primary">
                  🎉 Crea il tuo primo evento
                </button>
              </div>
            )}
          </>
        )}

        {/* Link torna home */}
        <div className="text-center mt-12">
          <Link to="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-primary-600 transition-colors">
            🏠 Torna alla Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default EventsPage
