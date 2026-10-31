import { Expense } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { formatEuro } from '../utils/expenseUtils'

interface ExpenseCardProps {
  expense: Expense
  onEdit?: (expense: Expense) => void
  onDelete?: (expenseId: string) => void
}

const ExpenseCard = ({ expense, onEdit, onDelete }: ExpenseCardProps) => {
  const { user } = useAuthStore()

  const totalOwedToUser = expense.participants
    .filter(p => p.userId !== expense.paidBy)
    .reduce((sum, p) => sum + p.amount, 0)

  const userParticipation = expense.participants.find(p => p.userId === user?.id)
  const userOwes = userParticipation && expense.paidBy !== user?.id ? userParticipation.amount : 0
  const userIsOwed = expense.paidBy === user?.id ? totalOwedToUser : 0

  const isPaidByCurrentUser = expense.paidBy === user?.id

  return (
    <div className="bg-[--bg-card] border border-[--border-base] rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-[--text-base]">{expense.title}</h3>
          <p className="text-sm text-[--text-muted]">
            Totale: <span className="font-semibold text-[--text-base]">{formatEuro(expense.amount)}</span>
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(expense)}
              className="text-[--text-muted] hover:text-primary-600 p-1"
              title="Modifica spesa"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(expense.id)}
              className="text-[--text-muted] hover:text-red-600 p-1"
              title="Elimina spesa"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Payment Info */}
      <div className="mb-3">
        <div className="text-sm text-[--text-muted] mb-2">
          💳 Pagato da: <span className="font-medium">{isPaidByCurrentUser ? 'Te' : 'Altro utente'}</span>
        </div>
        
        {/* Current User Balance */}
        {userOwes > 0 && (
          <div className="text-sm bg-red-50 text-red-700 px-2 py-1 rounded">
            Devi pagare: <span className="font-semibold">{formatEuro(userOwes)}</span>
          </div>
        )}
        
        {userIsOwed > 0 && (
          <div className="text-sm bg-green-50 text-green-700 px-2 py-1 rounded">
            Ti devono: <span className="font-semibold">{formatEuro(userIsOwed)}</span>
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="border-t pt-3">
        <h4 className="text-sm font-medium text-[--text-muted] mb-2">
          Partecipanti ({expense.participants.length})
        </h4>
        <div className="space-y-1">
          {expense.participants.map((participant, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className={`${participant.userId === user?.id ? 'font-medium text-primary-700' : 'text-[--text-muted]'}`}>
                {participant.name} {participant.userId === user?.id && '(Tu)'}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-[--text-base] font-medium">
                  {formatEuro(participant.amount)}
                </span>
                <div className={`w-2 h-2 rounded-full ${
                  participant.settled ? 'bg-green-500' : 'bg-yellow-500'
                }`} title={participant.settled ? 'Saldato' : 'Da saldare'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event Reference */}
      {expense.eventId && (
        <div className="mt-3 pt-2 border-t">
          <div className="text-xs text-[--text-muted]">
            📅 Collegato a un evento
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpenseCard

