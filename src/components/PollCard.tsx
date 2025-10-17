import { Poll, PollOption } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { useState, useEffect } from 'react'

interface PollCardProps {
  poll: Poll
  onVote: (pollId: string, optionId: string) => Promise<void>
  onClose?: (pollId: string) => Promise<void>
}

const PollCard = ({ poll, onVote, onClose }: PollCardProps) => {
  const { user } = useAuthStore()
  const { events } = useAppStore()
  const [timeLeft, setTimeLeft] = useState<string>('')
  
  const userVote = poll.votes.find(vote => vote.userId === user?.id)
  const isCreator = user?.id === poll.createdBy
  const isPollClosed = !!poll.closedAt
  const event = events.find(e => e.id === poll.eventId)
  
  // Calcola se il sondaggio è scaduto
  const isExpired = poll.votingEndsAt && new Date() > poll.votingEndsAt
  
  // Hook per aggiornare il countdown
  useEffect(() => {
    if (!poll.votingEndsAt || isPollClosed) return

    const updateCountdown = () => {
      const now = new Date()
      const timeRemaining = poll.votingEndsAt!.getTime() - now.getTime()
      
      if (timeRemaining <= 0) {
        setTimeLeft('Scaduto')
        return
      }
      
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
      
      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m rimanenti`)
      } else {
        setTimeLeft(`${minutes}m rimanenti`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [poll.votingEndsAt, isPollClosed])
  
  const getTotalVotes = () => {
    return poll.votes.length
  }
  
  const getOptionVotes = (optionId: string) => {
    return poll.votes.filter(vote => vote.optionId === optionId).length
  }
  
  const getOptionPercentage = (optionId: string) => {
    const totalVotes = getTotalVotes()
    if (totalVotes === 0) return 0
    return (getOptionVotes(optionId) / totalVotes) * 100
  }

  const handleVote = async (optionId: string) => {
    if (isPollClosed || isExpired || !user) return
    
    try {
      await onVote(poll.id, optionId)
    } catch (error) {
      console.error('❌ Error voting:', error)
    }
  }

  const handleClosePoll = async () => {
    if (!isCreator || isPollClosed) return
    
    try {
      await onClose?.(poll.id)
    } catch (error) {
      console.error('❌ Error closing poll:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {poll.question}
          </h3>
          
          {/* Event and creation info */}
          {event && (
            <div className="text-sm text-gray-600 mb-2">
              📅 <span className="font-medium">{event.title}</span>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                {getTotalVotes()} vot{getTotalVotes() === 1 ? 'o' : 'i'}
              </span>
              <span>
                Creato {new Date(poll.createdAt).toLocaleDateString('it-IT', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            
            {/* Status and countdown */}
            <div className="flex items-center gap-2">
              {isPollClosed && (
                <span className="text-red-600 font-medium">🔒 Chiuso</span>
              )}
              {isExpired && !isPollClosed && (
                <span className="text-red-600 font-medium">⏰ Scaduto</span>
              )}
              {timeLeft && !isPollClosed && !isExpired && (
                <span className="text-orange-600 font-medium">⏱️ {timeLeft}</span>
              )}
            </div>
          </div>
        </div>
        
        {isCreator && !isPollClosed && (
          <button
            onClick={handleClosePoll}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            Chiudi sondaggio
          </button>
        )}
      </div>

      {/* Change vote hint */}
      {userVote && !isPollClosed && !isExpired && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            💡 <strong>Suggerimento:</strong> Puoi cambiare il tuo voto cliccando su un'altra opzione
          </p>
        </div>
      )}

      {/* Options */}
      <div className="space-y-3">
        {poll.options.map((option: PollOption) => {
          const votes = getOptionVotes(option.id)
          const percentage = getOptionPercentage(option.id)
          const isUserChoice = userVote?.optionId === option.id
          const showResults = isPollClosed || userVote || isExpired
          const canClickToVote = !isPollClosed && !isExpired // Permettere cambio voto
          
          return (
            <div
              key={option.id}
              className={`relative border rounded-lg p-3 transition-colors ${
                canClickToVote
                  ? 'cursor-pointer hover:bg-gray-50 hover:border-primary-300'
                  : 'cursor-default'
              } ${
                isUserChoice
                  ? 'border-primary-500 bg-primary-50'
                  : canClickToVote
                  ? 'border-gray-200 hover:border-primary-200'
                  : 'border-gray-200'
              }`}
              onClick={() => canClickToVote && handleVote(option.id)}
            >
              {/* Progress bar background for results */}
              {showResults && (
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-primary-100 to-transparent rounded-lg transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              )}
              
              {/* Content */}
              <div className="relative flex justify-between items-center">
                <div className="flex items-center">
                  {isUserChoice && (
                    <div className="w-2 h-2 bg-primary-600 rounded-full mr-3" />
                  )}
                  <span className="font-medium text-gray-900">
                    {option.text}
                  </span>
                  {isUserChoice && canClickToVote && (
                    <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                      La tua scelta
                    </span>
                  )}
                </div>
                
                {showResults && (
                  <div className="flex items-center text-sm">
                    <span className="font-semibold text-gray-700 mr-2">
                      {votes}
                    </span>
                    <span className="text-gray-500">
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>
            Creato da {isCreator ? 'te' : 'un amico'}
          </span>
          
          <div className="flex items-center gap-2">
            {userVote && !isPollClosed && !isExpired && (
              <span className="text-primary-600 font-medium">
                ✅ Hai votato · <span className="text-gray-500 font-normal">Clicca per cambiare</span>
              </span>
            )}
            {userVote && (isPollClosed || isExpired) && (
              <span className="text-primary-600 font-medium">
                ✅ Hai votato
              </span>
            )}
            {!userVote && !isPollClosed && !isExpired && (
              <span className="text-orange-600 font-medium">
                ⏳ In attesa del tuo voto
              </span>
            )}
            {!userVote && isExpired && !isPollClosed && (
              <span className="text-red-600 font-medium">
                ⏰ Tempo scaduto
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PollCard
