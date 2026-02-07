import { useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Poll } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'
import { filterSelectableEvents, getUserKeys } from '../utils/events'

const pollSchema = z.object({
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  description: z.string().optional(),
  eventId: z.string().optional(),
  votingDurationHours: z.coerce.number(),
  options: z.array(z.object({
    value: z.string().min(1, 'L\'opzione non può essere vuota')
  })).min(2, 'Sono necessarie almeno 2 opzioni')
})

type PollFormData = z.infer<typeof pollSchema>

interface PollFormProps {
  onSubmit: (pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

const PollForm = ({ onSubmit, onClose, isLoading }: PollFormProps) => {
  const { user } = useAuthStore()
  const { events } = useAppStore()

  const selectableEvents = useMemo(() => {
    return filterSelectableEvents(events, getUserKeys(user))
  }, [events, user])

  const {
    register,
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<PollFormData>({
    resolver: zodResolver(pollSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      eventId: '',
      votingDurationHours: 24,
      options: [{ value: '' }, { value: '' }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "options"
  })

  const onFormSubmit = async (data: PollFormData) => {
    if (!user) {
      console.error('❌ User not authenticated')
      return
    }

    try {
      // Calcola la data di scadenza delle votazioni
      const votingEndsAt = new Date()
      votingEndsAt.setHours(votingEndsAt.getHours() + data.votingDurationHours)
      
      const pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt'> = {
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        options: data.options.map(option => ({
          id: crypto.randomUUID(),
          text: option.value.trim(),
          votes: 0
        })),
        votes: [],
        createdBy: user.id,
        eventId: data.eventId || undefined,
        isActive: true,
        votingDurationHours: data.votingDurationHours,
        votingEndsAt: votingEndsAt
      }

      await onSubmit(pollData)
    } catch (error) {
      console.error('❌ Error in form submission:', error)
    }
  }

  // Prevent background scroll
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original || '' }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
        <div className="p-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Nuovo Sondaggio</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Titolo *
              </label>
              <input
                type="text"
                id="title"
                {...register('title')}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Es. Dove andiamo a cena?"
                disabled={isLoading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione
              </label>
              <textarea
                id="description"
                rows={3}
                {...register('description')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Dettagli opzionali sul sondaggio..."
                disabled={isLoading}
              />
            </div>

            {/* Event Selection */}
            <div>
              <label htmlFor="eventId" className="block text-sm font-medium text-gray-700 mb-1">
                Evento (opzionale)
              </label>
              <select
                id="eventId"
                {...register('eventId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                <option value="">Nessun evento specifico</option>
                {selectableEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.date).toLocaleDateString('it-IT')}
                  </option>
                ))}
              </select>
            </div>

            {/* Voting Duration */}
            <div>
              <label htmlFor="votingDuration" className="block text-sm font-medium text-gray-700 mb-1">
                Durata votazioni
              </label>
              <select
                id="votingDuration"
                {...register('votingDurationHours')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                <option value={1}>1 ora</option>
                <option value={2}>2 ore</option>
                <option value={6}>6 ore</option>
                <option value={12}>12 ore</option>
                <option value={24}>24 ore</option>
                <option value={48}>48 ore</option>
                <option value={72}>72 ore</option>
                <option value={168}>1 settimana</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Dopo questo periodo non sarà più possibile votare
              </p>
            </div>

            {/* Options */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Opzioni *
                </label>
                <button
                  type="button"
                  onClick={() => append({ value: '' })}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  disabled={isLoading || fields.length >= 6}
                >
                  + Aggiungi opzione
                </button>
              </div>
              
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id}>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        {...register(`options.${index}.value` as const)}
                        className={`flex-1 px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          errors.options?.[index]?.value ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder={`Opzione ${index + 1}`}
                        disabled={isLoading}
                      />
                      {fields.length > 2 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-500 hover:text-red-700"
                          disabled={isLoading}
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {errors.options?.[index]?.value && (
                      <p className="mt-1 text-xs text-red-600">{errors.options[index]?.value?.message}</p>
                    )}
                  </div>
                ))}
              </div>
              
              {errors.options && (
                <p className="mt-1 text-sm text-red-600">{errors.options.message}</p>
              )}
              
              <p className="mt-2 text-xs text-gray-500">
                Minimo 2 opzioni, massimo 6.
              </p>
            </div>

            {/* Fixed action bar with safe-area */}
            <div className="fixed left-1/2 -translate-x-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] w-full max-w-md px-6">
              <div className="bg-white border rounded-xl shadow-md px-4 py-3 flex space-x-3">
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
                  disabled={isLoading}
                >
                  {isLoading ? 'Creazione...' : 'Crea Sondaggio'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default PollForm
