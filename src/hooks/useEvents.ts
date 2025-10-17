import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { eventService } from '../services/firestore'

export const useEvents = () => {
  const { user } = useAuthStore()
  const { events, setEvents } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = async (force = false) => {
    if (!user) return
    
    // Se gli eventi sono già caricati e non forziamo il reload, non ricaricare
    if (events.length > 0 && !force) return
    
    setLoading(true)
    setError(null)
    
    try {
      console.log('🔄 Loading events...')
      const eventsData = await eventService.getAll()
      setEvents(eventsData)
      console.log(`✅ Loaded ${eventsData.length} events`)
    } catch (err) {
      console.error('❌ Error loading events:', err)
      setError('Errore nel caricamento degli eventi')
    } finally {
      setLoading(false)
    }
  }

  // Carica gli eventi automaticamente quando l'utente è disponibile
  useEffect(() => {
    loadEvents()
  }, [user])

  // Ricarica quando vengono aggiunti/rimossi eventi
  useEffect(() => {
    if (user && events.length === 0) {
      loadEvents()
    }
  }, [events.length, user])

  return {
    events,
    loading,
    error,
    loadEvents,
    // Computed properties per facilità d'uso
    upcomingEvents: events
      .filter(event => new Date(event.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    pastEvents: events
      .filter(event => new Date(event.date) < new Date())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}
