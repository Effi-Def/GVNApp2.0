import { useState, useEffect } from 'react'
import { listService, eventService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { ShoppingList, ListItem, Event } from '../types'

const ListsPage = () => {
  const { user } = useAuthStore()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingList, setEditingList] = useState<ShoppingList | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<string>('all')

  // Form data per nuova lista
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    items: [''],
    eventId: ''
  })

  const currentUserId = user?.id || 'anonymous'

  // Carica liste ed eventi
  useEffect(() => {
    const loadLists = async () => {
      try {
        setLoading(true)
        console.log('📋 Loading lists and events...')
        const [listsData, eventsData] = await Promise.all([
          listService.getAll(),
          eventService.getAll(),
        ])
        setLists(listsData)
        setEvents(eventsData)
        console.log(`✅ Loaded ${listsData.length} lists and ${eventsData.length} events`)
      } catch (error) {
        console.error('❌ Error loading lists:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLists()
  }, [])

  // Reset automatico filtro evento (selezione placeholder) se l'evento selezionato non esiste più
  useEffect(() => {
    if (selectedEvent !== 'all') {
      const exists = events.some(e => e.id === selectedEvent)
      if (!exists) setSelectedEvent('all')
    }
  }, [events, selectedEvent])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    })
  }

  // Aggiungi elemento al form
  const addFormItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, '']
    }))
  }

  // Rimuovi elemento dal form
  const removeFormItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }))
    }
  }

  // Aggiorna elemento del form
  const updateFormItem = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? value : item)
    }))
  }

  // Gestione submit lista
  const handleSubmitList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || formData.items.some(item => !item.trim())) return

    setSubmitting(true)
    try {
      const listItems: ListItem[] = formData.items
        .filter(item => item.trim())
        .map((item, index) => ({
          id: `item_${index}`,
          text: item.trim(),
          completed: false,
          addedBy: currentUserId,
          addedAt: new Date()
        }))

      const listData = {
        title: formData.title,
        description: formData.description,
        items: listItems,
        createdBy: currentUserId,
        shared: true,
        eventId: formData.eventId || undefined
      }

      if (editingList) {
        await listService.update(editingList.id, listData)
        const updatedLists = await listService.getAll()
        setLists(updatedLists)
        setEditingList(null)
      } else {
        const newList = await listService.create(listData)
        setLists(prev => [newList, ...prev])
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        items: [''],
        eventId: ''
      })
      setShowForm(false)
      console.log('✅ List saved successfully')
    } catch (error) {
      console.error('❌ Error saving list:', error)
      alert('Errore durante il salvataggio della lista')
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle completamento elemento
  const toggleItemCompletion = async (listId: string, itemId: string) => {
    try {
      const list = lists.find(l => l.id === listId)
      if (!list) return

      const updatedItems = list.items.map(item => 
        item.id === itemId 
          ? { ...item, completed: !item.completed, completedBy: !item.completed ? currentUserId : undefined, completedAt: !item.completed ? new Date() : undefined }
          : item
      )

      const updatedListData = {
        ...list,
        items: updatedItems,
        updatedAt: new Date()
      }

      await listService.update(listId, updatedListData)
      
      // Aggiorna lo stato locale
      setLists(prev => prev.map(l => 
        l.id === listId ? updatedListData : l
      ))

      console.log('✅ Item status updated successfully')
    } catch (error) {
      console.error('❌ Error updating item:', error)
      alert('Errore durante l\'aggiornamento dell\'elemento')
    }
  }

  // Aggiungi elemento a lista esistente
  const addItemToList = async (listId: string, itemText: string) => {
    if (!itemText.trim()) return

    try {
      const list = lists.find(l => l.id === listId)
      if (!list) return

      const newItem: ListItem = {
        id: `item_${Date.now()}`,
        text: itemText.trim(),
        completed: false,
        addedBy: currentUserId,
        addedAt: new Date()
      }

      const updatedListData = {
        ...list,
        items: [...list.items, newItem],
        updatedAt: new Date()
      }

      await listService.update(listId, updatedListData)
      
      // Aggiorna lo stato locale
      setLists(prev => prev.map(l => 
        l.id === listId ? updatedListData : l
      ))

      console.log('✅ Item added successfully')
    } catch (error) {
      console.error('❌ Error adding item:', error)
      alert('Errore durante l\'aggiunta dell\'elemento')
    }
  }

  // Modifica lista
  const handleEditList = (list: ShoppingList) => {
    setEditingList(list)
    setFormData({
      title: list.title,
      description: list.description || '',
      items: list.items.map(item => item.text),
      eventId: list.eventId || ''
    })
    setShowForm(true)
  }

  // Cancella lista
  const handleDeleteList = async (listId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa lista?')) return

    try {
      await listService.delete(listId)
      setLists(prev => prev.filter(l => l.id !== listId))
      console.log('✅ List deleted successfully')
    } catch (error) {
      console.error('❌ Error deleting list:', error)
      alert('Errore durante l\'eliminazione della lista')
    }
  }

  // Calcola statistiche lista
  const getListStats = (list: ShoppingList) => {
    const total = list.items.length
    const completed = list.items.filter(item => item.completed).length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percentage }
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
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nuova Lista</span>
          </button>
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
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista delle Liste */}
      <div className="space-y-6">
        {lists
          .filter(l => selectedEvent === 'all' || l.eventId === selectedEvent)
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
                  <div className="flex items-center flex-wrap gap-3 text-sm text-gray-500 mb-4">
                    <span>📅 {formatDate(list.createdAt)}</span>
                    <span>📊 {stats.completed}/{stats.total} completati ({stats.percentage}%)</span>
                    {list.eventId && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        📅 {events.find(e => e.id === list.eventId)?.title || 'Evento'}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      list.shared 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-100 text-gray-700'
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
                
                {/* Controlli per chi ha creato la lista */}
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
                        item.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 hover:border-green-500'
                      }`}
                    >
                      {item.completed && (
                        <svg className="w-4 h-4 text-white mx-auto mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 ${
                      item.completed ? 'line-through text-gray-500' : 'text-gray-800'
                    }`}>
                      {item.text}
                    </span>
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
                      const formData = new FormData(e.currentTarget)
                      const itemText = formData.get('newItem') as string
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
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
                      eventId: ''
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
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                    rows={3}
                    placeholder="Aggiungi dettagli alla lista..."
                  />
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
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.title}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Collega la lista a un evento specifico
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Elementi della lista
                  </label>
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateFormItem(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                        placeholder={`Elemento ${index + 1}`}
                        required
                      />
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFormItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingList(null)
                      setFormData({
                        title: '',
                        description: '',
                        items: [''],
                        eventId: ''
                      })
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