import { useState, useEffect, useRef } from 'react'
import { listService, eventService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { ShoppingList, Event, ListType, ListItem } from '../types'

const ListsPage = () => {
  const { user } = useAuthStore()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingList, setEditingList] = useState<ShoppingList | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<'all' | ListType>('all')
  const [openAssignees, setOpenAssignees] = useState<{ listId: string; itemId: string } | null>(null)
  const [openFormAssignees, setOpenFormAssignees] = useState<number | null>(null)
  const dateInputsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const itemInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const currentUserId = user?.id || 'anonymous'

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    items: [''],
    // Extra fields for To-do creation UX
    todoDueDates: [''], // ISO yyyy-mm-dd per index
    todoAssignees: [[]] as string[][], // array of names per index
    eventId: '',
    type: 'shopping' as ListType,
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [ls, evs] = await Promise.all([
          listService.getAll(),
          eventService.getAll(),
        ])
        // Mostra liste per eventi a cui partecipo o non collegate
        const myEvents = evs.filter(e => e.participants.some(p => p.userId === currentUserId && p.status === 'yes'))
        setEvents(myEvents)
        const myIds = new Set(myEvents.map(e => e.id))
        setLists(ls.filter(l => !l.eventId || myIds.has(l.eventId)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUserId])

  // Prevent background scroll on mobile when modal is open
  useEffect(() => {
    const original = document.body.style.overflow
    if (showForm) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = original || ''
    }
    return () => { document.body.style.overflow = original || '' }
  }, [showForm])

  // Utils
  const formatDate = (d?: Date) => {
    if (!d) return ''
    const dt = new Date(d)
    return dt.toLocaleDateString()
  }

  const formatShortDate = (d?: Date) => {
    if (!d) return ''
    const dt = new Date(d)
    const day = String(dt.getDate()).padStart(2, '0')
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}`
  }

  const isPastDate = (d?: Date) => {
    if (!d) return false
    const end = new Date(d)
    end.setHours(23,59,59,999)
    return end.getTime() < Date.now()
  }
  const isPastISO = (iso?: string) => {
    if (!iso) return false
    const d = new Date(iso + 'T23:59:59')
    return d.getTime() < Date.now()
  }

  const getListStats = (list: ShoppingList) => {
    const total = list.items.length
    const completed = list.items.filter(i => i.completed).length
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)
    return { total, completed, percentage }
  }

  // Item helpers
  const cycleStatus = (s?: ListItem['status']): ListItem['status'] => {
    if (s === 'todo') return 'in-progress'
    if (s === 'in-progress') return 'done'
    return 'todo'
  }

  const updateListItem = async (listId: string, itemId: string, patch: Partial<ListItem>) => {
    const list = lists.find(l => l.id === listId)
    if (!list) return
    const updatedItems = list.items.map(it => it.id === itemId ? { ...it, ...patch } : it)
    const updatedList = { ...list, items: updatedItems, updatedAt: new Date() }
    await listService.update(list.id, updatedList)
    setLists(prev => prev.map(l => l.id === list.id ? updatedList : l))
  }

  const toggleItemCompletion = async (listId: string, itemId: string) => {
    const list = lists.find(l => l.id === listId)
    if (!list) return
    const updatedItems = list.items.map(it => {
      if (it.id !== itemId) return it
      const nowCompleted = !it.completed
      return {
        ...it,
        completed: nowCompleted,
        completedBy: nowCompleted ? currentUserId : undefined,
        completedAt: nowCompleted ? new Date() : undefined,
        status: (list.type || 'shopping') === 'todo' ? (nowCompleted ? 'done' : 'todo') : it.status,
      }
    })
    const updatedList = { ...list, items: updatedItems, updatedAt: new Date() }
    await listService.update(list.id, updatedList)
    setLists(prev => prev.map(l => l.id === list.id ? updatedList : l))
  }

  const addItemToList = async (listId: string, text: string) => {
    const list = lists.find(l => l.id === listId)
    if (!list || !text || text.trim().length === 0) return
    const newItem: ListItem = {
      id: Math.random().toString(36).slice(2),
      text: text.trim(),
      completed: false,
      addedBy: currentUserId,
      addedAt: new Date(),
      status: (list.type || 'shopping') === 'todo' ? 'todo' : undefined,
      capacity: list.type === 'transport' ? 5 : (list.type === 'lodging' ? 2 : undefined),
    }
    const updatedList = { ...list, items: [...list.items, newItem], updatedAt: new Date() }
    await listService.update(list.id, updatedList)
    setLists(prev => prev.map(l => l.id === list.id ? updatedList : l))
  }

  // List handlers
  const handleEditList = (list: ShoppingList) => {
    setEditingList(list)
    setFormData({
      title: list.title,
      description: list.description || '',
      items: list.items.length ? list.items.map(i => i.text) : [''],
      todoDueDates: list.items.length ? list.items.map(i => (i.dueDate ? new Date(i.dueDate).toISOString().slice(0,10) : '')) : [''],
      todoAssignees: list.items.length ? list.items.map(i => (i.assignees?.map(a => a.userName) || [])) : [[]],
      eventId: list.eventId || '',
      type: list.type || 'shopping',
    })
    setShowForm(true)
  }

  const handleDeleteList = async (id: string) => {
    if (!confirm('Eliminare la lista?')) return
    await listService.delete(id)
    setLists(prev => prev.filter(l => l.id !== id))
  }

  const updateFormItem = (index: number, value: string) => {
    setFormData(prev => ({ ...prev, items: prev.items.map((it, i) => i === index ? value : it) }))
  }
  const removeFormItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
      todoDueDates: prev.todoDueDates.filter((_, i) => i !== index),
      todoAssignees: prev.todoAssignees.filter((_, i) => i !== index),
    }))
  }
  const addFormItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, ''],
      todoDueDates: [...prev.todoDueDates, ''],
      todoAssignees: [...prev.todoAssignees, []],
    }))
  }

  const handleSubmitList = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = formData.title.trim()
    if (!title) {
      alert('Inserisci un titolo per la lista')
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      if (editingList) {
        // Per liste To-do, non sovrascrivere items esistenti
        const preserveItems = (editingList.type || 'shopping') === 'todo'
        const newItems = preserveItems
          ? editingList.items
      : formData.items.filter(t => t.trim().length > 0).map(t => ({
              id: Math.random().toString(36).slice(2),
              text: t.trim(),
              completed: false,
              addedBy: currentUserId,
              addedAt: new Date(),
        status: formData.type === 'todo' ? 'todo' as const : undefined,
            }))
        const updated: ShoppingList = {
          ...editingList,
          title,
          description: formData.description.trim() || undefined,
          eventId: formData.eventId || undefined,
          type: formData.type,
          items: newItems,
          updatedAt: new Date(),
        }
        await listService.update(editingList.id, updated)
        setLists(prev => prev.map(l => l.id === editingList.id ? updated : l))
      } else {
        const items: ListItem[] = formData.items
          .map((t, idx) => ({ t: t.trim(), idx }))
          .filter(({ t }) => t.length > 0)
          .map(({ t, idx }) => {
            const base: ListItem = {
              id: Math.random().toString(36).slice(2),
              text: t,
              completed: false,
              addedBy: currentUserId,
              addedAt: new Date(),
            }
            if (formData.type === 'todo') {
              const dueStr = formData.todoDueDates[idx]
              const names = formData.todoAssignees[idx] || []
              return {
                ...base,
                status: 'todo' as const,
                dueDate: dueStr ? new Date(dueStr + 'T00:00:00') : undefined,
                assignees: names.map(n => ({ userName: n })),
              }
            } else if (formData.type === 'transport' || formData.type === 'lodging') {
              const names = formData.todoAssignees[idx] || []
              return {
                ...base,
                assignees: names.map(n => ({ userName: n })),
                capacity: formData.type === 'transport' ? 5 : 2,
              }
            }
            return base
          })
        const newList: Omit<ShoppingList, 'id' | 'createdAt' | 'updatedAt'> = {
          title,
          description: formData.description.trim() || undefined,
          items,
          eventId: formData.eventId || undefined,
          createdBy: currentUserId,
          shared: true,
          type: formData.type,
        }
        const created = await listService.create(newList)
        setLists(prev => [created, ...prev])
      }
      setShowForm(false)
      setEditingList(null)
      setFormData({ title: '', description: '', items: [''], todoDueDates: [''], todoAssignees: [[]], eventId: '', type: 'shopping' })
      // Optional feedback for mobile
      setTimeout(() => {
        // Visual confirmation
        // Using alert here keeps it simple without bringing a toast lib
        // Comment out if you prefer silent success
        // alert('Lista salvata con successo')
      }, 0)
    } catch (err: any) {
      console.error('Errore salvataggio lista:', err)
      const code = err?.code || 'unknown'
      const msg = err?.message || String(err)
      alert(`Impossibile salvare la lista.\nCodice: ${code}\nDettagli: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Caricamento liste...</h3>
          <p className="text-gray-500">Connessione a Firebase in corso</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Liste 📋</h1>
            <p className="text-gray-600">Gestisci liste condivise per spesa e organizzazione</p>
          </div>
        </div>
        {/* Filtri */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Evento:</span>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="px-3 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="all">Tutti gli eventi</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Tipo:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'all' | ListType)}
              className="px-3 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="all">Tutti</option>
              <option value="shopping">Shopping</option>
              <option value="todo">To-do</option>
              <option value="transport">Macchine</option>
              <option value="lodging">Stanze</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista delle Liste */}
      <div className="space-y-6">
        {lists
          .filter(l => selectedEvent === 'all' || l.eventId === selectedEvent)
          .filter(l => selectedType === 'all' || (l.type || 'shopping') === selectedType)
          .map(list => {
            const stats = getListStats(list)
            return (
              <div key={list.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{list.title}</h3>
                    {list.description && (
                      <p className="text-gray-600 mb-3">{list.description}</p>
                    )}
                    <div className="flex items-center flex-wrap gap-2 text-xs text-gray-500 mb-4">
                      <span>📅 {formatDate(list.createdAt)}</span>
                      <span>📊 {stats.completed}/{stats.total} ({stats.percentage}%)</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded-full">🏷️ {list.type === 'transport' ? 'macchine' : list.type === 'lodging' ? 'stanze' : (list.type || 'shopping')}</span>
                      {list.eventId && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">
                          📅 {events.find(e => e.id === list.eventId)?.title || 'Evento'}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        list.shared ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {list.shared ? 'Condivisa' : 'Privata'}
                      </span>
                    </div>
                    {/* Barra di progresso */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  {list.createdBy === currentUserId && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditList(list)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifica lista"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteList(list.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina lista"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Elementi della lista */}
                <div className="space-y-2">
                  {list.items.map(item => (
                    <div key={item.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <button
                        onClick={() => toggleItemCompletion(list.id, item.id)}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                          item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {item.completed && (
                          <svg className="w-4 h-4 text-white mx-auto mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 ${item.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                        {item.text}
                        {(list.type === 'transport' || list.type === 'lodging') && (
                          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 align-middle">
                            {(item.assignees?.length || 0)}/{item.capacity || (list.type === 'transport' ? 5 : 2)}
                          </span>
                        )}
                        {list.type === 'transport' && item.driver && (
                          <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 align-middle">🚗 {item.driver.userName}</span>
                        )}
                      </span>
                      {list.type === 'todo' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateListItem(list.id, item.id, { status: cycleStatus(item.status) })}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              item.status === 'done' ? 'bg-green-100 text-green-700 border-green-200' :
                              item.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                              'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                            title="Cambia stato"
                          >
                            {item.status || 'todo'}
                          </button>
                          {/* Compact date chip + hidden native picker to avoid oversized mobile date input */}
                          <input
                            type="date"
                            ref={(el) => { dateInputsRef.current[item.id] = el }}
                            value={item.dueDate ? new Date(item.dueDate).toISOString().slice(0,10) : ''}
                            onChange={(e) => {
                              const val = e.target.value
                              const date = val ? new Date(val + 'T00:00:00') : undefined
                              updateListItem(list.id, item.id, { dueDate: date })
                            }}
                            className="sr-only"
                            aria-hidden="true"
                            tabIndex={-1}
                          />
                          <button
                            onClick={() => {
                              const input = dateInputsRef.current[item.id]
                              // showPicker is supported in modern browsers; fallback to click
                              // @ts-ignore
                              if (input && typeof input.showPicker === 'function') input.showPicker()
                              else input?.click()
                            }}
                            className={`text-[10px] px-2 py-1 rounded border hover:bg-gray-50 ${
                              item.dueDate && isPastDate(item.dueDate as Date)
                                ? 'border-red-300 text-red-700 bg-red-50'
                                : 'border-gray-300 text-gray-700'
                            }`}
                            title="Scadenza"
                          >
                            📅 {item.dueDate ? formatShortDate(item.dueDate as Date) : 'Data'}
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenAssignees(prev => (prev && prev.listId === list.id && prev.itemId === item.id) ? null : { listId: list.id, itemId: item.id })}
                              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                              title="Assegna utenti"
                            >
                              👤 {(item.assignees?.length || 0)}
                            </button>
                            {openAssignees && openAssignees.listId === list.id && openAssignees.itemId === item.id && (
                              <div className="absolute right-0 top-8 z-20 w-64 max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium text-gray-700">Assegna partecipanti</div>
                                  <button onClick={() => setOpenAssignees(null)} className="text-gray-500 hover:text-gray-700">✖</button>
                                </div>
                                {list.eventId ? (
                                  <div className="space-y-2">
                                    {(events.find(e => e.id === list.eventId)?.participants || []).map(p => {
                                      const checked = (item.assignees || []).some(a => (a.userId && a.userId === p.userId) || (!a.userId && a.userName === p.name))
                                      return (
                                        <label key={p.userId} className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                              const current = new Map<string, { userId?: string; userName: string }>()
                                              for (const a of (item.assignees || [])) {
                                                const key = a.userId || a.userName
                                                current.set(key, a)
                                              }
                                              const key = p.userId || p.name
                                              if (e.target.checked) {
                                                current.set(key, { userId: p.userId, userName: p.name })
                                              } else {
                                                current.delete(key)
                                              }
                                              const next = Array.from(current.values())
                                              updateListItem(list.id, item.id, { assignees: next })
                                            }}
                                          />
                                          <span>{p.name}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">Nessun evento collegato. Aggiungi manualmente dal form o collega un evento.</div>
                                )}
                                <div className="mt-3 border-t pt-2">
                                  <button
                                    onClick={() => {
                                      const current = (item.assignees || []).map(a => a.userName).join(', ')
                                      const res = prompt('Aggiungi nominativi (separati da virgola):', current)
                                      if (res !== null) {
                                        const names = res.split(',').map(s => s.trim()).filter(Boolean)
                                        updateListItem(list.id, item.id, { assignees: names.map(n => ({ userName: n })) })
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Aggiungi manualmente…
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {(list.type === 'transport' || list.type === 'lodging') && (
                        <div className="flex items-center gap-2">
                          {/* Azioni struttura per STANZE: rinomina, +/- capacità, elimina stanza */}
                          {list.type === 'lodging' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const name = prompt('Rinomina stanza:', item.text)
                                  if (name && name.trim()) updateListItem(list.id, item.id, { text: name.trim() })
                                }}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                title="Rinomina stanza"
                              >✏️</button>
                              <button
                                onClick={() => {
                                  const cap = item.capacity ?? 2
                                  if ((item.assignees?.length || 0) >= cap) return
                                  updateListItem(list.id, item.id, { capacity: cap + 1 })
                                }}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                title="Aggiungi posto"
                              >➕</button>
                              <button
                                onClick={() => {
                                  const cap = item.capacity ?? 2
                                  const assigned = (item.assignees?.length || 0)
                                  if (cap <= 1 || cap - 1 < assigned) return
                                  updateListItem(list.id, item.id, { capacity: cap - 1 })
                                }}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                title="Rimuovi posto"
                              >➖</button>
                              <button
                                onClick={async () => {
                                  if (!confirm('Eliminare questa stanza?')) return
                                  const lst = lists.find(l => l.id === list.id)
                                  if (!lst) return
                                  const updated = { ...lst, items: lst.items.filter(it => it.id !== item.id), updatedAt: new Date() }
                                  await listService.update(lst.id, updated)
                                  setLists(prev => prev.map(l => l.id === lst.id ? updated : l))
                                }}
                                className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                title="Elimina stanza"
                              >🗑️</button>
                            </div>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setOpenAssignees(prev => (prev && prev.listId === list.id && prev.itemId === item.id) ? null : { listId: list.id, itemId: item.id })}
                              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                              title="Assegna partecipanti"
                            >
                              👤 {(item.assignees?.length || 0)}
                            </button>
                            {openAssignees && openAssignees.listId === list.id && openAssignees.itemId === item.id && (
                              <div className="absolute right-0 top-8 z-20 w-64 max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium text-gray-700">Assegna partecipanti</div>
                                  <button onClick={() => setOpenAssignees(null)} className="text-gray-500 hover:text-gray-700">✖</button>
                                </div>
                                {list.eventId ? (
                                  <div className="space-y-2">
                                    {(() => {
                                      // Set di assegnati negli altri slot per evitare doppioni globali
                                      const assignedElsewhere = new Set<string>()
                                      list.items.forEach(it => {
                                        if (it.id !== item.id) (it.assignees || []).forEach(a => assignedElsewhere.add(a.userId || a.userName))
                                      })
                                      const capacity = item.capacity ?? (list.type === 'transport' ? 5 : (list.type === 'lodging' ? 2 : undefined))
                                      const assignedCount = (item.assignees?.length || 0)
                                      return (events.find(e => e.id === list.eventId)?.participants || []).map(p => {
                                        const key = p.userId || p.name
                                        const checked = (item.assignees || []).some(a => (a.userId && a.userId === p.userId) || (!a.userId && a.userName === p.name))
                                        const disabled = !checked && assignedElsewhere.has(key)
                                        return (
                                          <label key={p.userId} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} title={disabled ? 'Già assegnato in un altro slot' : ''}>
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={disabled}
                                              onChange={(e) => {
                                                const current = new Map<string, { userId?: string; userName: string }>()
                                                for (const a of (item.assignees || [])) {
                                                  const k = a.userId || a.userName
                                                  current.set(k, a)
                                                }
                                                const k = key
                                                if (e.target.checked) {
                                                  if (capacity !== undefined && !current.has(k) && assignedCount >= capacity) {
                                                    alert('Capacità raggiunta')
                                                    return
                                                  }
                                                  current.set(k, { userId: p.userId, userName: p.name })
                                                } else {
                                                  current.delete(k)
                                                }
                                                const next = Array.from(current.values())
                                                const isRemovingDriver = !e.target.checked && item.driver && ((item.driver.userId && item.driver.userId === p.userId) || (!item.driver.userId && item.driver.userName === p.name))
                                                updateListItem(list.id, item.id, { assignees: next, driver: isRemovingDriver ? undefined : item.driver })
                                              }}
                                            />
                                            <span>{p.name}</span>
                                          </label>
                                        )
                                      })
                                    })()}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">Nessun evento collegato. Aggiungi manualmente dal form o collega un evento.</div>
                                )}
                                {list.type === 'transport' && (
                                  <div className="mt-3 border-t pt-2">
                                    <label className="block text-xs text-gray-600 mb-1">Guidatore:</label>
                                    <select
                                      value={item.driver ? (item.driver.userId || item.driver.userName) : ''}
                                      onChange={(e) => {
                                        const key = e.target.value
                                        if (!key) {
                                          updateListItem(list.id, item.id, { driver: undefined })
                                          return
                                        }
                                        const fromAssigned = (item.assignees || [])
                                        const found = fromAssigned.find(a => (a.userId || a.userName) === key)
                                        if (found) {
                                          updateListItem(list.id, item.id, { driver: { userId: found.userId, userName: found.userName } })
                                        }
                                      }}
                                      className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm"
                                    >
                                      <option value="">Nessuno</option>
                                      {(item.assignees || []).map(a => (
                                        <option key={a.userId || a.userName} value={a.userId || a.userName}>{a.userName}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <div className="mt-3 border-t pt-2">
                                  <button
                                    onClick={() => {
                                      const current = (item.assignees || []).map(a => a.userName).join(', ')
                                      const res = prompt('Aggiungi nominativi (separati da virgola):', current)
                                      if (res !== null) {
                                        const names = res.split(',').map(s => s.trim()).filter(Boolean)
                                        // Applica capacità se presente
                                        const capacity = item.capacity ?? (list.type === 'transport' ? 5 : (list.type === 'lodging' ? 2 : undefined))
                                        // Evita doppioni tra slot
                                        const assignedElsewhere = new Set<string>()
                                        list.items.forEach(it => {
                                          if (it.id !== item.id) (it.assignees || []).forEach(a => assignedElsewhere.add(a.userId || a.userName))
                                        })
                                        const filtered = names.filter(n => !assignedElsewhere.has(n))
                                        const room = capacity ? Math.max(0, capacity - (item.assignees?.length || 0)) : undefined
                                        const limited = room !== undefined ? filtered.slice(0, room) : filtered
                                        const next = [...(item.assignees || []).map(a => a.userName), ...limited]
                                          .map(n => ({ userName: n }))
                                        updateListItem(list.id, item.id, { assignees: next })
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Aggiungi manualmente…
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {item.completed && item.completedBy && (
                        <span className="text-xs text-green-600">
                          ✓ {item.completedBy === currentUserId ? 'Da te' : 'Completato'}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Form per aggiungere nuovo elemento */}
                  <div className="pt-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        const f = new FormData(e.currentTarget)
                        const itemText = f.get('newItem') as string
                        addItemToList(list.id, itemText)
                        e.currentTarget.reset()
                      }}
                      className="flex space-x-2"
                    >
                      <input
                        name="newItem"
                        type="text"
                        placeholder="Aggiungi nuovo elemento..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                      >
                        Aggiungi
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}

        {lists.filter(l => selectedEvent === 'all' || l.eventId === selectedEvent).length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Nessuna lista</h3>
            <p className="text-gray-500">Crea la prima lista per organizzare le attività di gruppo</p>
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-md w-full h-[calc(100dvh-2rem)] sm:h-auto sm:max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)] relative">
            <div className="p-6 pb-[calc(6rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingList ? 'Modifica Lista' : 'Nuova Lista'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingList(null)
                    setFormData({
                      title: '',
                      description: '',
                      items: [''],
                      todoDueDates: [''],
                      todoAssignees: [[]],
                      eventId: '',
                      type: 'shopping'
                    })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitList} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo lista
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    placeholder="Es. Lista della spesa"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione (opzionale)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    rows={3}
                    placeholder="Aggiungi dettagli alla lista..."
                  />
                </div>

                {/* Tipo lista */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo lista
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ListType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  >
                    <option value="shopping">Shopping</option>
                    <option value="todo">To-do</option>
                    <option value="transport">Macchine</option>
                    <option value="lodging">Stanze</option>
                  </select>
                </div>

                {/* Evento collegato (opzionale) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evento collegato (opzionale)
                  </label>
                  <select
                    value={formData.eventId}
                    onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  >
                    <option value="">Nessun evento specifico</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Collega la lista a un evento specifico
                  </p>
                  {/* Generatore slot per Macchine/Stanze */}
                  {(formData.type === 'transport' || formData.type === 'lodging') && formData.eventId && (
                    <div className="mt-3 p-3 rounded-lg border bg-gray-50">
                      {(() => {
                        const ev = events.find(e => e.id === formData.eventId)
                        const participants = (ev?.participants || []).filter(p => p.status === 'yes')
                        const count = participants.length || 0
                        const denom = formData.type === 'transport' ? 5 : 2
                        const slots = Math.ceil((count || 0) / denom) || 1
                        const label = formData.type === 'transport' ? `Genera ${slots} auto (cap. ${denom})` : `Genera ${slots} stanze (cap. ${denom})`
                        return (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-700">Partecipanti confermati: <strong>{count}</strong></span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!ev) return
                                const denomLocal = formData.type === 'transport' ? 5 : 2
                                const slotsLocal = Math.ceil(((ev.participants || []).filter(p => p.status === 'yes').length || 0) / denomLocal) || 1
                                const items = Array.from({ length: slotsLocal }, (_, i) => formData.type === 'transport' ? `Auto ${i + 1}` : `Room ${101 + i}`)
                                setFormData(prev => ({
                                  ...prev,
                                  items,
                                  todoAssignees: items.map(() => []),
                                  todoDueDates: items.map(() => ''),
                                }))
                              }}
                              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {label}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Elementi della lista
                  </label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateFormItem(index, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const val = (e.currentTarget.value || '').trim()
                              if (val.length === 0) return
                              const isLast = index === formData.items.length - 1
                              if (isLast) {
                                addFormItem()
                                setTimeout(() => {
                                  const next = itemInputRefs.current[index + 1]
                                  next?.focus()
                                }, 0)
                              } else {
                                const next = itemInputRefs.current[index + 1]
                                next?.focus()
                              }
                            }
                          }}
                          ref={(el) => { itemInputRefs.current[index] = el }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                          placeholder={`Elemento ${index + 1}`}
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFormItem(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            aria-label="Rimuovi elemento"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {(formData.type === 'todo' || formData.type === 'transport' || formData.type === 'lodging') && !editingList && (
                        <div className="flex items-center gap-2 pl-1">
                          {/* Hidden date input per item + compact chip */}
                          {formData.type === 'todo' && (
                            <>
                              <input
                                type="date"
                                value={formData.todoDueDates[index] || ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setFormData(prev => ({
                                    ...prev,
                                    todoDueDates: prev.todoDueDates.map((d, i) => i === index ? v : d)
                                  }))
                                }}
                                className="sr-only"
                                aria-hidden="true"
                                tabIndex={-1}
                                id={`todo-date-${index}`}
                              />
                              <label
                                htmlFor={`todo-date-${index}`}
                                className={`text-[10px] px-2 py-1 rounded border hover:bg-gray-50 cursor-pointer ${
                                  isPastISO(formData.todoDueDates[index]) ? 'border-red-300 text-red-700 bg-red-50' : 'border-gray-300 text-gray-700'
                                }`}
                              >
                                📅 {formData.todoDueDates[index] ? (() => { const parts = formData.todoDueDates[index].split('-'); const d = parts[2]; const m = parts[1]; return `${d}/${m}` })() : 'Data'}
                              </label>
                            </>
                          )}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenFormAssignees(prev => prev === index ? null : index)}
                              className="text-[10px] px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              👤 {(formData.todoAssignees[index] || []).length}
                            </button>
                            {openFormAssignees === index && (
                              <div className="absolute z-30 right-0 top-8 w-64 max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium text-gray-700">Assegna partecipanti</div>
                                  <button onClick={() => setOpenFormAssignees(null)} className="text-gray-500 hover:text-gray-700">✖</button>
                                </div>
                                {formData.eventId ? (
                                  <div className="space-y-2">
                                    {(events.find(e => e.id === formData.eventId)?.participants || []).map(p => {
                                      const names = new Set(formData.todoAssignees[index] || [])
                                      const checked = names.has(p.name)
                                      // Evita doppioni tra slot (solo per macchine/stanze)
                                      const takenElsewhere = new Set<string>()
                                      if (formData.type === 'transport' || formData.type === 'lodging') {
                                        formData.todoAssignees.forEach((arr, i) => {
                                          if (i !== index) arr.forEach(n => takenElsewhere.add(n))
                                        })
                                      }
                                      const disabled = (formData.type === 'transport' || formData.type === 'lodging') && !checked && takenElsewhere.has(p.name)
                                      return (
                                        <label key={p.userId} className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} title={disabled ? 'Già assegnato in un altro slot' : ''}>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={disabled}
                                            onChange={(e) => {
                                              const next = new Set(formData.todoAssignees[index] || [])
                                              if (e.target.checked) next.add(p.name)
                                              else next.delete(p.name)
                                              setFormData(prev => ({
                                                ...prev,
                                                todoAssignees: prev.todoAssignees.map((arr, i) => i === index ? Array.from(next) : arr)
                                              }))
                                            }}
                                          />
                                          <span>{p.name}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500">Nessun evento collegato. Aggiungi manualmente.</div>
                                )}
                                <div className="mt-3 border-t pt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = (formData.todoAssignees[index] || []).join(', ')
                                      const res = prompt('Aggiungi nominativi (separati da virgola):', current)
                                      if (res !== null) {
                                        let names = res.split(',').map(s => s.trim()).filter(Boolean)
                                        // Evita doppioni tra slot per macchine/stanze
                                        if (formData.type === 'transport' || formData.type === 'lodging') {
                                          const takenElsewhere = new Set<string>()
                                          formData.todoAssignees.forEach((arr, i) => {
                                            if (i !== index) arr.forEach(n => takenElsewhere.add(n))
                                          })
                                          names = names.filter(n => !takenElsewhere.has(n))
                                        }
                                        setFormData(prev => ({
                                          ...prev,
                                          todoAssignees: prev.todoAssignees.map((arr, i) => i === index ? names : arr)
                                        }))
                                      }
                                    }}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
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
                    onClick={addFormItem}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-green-500 hover:text-green-600 transition-colors"
                  >
                    + Aggiungi elemento
                  </button>
                  {formData.type === 'todo' && (
                    <p className="text-xs text-gray-500 mt-2">
                      Suggerimento: per le liste To-do puoi modificare stato, scadenza e assegnatari direttamente dalla lista dopo il salvataggio.
                    </p>
                  )}
                </div>
                {/* Fixed action bar: guaranteed above mobile bottom UI */}
                <div className="fixed left-1/2 -translate-x-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] w-full max-w-md px-6">
                  <div className="bg-white border rounded-xl shadow-md px-4 py-3 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingList(null)
                      setFormData({ title: '', description: '', items: [''], todoDueDates: [''], todoAssignees: [[]], eventId: '', type: 'shopping' })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Salvataggio...' : (editingList ? 'Salva' : 'Crea Lista')}
                  </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottone Mobile */}
      <div className="fixed bottom-28 right-6 md:bottom-8 z-40">
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 ring-4 ring-green-100"
          title="Crea nuova lista"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default ListsPage
 