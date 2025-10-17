import { useState } from 'react'
import { Event, EventCategory } from '../types'
import { useAuthStore } from '../stores/useAuthStore'

interface EventFormProps {
  onSubmit: (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
  isLoading?: boolean
}

const EventForm = ({ onSubmit, onClose, isLoading = false }: EventFormProps) => {
  const { user } = useAuthStore()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'cena' as EventCategory,
    date: '',
    endDate: '',
    time: '',
    location: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio'
    }

    if (!formData.date) {
      newErrors.date = 'La data è obbligatoria'
    }

    if (!formData.time) {
      newErrors.time = 'L\'orario è obbligatorio'
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Il luogo è obbligatorio'
    }

    // Validazione specifica per viaggi
    if (formData.category === 'viaggio') {
      if (!formData.endDate) {
        newErrors.endDate = 'La data di fine è obbligatoria per i viaggi'
      } else if (formData.date && formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
        newErrors.endDate = 'La data di fine deve essere successiva alla data di inizio'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !user) return

    try {
      const eventDate = new Date(`${formData.date}T${formData.time}`)
      
      const eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        date: eventDate,
        endDate: formData.category === 'viaggio' && formData.endDate 
          ? new Date(`${formData.endDate}T${formData.time}`) 
          : undefined,
        time: formData.time,
        location: formData.location.trim(),
        createdBy: user.id,
        participants: [{
          userId: user.id,
          name: user.displayName || user.email || 'Utente',
          status: 'yes',
          respondedAt: new Date()
        }]
      }

      await onSubmit(eventData)
      onClose()
    } catch (error) {
      console.error('❌ Error submitting form:', error)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Nuovo Evento</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="Nome dell'evento"
                disabled={isLoading}
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
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
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Descrizione dell'evento..."
                disabled={isLoading}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              >
                <option value="cena">🍽️ Cena</option>
                <option value="aperitivo">🍻 Aperitivo</option>
                <option value="viaggio">✈️ Viaggio</option>
                <option value="sport">⚽ Sport</option>
                <option value="festa">🎉 Festa</option>
                <option value="cinema">🎬 Cinema</option>
                <option value="shopping">🛍️ Shopping</option>
                <option value="altro">📌 Altro</option>
              </select>
            </div>

            {/* Date and Time */}
            {formData.category === 'viaggio' ? (
              // Layout per viaggi con data di inizio e fine
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                      Data di Partenza *
                    </label>
                    <input
                      type="date"
                      id="date"
                      value={formData.date}
                      onChange={(e) => handleChange('date', e.target.value)}

                      className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        errors.date ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    />
                    {errors.date && (
                      <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Data di Ritorno *
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      value={formData.endDate}
                      onChange={(e) => handleChange('endDate', e.target.value)}
                      min={formData.date || undefined}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        errors.endDate ? 'border-red-300' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                    Orario di Partenza *
                  </label>
                  <input
                    type="time"
                    id="time"
                    value={formData.time}
                    onChange={(e) => handleChange('time', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.time ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.time && (
                    <p className="mt-1 text-sm text-red-600">{errors.time}</p>
                  )}
                </div>
              </>
            ) : (
              // Layout normale per altri eventi
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    Data *
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}

                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.date ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                    Orario *
                  </label>
                  <input
                    type="time"
                    id="time"
                    value={formData.time}
                    onChange={(e) => handleChange('time', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.time ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                  />
                  {errors.time && (
                    <p className="mt-1 text-sm text-red-600">{errors.time}</p>
                  )}
                </div>
              </div>
            )}

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Luogo *
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.location ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Dove si svolge l'evento"
                disabled={isLoading}
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">{errors.location}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={isLoading}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isLoading ? 'Creazione...' : 'Crea Evento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EventForm
