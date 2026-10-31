import { useState, useEffect, useMemo } from 'react'
import { roundTo2 } from '../services/firestoreMappers'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Expense } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { getSelectableEvents, getUserKeys } from '../utils/events'

const expenseSchema = z.object({
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  amount: z.coerce.number().min(0.01, 'Inserisci un importo valido'),
  eventId: z.string().min(1, 'Seleziona un evento'),
  participants: z.array(z.object({
    userId: z.string(),
    name: z.string(),
    amount: z.number(),
    settled: z.boolean()
  })).min(1, 'Seleziona almeno un partecipante')
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface ExpenseFormProps {
  expense?: Expense // Per la modifica
  defaultEventId?: string
  onSubmit: (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const ExpenseForm = ({ expense, defaultEventId, onSubmit, onClose, isLoading = false }: ExpenseFormProps) => {
  const { user } = useAuthStore()
  const { events, farmIds } = useAppStore()
  const [availableParticipants, setAvailableParticipants] = useState<{ userId: string, name: string }[]>([])

  const selectableEvents = useMemo(() => {
    return getSelectableEvents(events, { userKeys: getUserKeys(user), farmIds: Array.isArray(farmIds) ? farmIds : [] })
  }, [events, user, farmIds])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      title: expense?.title || '',
      amount: expense?.amount || 0,
      eventId: expense?.eventId || defaultEventId || '',
      participants: expense?.participants || []
    }
  })

  const selectedEventId = watch('eventId')
  const currentAmount = watch('amount')
  const currentParticipants = watch('participants')

  // Quando si seleziona un evento, aggiorna i partecipanti disponibili
  useEffect(() => {
    if (selectedEventId) {
      const event = events.find(e => e.id === selectedEventId)
      if (event) {
        const participants = event.participants.map(p => ({
          userId: p.userId,
          name: p.name
        }))
        setAvailableParticipants(participants)
        
        // Se è una nuova spesa (o se la lista partecipanti è vuota), seleziona automaticamente tutti
        if (!expense && currentParticipants.length === 0) {
          const amount = currentAmount || 0
          const splitAmount = participants.length > 0 ? roundTo2(amount / participants.length) : 0
          setValue('participants', participants.map(p => ({
            userId: p.userId,
            name: p.name,
            amount: splitAmount,
            settled: false
          })))
        }
      }
    } else {
      setAvailableParticipants([])
    }
  }, [selectedEventId, events, expense, setValue])

  // Quando cambia l'importo, ricalcola gli split
  useEffect(() => {
    if (currentParticipants.length > 0) {
      const amount = currentAmount || 0
      const splitAmount = roundTo2(amount / currentParticipants.length)

      // Evita loop infinito se i valori sono già corretti (con tolleranza per float)
      const needsUpdate = currentParticipants.some(p => Math.abs(p.amount - splitAmount) > 0.01)
      
      if (needsUpdate) {
        setValue('participants', currentParticipants.map(p => ({
          ...p,
          amount: splitAmount
        })))
      }
    }
  }, [currentAmount]) // Rimosso currentParticipants dalle dipendenze per evitare loop

  // Funzioni per gestire la selezione dei partecipanti
  const selectAllParticipants = () => {
    const amount = currentAmount || 0
    const splitAmount = availableParticipants.length > 0 ? roundTo2(amount / availableParticipants.length) : 0
    setValue('participants', availableParticipants.map(p => ({
      userId: p.userId,
      name: p.name,
      amount: splitAmount,
      settled: false
    })))
  }

  const deselectAllParticipants = () => {
    setValue('participants', [])
  }

  const toggleParticipant = (participantData: { userId: string, name: string }) => {
    const isSelected = currentParticipants.some(p => p.userId === participantData.userId)
    let newParticipants

    if (isSelected) {
      // Rimuovi partecipante
      newParticipants = currentParticipants.filter(p => p.userId !== participantData.userId)
    } else {
      // Aggiungi partecipante
      newParticipants = [
        ...currentParticipants,
        {
          userId: participantData.userId,
          name: participantData.name,
          amount: 0, // Sarà ricalcolato
          settled: false
        }
      ]
    }

    // Ricalcola split
    const amount = currentAmount || 0
    const splitAmount = newParticipants.length > 0 ? roundTo2(amount / newParticipants.length) : 0
    
    setValue('participants', newParticipants.map(p => ({
      ...p,
      amount: splitAmount
    })))
  }

  const onFormSubmit = async (data: ExpenseFormData) => {
    if (!user) return

    try {
      const expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> = {
        title: data.title.trim(),
        amount: data.amount,
        paidBy: user.id,
        participants: data.participants,
        eventId: data.eventId,
        // Popola participantIds per le regole di sicurezza
        participantIds: [user.id, ...data.participants.map(p => p.userId)]
      }

      await onSubmit(expenseData)
      onClose()
    } catch (error) {
      console.error('Error submitting expense:', error)
    }
  }

  // Prevent background scroll when modal is open
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original || '' }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
        <div className="p-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[--text-base]">
              {expense ? 'Modifica Spesa' : 'Nuova Spesa'}
            </h2>
            <button
              onClick={onClose}
              className="text-[--text-muted] hover:text-[--text-muted]"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-[--text-muted] mb-1">
                Titolo *
              </label>
              <input
                type="text"
                id="title"
                {...register('title')}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.title ? 'border-red-300' : 'border-[--border-base]'
                }`}
                placeholder="Es. Cena al ristorante"
                disabled={isLoading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-[--text-muted] mb-1">
                Importo totale *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  id="amount"
                  {...register('amount')}
                  className={`w-full px-3 py-2 pr-8 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.amount ? 'border-red-300' : 'border-[--border-base]'
                  }`}
                  placeholder="0.00"
                  disabled={isLoading}
                />
                <span className="absolute right-3 top-2 text-[--text-muted]">€</span>
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            {/* Event Selection */}
            <div>
              <label htmlFor="eventId" className="block text-sm font-medium text-[--text-muted] mb-1">
                Evento *
              </label>
              <select
                id="eventId"
                {...register('eventId')}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading || !!defaultEventId}
              >
                <option value="">Seleziona un evento</option>
                {selectableEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.date).toLocaleDateString('it-IT')}
                  </option>
                ))}
              </select>
              {errors.eventId && (
                <p className="mt-1 text-sm text-red-600">{errors.eventId.message}</p>
              )}
            </div>

            {/* Participants Section */}
            {availableParticipants.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-[--text-muted]">
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
                      className="text-xs px-2 py-1 bg-[--bg-raised] text-[--text-muted] rounded hover:bg-[--bg-raised]"
                    >
                      Nessuno
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto border border-[--border-base] rounded-md p-2">
                  {availableParticipants.map(participant => {
                    const isSelected = currentParticipants.some(p => p.userId === participant.userId)
                    const selectedParticipant = currentParticipants.find(p => p.userId === participant.userId)
                    
                    return (
                      <div key={participant.userId} className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleParticipant(participant)}
                            className="mr-2 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-[--text-muted]">{participant.name}</span>
                        </label>
                        {isSelected && selectedParticipant && (
                          <span className="text-xs text-[--text-muted] bg-[--bg-raised] px-2 py-1 rounded">
                            {selectedParticipant.amount.toFixed(2)}€
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {currentParticipants.length > 0 && (
                  <div className="mt-2 text-xs text-[--text-muted]">
                    Totale: {currentParticipants.length} persone × {currentParticipants.length > 0 ? (currentAmount / currentParticipants.length).toFixed(2) : '0.00'}€ ciascuno
                  </div>
                )}
                
                {errors.participants && (
                  <p className="mt-1 text-sm text-red-600">{errors.participants.message}</p>
                )}
              </div>
            )}

            {/* Fallback for no event selected */}
            {availableParticipants.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  💡 <strong>Obbligatorio:</strong> Seleziona un evento per scegliere i partecipanti dalla lista degli invitati.
                </p>
              </div>
            )}

            {/* Fixed action bar with safe-area */}
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[80] w-full max-w-md px-6">
              <div className="bg-[--bg-card] border rounded-xl shadow-md px-4 py-3 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[--text-muted] bg-[--bg-card] border border-[--border-base] rounded-md hover:bg-[--bg-subtle] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  disabled={isLoading || !selectedEventId}
                >
                  {isLoading ? 'Salvando...' : (expense ? 'Aggiorna' : 'Crea')} Spesa
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ExpenseForm

