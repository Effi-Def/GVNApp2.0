import { useState, useEffect } from 'react'
import { pollService, eventService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { Poll, PollOption, PollVote, Event } from '../types'

const PollsPage = () => {
  const { user } = useAuthStore()
  const [polls, setPolls] = useState<Poll[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form data per nuovo sondaggio
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventId: '',
    votingDurationHours: 24,
    options: ['', '']
  })

  const currentUserId = user?.id || 'anonymous'
  const currentUserName = user?.displayName || user?.email || 'Utente'

  // Carica sondaggi e eventi
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        console.log('🗳️ Loading polls and events...')
        
        const [pollsData, eventsData] = await Promise.all([
          pollService.getAll(),
          eventService.getAll()
        ])
        
        setPolls(pollsData)
        setEvents(eventsData)
        console.log(`✅ Loaded ${pollsData.length} polls and ${eventsData.length} events`)
      } catch (error) {
        console.error('❌ Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

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
    if (!formData.title || formData.options.some(opt => !opt.trim())) return

    setSubmitting(true)
    try {
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
        const updatedPolls = await pollService.getAll()
        setPolls(updatedPolls)
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
        options: ['', '']
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
    setFormData({
      title: poll.title,
      description: poll.description || '',
      eventId: poll.eventId || '',
      votingDurationHours: poll.votingDurationHours || 24,
      options: poll.options.map(opt => opt.text)
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
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗳️</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Caricamento sondaggi...</h3>
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Sondaggi 🗳️</h1>
            <p className="text-gray-600">Crea sondaggi e raccogli le opinioni del gruppo</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nuovo Sondaggio</span>
          </button>
        </div>

        {/* Filtri */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Evento:</span>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="px-3 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
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
            <div key={poll.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-xl font-semibold text-gray-800">{poll.title}</h3>
                    {eventName && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        📅 {eventName}
                      </span>
                    )}
                  </div>
                  
                  {poll.description && (
                    <p className="text-gray-600 mb-3">{poll.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
                    <span>📅 Creato il {formatDate(poll.createdAt)}</span>
                    <span>👤 da {creatorName}</span>
                    <span>👥 {totalVotes} voti</span>
                  </div>

                  {/* Countdown e stato */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      pollIsActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {pollIsActive ? 'Attivo' : 'Chiuso'}
                    </span>
                    
                    {timeRemaining && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        timeRemaining.expired 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-orange-100 text-orange-700'
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
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                              ? 'border-blue-500 bg-blue-50 cursor-default'
                              : 'border-gray-200 bg-gray-50 cursor-default'
                            : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${
                            isUserChoice ? 'text-blue-700' : 'text-gray-800'
                          }`}>
                            {option.text}
                            {isUserChoice && <span className="ml-2 text-sm">✓ La tua scelta</span>}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">{optionVotes} voti</span>
                            <span className="text-sm font-semibold text-gray-800">{percentage}%</span>
                          </div>
                        </div>
                        
                        {/* Barra di progresso */}
                        {userHasVoted && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-500 ${
                                isUserChoice ? 'bg-blue-500' : 'bg-gray-400'
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
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    🗳️ Clicca su un'opzione per votare
                  </p>
                </div>
              ) : isExpired ? (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">
                    ⏰ Tempo scaduto - Il sondaggio è chiuso
                  </p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    🔒 Questo sondaggio è stato chiuso
                  </p>
                </div>
              )}
            </div>
          )
        })}

        {polls.filter(p => selectedEvent === 'all' || p.eventId === selectedEvent).length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🗳️</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Nessun sondaggio</h3>
            <p className="text-gray-500">Crea il primo sondaggio per raccogliere le opinioni del gruppo</p>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingPoll ? 'Modifica Sondaggio' : 'Nuovo Sondaggio'}
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
                      options: ['', '']
                    })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitPoll} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo sondaggio
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Es. Dove andare per il prossimo evento?"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="Aggiungi dettagli al sondaggio..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evento collegato (opzionale)
                  </label>
                  <select
                    value={formData.eventId}
                    onChange={(e) => setFormData({...formData, eventId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Nessun evento specifico</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Collega il sondaggio a un evento specifico
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durata votazioni (ore)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={formData.votingDurationHours}
                    onChange={(e) => setFormData({...formData, votingDurationHours: parseInt(e.target.value) || 24})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Le votazioni si chiuderanno automaticamente dopo questo periodo
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Opzioni di voto
                  </label>
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder={`Opzione ${index + 1}`}
                        required
                      />
                      {formData.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOption}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    + Aggiungi opzione
                  </button>
                </div>

                <div className="flex space-x-3 pt-4">
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
                        options: ['', '']
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
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Salvataggio...' : (editingPoll ? 'Salva' : 'Crea Sondaggio')}
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
          className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 ring-4 ring-blue-100"
          title="Crea nuovo sondaggio"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default PollsPage