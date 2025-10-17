import { Event } from '../types'
import { useAuthStore } from '../stores/useAuthStore'

interface EventCardProps {
  event: Event
  onEdit?: (event: Event) => void
  onDelete?: (eventId: string) => void
  onClick?: (event: Event) => void
  onParticipate?: (eventId: string, status: 'yes' | 'no' | 'maybe') => void
}

const EventCard = ({ event, onEdit, onDelete, onClick, onParticipate }: EventCardProps) => {
  const { user } = useAuthStore()
  
  const getCategoryIcon = (category: string) => {
    const icons = {
      cena: '🍽️',
      aperitivo: '🍻',
      viaggio: '✈️',
      sport: '⚽',
      festa: '🎉',
      cinema: '🎬',
      shopping: '🛍️',
      altro: '📌'
    }
    return icons[category as keyof typeof icons] || '📌'
  }

  const getCategoryName = (category: string) => {
    const names = {
      cena: 'Cena',
      aperitivo: 'Aperitivo',
      viaggio: 'Viaggio',
      sport: 'Sport',
      festa: 'Festa',
      cinema: 'Cinema',
      shopping: 'Shopping',
      altro: 'Altro'
    }
    return names[category as keyof typeof names] || 'Altro'
  }
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  }

  const formatTime = (time: string) => {
    return time
  }

  const isCreator = user?.id === event.createdBy
  const confirmedCount = event.participants.filter(p => p.status === 'yes').length
  const maybeCount = event.participants.filter(p => p.status === 'maybe').length
  
  // Controlla lo stato di partecipazione dell'utente corrente
  const userParticipation = event.participants.find(p => p.userId === user?.id)
  const userStatus = userParticipation?.status

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center mb-2">
            <span className="text-xl mr-2">{getCategoryIcon(event.category)}</span>
            <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium mr-2">
              {getCategoryName(event.category)}
            </span>
            <span>Creato da {isCreator ? 'te' : 'un amico'}</span>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {onClick && (
            <button
              onClick={() => onClick(event)}
              className="text-gray-400 hover:text-primary-600"
              title="Vedi dettagli evento"
            >
              📊
            </button>
          )}
          {isCreator && onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="text-gray-400 hover:text-primary-600"
              title="Modifica evento"
            >
              ✏️
            </button>
          )}
          {isCreator && onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="text-gray-400 hover:text-red-600"
              title="Elimina evento"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-gray-600 mb-4 text-sm">{event.description}</p>
      )}

      {/* Date, Time & Location */}
      <div className="space-y-2 mb-4">
        {event.category === 'viaggio' && event.endDate ? (
          <>
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">✈️</span>
              <span>Dal {formatDate(event.date)} al {formatDate(event.endDate)}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">�</span>
              <span>Partenza alle {formatTime(event.time)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">�📅</span>
              <span>{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="mr-2">🕒</span>
              <span>{formatTime(event.time)}</span>
            </div>
          </>
        )}
        <div className="flex items-center text-sm text-gray-600">
          <span className="mr-2">📍</span>
          <span>{event.location}</span>
        </div>
      </div>

      {/* Participants */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4 text-sm">
          <span className="text-green-600">✅ {confirmedCount} confermati</span>
          {maybeCount > 0 && (
            <span className="text-yellow-600">❓ {maybeCount} forse</span>
          )}
        </div>
        
        {!isCreator && (
          <div className="flex space-x-2">
            {userStatus === 'yes' ? (
              <span className="text-green-600 font-medium text-sm">✅ Partecipi</span>
            ) : userStatus === 'maybe' ? (
              <span className="text-yellow-600 font-medium text-sm">❓ Forse</span>
            ) : userStatus === 'no' ? (
              <span className="text-red-600 font-medium text-sm">❌ Non partecipi</span>
            ) : (
              <span className="text-gray-500 font-medium text-sm">Rispondi:</span>
            )}
            
            <div className="flex space-x-1">
              <button
                onClick={() => onParticipate?.(event.id, 'yes')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  userStatus === 'yes'
                    ? 'bg-green-100 text-green-700'
                    : 'text-green-600 hover:bg-green-50'
                }`}
                title="Parteciperò"
              >
                ✅
              </button>
              <button
                onClick={() => onParticipate?.(event.id, 'maybe')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  userStatus === 'maybe'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'text-yellow-600 hover:bg-yellow-50'
                }`}
                title="Forse"
              >
                ❓
              </button>
              <button
                onClick={() => onParticipate?.(event.id, 'no')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  userStatus === 'no'
                    ? 'bg-red-100 text-red-700'
                    : 'text-red-600 hover:bg-red-50'
                }`}
                title="Non parteciperò"
              >
                ❌
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventCard
