import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ListCard from '../components/lists/ListCard'
import ListFormModal, { type ListFormValues } from '../components/lists/ListFormModal'
import { farmService, listService } from '../services/firestore'
import { useAppStore } from '../stores/AppStore'
import { useActiveFarmStore } from '../stores/useActiveFarmStore'
import { refreshActiveFarmData, useAuthStore } from '../stores/useAuthStore'
import type { FarmMembership, ListItem, ListType, ShoppingList } from '../types'
import { getSelectableEvents, getUserEventParticipation, getUserKeys } from '../utils/events'
import {
  createListItem,
  getDefaultCapacity,
  getTogglePatch,
  LIST_TYPES,
  mergeEditedItems,
  namesToAssignees,
  type ListPerson,
} from '../utils/lists'

const ListsPage = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)
  const storeEvents = useAppStore(s => s.events)
  const storeLists = useAppStore(s => s.lists)
  const addList = useAppStore(s => s.addList)
  const updateList = useAppStore(s => s.updateList)
  const deleteList = useAppStore(s => s.deleteList)

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<FarmMembership[]>([])
  const [selectedEvent, setSelectedEvent] = useState('all')
  const [selectedType, setSelectedType] = useState<'all' | ListType>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingList, setEditingList] = useState<ShoppingList | null>(null)
  const [formEventId, setFormEventId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const handledNavStateRef = useRef('')

  const currentUserId = user?.id || 'anonymous'

  const events = useMemo(
    () => getSelectableEvents(storeEvents || [], { userKeys: getUserKeys(user), farmIds: activeFarmId ? [activeFarmId] : [] }),
    [storeEvents, user?.id, user?.email, activeFarmId],
  )

  const lists = useMemo(() => {
    const eventIds = new Set(events.map(e => e.id))
    return (storeLists || []).filter(l => l.eventId ? eventIds.has(l.eventId) : (!l.farmId || l.farmId === activeFarmId))
  }, [storeLists, events, activeFarmId])

  const visibleLists = lists
    .filter(l => selectedEvent === 'all' || l.eventId === selectedEvent)
    .filter(l => selectedType === 'all' || (l.type || 'shopping') === selectedType)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        if (user?.id && (storeEvents?.length || 0) === 0 && (storeLists?.length || 0) === 0) {
          await refreshActiveFarmData()
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => { alive = false }
  }, [currentUserId, activeFarmId])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeFarmId) {
      setMembers([])
      return
    }
    let alive = true
    farmService.listMembers(activeFarmId)
      .then(next => { if (alive) setMembers(next) })
      .catch(() => { if (alive) setMembers([]) })
    return () => { alive = false }
  }, [activeFarmId])

  const openCreateForm = (eventId = '') => {
    setEditingList(null)
    setFormEventId(eventId)
    setShowForm(true)
  }

  // Coming from an event summary: open the form with that event selected
  useEffect(() => {
    const state = location?.state
    const eventId = state?.eventId as string | undefined
    if (!state?.openForm || !eventId || !events.some(e => e.id === eventId)) return
    if (handledNavStateRef.current === eventId) return
    handledNavStateRef.current = eventId
    openCreateForm(eventId)
  }, [location?.state, events])

  // Auto-open create form when ?create=1
  useEffect(() => {
    if (new URLSearchParams(location?.search || '').get('create') === '1') openCreateForm()
  }, [location?.search])

  const getPeople = (eventId: string): ListPerson[] => {
    if (eventId) {
      return (events.find(e => e.id === eventId)?.participants || [])
        .map(p => ({ userId: p.userId, name: p.name }))
    }
    return members.map(m => ({ userId: m.userId, name: m.displayName || 'Maiale' }))
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingList(null)
  }

  // Every item change is applied on the latest saved list, so two people do not overwrite each other
  const changeItems = async (list: ShoppingList, change: (items: ListItem[]) => ListItem[]) => {
    setActionError(null)
    try {
      const items = await listService.changeItems(list.id, change, list.items)
      updateList(list.id, { items, updatedAt: new Date() })
    } catch (err) {
      console.error('❌ Error updating list items:', err)
      setActionError('Non sono riuscito a salvare la modifica. Riprova.')
    }
  }

  const patchItem = (list: ShoppingList, itemId: string, patch: Partial<ListItem>) =>
    changeItems(list, items => items.map(it => it.id === itemId ? { ...it, ...patch } : it))

  const toggleItem = (list: ShoppingList, item: ListItem) =>
    patchItem(list, item.id, getTogglePatch(item, list.type, currentUserId))

  const addItem = (list: ShoppingList, text: string) =>
    changeItems(list, items => [...items, createListItem(text, list.type, currentUserId)])

  const removeItem = (list: ShoppingList, itemId: string) =>
    changeItems(list, items => items.filter(it => it.id !== itemId))

  const handleDeleteList = async (id: string) => {
    if (!confirm('Eliminare la lista?')) return
    setActionError(null)
    try {
      await listService.delete(id)
      deleteList(id)
    } catch (err) {
      console.error('❌ Error deleting list:', err)
      setActionError('Non sono riuscito a eliminare la lista. Riprova.')
    }
  }

  const buildItems = (values: ListFormValues): ListItem[] => {
    const people = getPeople(values.eventId)
    return values.items
      .map((text, index) => ({ text: text.trim(), index }))
      .filter(({ text }) => text.length > 0)
      .map(({ text, index }) => {
        const item = createListItem(text, values.type, currentUserId)
        if (values.type === 'shopping') return item
        const due = values.dueDates[index]
        return {
          ...item,
          capacity: getDefaultCapacity(values.type),
          dueDate: values.type === 'todo' && due ? new Date(`${due}T00:00:00`) : undefined,
          assignees: namesToAssignees(values.assignees[index] || [], people),
        }
      })
  }

  const handleSubmit = async (values: ListFormValues) => {
    const title = values.title.trim()
    if (!title || submitting) return

    if (values.eventId) {
      const event = events.find(ev => ev.id === values.eventId)
      if (!event) {
        alert('Evento non valido')
        return
      }
      if (getUserEventParticipation(event, getUserKeys(user)).accessLevel !== 'full') {
        alert('Non hai i permessi per creare o modificare liste in questo evento')
        return
      }
    }

    setSubmitting(true)
    try {
      const description = values.description.trim()
      if (editingList) {
        const metadata: Partial<ShoppingList> = {
          title,
          description,
          eventId: values.eventId || undefined,
          // A private list stays private: only a list leaving its event moves to the farm
          farmId: values.eventId ? undefined : (editingList.eventId ? (activeFarmId || undefined) : editingList.farmId),
          type: values.type,
        }
        await listService.update(editingList.id, metadata)
        let items = editingList.items
        // Status, due dates and assignees of a to-do list change from the list itself
        if ((editingList.type || 'shopping') !== 'todo') {
          const texts = values.items.map(t => t.trim()).filter(Boolean)
          items = await listService.changeItems(editingList.id, current => mergeEditedItems(current, texts, values.type, currentUserId), editingList.items)
        }
        updateList(editingList.id, { ...metadata, items, updatedAt: new Date() })
      } else {
        const created = await listService.create({
          title,
          description: description || undefined,
          items: buildItems(values),
          eventId: values.eventId || undefined,
          // Without an event the farm is what makes the list visible to the others
          farmId: values.eventId ? undefined : (activeFarmId || undefined),
          createdBy: currentUserId,
          shared: true,
          type: values.type,
        })
        addList(created)
      }
      closeForm()
    } catch (err: any) {
      console.error('Errore salvataggio lista:', err)
      alert('Impossibile salvare la lista. Controlla la connessione e riprova.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="pt-16 px-6 pb-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-[--text-muted] mb-2">Caricamento liste...</h3>
        </div>
      </div>
    )
  }

  const selectClass = 'px-3 py-1 rounded-lg border border-[--border-base] bg-[--bg-card] text-[--text-base] text-sm focus:outline-none focus:border-green-500'

  return (
    <div className="pt-16 px-4 pb-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[--text-base] mb-0.5">Liste 📋</h1>
            <p className="text-sm text-[--text-muted]">Spesa, macchine, stanze e cose da preparare</p>
          </div>
          <button
            type="button"
            onClick={() => openCreateForm()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Nuova</span>
          </button>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-event" className="text-sm font-medium text-[--text-muted]">Evento:</label>
            <select id="filter-event" value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className={selectClass}>
              <option value="all">Tutti gli eventi</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-type" className="text-sm font-medium text-[--text-muted]">Tipo:</label>
            <select id="filter-type" value={selectedType} onChange={(e) => setSelectedType(e.target.value as 'all' | ListType)} className={selectClass}>
              <option value="all">Tutti</option>
              {LIST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {actionError}
        </div>
      )}

      <div className="space-y-6">
        {visibleLists.map(list => (
          <ListCard
            key={list.id}
            list={list}
            eventTitle={events.find(e => e.id === list.eventId)?.title}
            people={getPeople(list.eventId || '')}
            currentUserId={currentUserId}
            onEdit={() => {
              setEditingList(list)
              setShowForm(true)
            }}
            onDelete={() => handleDeleteList(list.id)}
            onToggleItem={(item) => toggleItem(list, item)}
            onPatchItem={(itemId, patch) => patchItem(list, itemId, patch)}
            onRemoveItem={(itemId) => removeItem(list, itemId)}
            onAddItem={(text) => addItem(list, text)}
          />
        ))}

        {visibleLists.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-[--text-muted] mb-2">Nessuna lista</h3>
            <p className="text-[--text-muted]">
              {lists.length === 0 ? 'Tocca + Nuova per creare la prima lista della fattoria.' : 'Nessuna lista con questi filtri.'}
            </p>
          </div>
        )}
      </div>

      {showForm && (
        <ListFormModal
          key={editingList?.id || `new-${formEventId}`}
          editingList={editingList}
          initialEventId={formEventId}
          events={events}
          getPeople={getPeople}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}
    </div>
  )
}

export default ListsPage
