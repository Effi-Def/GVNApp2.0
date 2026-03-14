import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { eventService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { Event, EventCategory, EventParticipant, EventPriority } from '../types'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAppStore } from '../stores/AppStore'
import { APP_CONFIG } from '../constants'
import { getUserKeys, getUserEventParticipation } from '../utils/events'

const EventsPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  // Usa lo store centrale per avere eventi sincronizzati in tutta l'app
  const { events, setEvents, addEvent, updateEvent, deleteEvent, expenses, polls, lists, setExpenses, setPolls, setLists } = useAppStore()
  const { notifications } = useUserSettingsStore()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Form data per nuovo evento
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'cena' as EventCategory,
    date: '',
    endDate: '',
    time: '',
    location: '',
    priority: 'medium' as EventPriority
  })
  const [sortMode, setSortMode] = useState<'byDate' | 'createdDesc' | 'createdAsc' | 'priority'>('byDate')

  const currentUserId = user?.id || 'anonymous'
  const currentUserName = user?.displayName || user?.email || 'Utente'
  const meKeys = getUserKeys(user)

  // Categorie con emoji
  const categories = [
    { value: 'cena', label: 'Cena 🍽️', multiDay: false },
    { value: 'aperitivo', label: 'Aperitivo 🍻', multiDay: false },
    { value: 'viaggio', label: 'Viaggio ✈️', multiDay: true },
    { value: 'sport', label: 'Sport ⚽', multiDay: false },
    { value: 'festa', label: 'Festa 🎉', multiDay: false },
    { value: 'cinema', label: 'Cinema 🎬', multiDay: false },
    { value: 'shopping', label: 'Shopping 🛍️', multiDay: false },
    { value: 'altro', label: 'Altro 📅', multiDay: false }
  ]

  const priorityOptions: { value: EventPriority; label: string }[] = [
    { value: 'high', label: 'Alta 🔥' },
    { value: 'medium', label: 'Media ⚖️' },
    { value: 'low', label: 'Bassa 💤' }
  ]

  // Carica eventi
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        console.log('📅 Loading events...')
        const eventsData = await eventService.getAll()
        // Aggiorna lo store centrale
        setEvents(eventsData)
        
        // Se abbiamo ricevuto meno eventi del limite, non ce ne sono altri
        if (eventsData.length < APP_CONFIG.PAGINATION_LIMIT) {
          setHasMore(false)
        } else {
          setHasMore(true)
        }
        
        console.log(`✅ Loaded ${eventsData.length} events`)
      } catch (error) {
        console.error('❌ Error loading events:', error)
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

  // Carica altri eventi (paginazione)
  const handleLoadMore = async () => {
    if (events.length === 0 || loadingMore) return

    setLoadingMore(true)
    try {
      // Trova la data più vecchia tra gli eventi attuali
      const minDateEvent = events.reduce((min: Event, e: Event) => 
        new Date(e.date) < new Date(min.date) ? e : min
      , events[0])

      const newEvents = await eventService.getMoreEvents(new Date(minDateEvent.date))
      
      if (newEvents.length < APP_CONFIG.PAGINATION_LIMIT) {
        setHasMore(false)
      }

      if (newEvents.length > 0) {
        // Filtra duplicati (sicurezza)
        const uniqueNewEvents = newEvents.filter((ne: Event) => !events.some((e: Event) => e.id === ne.id))
        setEvents([...events, ...uniqueNewEvents])
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('❌ Error loading more events:', error)
    } finally {
      setLoadingMore(false)
    }
  }

  // Auto-open create form when ?create=1, prefill date if ?date=YYYY-MM-DD
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const shouldCreate = params.get('create') === '1'
    const dateParam = params.get('date')
    if (shouldCreate) {
      setShowForm(true)
      if (dateParam) {
        setFormData(prev => ({ ...prev, date: dateParam }))
      }
    }
  }, [location.search])

  // Helper functions
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'short'
    })
  }

  const getCategoryIcon = (category: EventCategory) => {
    const cat = categories.find(c => c.value === category)
    const label = cat?.label
    return label ? (label.split(' ')[1] || '📅') : '📅'
  }

  const isMultiDayCategory = (category: EventCategory) => {
    const cat = categories.find(c => c.value === category)
    return cat?.multiDay || false
  }

  // Gestione submit evento
  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.date || !formData.location) return

    setSubmitting(true)
    try {
      // Crea partecipante iniziale (il creatore)
      const initialParticipant: EventParticipant = {
        userId: currentUserId,
        name: currentUserName,
        status: 'yes',
        respondedAt: new Date()
      }

      const eventData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        date: new Date(formData.date + (formData.time ? `T${formData.time}` : 'T12:00')),
        endDate: formData.endDate ? new Date(formData.endDate + 'T23:59') : undefined,
        time: formData.time,
        location: formData.location,
        createdBy: currentUserId,
        participants: [initialParticipant],
        priority: formData.priority
      }

      if (editingEvent) {
        await eventService.update(editingEvent.id, eventData)
        // Aggiorna subito lo store per riflettere la modifica
        updateEvent(editingEvent.id, { ...eventData, updatedAt: new Date() } as Partial<Event>)
        setEditingEvent(null)
      } else {
        const newEvent = await eventService.create(eventData)
        // Aggiungi all'elenco eventi globale
        addEvent(newEvent)
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'cena',
        date: '',
        endDate: '',
        time: '',
        location: '',
        priority: 'medium'
      })
      setShowForm(false)
      console.log('✅ Event saved successfully')
    } catch (error) {
      console.error('❌ Error saving event:', error)
      alert('Errore durante il salvataggio dell\'evento')
    } finally {
      setSubmitting(false)
    }
  }

  // Modifica evento
  const handleEditEvent = (event: Event) => {
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description,
      category: event.category,
      date: event.date.toISOString().split('T')[0],
      endDate: event.endDate ? event.endDate.toISOString().split('T')[0] : '',
      time: event.time,
      location: event.location,
      priority: event.priority || 'medium'
    })
    setShowForm(true)
  }

  // Cancella evento
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo evento?')) return

    try {
      await eventService.delete(eventId)
      // Rimuovi anche dallo store globale
      deleteEvent(eventId)
      // Pulisci dati correlati dal client store
      setExpenses(expenses.filter((e: any) => e.eventId !== eventId))
      setPolls(polls.filter((p: any) => p.eventId !== eventId))
      setLists(lists.filter((l: any) => l.eventId !== eventId))
      console.log('✅ Event deleted successfully')
    } catch (error) {
      console.error('❌ Error deleting event:', error)
      alert('Errore durante l\'eliminazione dell\'evento')
    }
  }

  // Partecipa/non partecipa a evento
  const handleParticipation = async (eventId: string, status: 'yes' | 'no' | 'maybe') => {
    try {
  const ev = events.find((e: Event) => e.id === eventId)
      if (!ev) return

      // Aggiorna su Firestore con l'helper dedicato
      await eventService.updateParticipation(eventId, currentUserId, currentUserName, status)

      // Aggiorna anche lo store globale per riflettere subito la modifica
  const idx = ev.participants.findIndex((p: EventParticipant) => p.userId === currentUserId)
      const updatedParticipants = [...ev.participants]
      if (idx >= 0) {
        updatedParticipants[idx] = {
          ...updatedParticipants[idx],
          status,
          respondedAt: new Date()
        }
      } else {
        updatedParticipants.push({
          userId: currentUserId,
          name: currentUserName,
          status,
          respondedAt: new Date()
        })
      }

      const updatedParticipation = (() => {
        const base = (ev.participation && typeof ev.participation === 'object') ? { ...ev.participation } : {}
        base[currentUserId] = {
          status,
          accessLevel: status === 'no' ? 'readonly' : 'full',
          role: ev.createdBy === currentUserId ? 'owner' : 'member',
          respondedAt: new Date(),
        }
        return base
      })()

      updateEvent(eventId, { participants: updatedParticipants, participation: updatedParticipation as any, updatedAt: new Date() })

      console.log('✅ Participation updated successfully')
    } catch (error) {
      console.error('❌ Error updating participation:', error)
      alert('Errore durante l\'aggiornamento della partecipazione')
    }
  }

  // Filtra eventi
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let upcomingEvents = events.filter((event: Event) => {
    const eventDate = new Date(event.date)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate >= today
  })
  let pastEvents = events.filter((event: Event) => {
    const eventDate = new Date(event.date)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate < today
  })

  const priorityWeight = (p?: EventPriority) => (p === 'high' ? 3 : p === 'medium' || !p ? 2 : 1)

  // Applica ordinamento
  if (sortMode === 'byDate') {
    upcomingEvents = upcomingEvents.sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime())
    pastEvents = pastEvents.sort((a: Event, b: Event) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } else if (sortMode === 'createdDesc') {
    upcomingEvents = upcomingEvents.sort((a: Event, b: Event) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    pastEvents = pastEvents.sort((a: Event, b: Event) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } else if (sortMode === 'createdAsc') {
    upcomingEvents = upcomingEvents.sort((a: Event, b: Event) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    pastEvents = pastEvents.sort((a: Event, b: Event) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } else if (sortMode === 'priority') {
    upcomingEvents = upcomingEvents.sort((a: Event, b: Event) => {
      const diff = priorityWeight(b.priority) - priorityWeight(a.priority)
      return diff !== 0 ? diff : new Date(a.date).getTime() - new Date(b.date).getTime()
    })
    pastEvents = pastEvents.sort((a: Event, b: Event) => {
      const diff = priorityWeight(b.priority) - priorityWeight(a.priority)
      return diff !== 0 ? diff : new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }

  // Ottieni stato partecipazione utente
  const getUserParticipationStatus = (event: Event) => {
    const p = getUserEventParticipation(event, [currentUserId, ...(meKeys || [])])
    return p.status === 'none' ? null : (p.status as any)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Caricamento eventi...</h3>
          <p className="text-gray-500">Connessione a Firebase in corso</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Eventi 📅</h1>
            <p className="text-gray-600">Organizza e partecipa agli eventi di gruppo</p>
          </div>
          {/* Rimosso pulsante header: creazione evento solo dal FAB in basso */}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">Ordina:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
          >
            <option value="byDate">Per data</option>
            <option value="createdDesc">Inserimento (nuovi → vecchi)</option>
            <option value="createdAsc">Inserimento (vecchi → nuovi)</option>
            <option value="priority">Per priorità</option>
          </select>
        </div>
      </div>

      {/* Eventi Prossimi */}
      {upcomingEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Prossimi Eventi</h2>
          <div className="space-y-4">
            {upcomingEvents.map((event: Event) => {
              const userStatus = getUserParticipationStatus(event)
              const isCreator = event.createdBy === currentUserId
              const participants = event.participants || []
              const lastRead = notifications.lastReadByEvent?.[event.id] || 0
              const hasUnread = (event.chatLastActivityAt?.getTime?.() || 0) > lastRead
              const isMuted = (notifications.mutedEventIds || []).includes(event.id)

              return (
                <div key={event.id} className={`bg-white rounded-xl shadow-sm border p-6 ${
                  (userStatus === 'yes') ? 'border-green-400 ring-1 ring-green-200' : (userStatus === 'no') ? 'border-gray-300 bg-gray-50/40' : 'border-gray-200'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
                    <div className="md:flex-1 cursor-pointer" onClick={() => navigate(`/events/${event.id}/summary`)}>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">{getCategoryIcon(event.category)}</span>
                        <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <span>{event.title}</span>
                          {hasUnread && (
                            <span className={`px-2 py-0.5 text-[11px] rounded-full ${isMuted ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`} title={isMuted ? 'Nuovi messaggi (silenzioso)' : 'Nuovi messaggi'}>
                              {isMuted ? 'Nuovi' : 'Nuovi'}
                            </span>
                          )}
                        </h3>
                        {event.priority && (
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            event.priority === 'high' ? 'bg-red-100 text-red-700' :
                            event.priority === 'low' ? 'bg-gray-100 text-gray-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {event.priority === 'high' ? 'Priorità alta' : event.priority === 'low' ? 'Priorità bassa' : 'Priorità media'}
                          </span>
                        )}
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {(() => { const cat = categories.find(c => c.value === event.category); const label = cat?.label; return label ? label.split(' ')[0] : 'Evento' })()}
                        </span>
                      </div>
                      
                      {event.description && (
                        <p className="text-gray-600 mb-3">{event.description}</p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                        <span>📅 {formatDate(new Date(event.date))}</span>
                        {event.endDate && (
                          <span>📅 fino al {formatDateShort(new Date(event.endDate))}</span>
                        )}
                        {event.time && <span>🕐 {event.time}</span>}
                        <span>📍 {event.location}</span>
                        <span>👥 {participants.filter((p: EventParticipant) => p.status !== 'no').length} partecipanti</span>
                      </div>

                      {/* Partecipanti */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {participants
                          .filter((participant: EventParticipant) => participant.status !== 'no')
                          .map((participant: EventParticipant) => (
                            <span key={participant.userId} className={`px-2 py-1 text-xs rounded-full ${
                              participant.status === 'yes' 
                                ? 'bg-green-600 text-white' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {participant.name} {participant.status === 'yes' ? '✓' : '?'}
                            </span>
                          ))}
                      </div>

                      {/* Controlli partecipazione */}
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">La tua risposta:</span>
                        <button
                          onClick={() => handleParticipation(event.id, 'yes')}
                          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                            userStatus === 'yes'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                          }`}
                        >
                          ✓ Partecipo
                        </button>
                        <button
                          onClick={() => handleParticipation(event.id, 'maybe')}
                          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                            userStatus === 'maybe'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-yellow-100'
                          }`}
                        >
                          ? Forse
                        </button>
                        <button
                          onClick={() => handleParticipation(event.id, 'no')}
                          className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                            userStatus === 'no'
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-red-100'
                          }`}
                        >
                          ✗ Non partecipo
                        </button>
                      </div>
                    </div>
                    
                    {/* Azioni: condividi + modifica/elimina */}
                    {(() => {
                      const canEdit = isCreator || userStatus === 'yes' || userStatus === 'maybe'
                      return (
                        <div className="flex items-center gap-2 md:self-start md:shrink-0">
                          {/* Share */}
                          <button
                            onClick={async () => {
                              const shareUrl = `${window.location.origin}/share/e/${event.id}`
                              const shareData = {
                                title: `Invito: ${event.title}`,
                                text: `${event.title} • ${new Date(event.date).toLocaleDateString('it-IT')} ${event.time ? 'alle ' + event.time : ''} • ${event.location}`,
                                url: shareUrl
                              }
                              try {
                                if ((navigator as any).share) {
                                  await (navigator as any).share(shareData)
                                } else if (navigator.clipboard) {
                                  await navigator.clipboard.writeText(shareUrl)
                                  alert('Link copiato negli appunti')
                                } else {
                                  prompt('Copia il link', shareUrl)
                                }
                              } catch (e) {
                                console.error('Share failed:', e)
                              }
                            }}
                            className="inline-flex items-center gap-1.5 p-2.5 text-gray-800 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                            title="Condividi evento"
                            aria-label="Condividi evento"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8a3 3 0 10-2.83-4H12a3 3 0 00.17 6h.01A3 3 0 0015 8zM5 12a3 3 0 100 6 3 3 0 000-6zm10 1l-6 3m0-6l6 3" />
                            </svg>
                            <span className="hidden sm:inline text-sm">Condividi</span>
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEditEvent(event)}
                              className="inline-flex items-center gap-1.5 p-2.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                              title="Modifica evento"
                              aria-label="Modifica evento"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span className="hidden sm:inline text-sm">Modifica</span>
                            </button>
                          )}
                          {isCreator && (
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="inline-flex items-center gap-1.5 p-2.5 text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                              title="Elimina evento"
                              aria-label="Elimina evento"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span className="hidden sm:inline text-sm">Elimina</span>
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Eventi Passati */}
      {pastEvents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Eventi Passati</h2>
          <div className="space-y-4">
            {pastEvents.slice(0, 5).map((event: Event) => (
              <div key={event.id} className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4 opacity-75">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-lg">{getCategoryIcon(event.category)}</span>
                  <h3 className="text-lg font-semibold text-gray-700">{event.title}</h3>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>📅 {formatDate(event.date)}</span>
                  <span>📍 {event.location}</span>
                  <span>👥 {event.participants.length} partecipanti</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && events.length > 0 && (
        <div className="mt-8 text-center mb-24">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-full shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-all"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                Caricamento...
              </span>
            ) : (
              'Carica altri eventi'
            )}
          </button>
        </div>
      )}

      {/* Stato vuoto */}
      {events.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Nessun evento</h3>
          <p className="text-gray-500">Crea il primo evento per organizzare attività di gruppo</p>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingEvent ? 'Modifica Evento' : 'Nuovo Evento'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingEvent(null)
                    setFormData({
                      title: '',
                      description: '',
                      category: 'cena',
                      date: '',
                      endDate: '',
                      time: '',
                      location: '',
                      priority: 'medium'
                    })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo evento
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="Es. Cena da Mario"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione (opzionale)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    rows={3}
                    placeholder="Aggiungi dettagli sull'evento..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const newCategory = e.target.value as EventCategory
                      setFormData({
                        ...formData, 
                        category: newCategory,
                        // Reset endDate se non è una categoria multi-giorno
                        endDate: isMultiDayCategory(newCategory) ? formData.endDate : ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorità
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as EventPriority })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  >
                    {priorityOptions.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data {isMultiDayCategory(formData.category) ? 'inizio' : 'evento'}
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    required
                  />
                </div>

                {isMultiDayCategory(formData.category) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data fine (per viaggi/eventi multi-giorno)
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                      min={formData.date}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orario (opzionale)
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Luogo
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="Es. Ristorante Da Mario, Via Roma 1"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingEvent(null)
                      setFormData({
                        title: '',
                        description: '',
                        category: 'cena',
                        date: '',
                        endDate: '',
                        time: '',
                        location: '',
                        priority: 'medium'
                      })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Salvataggio...' : (editingEvent ? 'Salva' : 'Crea Evento')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottone Mobile */}
      <div className="fixed bottom-28 right-6 md:bottom-8 z-40">
        <button 
          onClick={() => setShowForm(true)}
          className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 ring-4 ring-green-100"
          title="Crea nuovo evento"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default EventsPage