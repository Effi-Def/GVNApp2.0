import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { eventService, farmService } from '../services/firestore'
import { db } from '../firebase/config'
import { doc, getDoc, QueryDocumentSnapshot } from 'firebase/firestore'
import { refreshActiveFarmData, useAuthStore } from '../stores/useAuthStore'
import { Event, EventCategory, EventParticipant, EventPriority, FarmMembership } from '../types'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { useAppStore } from '../stores/AppStore'
import { APP_CONFIG } from '../constants'
import { getUserKeys, getUserEventParticipation, userCanViewEvent } from '../utils/events'
import QuickEventForm, { QuickEventFormValues } from '../components/QuickEventForm'
import AdvancedSection from '../components/AdvancedSection'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { useFarmContext } from '../contexts/FarmContext'

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
  const [activeFarmMembers, setActiveFarmMembers] = useState<FarmMembership[]>([])
  const [quickPrefillDate, setQuickPrefillDate] = useState('')
  
  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  // DocumentSnapshot cursor for reliable Firestore pagination (startAfter doc, not scalar date)
  const [paginationCursor, setPaginationCursor] = useState<QueryDocumentSnapshot | null>(null)

  // Form data per nuovo evento
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'cena' as EventCategory,
    date: '',
    endDate: '',
    time: '',
    location: '',
    priority: 'medium' as EventPriority,
    visibilityType: 'farm' as 'farm' | 'members' | 'public',
    visibilityUserIds: [] as string[]
  })
  const [sortMode, setSortMode] = useState<'byDate' | 'createdDesc' | 'createdAsc' | 'priority'>('byDate')

  const currentUserId = user?.id || 'anonymous'
  const currentUserName = user?.displayName || user?.email || 'Utente'
  const meKeys = getUserKeys(user)
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)
  const { activeFarm } = useFarmContext()

  // Load active farm members for the member picker
  useEffect(() => {
    if (!activeFarmId) { setActiveFarmMembers([]); return }
    let alive = true
    farmService.listMembers(activeFarmId)
      .then((m) => { if (alive) setActiveFarmMembers(m) })
      .catch(() => { if (alive) setActiveFarmMembers([]) })
    return () => { alive = false }
  }, [activeFarmId])

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
    let cancelled = false
    // Reset the pagination cursor on farm switch — the next load-more must start from
    // the first page of the new farm, not from a snapshot belonging to a different farm.
    setPaginationCursor(null)

    const loadEvents = async () => {
      try {
        setLoading(true)
        console.log('📅 Loading events...')
        await refreshActiveFarmData()
        if (!cancelled) setHasMore(true)
      } catch (error) {
        console.error('❌ Error loading events:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Only load if store is empty for the current farm; otherwise just clear the loading flag.
    // Depend on activeFarmId (not events?.length) to avoid a triple-load on farm switch:
    // Layout.tsx and useActiveFarmStore.setActiveFarmId both clear events[] and call
    // refreshActiveFarmData concurrently — the guard in refreshActiveFarmData ensures only
    // one of them runs, and EventsPage must not add a third concurrent call.
    if ((events?.length || 0) === 0) {
      loadEvents()
    } else {
      setLoading(false)
    }

    return () => { cancelled = true }
  }, [activeFarmId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Carica altri eventi (paginazione)
  const handleLoadMore = async () => {
    if (events.length === 0 || loadingMore) return

    setLoadingMore(true)
    try {
      // Lazily resolve the DocumentSnapshot cursor.
      // On the first call paginationCursor is null (initial page was loaded via the store),
      // so we fetch the snapshot of the last-ordered event by its document ID.
      let cursor = paginationCursor
      if (!cursor) {
        // Find the event with the oldest date among the currently-displayed events
        const oldestEvent = events.reduce((min: Event, e: Event) =>
          new Date(e.date) < new Date(min.date) ? e : min
        , events[0])
        const snap = await getDoc(doc(db, 'events', oldestEvent.id))
        if (!snap.exists()) { setHasMore(false); return }
        cursor = snap as QueryDocumentSnapshot
      }

      const result = await eventService.getMoreEvents(cursor)

      if (result.events.length < APP_CONFIG.PAGINATION_LIMIT) {
        setHasMore(false)
      }

      if (result.events.length > 0) {
        // Store the new cursor for the next load-more call
        setPaginationCursor(result.lastDoc)

        // Filter duplicates (safety net)
        const uniqueNewEvents = result.events.filter(
          (ne: Event) => !events.some((e: Event) => e.id === ne.id)
        )

        // Apply active-farm visibility scoping on paginated results
        const ctx = { userKeys: meKeys, farmIds: activeFarmId ? [activeFarmId] : [] }
        const scoped = activeFarmId
          ? uniqueNewEvents.filter(ev => userCanViewEvent(ev, ctx))
          : uniqueNewEvents

        setEvents([...events, ...scoped])
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
      setEditingEvent(null)
      setShowForm(true)
      if (dateParam) {
        setQuickPrefillDate(dateParam)
      }
    }
  }, [location.search])

  const handleQuickCreateEvent = async (values: QuickEventFormValues) => {
    if (!values.title || !values.date) return

    setSubmitting(true)
    try {
      const initialParticipant: EventParticipant = {
        userId: currentUserId,
        name: currentUserName,
        status: 'yes',
        respondedAt: new Date(),
      }

      const eventData = {
        title: values.title,
        description: values.description,
        category: values.category,
        date: new Date(values.date + 'T12:00'),
        time: '',
        location: values.location,
        locationGeo: values.locationGeo,
        createdBy: currentUserId,
        participants: [initialParticipant],
        priority: values.priority,
        visibility: values.visibilityType === 'public'
          ? { type: 'public' as const }
          : {
              type: 'restricted' as const,
              farms: activeFarmId ? [activeFarmId] : undefined,
              users: values.visibilityType === 'members' && values.invitedUserIds.length > 0
                ? values.invitedUserIds
                : undefined,
            },
      }

      const newEvent = await eventService.create(eventData as any)
      addEvent(newEvent)
      setShowForm(false)
      setQuickPrefillDate('')
      console.log('✅ Quick event created successfully')
    } catch (error) {
      console.error('❌ Error creating quick event:', error)
      alert('Errore durante la creazione dell\'evento')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper functions
  const formatCompactDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
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
      // Crea partecipante iniziale (il creatore) — usato solo per nuovi eventi
      const initialParticipant: EventParticipant = {
        userId: currentUserId,
        name: currentUserName,
        status: 'yes',
        respondedAt: new Date()
      }

      const buildVisibility = () => {
        if (formData.visibilityType === 'public') {
          return { type: 'public' as const }
        }
        if (formData.visibilityType === 'members') {
          return {
            type: 'restricted' as const,
            farms: activeFarmId ? [activeFarmId] : undefined,
            users: formData.visibilityUserIds.length > 0 ? formData.visibilityUserIds : undefined,
          }
        }
        // 'farm' (default): current farm only
        return {
          type: 'restricted' as const,
          farms: activeFarmId ? [activeFarmId] : undefined,
        }
      }

      const eventData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        date: new Date(formData.date + (formData.time ? `T${formData.time}` : 'T12:00')),
        endDate: formData.endDate ? new Date(formData.endDate + 'T23:59') : undefined,
        time: formData.time,
        location: formData.location,
        // Preserve original creator and participants when editing
        createdBy: editingEvent ? editingEvent.createdBy : currentUserId,
        participants: editingEvent ? editingEvent.participants : [initialParticipant],
        priority: formData.priority,
        visibility: buildVisibility()
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
        priority: 'medium',
        visibilityType: 'farm',
        visibilityUserIds: []
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
    const hasUsers = (event.visibility?.users?.length ?? 0) > 0
    const visType: 'farm' | 'members' | 'public' =
      event.visibility?.type === 'public' ? 'public'
      : hasUsers ? 'members'
      : 'farm'
    setFormData({
      title: event.title,
      description: event.description || '',
      category: event.category,
      date: event.date.toISOString().split('T')[0],
      endDate: event.endDate ? event.endDate.toISOString().split('T')[0] : '',
      time: event.time,
      location: event.location,
      priority: event.priority || 'medium',
      visibilityType: visType,
      visibilityUserIds: event.visibility?.users || []
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

  // Strict farm filter: only show events belonging to the active farm
  const activeFarmCtx = { userKeys: meKeys, farmIds: activeFarmId ? [activeFarmId] : [] }
  const farmScopedEvents = (events || []).filter((e: Event) => userCanViewEvent(e, activeFarmCtx))

  // Filtra eventi
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let upcomingEvents = farmScopedEvents.filter((event: Event) => {
    const eventDate = new Date(event.date)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate >= today
  })
  let pastEvents = farmScopedEvents.filter((event: Event) => {
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
      <div className="pt-16 space-y-3">
        <div className="text-center py-16 text-[--text-muted]">
          <div className="text-4xl mb-3">📅</div>
          <div className="text-sm">Caricamento eventi…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[--text-base]">Eventi</h1>
          {activeFarm?.name && (
            <p className="text-xs text-[--text-muted] mt-0.5">{activeFarm.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="text-xs border border-[--border-base] rounded-lg px-2 py-1.5 bg-[--bg-card] text-[--text-muted] focus:outline-none"
          >
            <option value="byDate">Per data</option>
            <option value="createdDesc">Più recenti</option>
            <option value="priority">Per priorità</option>
          </select>
        </div>
      </div>

      {/* Prossimi eventi */}
      {upcomingEvents.length > 0 && (
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] overflow-hidden">
          <div className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[--text-muted]">In arrivo</div>
          <div className="divide-y divide-[--border-base]">
            {upcomingEvents.map((event: Event) => {
              const userStatus = getUserParticipationStatus(event)
              const isCreator = event.createdBy === currentUserId
              const participantCount = (event.participants || []).filter((p: EventParticipant) => p.status !== 'no').length
              const categoryIcon = getCategoryIcon(event.category)
              const lastRead = notifications.lastReadByEvent?.[event.id] || 0
              const hasUnread = (event.chatLastActivityAt?.getTime?.() || 0) > lastRead

              return (
                <div key={event.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[--bg-subtle] transition group">
                  {/* Icona categoria */}
                  <div className="shrink-0 text-xl">{categoryIcon}</div>

                  {/* Contenuto principale — clicca per aprire */}
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => navigate(`/events/${event.id}/summary`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[--text-base] truncate">{event.title}</span>
                      {hasUnread && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-blue-500" title="Nuovi messaggi" />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-[--text-muted] truncate">
                      {formatCompactDate(new Date(event.date))}
                      {event.location ? ` · ${event.location}` : ''}
                      {participantCount > 0 ? ` · ${participantCount} persone` : ''}
                    </div>
                  </button>

                  {/* Status badge RSVP */}
                  <div className="shrink-0 flex items-center gap-2">
                    {userStatus ? (
                      <span className={
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full ' +
                        (userStatus === 'yes' ? 'bg-green-50 text-green-700' :
                         userStatus === 'maybe' ? 'bg-amber-50 text-amber-700' :
                         'bg-[--bg-raised] text-[--text-muted]')
                      }>
                        {userStatus === 'yes' ? 'Sì' : userStatus === 'maybe' ? 'Forse' : 'No'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[--text-muted] font-medium">—</span>
                    )}

                    {/* Azioni: modifica / elimina (sempre visibili su mobile, al hover su desktop) */}
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition">{/* always visible mobile */}
                      {(isCreator || userStatus === 'yes' || userStatus === 'maybe') && (
                        <button
                          type="button"
                          onClick={() => handleEditEvent(event)}
                          className="p-1.5 rounded-lg text-[--text-muted] hover:text-[--text-muted] hover:bg-[--bg-raised] transition"
                          title="Modifica"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {isCreator && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-1.5 rounded-lg text-[--text-muted] hover:text-red-600 hover:bg-red-50 transition"
                          title="Elimina"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Nessun evento */}
      {events.length === 0 && (
        <div className="rounded-2xl border border-[--border-base] bg-[--bg-card] p-8 text-center">
          <div className="text-3xl mb-3">📅</div>
          <div className="text-base font-semibold text-[--text-base] mb-1">Nessun evento</div>
          <div className="text-sm text-[--text-muted]">Crea il primo evento del gruppo.</div>
        </div>
      )}

      {/* Eventi passati — collassati in un accordion */}
      {pastEvents.length > 0 && (
        <details className="rounded-2xl border border-[--border-base] bg-[--bg-card] overflow-hidden group">
          <summary className="px-4 py-3 text-sm font-medium text-[--text-muted] cursor-pointer select-none list-none flex items-center justify-between hover:bg-[--bg-subtle] transition">
            <span>Passati ({pastEvents.length})</span>
            <span className="text-[--text-muted] text-xs group-open:rotate-180 transition-transform inline-block">▾</span>
          </summary>
          <div className="divide-y divide-[--border-base] border-t border-neutral-100">
            {pastEvents.slice(0, 10).map((event: Event) => (
              <button
                key={event.id}
                type="button"
                className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-[--bg-subtle] transition opacity-60"
                onClick={() => navigate(`/events/${event.id}/summary`)}
              >
                <div className="shrink-0 text-base">{getCategoryIcon(event.category)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[--text-base] truncate">{event.title}</div>
                  <div className="text-xs text-[--text-muted]">{formatCompactDate(event.date)}{event.location ? ` · ${event.location}` : ''}</div>
                </div>
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Carica altri */}
      {hasMore && events.length > 0 && (
        <div className="text-center pb-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-5 py-2 rounded-xl border border-[--border-base] bg-[--bg-card] text-sm text-[--text-muted] hover:bg-[--bg-subtle] disabled:opacity-50 transition"
          >
            {loadingMore ? 'Caricamento…' : 'Carica altri'}
          </button>
        </div>
      )}

      {/* Modal Form */}
      {showForm && !editingEvent && (
        <QuickEventForm
          isOpen={showForm}
          onClose={() => {
            setShowForm(false)
            setQuickPrefillDate('')
          }}
          onSubmit={handleQuickCreateEvent}
          isLoading={submitting}
          initialDate={quickPrefillDate}
          farmMembers={activeFarmMembers}
          farmName={activeFarm?.name}
        />
      )}

      {/* Legacy edit form (full) */}
      {showForm && editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center sm:p-4 z-[70]">
          <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full h-[calc(100dvh-4rem)] sm:h-auto sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[--text-base]">Modifica Evento</h2>
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
                      priority: 'medium',
                      visibilityType: 'farm',
                      visibilityUserIds: []
                    })
                  }}
                  className="text-[--text-muted] hover:text-[--text-muted]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Titolo evento</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="Es. Cena da Mario"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Descrizione (opzionale)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                    rows={3}
                    placeholder="Aggiungi dettagli sull'evento..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const newCategory = e.target.value as EventCategory
                      setFormData({
                        ...formData,
                        category: newCategory,
                        endDate: isMultiDayCategory(newCategory) ? formData.endDate : '',
                      })
                    }}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Priorità</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as EventPriority })}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                  >
                    {priorityOptions.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">
                    Data {isMultiDayCategory(formData.category) ? 'inizio' : 'evento'}
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                    required
                  />
                </div>

                {isMultiDayCategory(formData.category) && (
                  <div>
                    <label className="block text-sm font-medium text-[--text-muted] mb-1">Data fine (per viaggi/eventi multi-giorno)</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                      min={formData.date}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Orario (opzionale)</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Luogo</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="Es. Ristorante Da Mario, Via Roma 1"
                    required
                  />
                </div>

                <AdvancedSection storageKey="gvn.advanced.eventVisibility" title="Avanzate">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-[--text-muted] mb-1">Visibilità</label>
                      <select
                        value={formData.visibilityType}
                        onChange={(e) => {
                          const v = e.target.value as 'farm' | 'members' | 'public'
                          setFormData({
                            ...formData,
                            visibilityType: v,
                            visibilityUserIds: v === 'members' ? formData.visibilityUserIds : [],
                          })
                        }}
                        className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-green-500"
                      >
                        <option value="farm">👥 Gruppo attuale (Standard)</option>
                        <option value="members">👥 Solo alcune persone</option>
                        <option value="public">🌍 Tutte le fattorie (Pubblico)</option>
                      </select>
                    </div>

                    {formData.visibilityType === 'members' && activeFarmMembers.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-[--text-muted] mb-1">Seleziona persone</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-[--border-base] rounded-lg p-2">
                          {activeFarmMembers.map(m => {
                            const checked = formData.visibilityUserIds.includes(m.userId)
                            return (
                              <label key={m.userId} className="flex items-center gap-2 text-sm text-[--text-muted] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? Array.from(new Set([...formData.visibilityUserIds, m.userId]))
                                      : formData.visibilityUserIds.filter(id => id !== m.userId)
                                    setFormData({ ...formData, visibilityUserIds: next })
                                  }}
                                />
                                {m.photoURL ? (
                                  <img src={m.photoURL} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <span className="w-5 h-5 rounded-full bg-[--bg-raised] flex items-center justify-center text-xs">
                                    {(m.displayName ?? '?')[0].toUpperCase()}
                                  </span>
                                )}
                                <span>{m.displayName ?? m.userId}</span>
                              </label>
                            )
                          })}
                        </div>
                        {formData.visibilityUserIds.length === 0 && (
                          <p className="mt-1 text-xs text-[--text-muted]">Nessuno selezionato — solo tu vedrai l'evento.</p>
                        )}
                      </div>
                    )}
                  </div>
                </AdvancedSection>

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
                        priority: 'medium',
                        visibilityType: 'farm',
                        visibilityUserIds: []
                      })
                    }}
                    className="flex-1 px-4 py-2 border border-[--border-base] text-[--text-muted] rounded-lg hover:bg-[--bg-subtle] transition-colors"
                    disabled={submitting}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Salvataggio...' : 'Salva'}
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
          onClick={() => {
            setEditingEvent(null)
            setQuickPrefillDate('')
            setShowForm(true)
          }}
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
