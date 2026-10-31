import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Event, EventCategory } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { EVENT_CATEGORIES, DEFAULT_EVENT_CATEGORY } from '../constants'

const eventSchema = z.object({
  title: z.string().min(1, 'Il titolo è obbligatorio'),
  description: z.string().optional(),
  category: z.enum(Object.keys(EVENT_CATEGORIES) as [string, ...string[]]),
  date: z.string().min(1, 'La data è obbligatoria'),
  time: z.string().min(1, 'L\'orario è obbligatorio'),
  location: z.string().min(1, 'Il luogo è obbligatorio'),
  endDate: z.string().optional(),
}).refine((data) => {
  if (data.category === 'viaggio') {
    return !!data.endDate
  }
  return true
}, {
  message: "La data di fine è obbligatoria per i viaggi",
  path: ["endDate"],
}).refine((data) => {
  if (data.category === 'viaggio' && data.endDate && data.date) {
    return new Date(data.endDate) >= new Date(data.date)
  }
  return true
}, {
  message: "La data di fine deve essere successiva alla data di inizio",
  path: ["endDate"],
})

type EventFormData = z.infer<typeof eventSchema>

interface EventFormProps {
  onSubmit: (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const EventForm = ({ onSubmit, onClose, isLoading = false }: EventFormProps) => {
  const { user } = useAuthStore()
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      category: DEFAULT_EVENT_CATEGORY,
      date: '',
      time: '',
      location: '',
      endDate: ''
    }
  })

  const selectedCategory = watch('category')

  const onFormSubmit = async (data: EventFormData) => {
    if (!user) return

    try {
      const eventDate = new Date(`${data.date}T${data.time}`)
      
      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        title: data.title.trim(),
        description: data.description?.trim() || '',
        category: data.category as EventCategory,
        date: eventDate,
        endDate: data.category === 'viaggio' && data.endDate 
          ? new Date(`${data.endDate}T${data.time}`) 
          : undefined,
        time: data.time,
        location: data.location.trim(),
        createdBy: user.id,
        participants: [{
          userId: user.id,
          name: user.displayName || user.email || 'Utente',
          status: 'yes',
          respondedAt: new Date()
        }],
        publicShareEnabled: true
      }

      await onSubmit(eventData)
      onClose()
    } catch (error) {
      console.error('❌ Error submitting form:', error)
    }
  }

  // Prevent background scroll
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original || '' }
  }, [])

  return (
    <div className="fixed inset-0 !mt-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[--text-base]">Nuovo Evento</h2>
            <button
              onClick={onClose}
              className="text-[--text-muted] hover:text-[--text-muted]"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
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
                placeholder="Nome dell'evento"
                disabled={isLoading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-[--text-muted] mb-1">
                Descrizione
              </label>
              <textarea
                id="description"
                rows={3}
                {...register('description')}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Descrizione dell'evento..."
                disabled={isLoading}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-[--text-muted] mb-1">
                Categoria *
              </label>
              <select
                id="category"
                {...register('category')}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                {Object.entries(EVENT_CATEGORIES).map(([key, { label, emoji }]) => (
                  <option key={key} value={key}>
                    {emoji} {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date and Time */}
            {selectedCategory === 'viaggio' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-[--text-muted] mb-1">
                      Data di Partenza *
                    </label>
                    <input
                      type="date"
                      id="date"
                      {...register('date')}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        errors.date ? 'border-red-300' : 'border-[--border-base]'
                      }`}
                      disabled={isLoading}
                    />
                    {errors.date && (
                      <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-[--text-muted] mb-1">
                      Data di Ritorno *
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      {...register('endDate')}
                      min={watch('date')}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        errors.endDate ? 'border-red-300' : 'border-[--border-base]'
                      }`}
                      disabled={isLoading}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-[--text-muted] mb-1">
                    Orario di Partenza *
                  </label>
                  <input
                    type="time"
                    id="time"
                    {...register('time')}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.time ? 'border-red-300' : 'border-[--border-base]'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.time && (
                    <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-[--text-muted] mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    id="date"
                    {...register('date')}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.date ? 'border-red-300' : 'border-[--border-base]'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-[--text-muted] mb-1">
                    Orario *
                  </label>
                  <input
                    type="time"
                    id="time"
                    {...register('time')}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.time ? 'border-red-300' : 'border-[--border-base]'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.time && (
                    <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-[--text-muted] mb-1">
                Luogo *
              </label>
              <input
                type="text"
                id="location"
                {...register('location')}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.location ? 'border-red-300' : 'border-[--border-base]'
                }`}
                placeholder="Dove si svolge l'evento"
                disabled={isLoading}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
              )}
            </div>

            {/* Fixed action bar with safe-area */}
            <div className="sticky bottom-0 z-10 pt-3 pb-[env(safe-area-inset-bottom)]">
              <div className="bg-[--bg-card] border border-[--border-base] rounded-xl shadow-md px-4 py-3 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-[--text-muted] bg-[--bg-raised] hover:bg-[--bg-raised] rounded-md transition-colors"
                  disabled={isLoading}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {isLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {isLoading ? 'Creazione...' : 'Crea Evento'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EventForm

