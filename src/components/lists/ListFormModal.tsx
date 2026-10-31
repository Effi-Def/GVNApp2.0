import { useEffect, useRef, useState } from 'react'
import type { Event, ListType, ShoppingList } from '../../types'
import { isPastISODate, isSlotList, LIST_TYPES, toLocalISODate, type ListPerson } from '../../utils/lists'
import AdvancedSection from '../AdvancedSection'

export type ListFormValues = {
  title: string
  description: string
  eventId: string
  type: ListType
  items: string[]
  dueDates: string[]
  assignees: string[][]
}

const emptyValues = (eventId = '', type: ListType = 'shopping'): ListFormValues => ({
  title: '',
  description: '',
  eventId,
  type,
  items: [''],
  dueDates: [''],
  assignees: [[]],
})

const fromList = (list: ShoppingList): ListFormValues => ({
  title: list.title,
  description: list.description || '',
  eventId: list.eventId || '',
  type: list.type || 'shopping',
  items: list.items.length ? list.items.map(i => i.text) : [''],
  dueDates: list.items.length ? list.items.map(i => (i.dueDate ? toLocalISODate(new Date(i.dueDate)) : '')) : [''],
  assignees: list.items.length ? list.items.map(i => i.assignees?.map(a => a.userName) || []) : [[]],
})

type Props = {
  editingList: ShoppingList | null
  initialEventId?: string
  events: Event[]
  getPeople: (eventId: string) => ListPerson[]
  submitting: boolean
  onSubmit: (values: ListFormValues) => void
  onClose: () => void
}

export default function ListFormModal({ editingList, initialEventId, events, getPeople, submitting, onSubmit, onClose }: Props) {
  const [values, setValues] = useState<ListFormValues>(() => editingList ? fromList(editingList) : emptyValues(initialEventId))
  const [openAssignees, setOpenAssignees] = useState<number | null>(null)
  const itemInputs = useRef<Record<number, HTMLInputElement | null>>({})
  const inputClass = 'w-full px-3 py-2 border border-[--border-base] rounded-lg bg-[--bg-card] text-[--text-base] focus:outline-none focus:border-green-500'
  const slotType = isSlotList(values.type)
  const people = getPeople(values.eventId)

  // Prevent background scroll on mobile while the form is open
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original || '' }
  }, [])

  const setAt = <T,>(array: T[], index: number, value: T) => array.map((v, i) => i === index ? value : v)

  const addItem = () => setValues(prev => ({
    ...prev,
    items: [...prev.items, ''],
    dueDates: [...prev.dueDates, ''],
    assignees: [...prev.assignees, []],
  }))

  const removeItem = (index: number) => setValues(prev => ({
    ...prev,
    items: prev.items.filter((_, i) => i !== index),
    dueDates: prev.dueDates.filter((_, i) => i !== index),
    assignees: prev.assignees.filter((_, i) => i !== index),
  }))

  const generateSlots = () => {
    const event = events.find(e => e.id === values.eventId)
    if (!event) return
    const confirmed = (event.participants || []).filter(p => p.status === 'yes').length
    const size = values.type === 'transport' ? 5 : 2
    const count = Math.ceil(confirmed / size) || 1
    const items = Array.from({ length: count }, (_, i) => `${values.type === 'transport' ? 'Auto' : 'Stanza'} ${i + 1}`)
    setValues(prev => ({ ...prev, items, assignees: items.map(() => []), dueDates: items.map(() => '') }))
  }

  const takenByOthers = (index: number) => {
    const taken = new Set<string>()
    if (slotType) values.assignees.forEach((names, i) => { if (i !== index) names.forEach(n => taken.add(n)) })
    return taken
  }

  const addManually = (index: number) => {
    const answer = prompt('Aggiungi nominativi (separati da virgola):', values.assignees[index].join(', '))
    if (answer === null) return
    const taken = takenByOthers(index)
    const names = answer.split(',').map(s => s.trim()).filter(n => n && !taken.has(n))
    setValues(prev => ({ ...prev, assignees: setAt(prev.assignees, index, names) }))
  }

  const confirmedCount = (events.find(e => e.id === values.eventId)?.participants || []).filter(p => p.status === 'yes').length
  const slotSize = values.type === 'transport' ? 5 : 2
  const slotCount = Math.ceil(confirmedCount / slotSize) || 1

  return (
    <div className="fixed inset-0 !mt-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-[70]">
      <div className="bg-[--bg-card] rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[--text-base]">{editingList ? 'Modifica lista' : 'Nuova lista'}</h2>
            <button type="button" onClick={onClose} className="text-[--text-muted] hover:text-[--text-base]" aria-label="Chiudi" disabled={submitting}>✕</button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit(values)
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="list-title" className="block text-sm font-medium text-[--text-muted] mb-1">Titolo lista</label>
              <input
                id="list-title"
                type="text"
                value={values.title}
                onChange={(e) => setValues({ ...values, title: e.target.value })}
                className={inputClass}
                placeholder="Es. Lista della spesa"
                required
              />
            </div>

            <div>
              <label htmlFor="list-type" className="block text-sm font-medium text-[--text-muted] mb-1">Tipo lista</label>
              <select
                id="list-type"
                value={values.type}
                onChange={(e) => setValues({ ...values, type: e.target.value as ListType })}
                className={inputClass}
              >
                {LIST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <AdvancedSection storageKey="gvn.advanced.listCreate" title="Avanzate">
              <div className="space-y-4">
                <div>
                  <label htmlFor="list-description" className="block text-sm font-medium text-[--text-muted] mb-1">Descrizione (opzionale)</label>
                  <textarea
                    id="list-description"
                    value={values.description}
                    onChange={(e) => setValues({ ...values, description: e.target.value })}
                    className={inputClass}
                    rows={3}
                    placeholder="Aggiungi dettagli alla lista..."
                  />
                </div>

                <div>
                  <label htmlFor="list-event" className="block text-sm font-medium text-[--text-muted] mb-1">Evento collegato (opzionale)</label>
                  <select
                    id="list-event"
                    value={values.eventId}
                    onChange={(e) => setValues({ ...values, eventId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Tutta la fattoria</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>

                  {slotType && values.eventId && (
                    <div className="mt-3 p-3 rounded-lg border border-[--border-base] bg-[--bg-subtle] flex items-center justify-between gap-3">
                      <span className="text-sm text-[--text-muted]">Confermati: <strong>{confirmedCount}</strong></span>
                      <button
                        type="button"
                        onClick={generateSlots}
                        className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Genera {slotCount} {values.type === 'transport' ? 'auto' : (slotCount === 1 ? 'stanza' : 'stanze')} (da {slotSize})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </AdvancedSection>

            <div>
              <div className="block text-sm font-medium text-[--text-muted] mb-2">Elementi della lista</div>
              {values.items.map((item, index) => (
                <div key={index} className="space-y-1 mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      aria-label={`Elemento ${index + 1}`}
                      onChange={(e) => setValues({ ...values, items: setAt(values.items, index, e.target.value) })}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        if (!e.currentTarget.value.trim()) return
                        if (index === values.items.length - 1) addItem()
                        setTimeout(() => itemInputs.current[index + 1]?.focus(), 0)
                      }}
                      ref={(el) => { itemInputs.current[index] = el }}
                      className={`flex-1 min-w-0 ${inputClass}`}
                      placeholder={`Elemento ${index + 1}`}
                    />
                    {values.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg"
                        aria-label={`Rimuovi elemento ${index + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {(values.type === 'todo' || slotType) && !editingList && (
                    <div className="flex items-center gap-2 pl-1">
                      {values.type === 'todo' && (
                        <>
                          <input
                            type="date"
                            value={values.dueDates[index] || ''}
                            onChange={(e) => setValues({ ...values, dueDates: setAt(values.dueDates, index, e.target.value) })}
                            className="sr-only"
                            tabIndex={-1}
                            id={`todo-date-${index}`}
                          />
                          <label
                            htmlFor={`todo-date-${index}`}
                            className={`text-[10px] px-2 py-1 rounded border hover:bg-[--bg-subtle] cursor-pointer ${
                              isPastISODate(values.dueDates[index]) ? 'bg-red-500/10 border-red-500/30 text-red-600' : 'border-[--border-base] text-[--text-muted]'
                            }`}
                          >
                            📅 {values.dueDates[index] ? values.dueDates[index].split('-').reverse().slice(0, 2).join('/') : 'Data'}
                          </label>
                        </>
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenAssignees(prev => prev === index ? null : index)}
                          className="text-[10px] px-2 py-1 rounded border border-[--border-base] text-[--text-muted] hover:bg-[--bg-subtle]"
                          aria-expanded={openAssignees === index}
                        >
                          👤 {values.assignees[index]?.length || 0}
                        </button>
                        {openAssignees === index && (
                          <div className="absolute z-30 left-0 top-8 w-64 max-h-64 overflow-auto bg-[--bg-card] border border-[--border-base] rounded-lg shadow-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-[--text-muted]">Assegna Maiali</div>
                              <button type="button" onClick={() => setOpenAssignees(null)} className="text-[--text-muted] hover:text-[--text-base]" aria-label="Chiudi">✖</button>
                            </div>
                            <div className="space-y-2">
                              {people.map(person => {
                                const names = values.assignees[index] || []
                                const checked = names.includes(person.name)
                                const disabled = !checked && takenByOthers(index).has(person.name)
                                return (
                                  <label key={person.userId} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={(e) => {
                                        const next = e.target.checked ? [...names, person.name] : names.filter(n => n !== person.name)
                                        setValues(prev => ({ ...prev, assignees: setAt(prev.assignees, index, next) }))
                                      }}
                                    />
                                    <span>{person.name}</span>
                                  </label>
                                )
                              })}
                            </div>
                            <div className="mt-3 border-t border-[--border-base] pt-2">
                              <button type="button" onClick={() => addManually(index)} className="text-xs text-blue-600 hover:underline">
                                Aggiungi manualmente…
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                className="w-full py-2 border-2 border-dashed border-[--border-base] rounded-lg text-[--text-muted] hover:border-green-500 hover:text-green-600 transition-colors"
              >
                + Aggiungi elemento
              </button>
              {values.type === 'todo' && editingList && (
                <p className="text-xs text-[--text-muted] mt-2">
                  Stato, scadenza e assegnatari si cambiano direttamente dalla lista.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 z-10 pt-3 pb-[env(safe-area-inset-bottom)]">
              <div className="bg-[--bg-card] border border-[--border-base] rounded-xl shadow-md px-4 py-3 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-[--border-base] text-[--text-muted] rounded-lg hover:bg-[--bg-subtle] transition-colors"
                  disabled={submitting}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvataggio...' : (editingList ? 'Salva' : 'Crea lista')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
