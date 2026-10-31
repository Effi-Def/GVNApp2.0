import { useEffect, useMemo, useRef, useState } from 'react'
import { EventCategory, EventLocation, EventPriority, FarmMembership } from '../types'
import { geocodeAddress } from '../services/geocoding'
import AdvancedSection from './AdvancedSection'

export type QuickEventVisibilityType = 'farm' | 'members' | 'public'

export interface QuickEventFormValues {
  title: string
  date: string // YYYY-MM-DD
  description: string
  category: EventCategory
  location: string
  locationGeo?: EventLocation
  visibilityType: QuickEventVisibilityType
  priority: EventPriority
  invitedUserIds: string[]
}

interface QuickEventFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: QuickEventFormValues) => Promise<void>
  isLoading?: boolean
  initialDate?: string
  initialValues?: Partial<QuickEventFormValues>
  farmMembers?: Pick<FarmMembership, 'userId' | 'displayName' | 'photoURL'>[]
  farmName?: string
}

const defaultCategories: { value: EventCategory; label: string }[] = [
  { value: 'cena', label: 'Cena 🍽️' },
  { value: 'aperitivo', label: 'Aperitivo 🍻' },
  { value: 'viaggio', label: 'Viaggio ✈️' },
  { value: 'sport', label: 'Sport ⚽' },
  { value: 'festa', label: 'Festa 🎉' },
  { value: 'cinema', label: 'Cinema 🎬' },
  { value: 'shopping', label: 'Shopping 🛍️' },
  { value: 'altro', label: 'Altro 📅' },
]

const defaultPriorities: { value: EventPriority; label: string }[] = [
  { value: 'high', label: 'Alta 🔥' },
  { value: 'medium', label: 'Media ⚖️' },
  { value: 'low', label: 'Bassa 💤' },
]

