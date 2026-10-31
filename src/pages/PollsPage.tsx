import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { pollService } from '../services/firestore'
import { refreshActiveFarmData, useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { Poll, PollOption, PollVote, Event } from '../types'
import { getSelectableEvents, getUserEventParticipation, getUserKeys } from '../utils/events'
import AdvancedSection from '../components/AdvancedSection'

// Format ISO date string (YYYY-MM-DD) as Italian readable
function formatDateOption(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    try {
      const [y, m, d] = value.split('-').map(Number)
      return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    } catch { return value }
  }
  return value
}

// Get upcoming weekend dates (Sat + Sun) for n weekends
function getUpcomingWeekends(weekends = 3): { label: string; value: string }[] {
  const results: { label: string; value: string }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(today)
  const daysToSat = ((6 - d.getDay()) + 7) % 7 || 7
  d.setDate(d.getDate() + daysToSat)
  for (let w = 0; w < weekends; w++) {
    for (let offset = 0; offset < 2; offset++) {
      const dd = new Date(d); dd.setDate(d.getDate() + offset)
      const value = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}-${String(dd.getDate()).padStart(2,'0')}`
      const label = dd.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
      results.push({ label, value })
    }
    d.setDate(d.getDate() + 7)
  }
  return results
}

const PollsPage = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const [polls, setPolls] = useState<Poll[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const handledNavStateRef = useRef(false)

  const navEventId = (location.state as { eventId?: string } | null)?.eventId
  const allowCreateFromGlobal = !!((location.state as { openForm?: boolean } | null)?.openForm && navEventId)
  
  // Prevent background scroll on mobile when poll form modal is open
  useEffect(() => {
    const original = document.body.style.overflow
    if (showForm) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = original || ''
    return () => { document.body.style.overflow = original || '' }
  }, [showForm])

  // Form data per nuovo sondaggio
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventId: '',
    votingDurationHours: 24,
    options: ['', ''],
    pollType: 'generic' as 'date' | 'generic',
  })

  const currentUserId = user?.id || ''
  const currentUserName = user?.displayName || user?.email || 'Utente'
  const userKeys = getUserKeys(user)
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)
  const storeEvents = useAppStore(s => s.events)
  const storePolls = useAppStore(s => s.polls)

  // Carica sondaggi e eventi
  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user) {
          setLoading(false)
          return
        }
        setLoading(true)

        // Ensure data is present (farm-scoped)
        if ((storeEvents?.length || 0) === 0 && (storePolls?.length || 0) === 0) {
          await refreshActiveFarmData()
        }

        const evts = storeEvents || []
        const pls = storePolls || []

        // Eventi selezionabili: appartenenti all'utente e non troppo vecchi
        const myEvents = getSelectableEvents(evts, { userKeys, farmIds: activeFarmId ? [activeFarmId] : [] })
        setEvents(myEvents)
        // Filtra i sondaggi ai soli eventi a cui partecipo
        const myIds = new Set(myEvents.map(e => e.id))
        setPolls(pls.filter(p => !p.eventId || myIds.has(p.eventId)))
      } catch (error) {
        console.error('❌ Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, activeFarmId, storeEvents, storePolls])

  // Supporto navigazione dal Summary evento: apri form e pre-seleziona l'evento
  useEffect(() => {
    if (handledNavStateRef.current) return
    const st = location?.state
    const eventId = st?.eventId as string | undefined
    const openForm = !!st?.openForm
    if (!openForm || !eventId) return
    if (!events.some(e => e.id === eventId)) return
    handledNavStateRef.current = true
    setShowForm(true)
    setEditingPoll(null)
    setFormData(prev => ({
      ...prev,
      title: '',
      description: '',
      eventId,
      votingDurationHours: 24,
      options: ['', ''],
    }))
  }, [location?.state, events])

  // Auto-open create form when ?create=1
  useEffect(() => {
    const params = new URLSearchParams(location?.search || '')
    const shouldCreate = params.get('create') === '1'
    if (!shouldCreate) return

    const pollType: 'date' | 'generic' = params.get('type') === 'date' ? 'date' : 'generic'
    setEditingPoll(null)
    setShowForm(true)
    setFormData({
      title: pollType === 'date' ? 'Quando siete liberi?' : '',
      description: '',
      eventId: '',
      votingDurationHours: pollType === 'date' ? 72 : 24,
      options: pollType === 'date' ? ['', '', ''] : ['', ''],
      pollType,
    })
  }, [location?.search])

  // Selezione evento per filtro (UI verrà aggiunta dove serve)
  // Reset automatico se l'evento selezionato non esiste più
  useEffect(() => {
    if (selectedEvent !== 'all') {
      const exists = events.some(e => e.id === selectedEvent)
      if (!exists) setSelectedEvent('all')
    }
  }, [events, selectedEvent])

  // Timer per aggiornare i countdown
  useEffect(() => {
    const timer = setInterval(() => {
      // Forza il re-render per aggiornare i countdown
      setPolls(prevPolls => [...prevPolls])
    }, 60000) // Aggiorna ogni minuto

    return () => clearInterval(timer)
  }, [])

  // Aggiungi funzione per calcolare se il sondaggio è scaduto
  const isPollExpired = (poll: Poll) => {
    if (!poll.votingEndsAt) return false
    return new Date() > poll.votingEndsAt
  }

  // Funzione per calcolare il tempo rimanente
  const getTimeRemaining = (poll: Poll) => {
    if (!poll.votingEndsAt) return null
    
    const now = new Date()
    const timeLeft = poll.votingEndsAt.getTime() - now.getTime()
    
    if (timeLeft <= 0) return { expired: true, timeString: 'Scaduto' }
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60))
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return { expired: false, timeString: `${hours}h ${minutes}m rimanenti` }
    } else {
      return { expired: false, timeString: `${minutes}m rimanenti` }
    }
  }

  // Ottieni nome evento
  const getEventName = (eventId?: string) => {
    if (!eventId) return null
    const event = events.find(e => e.id === eventId)
    return event?.title || 'Evento non trovato'
  }

  // Ottieni nome creatore
  const getCreatorName = (createdBy: string) => {
    // Per ora usiamo solo l'ID, in futuro potresti voler caricare i dati utente
    if (createdBy === currentUserId) return 'Tu'
    return 'Altro utente'
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    })
  }

  // Aggiungi opzione al form
  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }))
  }

  // Rimuovi opzione dal form
  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      setFormData(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }))
    }
  }

  // Aggiorna opzione
  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }))
  }

  // Gestione submit sondaggio
  const handleSubmitPoll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || formData.options.filter(o => o.trim()).length < 2) return

    setSubmitting(true)
    try {
      if (formData.eventId) {
        const selectedEvent = events.find(ev => ev.id === formData.eventId)
        if (!selectedEvent) {
          alert('Evento non valido')
          return
        }
        const p = getUserEventParticipation(selectedEvent, userKeys)
        if (p.accessLevel !== 'full') {
          alert('Non hai i permessi per creare sondaggi in questo evento')
          return
        }
      }

      const pollOptions: PollOption[] = formData.options
        .filter(opt => opt.trim())
        .map((option, index) => ({
          id: `option_${index}`,
          text: option.trim(),
          votes: 0
        }))

      const pollData = {
        title: formData.title,
        description: formData.description,
        options: pollOptions,
        createdBy: currentUserId,
        eventId: formData.eventId || undefined,
        isActive: true,
        votingDurationHours: formData.votingDurationHours,
        votingEndsAt: new Date(Date.now() + formData.votingDurationHours * 60 * 60 * 1000)
      }

      if (editingPoll) {
        await pollService.update(editingPoll.id, pollData)
        await refreshActiveFarmData()
        setEditingPoll(null)
      } else {
        const newPoll = await pollService.create(pollData)
        setPolls(prev => [newPoll, ...prev])
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        eventId: '',
        votingDurationHours: 24,
        options: ['', ''],
        pollType: 'generic',
      })
      setShowForm(false)
      console.log('✅ Poll saved successfully')
    } catch (error) {
      console.error('❌ Error saving poll:', error)
      alert('Errore durante il salvataggio del sondaggio')
    } finally {
      setSubmitting(false)
    }
  }

  // Vota in un sondaggio
  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const poll = polls.find(p => p.id === pollId)
      if (!poll) return

      // Controlla se l'utente ha già votato
      const existingVote = poll.votes.find(vote => vote.userId === currentUserId)
      if (existingVote) {
        alert('Hai già votato in questo sondaggio!')
        return
      }

      // Aggiungi nuovo voto
      const newVote: PollVote = {
        userId: currentUserId,
        userName: currentUserName,
        optionId,
        votedAt: new Date()
      }

      // Aggiorna le opzioni con il nuovo conteggio
      const updatedOptions = poll.options.map(option => 
        option.id === optionId 
          ? { ...option, votes: option.votes + 1 }
          : option
      )

      const updatedPollData = {
        ...poll,
        votes: [...poll.votes, newVote],
        options: updatedOptions,
        updatedAt: new Date()
      }

      await pollService.update(pollId, updatedPollData)
      
      // Aggiorna lo stato locale
      setPolls(prev => prev.map(p => 
        p.id === pollId ? updatedPollData : p
      ))

      console.log('✅ Vote recorded successfully')
    } catch (error) {
      console.error('❌ Error recording vote:', error)
      alert('Errore durante la registrazione del voto')
    }
  }

  // Modifica sondaggio
  const handleEditPoll = (poll: Poll) => {
    setEditingPoll(poll)
    const opts = poll.options.map(opt => opt.text)
    const isDatePoll = opts.every(o => /^\d{4}-\d{2}-\d{2}$/.test(o.trim()))
    setFormData({
      title: poll.title,
      description: poll.description || '',
      eventId: poll.eventId || '',
      votingDurationHours: poll.votingDurationHours || 24,
      options: opts,
      pollType: isDatePoll ? 'date' : 'generic',
    })
    setShowForm(true)
  }

  // Cancella sondaggio
  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo sondaggio?')) return

    try {
      await pollService.delete(pollId)
      setPolls(prev => prev.filter(p => p.id !== pollId))
      console.log('✅ Poll deleted successfully')
    } catch (error) {
      console.error('❌ Error deleting poll:', error)
      alert('Errore durante l\'eliminazione del sondaggio')
    }
  }

  // Calcola percentuali voti
  const getVotePercentage = (poll: Poll, optionId: string) => {
    const totalVotes = poll.votes.length
    if (totalVotes === 0) return 0
    
    const optionVotes = poll.votes.filter(vote => vote.optionId === optionId).length
    return Math.round((optionVotes / totalVotes) * 100)
  }

  // Controlla se l'utente ha votato
  const hasUserVoted = (poll: Poll) => {
    return poll.votes.some(vote => vote.userId === currentUserId)
  }

  // Ottieni l'opzione votata dall'utente
  const getUserVotedOption = (poll: Poll) => {
    const userVote = poll.votes.find(vote => vote.userId === currentUserId)
    return userVote?.optionId
  }

  if (loading) {
    return (
      <div className="pt-16 px-6 pb-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗳️</div>
          <h3 className="text-xl font-semibold text-[--text-muted] mb-2">Caricamento sondaggi...</h3>
          <p className="text-[--text-muted]">Connessione a Firebase in corso</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-16 px-4 pb-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[--text-base] mb-0.5">Sondaggi 🗳️</h1>
            <p className="text-sm text-[--text-muted]">Crea sondaggi e raccogli le opinioni del gruppo</p>
          </div>
          <button
            onClick={() => { setEditingPoll(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-700 active:bg-neutral-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span className="hidden sm:inline">Nuovo</span>
          </button>
        </div>

        {/* Filtri */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[--text-muted]">Evento:</span>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="px-3 py-1 rounded-lg border border-[--border-base] text-sm focus:outline-none focus:border-neutral-500"
            >
              <option value="all">Tutti gli eventi</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista Sondaggi */}
      <div className="space-y-6">
        {polls
          .filter(p => selectedEvent === 'all' || p.eventId === selectedEvent)
          .map(poll => {
          const userHasVoted = hasUserVoted(poll)
          const userVotedOption = getUserVotedOption(poll)
          const totalVotes = poll.votes.length
          const eventName = getEventName(poll.eventId)
          const creatorName = getCreatorName(poll.createdBy)
          const timeRemaining = getTimeRemaining(poll)
          const isExpired = isPollExpired(poll)
          const pollIsActive = poll.isActive && !isExpired

          return (
            <div key={poll.id} className="bg-[--bg-card] rounded-xl shadow-sm border border-[--border-base] p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-semibold text-[--text-base]">{poll.title}</h3>
                    {eventName && (
                      <span className="px-2 py-1 bg-[--bg-raised] text-[--text-muted] text-xs rounded-full">
                        📅 {eventName}
                      </span>
                    )}
                  </div>
                  
                  {poll.description && (
                    <p className="text-[--text-muted] mb-3">{poll.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-[--text-muted] mb-3">
                    <span>📅 Creato il {formatDate(poll.createdAt)}</span>
                    <span>👤 da {creatorName}</span>
                    <span>👥 {totalVotes} voti</span>
                  </div>

                  {/* Countdown e stato */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pollIsActive 
                        ? 'bg-green-500/10 text-green-600' 
                        : 'bg-red-500/10 text-red-600'
                    }`}>
                      {pollIsActive ? 'Attivo' : 'Chiuso'}
                    </span>
                    
                    {timeRemaining && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        timeRemaining.expired 
                          ? 'bg-red-500/10 text-red-600' 
                          : 'bg-orange-500/10 text-orange-600'
                      }`}>
                        ⏰ {timeRemaining.timeString}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Controlli per chi ha creato il sondaggio */}
                {poll.createdBy === currentUserId && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditPoll(poll)}
                      className="p-2 text-[--text-muted] hover:text-[--text-base] hover:bg-[--bg-subtle] rounded-lg transition-colors"
                      title="Modifica sondaggio"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePoll(poll.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Elimina sondaggio"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Opzioni del sondaggio */}
              <div className="space-y-3">
                {poll.options.map(option => {
                  const percentage = getVotePercentage(poll, option.id)
                  const isUserChoice = userVotedOption === option.id
                  const optionVotes = poll.votes.filter(vote => vote.optionId === option.id).length

                  return (
                    <div key={option.id} className="relative">
                      <button
                        onClick={() => !userHasVoted && pollIsActive ? handleVote(poll.id, option.id) : undefined}
                        disabled={userHasVoted || !pollIsActive}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                          userHasVoted || !pollIsActive
                            ? isUserChoice
                              ? 'border-neutral-900 bg-[--bg-raised] cursor-default'
                              : 'border-[--border-base] bg-[--bg-subtle] cursor-default'
                            : 'border-[--border-base] hover:border-neutral-500 hover:bg-[--bg-raised] cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[--text-base]">
                            {formatDateOption(option.text)}
                            {isUserChoice && <span className="ml-2 text-sm text-[--text-muted]">✓</span>}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-[--text-muted]">{optionVotes} voti</span>
                            <span className="text-sm font-semibold text-[--text-base]">{percentage}%</span>
                          </div>
                        </div>
                        
                        {/* Barra di progresso */}
                        {userHasVoted && (
                          <div className="mt-2 w-full bg-[--bg-raised] rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                isUserChoice ? 'bg-neutral-900' : 'bg-[--border-base]'
                              }`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Stato del voto */}
              {userHasVoted ? (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✅ Hai votato in questo sondaggio
                  </p>
                </div>
              ) : pollIsActive ? (
                <div className="mt-4 p-3 bg-[--bg-subtle] border border-[--border-base] rounded-lg">
                  <p className="text-sm text-[--text-muted]">
                    🗳️ Tocca un'opzione per votare
                  </p>
                </div>
              ) : isExpired ? (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⏰ Tempo scaduto - Il sondaggio è chiuso
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-[--bg-subtle] border border-[--border-base] rounded-lg">
                  <p className="text-sm text-[--text-muted]">
                    🔒 Questo sondaggio è stato chiuso
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {polls.filter(p => selectedEvent === 'all' || p.eventId === selectedEvent).length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">🗳️</div>
            <div className="text-base font-semibold text-[--text-base]">Nessun sondaggio ancora</div>
            <p className="text-sm text-[--text-muted]">Scopri quando tutti sono liberi in 2 tap.</p>
            <div className="flex gap-2 justify-center pt-1">
              <button
                onClick={() => { setEditingPoll(null); setFormData({ title: 'Quando siete liberi?', description: '', eventId: '', votingDurationHours: 72, options: ['', '', ''], pollType: 'date' }); setShowForm(true) }}
                className="px-4 py-2 rounded-xl bg-[--text-base] text-[--bg-card] text-sm font-semibold hover:opacity-90 transition"
              >
                🗓️ Quando siete liberi?
              </button>
              <button
                onClick={() => { setEditingPoll(null); setShowForm(true) }}
                className="px-4 py-2 rounded-xl bg-[--bg-raised] text-[--text-base] text-sm font-semibold hover:bg-[--bg-subtle] transition"
              >
                + Sondaggio libero
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-[70]">
          <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
            <div className="p-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[--text-base]">
                  {editingPoll
                    ? 'Modifica Sondaggio'
                    : formData.pollType === 'date' ? '🗓️ Quando siete liberi?' : 'Nuovo Sondaggio'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingPoll(null)
                    setFormData({
                      title: '',
                      description: '',
                      eventId: '',
                      votingDurationHours: 24,
                      options: ['', ''],
                      pollType: 'generic',
                    })
                  }}
                  className="text-[--text-muted] hover:text-[--text-muted]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitPoll} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">
                    Titolo sondaggio
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-neutral-500"
                    placeholder="Es. Dove andare per il prossimo evento?"
                    required
                  />
                </div>

                <AdvancedSection storageKey="gvn.advanced.pollCreate" title="Avanzate">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[--text-muted] mb-1">
                        Descrizione (opzionale)
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-neutral-500"
                        rows={3}
                        placeholder="Aggiungi dettagli al sondaggio..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[--text-muted] mb-1">
                        Evento collegato (opzionale)
                      </label>
                      <select
                        value={formData.eventId}
                        onChange={(e) => setFormData({...formData, eventId: e.target.value})}
                        className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-neutral-500"
                      >
                        <option value="">Nessun evento specifico</option>
                        {events.map(event => (
                          <option key={event.id} value={event.id}>{event.title}</option>
                        ))}
                      </select>
                      <p className="text-xs text-[--text-muted] mt-1">
                        Collega il sondaggio a un evento specifico
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[--text-muted] mb-1">
                        Durata votazioni (ore)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={formData.votingDurationHours}
                        onChange={(e) => setFormData({...formData, votingDurationHours: parseInt(e.target.value) || 24})}
                        className="w-full px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-neutral-500"
                      />
                      <p className="text-xs text-[--text-muted] mt-1">
                        Le votazioni si chiuderanno automaticamente dopo questo periodo
                      </p>
                    </div>
                  </div>
                </AdvancedSection>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-2">
                    {formData.pollType === 'date' ? 'Date proposte' : 'Opzioni di voto'}
                  </label>

                  {/* Weekend shortcuts for date polls */}
                  {formData.pollType === 'date' && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {getUpcomingWeekends(3).map(({ label, value }) => {
                        const already = formData.options.includes(value)
                        return (
                          <button
                            key={value}
                            type="button"
                            disabled={already}
                            onClick={() => {
                              setFormData(prev => {
                                const emptyIdx = prev.options.findIndex(o => !o.trim())
                                if (emptyIdx >= 0) {
                                  const opts = [...prev.options]; opts[emptyIdx] = value
                                  return { ...prev, options: opts }
                                }
                                return { ...prev, options: [...prev.options, value] }
                              })
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                              already
                                ? 'bg-[--bg-raised] text-[--text-muted] border-[--border-base] cursor-default'
                                : 'bg-[--bg-subtle] text-[--text-base] border-[--border-base] hover:border-neutral-600 hover:bg-[--bg-raised]'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type={formData.pollType === 'date' ? 'date' : 'text'}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-[--border-base] rounded-lg focus:outline-none focus:border-neutral-500 bg-[--bg-card] text-[--text-base]"
                        placeholder={formData.pollType === 'date' ? '' : `Opzione ${index + 1}`}
                      />
                      {formData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="p-2 text-[--text-muted] hover:text-red-500 hover:bg-[--bg-subtle] rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="w-full py-2 border-2 border-dashed border-[--border-base] rounded-lg text-[--text-muted] hover:border-neutral-500 hover:text-[--text-base] transition-colors"
                  >
                    + {formData.pollType === 'date' ? 'Aggiungi data' : 'Aggiungi opzione'}
                  </button>
                </div>

                {/* Fixed action bar with safe-area */}
                <div className="fixed left-1/2 -translate-x-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] w-full max-w-md px-6">
                  <div className="bg-[--bg-card] border rounded-xl shadow-md px-4 py-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false)
                        setEditingPoll(null)
                        setFormData({
                          title: '',
                          description: '',
                          eventId: '',
                          votingDurationHours: 24,
                          options: ['', ''],
                          pollType: 'generic',
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
                      className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Salvataggio...' : editingPoll ? 'Salva' : formData.pollType === 'date' ? 'Invia sondaggio →' : 'Crea Sondaggio'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottone Mobile (solo da Summary evento) */}
      {allowCreateFromGlobal && (
        <div className="fixed bottom-28 right-6 md:bottom-8 z-40">
          <button 
            onClick={() => setShowForm(true)}
            className="bg-neutral-900 hover:bg-neutral-700 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110"
            title="Crea nuovo sondaggio"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default PollsPage

