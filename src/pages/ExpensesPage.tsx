import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { expenseService, eventService, paymentService } from '../services/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { Expense, Event, ExpenseParticipant, PaymentTransaction } from '../types'
import ExpenseSettlement from '../components/ExpenseSettlement'
import { filterSelectableEvents, getUserKeys } from '../utils/events'

const ExpensesPage = () => {
  const { user } = useAuthStore()
  const location = useLocation() as any
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'settlement'>('list')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'owed' | 'paid'>('all')
  const [selectedEvent, setSelectedEvent] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const handledNavStateRef = useRef(false)

  // Form data per nuova spesa
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Cibo',
    eventId: '',
    participants: [] as string[]
  })

  const currentUserId = user?.id || ''
  const userKeys = getUserKeys(user)

  // Carica dati iniziali
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        console.log('🔄 Loading expenses and events...')

        // IMPORTANT: don't let a failure in payments/expenses prevent events from loading.
        const [eventsRes, expensesRes, paymentsRes] = await Promise.allSettled([
          eventService.getAll(),
          expenseService.getAll(),
          paymentService.getAll(),
        ])

        const eventsData: Event[] = eventsRes.status === 'fulfilled' ? eventsRes.value : []
        if (eventsRes.status === 'rejected') {
          console.error('❌ Error loading events:', eventsRes.reason)
        }

        const expensesData: Expense[] = expensesRes.status === 'fulfilled' ? expensesRes.value : []
        if (expensesRes.status === 'rejected') {
          console.error('❌ Error loading expenses:', expensesRes.reason)
        }

        const paymentsData: PaymentTransaction[] = paymentsRes.status === 'fulfilled' ? paymentsRes.value : []
        if (paymentsRes.status === 'rejected') {
          console.error('❌ Error loading payments:', paymentsRes.reason)
        }

        // Eventi selezionabili: appartenenti all'utente (uid o email) e non troppo vecchi
        const myEvents = filterSelectableEvents(eventsData, userKeys)
        setEvents(myEvents)

        // Mostra spese SOLO se collegate a un evento dove l'utente ha status 'yes'
        const myEventIds = new Set(myEvents.map(e => e.id))
        const visibleExpenses = expensesData.filter(exp => exp.eventId && myEventIds.has(exp.eventId))
        setExpenses(visibleExpenses)
        setPayments(paymentsData)
        console.log(`✅ Loaded ${expensesData.length} expenses, ${paymentsData.length} payments and ${eventsData.length} events`)
      } catch (error) {
        console.error('❌ Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      loadData()
    }
  }, [user])

  // Supporto navigazione dal Summary evento: apri form e pre-seleziona l'evento
  useEffect(() => {
    if (handledNavStateRef.current) return
    const st = location?.state
    const eventId = st?.eventId as string | undefined
    const openForm = !!st?.openForm
    if (!openForm || !eventId) return
    if (!events.some(e => e.id === eventId)) return
    handledNavStateRef.current = true
    setShowForm(true)
    handleEventChange(eventId)
  }, [location?.state, events])

  // Calcolo del saldo totale
  const calculateBalance = () => {
    let totalPaid = 0
    let totalOwed = 0
    
    expenses.forEach(expense => {
      if (expense.paidBy === currentUserId) {
        totalPaid += expense.amount
      }
      const userParticipation = expense.participants.find(p => p.userId === currentUserId)
      if (userParticipation) {
        totalOwed += userParticipation.amount
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
      case 'Alloggio': return '🏨'
      default: return '💰'
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'long' 
    })
  }

  // Gestione cambio evento - aggiorna automaticamente i partecipanti disponibili
  const handleEventChange = (eventId: string) => {
    const selectedEvent = events.find(e => e.id === eventId)
    setFormData(prev => ({
      ...prev,
      eventId,
      participants: selectedEvent ? [currentUserId] : []
    }))
  }

  // Ottieni i partecipanti disponibili in base all'evento selezionato
  const getAvailableParticipants = () => {
    if (!formData.eventId) return []
    const selectedEvent = events.find(e => e.id === formData.eventId)
    return selectedEvent ? selectedEvent.participants : []
  }

  const toggleParticipant = (participantId: string) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.includes(participantId)
        ? prev.participants.filter(p => p !== participantId)
        : [...prev.participants, participantId]
    }))
  }

  // Funzioni per gestire le spese
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.amount || !formData.eventId || formData.participants.length === 0) return

    setSubmitting(true)
    try {
      const selectedEvent = events.find(e => e.id === formData.eventId)
      if (!selectedEvent) return

      // Calcola l'importo per partecipante
      const amountPerPerson = parseFloat(formData.amount) / formData.participants.length

      // Crea i partecipanti con la struttura corretta
      const participants: ExpenseParticipant[] = formData.participants.map(participantId => {
        const participant = selectedEvent.participants.find(p => p.userId === participantId)
        return {
          userId: participantId,
          name: participant?.name || participantId,
          amount: amountPerPerson,
          settled: false
        }
      })

      const expenseData = {
        title: formData.title,
        amount: parseFloat(formData.amount),
        paidBy: currentUserId,
        participants,
        eventId: formData.eventId
      }

      if (editingExpense) {
        await expenseService.update(editingExpense.id, expenseData)
        // Ricarica le spese
        const updatedExpenses = await expenseService.getAll()
        setExpenses(updatedExpenses)
        setEditingExpense(null)
      } else {
        const newExpense = await expenseService.create(expenseData)
        setExpenses(prev => [newExpense, ...prev])
      }

      // Reset form
      setFormData({
        title: '',
        amount: '',
        category: 'Cibo',
        eventId: '',
        participants: []
      })
      setShowForm(false)
      console.log('✅ Expense saved successfully')
    } catch (error) {
      console.error('❌ Error saving expense:', error)
      alert('Errore durante il salvataggio della spesa')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      category: 'Cibo', // Default category since it's not stored in the expense
      eventId: expense.eventId || '',
      participants: expense.participants.map(p => p.userId)
    })
    setShowForm(true)
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return

    try {
      await expenseService.delete(expenseId)
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId))
      console.log('✅ Expense deleted successfully')
    } catch (error) {
      console.error('❌ Error deleting expense:', error)
      alert('Errore durante l\'eliminazione della spesa')
    }
  }

  // Filtro spese
  const filteredExpenses = expenses.filter(expense => {
    const matchesFilter = 
      selectedFilter === 'all' || 
      (selectedFilter === 'paid' && expense.paidBy === currentUserId) ||
      (selectedFilter === 'owed' && expense.participants.some(p => p.userId === currentUserId))
    
    const matchesEvent = selectedEvent === 'all' || expense.eventId === selectedEvent
    
    return matchesFilter && matchesEvent
  })

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">💰</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Caricamento spese...</h3>
          <p className="text-gray-500">Connessione a Firebase in corso</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Accesso richiesto</h3>
          <p className="text-gray-500">Effettua l'accesso per vedere le spese</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Spese 💰</h1>
            <p className="text-gray-600">Gestisci le spese di gruppo e i saldi</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Lista Spese
            </button>
            <button
              onClick={() => setViewMode('settlement')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'settlement' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Chi deve a Chi
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'settlement' ? (
        <ExpenseSettlement 
          expenses={expenses}
          payments={payments}
          events={events}
          currentUserId={currentUserId}
          onPaymentRecorded={async () => {
            const newPayments = await paymentService.getAll()
            setPayments(newPayments)
          }}
        />
      ) : (
        <>
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
            Tutte ({expenses.length})
          </button>
          <button
            onClick={() => setSelectedFilter('paid')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'paid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pagate da me ({expenses.filter(e => e.paidBy === currentUserId).length})
          </button>
          <button
            onClick={() => setSelectedFilter('owed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'owed'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Che mi riguardano ({expenses.filter(e => e.participants.some(p => p.userId === currentUserId)).length})
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
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista Spese */}
      <div className="space-y-4">
        {filteredExpenses.map(expense => {
          const eventName = events.find(e => e.id === expense.eventId)?.title
          const paidByName = events.find(e => e.id === expense.eventId)?.participants.find(p => p.userId === expense.paidBy)?.name || expense.paidBy
          
          return (
            <div key={expense.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="text-2xl">
                    {getCategoryIcon('Cibo')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-800">{expense.title}</h3>
                      {eventName && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {eventName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Pagato da <span className="font-medium">{paidByName}</span> • {formatDate(expense.createdAt)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {expense.participants.length} partecipanti: {expense.participants.map(p => p.name).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">€{expense.amount.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">
                      €{(expense.amount / expense.participants.length).toFixed(2)} a testa
                    </p>
                    {expense.paidBy === currentUserId && (
                      <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        Hai pagato tu
                      </span>
                    )}
                  </div>
                  {/* Controlli modifica/cancellazione per chi ha creato la spesa */}
                  {expense.paidBy === currentUserId && (
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
          )
        })}
        
        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💸</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Nessuna spesa trovata</h3>
            <p className="text-gray-500">Non ci sono spese che corrispondono ai filtri selezionati</p>
          </div>
        )}
      </div>
      </>
      )}

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
                      <option key={event.id} value={event.id}>{event.title}</option>
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
                          onClick={() => setFormData(prev => ({ ...prev, participants: getAvailableParticipants().map(p => p.userId) }))}
                          className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Tutti i partecipanti ({getAvailableParticipants().length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, participants: getAvailableParticipants().map(p => p.userId) }))}
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
                          {getAvailableParticipants().map(participant => (
                            <label key={participant.userId} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={formData.participants.includes(participant.userId)}
                                  onChange={() => toggleParticipant(participant.userId)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 font-medium">{participant.name}</span>
                                {participant.userId === currentUserId && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">tu</span>
                                )}
                              </div>
                              {formData.participants.includes(participant.userId) && formData.amount && (
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
                    disabled={submitting}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Salvataggio...' : (editingExpense ? 'Salva' : 'Aggiungi')}
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