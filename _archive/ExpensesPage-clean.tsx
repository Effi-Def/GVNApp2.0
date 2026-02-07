import { useState } from 'react'

interface Expense {
  id: string
  title: string
  amount: number
  paidBy: string
  participants: string[]
  date: string
  eventId?: string
  eventName?: string
  category: string
  createdBy: string
}

interface Event {
  id: string
  name: string
  participants: string[]
}

const ExpensesPage = () => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'owed' | 'paid'>('all')
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  
  // Dati di esempio
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: '1',
      title: 'Ristorante "Da Mario"',
      amount: 158.00,
      paidBy: 'Marco',
      participants: ['Marco', 'Andrea', 'Giulia', 'Luca'],
      date: '2025-10-15',
      eventId: 'event1',
      eventName: 'Cena di Gruppo',
      category: 'Cibo',
      createdBy: 'Marco'
    },
    {
      id: '2',
      title: 'Biglietti Cinema',
      amount: 84.50,
      paidBy: 'Andrea',
      participants: ['Andrea', 'Giulia', 'Sara'],
      date: '2025-10-12',
      eventId: 'event2',
      eventName: 'Cinema & Aperitivo',
      category: 'Intrattenimento',
      createdBy: 'Andrea'
    },
    {
      id: '3',
      title: 'Aperitivo Bar Central',
      amount: 45.00,
      paidBy: 'Giulia',
      participants: ['Giulia', 'Marco', 'Andrea'],
      date: '2025-10-08',
      eventId: 'event2',
      eventName: 'Cinema & Aperitivo',
      category: 'Bevande',
      createdBy: 'Giulia'
    },
    {
      id: '4',
      title: 'Benzina Viaggio',
      amount: 65.00,
      paidBy: 'Luca',
      participants: ['Luca', 'Marco', 'Andrea', 'Giulia'],
      date: '2025-10-05',
      eventId: 'event3',
      eventName: 'Concerto Live',
      category: 'Trasporti',
      createdBy: 'Luca'
    }
  ])

  const events: Event[] = [
    { id: 'event1', name: 'Cena di Gruppo', participants: ['Marco', 'Andrea', 'Giulia', 'Luca'] },
    { id: 'event2', name: 'Cinema & Aperitivo', participants: ['Andrea', 'Giulia', 'Sara'] },
    { id: 'event3', name: 'Concerto Live', participants: ['Luca', 'Marco', 'Andrea', 'Giulia'] }
  ]

  const currentUser = 'Andrea'
  
  // Form data per nuova spesa
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Cibo',
    eventId: '',
    participants: [] as string[]
  })
  
  // Calcolo dei saldi
  const calculateBalance = () => {
    let totalPaid = 0
    let totalOwed = 0
    
    expenses.forEach(expense => {
      if (expense.paidBy === currentUser) {
        totalPaid += expense.amount
      }
      if (expense.participants.includes(currentUser)) {
        totalOwed += expense.amount / expense.participants.length
      }
    })
    
    return totalPaid - totalOwed
  }

  const balance = calculateBalance()

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Cibo': return '🍽️'
      case 'Intrattenimento': return '🎬'
      case 'Bevande': return '🍻'
      case 'Trasporti': return '⛽'
      default: return '💰'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'long' 
    })
  }

  // Funzioni per gestire le spese
  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.amount || !formData.eventId || formData.participants.length === 0) return

    const newExpense: Expense = {
      id: Date.now().toString(),
      title: formData.title,
      amount: parseFloat(formData.amount),
      paidBy: currentUser,
      participants: formData.participants,
      date: new Date().toISOString().split('T')[0],
      eventId: formData.eventId || undefined,
      eventName: formData.eventId ? events.find(e => e.id === formData.eventId)?.name : undefined,
      category: formData.category,
      createdBy: currentUser
    }

    if (editingExpense) {
      setExpenses(expenses.map(exp => exp.id === editingExpense.id ? { ...newExpense, id: editingExpense.id } : exp))
      setEditingExpense(null)
    } else {
      setExpenses([newExpense, ...expenses])
    }

    setFormData({
      title: '',
      amount: '',
      category: 'Cibo',
      eventId: '',
      participants: []
    })
    setShowForm(false)
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      eventId: expense.eventId || '',
      participants: expense.participants
    })
    setShowForm(true)
  }

  const handleDeleteExpense = (expenseId: string) => {
    if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
      setExpenses(expenses.filter(exp => exp.id !== expenseId))
    }
  }

  const toggleParticipant = (participant: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(participant)
        ? prev.participants.filter(p => p !== participant)
        : [...prev.participants, participant]
    }))
  }

  // Gestione cambio evento - aggiorna automaticamente i partecipanti disponibili
  const handleEventChange = (eventId: string) => {
    const selectedEvent = events.find(e => e.id === eventId)
    setFormData(prev => ({
      ...prev,
      eventId,
      participants: selectedEvent ? [currentUser] : [] // Include sempre l'utente corrente se c'è un evento
    }))
  }

  // Ottieni i partecipanti disponibili in base all'evento selezionato
  const getAvailableParticipants = () => {
    if (!formData.eventId) return []
    const selectedEvent = events.find(e => e.id === formData.eventId)
    return selectedEvent ? selectedEvent.participants : []
  }

  // Filtro spese
  const filteredExpenses = expenses.filter(expense => {
    const matchesFilter = 
      selectedFilter === 'all' || 
      (selectedFilter === 'paid' && expense.paidBy === currentUser) ||
      (selectedFilter === 'owed' && expense.participants.includes(currentUser))
    
    const matchesEvent = selectedEvent === 'all' || expense.eventId === selectedEvent
    
    return matchesFilter && matchesEvent
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Spese 💰</h1>
            <p className="text-gray-600">Gestisci le spese di gruppo e i saldi</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Aggiungi Spesa</span>
          </button>
        </div>
      </div>

      {/* Saldo Totale */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Il tuo saldo</h2>
          <div className={`text-4xl font-bold mb-2 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(2)}€
          </div>
          <p className="text-gray-500">
            {balance > 0 
              ? 'Ti devono restituire denaro' 
              : balance < 0 
                ? 'Devi restituire denaro'
                : 'Sei in pari con tutti'
            }
          </p>
        </div>
      </div>

      {/* Filtri */}
      <div className="space-y-4 mb-6">
        {/* Filtri per tipo */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tutte
          </button>
          <button
            onClick={() => setSelectedFilter('paid')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'paid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pagate da me
          </button>
          <button
            onClick={() => setSelectedFilter('owed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'owed'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Che mi riguardano
          </button>
        </div>

        {/* Filtro per evento */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Evento:</span>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="px-3 py-1 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tutti gli eventi</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista Spese */}
      <div className="space-y-4">
        {filteredExpenses.map(expense => (
          <div key={expense.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className="text-2xl">
                  {getCategoryIcon(expense.category)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{expense.title}</h3>
                    {expense.eventName && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {expense.eventName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Pagato da <span className="font-medium">{expense.paidBy}</span> • {formatDate(expense.date)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {expense.participants.length} partecipanti: {expense.participants.join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-800">€{expense.amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">
                    €{(expense.amount / expense.participants.length).toFixed(2)} a testa
                  </p>
                  {expense.paidBy === currentUser && (
                    <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Hai pagato tu
                    </span>
                  )}
                </div>
                {/* Controlli modifica/cancellazione per chi ha creato la spesa */}
                {expense.createdBy === currentUser && (
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleEditExpense(expense)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifica spesa"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteExpense(expense.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Elimina spesa"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💸</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Nessuna spesa trovata</h3>
            <p className="text-gray-500">Non ci sono spese che corrispondono ai filtri selezionati</p>
          </div>
        )}
      </div>

      {/* Modal Form per Aggiungere/Modificare Spesa */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  {editingExpense ? 'Modifica Spesa' : 'Nuova Spesa'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingExpense(null)
                    setFormData({
                      title: '',
                      amount: '',
                      category: 'Cibo',
                      eventId: '',
                      participants: []
                    })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmitExpense} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo spesa
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="Es. Cena al ristorante"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importo (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="Cibo">Cibo</option>
                    <option value="Intrattenimento">Intrattenimento</option>
                    <option value="Bevande">Bevande</option>
                    <option value="Trasporti">Trasporti</option>
                    <option value="Alloggio">Alloggio</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.eventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Seleziona un evento</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Seleziona l'evento per vedere i partecipanti disponibili
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Partecipanti per lo split {formData.eventId && <span className="text-red-500">*</span>}
                  </label>
                  {!formData.eventId ? (
                    <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <p className="text-gray-500 text-sm">
                        Seleziona prima un evento per vedere i partecipanti disponibili
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Controlli rapidi per la selezione */}
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, participants: getAvailableParticipants() }))}
                          className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Tutti i partecipanti ({getAvailableParticipants().length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, participants: getAvailableParticipants() }))}
                          className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                        >
                          Seleziona tutti
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, participants: [] }))}
                          className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                        >
                          Deseleziona tutti
                        </button>
                      </div>

                      {/* Lista dei partecipanti con checkbox */}
                      <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <div className="space-y-2">
                          {getAvailableParticipants().map(person => (
                            <label key={person} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={formData.participants.includes(person)}
                                  onChange={() => toggleParticipant(person)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 font-medium">{person}</span>
                                {person === currentUser && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">tu</span>
                                )}
                              </div>
                              {formData.participants.includes(person) && formData.amount && (
                                <span className="text-xs text-gray-500">
                                  €{(parseFloat(formData.amount) / formData.participants.length).toFixed(2)}
                                </span>
                              )}
                            </label>
                          ))}
                          {getAvailableParticipants().length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-2">
                              Nessun partecipante disponibile per questo evento
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Riepilogo selezione */}
                      {formData.eventId && (
                        <div className="flex items-center justify-between text-sm p-2 bg-blue-50 rounded-lg">
                          <span className="text-gray-600">
                            {formData.participants.length > 0 
                              ? `${formData.participants.length} partecipanti selezionati`
                              : 'Nessun partecipante selezionato'
                            }
                          </span>
                          {formData.participants.length > 0 && formData.amount && (
                            <span className="font-medium text-blue-700">
                              €{(parseFloat(formData.amount) / formData.participants.length).toFixed(2)} a testa
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {formData.eventId && formData.participants.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Seleziona almeno un partecipante per lo split della spesa
                    </p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingExpense(null)
                      setFormData({
                        title: '',
                        amount: '',
                        category: 'Cibo',
                        eventId: '',
                        participants: []
                      })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    {editingExpense ? 'Salva' : 'Aggiungi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bottone Aggiungi Spesa Mobile */}
      <div className="fixed bottom-28 right-6 md:bottom-8 z-40">
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 ring-4 ring-blue-100"
          title="Aggiungi nuova spesa"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default ExpensesPage
