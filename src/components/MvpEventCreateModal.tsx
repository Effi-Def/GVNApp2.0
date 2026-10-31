import { useEffect, useMemo, useState } from 'react'

export interface MvpEventCreateValues {
  title: string
  location: string
  notes: string
  proposedDates: string[] // YYYY-MM-DD
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: MvpEventCreateValues) => Promise<void>
  isLoading?: boolean
}

function uniqSortedDates(dates: string[]) {
  const out = Array.from(new Set(dates.map(d => d.trim()).filter(Boolean)))
  out.sort((a, b) => a.localeCompare(b))
  return out
}

export default function MvpEventCreateModal({ isOpen, onClose, onSubmit, isLoading = false }: Props) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [proposedDates, setProposedDates] = useState<string[]>([])

  const canSubmit = title.trim().length > 0 && proposedDates.length > 0

  // Reset on open
  useEffect(() => {
    if (!isOpen) return
    setTitle('')
    setLocation('')
    setNotes('')
    setDateInput('')
    setProposedDates([])
  }, [isOpen])

  // Prevent background scroll
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original || ''
    }
  }, [isOpen])

  const normalizedDates = useMemo(() => uniqSortedDates(proposedDates), [proposedDates])

  const addDate = () => {
    const d = dateInput.trim()
    if (!d) return
    setProposedDates(prev => uniqSortedDates([...prev, d]))
    setDateInput('')
  }

  const removeDate = (d: string) => {
    setProposedDates(prev => prev.filter(x => x !== d))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    await onSubmit({
      title: title.trim(),
      location: location.trim(),
      notes: notes.trim(),
      proposedDates: uniqSortedDates(normalizedDates),
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 !mt-0 bg-black/50 flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[--text-base]">Crea evento</h2>
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
              <label className="block text-sm font-medium text-[--text-muted] mb-1">Titolo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Es. Cena di venerdì"
                disabled={isLoading}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--text-muted] mb-1">Date proposte</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-neutral-900 text-white text-sm disabled:opacity-50"
                  onClick={addDate}
                  disabled={isLoading || !dateInput.trim()}
                >
                  Aggiungi
                </button>
              </div>

              {normalizedDates.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {normalizedDates.map(d => (
                    <span key={d} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[--bg-raised] text-[--text-base] text-sm">
                      <span>{d}</span>
                      <button
                        type="button"
                        className="text-[--text-muted] hover:text-[--text-base]"
                        onClick={() => removeDate(d)}
                        disabled={isLoading}
                        aria-label={`Rimuovi ${d}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-[--text-muted]">Aggiungi almeno una data.</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[--text-muted] mb-1">Luogo</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Es. Centro / Da Mario / Casa di Luca"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[--text-muted] mb-1">Note (opzionale)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-[--border-base] rounded-md shadow-sm bg-[--bg-card] text-[--text-base] focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                placeholder="Orario, info utili, cosa portare…"
                disabled={isLoading}
              />
            </div>

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

