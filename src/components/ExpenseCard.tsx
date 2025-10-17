import { Expense } from '../types'
import { useAuthStore } from '../stores/useAuthStore'

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
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">{expense.title}</h3>
          <p className="text-sm text-gray-500">
            Totale: <span className="font-semibold text-gray-900">{expense.amount.toFixed(2)}€</span>
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(expense)}
              className="text-gray-400 hover:text-primary-600 p-1"
              title="Modifica spesa"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(expense.id)}
              className="text-gray-400 hover:text-red-600 p-1"
              title="Elimina spesa"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Payment Info */}
      <div className="mb-3">
        <div className="text-sm text-gray-600 mb-2">
          💳 Pagato da: <span className="font-medium">{isPaidByCurrentUser ? 'Te' : 'Altro utente'}</span>
        </div>
        
        {/* Current User Balance */}
        {userOwes > 0 && (
          <div className="text-sm bg-red-50 text-red-700 px-2 py-1 rounded">
            Devi pagare: <span className="font-semibold">{userOwes.toFixed(2)}€</span>
          </div>
        )}
        
        {userIsOwed > 0 && (
          <div className="text-sm bg-green-50 text-green-700 px-2 py-1 rounded">
            Ti devono: <span className="font-semibold">{userIsOwed.toFixed(2)}€</span>
          </div>
        )}
      </div>

      {/* Participants */}
      <div className="border-t pt-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Partecipanti ({expense.participants.length})
        </h4>
        <div className="space-y-1">
          {expense.participants.map((participant, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className={`${participant.userId === user?.id ? 'font-medium text-primary-700' : 'text-gray-600'}`}>
                {participant.name} {participant.userId === user?.id && '(Tu)'}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-gray-900 font-medium">
                  {participant.amount.toFixed(2)}€
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
          <div className="text-xs text-gray-500">
            📅 Collegato a un evento
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpenseCard
