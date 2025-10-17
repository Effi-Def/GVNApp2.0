import { useState, useEffect } from 'react'
import { Poll } from '../types'
import { useAppStore } from '../stores/AppStore'
import { pollService } from '../services/firestore'
import PollForm from '../components/PollForm'
import PollCard from '../components/PollCard'
import { useAuthStore } from '../stores/useAuthStore'

const PollsPage = () => {
  const { polls, events, setPolls, addPoll, updatePoll } = useAppStore()
  const { user } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && events.length >= 0) {
      loadPolls()
    }
  }, [user?.id, events.length]) // Usa proprietà specifiche per evitare loop

  const loadPolls = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      
      // Ottieni gli eventi a cui l'utente partecipa
      const userEvents = events
        .filter(event => event.participants.some(p => p.userId === user.id))
        .map(event => event.id)
      
      // Carica solo i sondaggi filtrati per privacy
      const pollsData = await pollService.getByUserParticipation(user.id, userEvents)
      setPolls(pollsData)
    } catch (err) {
      console.error('❌ Error loading polls:', err)
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento dei sondaggi')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePoll = async (pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setCreating(true)
      console.log('📊 Creating new poll...')
      
      const newPoll = await pollService.create(pollData)
      addPoll(newPoll)
      
      console.log('✅ Poll created and added to store')
      setShowForm(false)
    } catch (err) {
      console.error('❌ Error creating poll:', err)
      throw err
    } finally {
      setCreating(false)
    }
  }

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) return
    
    try {
      console.log(`📊 Voting on poll ${pollId}, option ${optionId}`)
      
      // Find the current poll
      const poll = polls.find(p => p.id === pollId)
      if (!poll) return
      
      // Check if user already voted
      const existingVote = poll.votes.find(vote => vote.userId === user.id)
      
      let updatedVotes
      if (existingVote) {
        // Update existing vote
        updatedVotes = poll.votes.map(vote => 
          vote.userId === user.id 
            ? { ...vote, optionId, votedAt: new Date() }
            : vote
        )
      } else {
        // Add new vote
        updatedVotes = [
          ...poll.votes,
          {
            userId: user.id,
            optionId,
            votedAt: new Date()
          }
        ]
      }
      
      const updatedPoll = {
        ...poll,
        votes: updatedVotes,
        updatedAt: new Date()
      }
      
      await pollService.update(pollId, updatedPoll)
      updatePoll(pollId, updatedPoll)
      
      console.log('✅ Vote recorded')
    } catch (err) {
      console.error('❌ Error voting:', err)
    }
  }

  const handleClosePoll = async (pollId: string) => {
    try {
      console.log(`📊 Closing poll ${pollId}`)
      
      const poll = polls.find(p => p.id === pollId)
      if (!poll) return
      
      const updatedPoll = {
        ...poll,
        closedAt: new Date(),
        updatedAt: new Date()
      }
      
      await pollService.update(pollId, updatedPoll)
      updatePoll(pollId, updatedPoll)
      
      console.log('✅ Poll closed')
    } catch (err) {
      console.error('❌ Error closing poll:', err)
    }
  }

  // Filtra i sondaggi in base all'evento selezionato
  const filteredPolls = selectedEventId === 'all' 
    ? polls.filter(poll => poll.eventId) // Solo sondaggi collegati a eventi
    : polls.filter(poll => poll.eventId === selectedEventId)

  // Separa sondaggi attivi e chiusi (include anche quelli scaduti)
  const activePolls = filteredPolls.filter(poll => {
    if (poll.closedAt) return false
    if (poll.votingEndsAt && new Date() > poll.votingEndsAt) {
      // Sondaggio scaduto ma non ancora chiuso formalmente
      return false
    }
    return true
  })
  
  const closedPolls = filteredPolls.filter(poll => {
    return poll.closedAt || (poll.votingEndsAt && new Date() > poll.votingEndsAt)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sondaggi</h1>
          <div className="flex items-center gap-3 mt-2">
            <label htmlFor="event-filter" className="text-sm font-medium text-gray-700">
              Filtra per evento:
            </label>
            <select
              id="event-filter"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tutti gli eventi</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center"
        >
          <span className="mr-2">+</span>
          Nuovo Sondaggio
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
                onClick={loadPolls}
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
            <span className="ml-3 text-gray-600">Caricamento sondaggi...</span>
          </div>
        </div>
      )}

      {/* Polls Content */}
      {!loading && !error && (
        <>
          {/* Active Polls */}
          {activePolls.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Sondaggi Attivi</h2>
              <div className="space-y-4">
                {activePolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    onVote={handleVote}
                    onClose={handleClosePoll}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Closed Polls */}
          {closedPolls.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Sondaggi Chiusi</h2>
              <div className="space-y-4">
                {closedPolls.map(poll => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    onVote={handleVote}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {polls.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun sondaggio ancora</h3>
              <p className="text-gray-500 mb-6">
                Crea il tuo primo sondaggio per raccogliere opinioni dal gruppo!
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Crea primo sondaggio
              </button>
            </div>
          )}
        </>
      )}

      {/* Poll Form Modal */}
      {showForm && (
        <PollForm
          onSubmit={handleCreatePoll}
          onClose={() => setShowForm(false)}
          isLoading={creating}
        />
      )}
    </div>
  )
}

export default PollsPage
