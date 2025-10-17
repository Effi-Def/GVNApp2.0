import { useState, useEffect } from 'react'
import { Event } from '../types'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { eventService } from '../services/firestore'
import EventForm from '../components/EventForm'
import EventCard from '../components/EventCard'
import EventDashboard from '../components/EventDashboard'

const EventsPage = () => {
  const { events, setEvents, addEvent } = useAppStore()
  const { user } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load events on component mount
  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('📅 Loading events from Firestore...')
      
      const eventsData = await eventService.getAll()
      setEvents(eventsData)
      console.log(`✅ Loaded ${eventsData.length} events`)
    } catch (err) {
      console.error('❌ Error loading events:', err)
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento degli eventi')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setCreating(true)
      console.log('📅 Creating new event...')
      
      const newEvent = await eventService.create(eventData)
      addEvent(newEvent)
      
      console.log('✅ Event created and added to store')
      setShowForm(false)
    } catch (err) {
      console.error('❌ Error creating event:', err)
      throw err // Re-throw to let the form handle the error display
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo evento?')) return

    try {
      console.log('📅 Deleting event:', eventId)
      await eventService.delete(eventId)
      
      // Remove from local state
      const updatedEvents = events.filter(e => e.id !== eventId)
      setEvents(updatedEvents)
      
      console.log('✅ Event deleted successfully')
    } catch (err) {
      console.error('❌ Error deleting event:', err)
      alert('Errore durante l\'eliminazione dell\'evento')
    }
  }

  const handleParticipation = async (eventId: string, status: 'yes' | 'no' | 'maybe') => {
    if (!user) return

    try {
      await eventService.updateParticipation(eventId, user.id, user.displayName || user.email || 'Utente', status)
      
      // Aggiorna lo stato locale
      const updatedEvents = events.map(event => {
        if (event.id === eventId) {
          const participants = event.participants || []
          const existingIndex = participants.findIndex(p => p.userId === user.id)
          
          if (existingIndex >= 0) {
            participants[existingIndex] = {
              userId: user.id,
              name: user.displayName || user.email || 'Utente',
              status,
              respondedAt: new Date()
            }
          } else {
            participants.push({
              userId: user.id,
              name: user.displayName || user.email || 'Utente',
              status,
              respondedAt: new Date()
            })
          }
          
          return { ...event, participants }
        }
        return event
      })
      
      setEvents(updatedEvents)
      console.log(`✅ Participation updated: ${status}`)
    } catch (err) {
      console.error('❌ Error updating participation:', err)
      alert('Errore durante l\'aggiornamento della partecipazione')
    }
  }

  // Sort events by date
  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const upcomingEvents = sortedEvents.filter(event => new Date(event.date) >= new Date())
  const pastEvents = sortedEvents.filter(event => new Date(event.date) < new Date())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Eventi</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center"
        >
          <span className="mr-2">+</span>
          Nuovo Evento
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-400 mr-2">❌</div>
            <div>
              <h3 className="text-red-800 font-medium">Errore</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button
                onClick={loadEvents}
                className="text-red-600 hover:text-red-500 text-sm font-medium mt-2"
              >
                Riprova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600">Caricamento eventi...</span>
          </div>
        </div>
      )}

      {/* Events Content */}
      {!loading && !error && (
        <>
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Prossimi Eventi</h2>
              <div className="space-y-4">
                {upcomingEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={handleDeleteEvent}
                    onClick={setSelectedEvent}
                    onParticipate={handleParticipation}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Eventi Passati</h2>
              <div className="space-y-4">
                {pastEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onDelete={handleDeleteEvent}
                    onClick={setSelectedEvent}
                    onParticipate={handleParticipation}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {events.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun evento ancora</h3>
              <p className="text-gray-500 mb-6">
                Crea il tuo primo evento per iniziare a organizzare attività con i tuoi amici!
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Crea il primo evento
              </button>
            </div>
          )}
        </>
      )}

      {/* Event Form Modal */}
      {showForm && (
        <EventForm
          onSubmit={handleCreateEvent}
          onClose={() => setShowForm(false)}
          isLoading={creating}
        />
      )}

      {selectedEvent && (
        <EventDashboard
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

export default EventsPage