export default function QuickEventForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  initialDate,
  initialValues,
  farmMembers,
  farmName,
}: QuickEventFormProps) {
  const initial: QuickEventFormValues = useMemo(
    () => ({
      title: initialValues?.title ?? '',
      date: initialValues?.date ?? initialDate ?? '',
      description: initialValues?.description ?? '',
      category: initialValues?.category ?? 'cena',
      location: initialValues?.location ?? '',
      locationGeo: initialValues?.locationGeo,
      visibilityType: initialValues?.visibilityType ?? 'farm',
      priority: initialValues?.priority ?? 'medium',
      invitedUserIds: initialValues?.invitedUserIds ?? [],
    }),
    [initialDate, initialValues]
  )

  const [values, setValues] = useState<QuickEventFormValues>(initial)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState(false)
  // Track last geocoded address to avoid redundant requests
  const geocodedForRef = useRef<string>('')

  // Reset values when opening (but preserve during toggles)
  useEffect(() => {
    if (!isOpen) return
    setValues(initial)
  }, [isOpen, initial])

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original || ''
    }
  }, [isOpen])

  const canSubmit = values.title.trim().length > 0 && values.date.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    await onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      location: values.location.trim(),
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 !mt-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[--text-base]">Nuovo Evento</h2>
              {farmName && (
                <p className="text-xs text-[--text-muted] mt-0.5">Fattoria: <span className="font-medium text-[--text-muted]">{farmName}</span></p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[--text-muted] hover:text-[--text-muted]"
              disabled={isLoading}
              aria-label="Chiudi"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="quick-event-title" className="block text-sm font-medium text-[--text-muted] mb-1">Titolo</label>
              <input
                id="quick-event-title"
                type="text"
                value={values.title}
                onChange={(e) => setValues(v => ({ ...v, title: e.target.value }))}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Es. Cena da Mario"
                disabled={isLoading}
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="quick-event-date" className="block text-sm font-medium text-[--text-muted] mb-1">Data</label>
              <input
                id="quick-event-date"
                type="date"
                value={values.date}
                onChange={(e) => setValues(v => ({ ...v, date: e.target.value }))}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
                required
              />
            </div>

            <AdvancedSection storageKey="gvn.advanced.eventCreate" title="Avanzate">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Descrizione</label>
                  <textarea
                    value={values.description}
                    onChange={(e) => setValues(v => ({ ...v, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    placeholder="Aggiungi dettagli sull'evento..."
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Categoria</label>
                  <select
                    value={values.category}
                    onChange={(e) => setValues(v => ({ ...v, category: e.target.value as EventCategory }))}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isLoading}
                  >
                    {defaultCategories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Luogo</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={values.location}
                      onChange={(e) => {
                        // Clear geo coords when the address text changes
                        setValues(v => ({ ...v, location: e.target.value, locationGeo: undefined }))
                        geocodedForRef.current = ''
                        setGeocodeError(false)
                      }}
                      className="flex-1 px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Es. Ristorante Da Mario"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      title={values.locationGeo ? 'Posizione trovata ✅' : 'Cerca su mappa'}
                      disabled={isLoading || geocoding || !values.location.trim()}
                      onClick={async () => {
                        const addr = values.location.trim()
                        if (!addr || geocodedForRef.current === addr) return
                        setGeocoding(true)
                        setGeocodeError(false)
                        try {
                          const result = await geocodeAddress(addr)
                          if (result) {
                            geocodedForRef.current = addr
                            setValues(v => ({
                              ...v,
                              locationGeo: { lat: result.lat, lon: result.lon, address: addr },
                            }))
                          } else {
                            setGeocodeError(true)
                          }
                        } catch {
                          setGeocodeError(true)
                        } finally {
                          setGeocoding(false)
                        }
                      }}
                      className="shrink-0 px-2.5 py-2 border border-[--border-base] rounded-md bg-[--bg-card] text-base transition-colors hover:bg-[--bg-subtle] disabled:opacity-40"
                    >
                      {geocoding ? '⏳' : values.locationGeo ? '✅' : geocodeError ? '❌' : '🗺️'}
                    </button>
                  </div>
                  {values.locationGeo && (
                    <p className="mt-1 text-xs text-green-600">📍 Posizione trovata — la mappa sarà visibile nel dettaglio evento</p>
                  )}
                  {geocodeError && (
                    <p className="mt-1 text-xs text-red-500">Indirizzo non trovato. Prova a essere più specifico.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Visibilità</label>
                  <select
                    value={values.visibilityType}
                    onChange={(e) => {
                      const v = e.target.value as QuickEventVisibilityType
                      setValues(prev => ({ ...prev, visibilityType: v, invitedUserIds: v === 'members' ? prev.invitedUserIds : [] }))
                    }}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isLoading}
                  >
                    <option value="farm">🐷 Fattoria attuale (Standard)</option>
                    <option value="members">👥 Solo alcune persone</option>
                    <option value="public">🌍 Tutte le fattorie (Pubblico)</option>
                  </select>
                </div>

                {values.visibilityType === 'members' && farmMembers && farmMembers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-[--text-muted] mb-1">Invita persone</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-[--border-base] rounded-md p-2">
                      {farmMembers.map(m => {
                        const checked = values.invitedUserIds.includes(m.userId)
                        return (
                          <label key={m.userId} className="flex items-center gap-2 text-sm text-[--text-muted] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isLoading}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? Array.from(new Set([...values.invitedUserIds, m.userId]))
                                  : values.invitedUserIds.filter(id => id !== m.userId)
                                setValues(v => ({ ...v, invitedUserIds: next }))
                              }}
                            />
                            {m.photoURL ? (
                              <img src={m.photoURL} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-[--bg-raised] flex items-center justify-center text-xs">
                                {(m.displayName ?? '?')[0].toUpperCase()}
                              </span>
                            )}
                            <span>{m.displayName ?? m.userId}</span>
                          </label>
                        )
                      })}
                    </div>
                    {values.invitedUserIds.length === 0 && (
                      <p className="mt-1 text-xs text-[--text-muted]">Nessuno selezionato — solo tu vedrai l'evento.</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[--text-muted] mb-1">Priorità</label>
                  <select
                    value={values.priority}
                    onChange={(e) => setValues(v => ({ ...v, priority: e.target.value as EventPriority }))}
                    className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isLoading}
                  >
                    {defaultPriorities.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </AdvancedSection>

            {/* Fixed action bar with safe-area */}
            <div className="sticky bottom-0 z-10 pt-3 pb-[env(safe-area-inset-bottom)]">
              <div className="bg-[--bg-card] border border-[--border-base] rounded-xl shadow-md px-4 py-3 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[--text-muted] bg-[--bg-card] border border-[--border-base] rounded-md hover:bg-[--bg-subtle] focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  disabled={isLoading}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  disabled={isLoading || !canSubmit}
                >
                  {isLoading ? 'Creazione…' : 'Crea'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

