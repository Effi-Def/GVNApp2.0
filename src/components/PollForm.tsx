import { useState } from 'react'
import { Poll } from '../types'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/AppStore'

interface PollFormProps {
  onSubmit: (pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

const PollForm = ({ onSubmit, onClose, isLoading }: PollFormProps) => {
  const { user } = useAuthStore()
  const { events } = useAppStore()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventId: '',
    options: ['', ''],
    votingDurationHours: 24 // Default 24 ore
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }))
  }

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }))
  }

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        options: newOptions
      }))
    }
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Il titolo è obbligatorio'
    }

    const validOptions = formData.options.filter(option => option.trim().length > 0)
    if (validOptions.length < 2) {
      newErrors.options = 'Sono necessarie almeno 2 opzioni valide'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!user) {
      console.error('❌ User not authenticated')
      return
    }

    try {
      const validOptions = formData.options.filter(option => option.trim().length > 0)
      
      // Calcola la data di scadenza delle votazioni
      const votingEndsAt = new Date()
      votingEndsAt.setHours(votingEndsAt.getHours() + formData.votingDurationHours)
      
      const pollData: Omit<Poll, 'id' | 'createdAt' | 'updatedAt'> = {
        question: formData.title.trim(),
        options: validOptions.map(option => ({
          id: crypto.randomUUID(),
          text: option.trim()
        })),
        votes: [],
        createdBy: user.id,
        eventId: formData.eventId || undefined,
        votingDurationHours: formData.votingDurationHours,
        votingEndsAt: votingEndsAt
      }

      await onSubmit(pollData)
    } catch (error) {
      console.error('❌ Error in form submission:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Nuovo Sondaggio</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              <span className="sr-only">Chiudi</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Titolo *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                errors.title ? 'border-red-300' : ''
              }`}
              placeholder="Es. Dove andiamo a cena?"
              disabled={isLoading}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descrizione
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Dettagli opzionali sul sondaggio..."
              disabled={isLoading}
            />
          </div>

          {/* Event Selection */}
          <div className="mb-6">
            <label htmlFor="eventId" className="block text-sm font-medium text-gray-700 mb-1">
              Evento (opzionale)
            </label>
            <select
              id="eventId"
              value={formData.eventId}
              onChange={(e) => setFormData(prev => ({ ...prev, eventId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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

          {/* Voting Duration */}
          <div className="mb-6">
            <label htmlFor="votingDuration" className="block text-sm font-medium text-gray-700 mb-1">
              Durata votazioni
            </label>
            <select
              id="votingDuration"
              value={formData.votingDurationHours}
              onChange={(e) => setFormData(prev => ({ ...prev, votingDurationHours: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Opzioni *
              </label>
              <button
                type="button"
                onClick={addOption}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                disabled={isLoading || formData.options.length >= 6}
              >
                + Aggiungi opzione
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`Opzione ${index + 1}`}
                    disabled={isLoading}
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={isLoading}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {errors.options && (
              <p className="mt-1 text-sm text-red-600">{errors.options}</p>
            )}
            
            <p className="mt-2 text-xs text-gray-500">
              Minimo 2 opzioni, massimo 6. Lascia vuote le opzioni non necessarie.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              disabled={isLoading}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creazione...' : 'Crea Sondaggio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PollForm
