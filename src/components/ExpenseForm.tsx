import { useState, useEffect } from 'react'
import { Expense } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'

interface ExpenseFormProps {
  expense?: Expense // Per la modifica
  onSubmit: (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const ExpenseForm = ({ expense, onSubmit, onClose, isLoading = false }: ExpenseFormProps) => {
  const { user } = useAuthStore()
  const { events } = useAppStore()
  
  const [formData, setFormData] = useState({
    title: expense?.title || '',
    amount: expense?.amount?.toString() || '',
    eventId: expense?.eventId || '',
    participants: expense?.participants || []
  })
  
  const [availableParticipants, setAvailableParticipants] = useState<{ userId: string, name: string }[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Quando si seleziona un evento, aggiorna i partecipanti disponibili
  useEffect(() => {
    if (formData.eventId) {
      const event = events.find(e => e.id === formData.eventId)
      if (event) {
        const participants = event.participants.map(p => ({
          userId: p.userId,
          name: p.name
        }))
        setAvailableParticipants(participants)
        
        // Se è una nuova spesa, seleziona automaticamente tutti i partecipanti all'evento
        if (!expense) {
          const amount = parseFloat(formData.amount) || 0
          const splitAmount = participants.length > 0 ? amount / participants.length : 0
          setFormData(prev => ({
            ...prev,
            participants: participants.map(p => ({
              userId: p.userId,
              name: p.name,
              amount: splitAmount,
              settled: false
            }))
          }))
        }
      }
    } else {
      setAvailableParticipants([])
    }
  }, [formData.eventId, events, expense])

  // Quando cambia l'importo, ricalcola gli split
  useEffect(() => {
    if (formData.amount && formData.participants.length > 0) {
      const totalAmount = parseFloat(formData.amount) || 0
      const splitAmount = totalAmount / formData.participants.length
      setFormData(prev => ({
        ...prev,
        participants: prev.participants.map(p => ({
          ...p,
          amount: splitAmount
        }))
      }))
    }
  }, [formData.amount])

  // Funzioni per gestire la selezione dei partecipanti
  const selectAllParticipants = () => {
    const amount = parseFloat(formData.amount) || 0
    const splitAmount = availableParticipants.length > 0 ? amount / availableParticipants.length : 0
    setFormData(prev => ({
      ...prev,
      participants: availableParticipants.map(p => ({
        userId: p.userId,
        name: p.name,
        amount: splitAmount,
        settled: false
      }))
    }))
  }

  const deselectAllParticipants = () => {
    setFormData(prev => ({ ...prev, participants: [] }))
  }

  const toggleParticipant = (participantData: { userId: string, name: string }) => {
    const isSelected = formData.participants.some(p => p.userId === participantData.userId)
    
    if (isSelected) {
      // Rimuovi partecipante
      const newParticipants = formData.participants.filter(p => p.userId !== participantData.userId)
      const amount = parseFloat(formData.amount) || 0
      const splitAmount = newParticipants.length > 0 ? amount / newParticipants.length : 0
      
      setFormData(prev => ({
        ...prev,
        participants: newParticipants.map(p => ({ ...p, amount: splitAmount }))
      }))
    } else {
      // Aggiungi partecipante
      const currentParticipants = [...formData.participants]
      const amount = parseFloat(formData.amount) || 0
      const newCount = currentParticipants.length + 1
      const splitAmount = amount / newCount
      
      setFormData(prev => ({
        ...prev,
        participants: [
          ...currentParticipants.map(p => ({ ...p, amount: splitAmount })),
          {
            userId: participantData.userId,
            name: participantData.name,
            amount: splitAmount,
            settled: false
          }
        ]
      }))
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio'
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Inserisci un importo valido'
    }

    if (formData.participants.length === 0) {
      newErrors.participants = 'Seleziona almeno un partecipante'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !user) return

    try {
      const expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title.trim(),
        amount: parseFloat(formData.amount),
        paidBy: user.id,
        participants: formData.participants,
        eventId: formData.eventId || undefined
      }

      await onSubmit(expenseData)
      onClose()
    } catch (error) {
      console.error('Error submitting expense:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {expense ? 'Modifica Spesa' : 'Nuova Spesa'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Titolo *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Es. Cena al ristorante"
                disabled={isLoading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Importo totale *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  className={`w-full px-3 py-2 pr-8 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={isLoading}
                />
                <span className="absolute right-3 top-2 text-gray-500">€</span>
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
              )}
            </div>

            {/* Event Selection */}
            <div>
              <label htmlFor="eventId" className="block text-sm font-medium text-gray-700 mb-1">
                Evento (opzionale)
              </label>
              <select
                id="eventId"
                value={formData.eventId}
                onChange={(e) => handleChange('eventId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                <option value="">Nessun evento specifico</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.date).toLocaleDateString('it-IT')}
                  </option>
                ))}
              </select>
            </div>

            {/* Participants Section */}
            {availableParticipants.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Partecipanti alla spesa *
                  </label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={selectAllParticipants}
                      className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                    >
                      Tutti
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllParticipants}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Nessuno
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {availableParticipants.map(participant => {
                    const isSelected = formData.participants.some(p => p.userId === participant.userId)
                    const selectedParticipant = formData.participants.find(p => p.userId === participant.userId)
                    
                    return (
                      <div key={participant.userId} className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleParticipant(participant)}
                            className="mr-2 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">{participant.name}</span>
                        </label>
                        {isSelected && selectedParticipant && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {selectedParticipant.amount.toFixed(2)}€
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {formData.participants.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Totale: {formData.participants.length} persone × {formData.participants.length > 0 ? (parseFloat(formData.amount || '0') / formData.participants.length).toFixed(2) : '0.00'}€ ciascuno
                  </div>
                )}
                
                {errors.participants && (
                  <p className="mt-1 text-sm text-red-600">{errors.participants}</p>
                )}
              </div>
            )}

            {/* Fallback for no event selected */}
            {availableParticipants.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  💡 <strong>Suggerimento:</strong> Seleziona un evento per scegliere automaticamente i partecipanti dalla lista degli invitati.
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                disabled={isLoading || formData.participants.length === 0}
              >
                {isLoading ? 'Salvando...' : (expense ? 'Aggiorna' : 'Crea')} Spesa
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ExpenseForm
