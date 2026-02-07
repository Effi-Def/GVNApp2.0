import { useState, useEffect } from 'react'
import { Expense } from '../types'
import { useAppStore } from '../stores/AppStore'
import { expenseService } from '../services/firestore'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseCard from '../components/ExpenseCard'
import { useAuthStore } from '../stores/useAuthStore'

const ExpensesPage = () => {
  const { expenses, events, setExpenses, addExpense, updateExpense, deleteExpense } = useAppStore()
  const { user } = useAuthStore()
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExpenses()
  }, [user, events]) // Ricarica quando cambiano utente o eventi

  const loadExpenses = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      console.log('💰 Loading expenses with privacy filter...')
      
      // Ottieni gli eventi a cui l'utente partecipa
      const userEvents = events
        .filter(event => event.participants.some(p => p.userId === user.id))
        .map(event => event.id)
      
      console.log(`🔒 User participates in ${userEvents.length} events`)
      
      // Carica solo le spese filtrate per privacy
      const expensesData = await expenseService.getByUserParticipation(user.id, userEvents)
      setExpenses(expensesData)
      console.log(`✅ Loaded ${expensesData.length} expenses with privacy filter`)
    } catch (err) {
      console.error('❌ Error loading expenses:', err)
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento delle spese')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setCreating(true)
      console.log('💰 Creating new expense...')
      
      const newExpense = await expenseService.create(expenseData)
      addExpense(newExpense)
      
      console.log('✅ Expense created and added to store')
      setShowForm(false)
    } catch (err) {
      console.error('❌ Error creating expense:', err)
      throw err
    } finally {
      setCreating(false)
    }
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  const handleUpdateExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingExpense) return
    
    try {
      setCreating(true)
      console.log('💰 Updating expense...')
      
      await expenseService.update(editingExpense.id, expenseData)
      
      const updatedExpense: Expense = {
        ...editingExpense,
        ...expenseData,
        updatedAt: new Date()
      }
      
      updateExpense(editingExpense.id, updatedExpense)
      
      console.log('✅ Expense updated successfully')
      setShowForm(false)
      setEditingExpense(null)
    } catch (err) {
      console.error('❌ Error updating expense:', err)
      throw err
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa?')) return
    
    try {
      console.log('💰 Deleting expense...')
      await expenseService.delete(expenseId)
      deleteExpense(expenseId)
      console.log('✅ Expense deleted successfully')
    } catch (err) {
      console.error('❌ Error deleting expense:', err)
      alert('Errore durante l\'eliminazione della spesa')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingExpense(null)
  }

  const calculateUserBalance = () => {
    if (!user) return 0
    
    return expenses.reduce((balance, expense) => {
      const userParticipation = expense.participants.find(p => p.userId === user.id)
      if (!userParticipation) return balance

      if (expense.paidBy === user.id) {
        // User paid, should receive from others
        const totalOwed = expense.participants
          .filter(p => p.userId !== user.id)
          .reduce((sum, p) => sum + p.amount, 0)
        return balance + totalOwed
      } else {
        // User owes money
        return balance - userParticipation.amount
      }
    }, 0)
  }

  // Filtra le spese in base all'evento selezionato
  const filteredExpenses = selectedEventId === 'all' 
    ? expenses 
    : expenses.filter(expense => expense.eventId === selectedEventId)

  const userBalance = calculateUserBalance()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Spese</h1>
          <div className="flex items-center gap-3 mt-2">
            <label htmlFor="event-filter" className="text-sm font-medium text-gray-700">
              Filtra per evento:
            </label>
            <select
              id="event-filter"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Tutti gli eventi</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center"
        >
          <span className="mr-2">+</span>
          Nuova Spesa
        </button>
      </div>

      {/* Balance Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo Bilancio</h2>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Il tuo bilancio totale:</span>
          <span className={`text-2xl font-bold ${
            userBalance > 0 ? 'text-green-600' : userBalance < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {userBalance > 0 ? '+' : ''}{userBalance.toFixed(2)}€
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {userBalance > 0 
            ? 'Devi ricevere denaro dal gruppo' 
            : userBalance < 0 
            ? 'Devi pagare al gruppo' 
            : 'Sei in pari con tutti'
          }
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-400 mr-2">❌</div>
            <div>
              <h3 className="text-red-800 font-medium">Errore</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <button
                onClick={loadExpenses}
                className="text-red-600 hover:text-red-500 text-sm font-medium mt-2"
              >
                Riprova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600">Caricamento spese...</span>
          </div>
        </div>
      )}

      {/* Expenses List */}
      {!loading && !error && (
        <>
          {filteredExpenses.length > 0 ? (
            <div className="space-y-4">
              {filteredExpenses.map(expense => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onEdit={handleEditExpense}
                  onDelete={handleDeleteExpense}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">💰</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna spesa ancora</h3>
              <p className="text-gray-500 mb-6">
                Aggiungi la tua prima spesa per iniziare a tracciare i costi del gruppo!
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Aggiungi prima spesa
              </button>
            </div>
          )}
        </>
      )}

      {/* Expense Form Modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense || undefined}
          onSubmit={editingExpense ? handleUpdateExpense : handleCreateExpense}
          onClose={handleCloseForm}
          isLoading={creating}
        />
      )}
    </div>
  )
}

export default ExpensesPage
