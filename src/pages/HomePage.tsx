import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/AppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { eventService, expenseService } from '../services/firestore'

const HomePage = () => {
  const { user } = useAuthStore()
  const { events, expenses, setEvents, setExpenses } = useAppStore()
  
  const [isLoading, setIsLoading] = useState(false)

  // Funzione per ricaricare i dati manualmente
  const refreshData = async () => {
    if (!user?.uid) return
    
    console.log('🔄 HomePage: Manual data refresh...')
    setIsLoading(true)
    
    try {
      const [eventsData, expensesData] = await Promise.all([
        eventService.getEvents(user.uid),
        expenseService.getExpenses(user.uid)
      ])
      
      console.log('🔄 HomePage: Refreshed data:', { events: eventsData.length, expenses: expensesData.length })
      setEvents(eventsData)
      setExpenses(expensesData)
    } catch (error) {
      console.error('❌ HomePage: Error refreshing data:', error)
      // Fallback ai dati mock
      const mockData = await import('../data/mockData')
      setEvents(mockData.mockEvents)
      setExpenses(mockData.mockExpenses)
    } finally {
      setIsLoading(false)
    }
  }

  // Fallback data loading se l'AppStore è vuoto
  useEffect(() => {
    const loadDataFallback = async () => {
      if (!user?.uid) return
      
      // Controlla se i dati sono già caricati
      if (events.length > 0 || expenses.length > 0) return
      
      console.log('📱 HomePage: Loading fallback data...')
      setIsLoading(true)
      
      try {
        // Prova Firebase prima
        const [eventsData, expensesData] = await Promise.all([
          eventService.getEvents(user.uid),
          expenseService.getExpenses(user.uid)
        ])
        
        if (eventsData.length > 0 || expensesData.length > 0) {
          console.log('🔥 HomePage: Loaded from Firebase:', { events: eventsData.length, expenses: expensesData.length })
          setEvents(eventsData)
          setExpenses(expensesData)
        } else {
          // Fallback ai dati mock
          console.log('🎭 HomePage: Using mock data fallback')
          const mockData = await import('../data/mockData')
          setEvents(mockData.mockEvents)
          setExpenses(mockData.mockExpenses)
        }
      } catch (error) {
        console.error('❌ HomePage: Error loading data:', error)
        // Fallback ai dati mock in caso di errore
        try {
          const mockData = await import('../data/mockData')
          setEvents(mockData.mockEvents)
          setExpenses(mockData.mockExpenses)
        } catch (mockError) {
          console.error('❌ HomePage: Error loading mock data:', mockError)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadDataFallback()
  }, [user?.uid, events.length, expenses.length, setEvents, setExpenses])

  // Prendi i prossimi 3-5 eventi
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.date)
      eventDate.setHours(0, 0, 0, 0)
      return eventDate >= today
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  const nextUpcomingEvents = upcomingEvents.slice(0, 5)

  // Calcola il bilancio delle spese per l'utente corrente (stesso algoritmo di ExpensesPage-hybrid)
  const currentUserId = user?.id || user?.email || 'mock-user'
  
  const userBalance = expenses.reduce((balance, expense) => {
    const userParticipation = expense.participants.find(p => p.userId === currentUserId)
    if (!userParticipation) return balance

    if (expense.paidBy === currentUserId) {
      // L'utente ha pagato, deve ricevere dagli altri (solo da quelli non settled)
      const totalOwed = expense.participants
        .filter(p => p.userId !== currentUserId && !p.settled)
        .reduce((sum, p) => sum + p.amount, 0)
      return balance + totalOwed
    } else if (!userParticipation.settled) {
      // L'utente deve pagare (solo se non già settled)
      return balance - userParticipation.amount
    }
    return balance
  }, 0)

  console.log('🏠 HomePage Balance Calculation:', { 
    currentUserId, 
    expensesCount: expenses.length, 
    userBalance,
    expenses: expenses.map(e => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      paidBy: e.paidBy,
      userParticipation: e.participants.find(p => p.userId === currentUserId)
    }))
  })

  return (
    <div className="space-y-8 pb-8">
      {/* Loading state */}
      {isLoading && (
        <div className="gvn-card p-6 bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
          <div className="flex items-center space-x-3">
            <div className="animate-spin h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full"></div>
            <span className="text-primary-700 font-medium">Caricamento dati in corso...</span>
          </div>
        </div>
      )}

      {/* Hero Header con mascotte */}
      <div className="gvn-card p-8 bg-gradient-to-br from-primary-50 via-white to-accent-50 border-primary-100 relative overflow-hidden">
        {/* Mascotte floating */}
        <div className="absolute top-4 right-6 text-4xl animate-float opacity-60">
          🐷
        </div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <h1 className="gvn-title text-3xl lg:text-4xl bg-gradient-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent">
                Ciao, {user?.displayName?.split(' ')[0] || 'Amico'}!
              </h1>
              <span className="text-2xl animate-bounce">👋</span>
            </div>
            <p className="text-neutral-600 text-lg font-medium">
              Benvenuto nel tuo hub sociale del <span className="gvn-badge-pig">🐷 Gruppo GVN</span>
            </p>
            <p className="text-neutral-500 flex items-center gap-2">
              Gestisci eventi, spese e decisioni di gruppo tutto in un posto
              {/* Pulsante refresh dati */}
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="ml-2 p-1 rounded-full hover:bg-primary-100 transition-colors disabled:opacity-50"
                title="Aggiorna dati"
              >
                <span className={`text-sm ${isLoading ? 'animate-spin' : ''}`}>🔄</span>
              </button>
            </p>
          </div>
          <div className="hidden lg:block text-6xl opacity-20">
            🎉
          </div>
        </div>
      </div>

      {/* Stats Cards redesigned */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="gvn-card p-6 group hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Eventi Totali</p>
              <p className="gvn-title text-4xl text-primary-600">{events.length}</p>
              <p className="text-xs text-neutral-400">
                {upcomingEvents.length} in programma
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary-100 to-primary-200 p-4 rounded-2xl group-hover:scale-110 transition-transform">
              <span className="text-3xl">🎉</span>
            </div>
          </div>
        </div>

        <div className="gvn-card p-6 group hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Il Tuo Saldo</p>
              <p className={`gvn-title text-4xl ${userBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {userBalance >= 0 ? '+' : ''}€{userBalance.toFixed(2)}
              </p>
              <p className="text-xs text-neutral-400">
                {userBalance >= 0 ? 'Devi ricevere' : 'Devi pagare'}
              </p>
              {/* Debug info */}
              <p className="text-xs text-blue-400 opacity-70">
                📊 Dati: {events.length} eventi, {expenses.length} spese
              </p>
            </div>
            <div className={`bg-gradient-to-br p-4 rounded-2xl group-hover:scale-110 transition-transform ${
              userBalance >= 0 ? 'from-green-100 to-green-200' : 'from-red-100 to-red-200'
            }`}>
              <span className="text-3xl">{userBalance >= 0 ? '💚' : '💸'}</span>
            </div>
          </div>
        </div>

        <div className="gvn-card p-6 group hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Spese Totali</p>
              <p className="gvn-title text-4xl text-neutral-900">{expenses.length}</p>
              <p className="text-xs text-neutral-400">
                Condivise con il gruppo
              </p>
            </div>
            <div className="bg-gradient-to-br from-accent-100 to-accent-200 p-4 rounded-2xl group-hover:scale-110 transition-transform">
              <span className="text-3xl">💰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Prossimi Eventi - redesigned */}
      <div className="gvn-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="gvn-title text-2xl flex items-center space-x-3">
            <span>🎉</span>
            <span>Eventi in Programma</span>
          </h2>
          {nextUpcomingEvents.length > 0 && (
            <div className="gvn-badge-pig">
              <span>🐷</span>
              <span>{nextUpcomingEvents.length} eventi</span>
            </div>
          )}
        </div>
        
        {nextUpcomingEvents.length > 0 ? (
          <div className="space-y-4">
            {nextUpcomingEvents.map((event, index) => (
              <div key={event.id} className="relative">
                <div className="flex items-start space-x-4 p-4 rounded-xl bg-gradient-to-r from-neutral-50 to-transparent border border-neutral-100 hover:shadow-md transition-all duration-200">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg">
                      {new Date(event.date).getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-lg">{event.title}</h3>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-neutral-600">
                      <span className="flex items-center space-x-1">
                        <span>📅</span>
                        <span>{new Date(event.date).toLocaleDateString('it-IT')} alle {event.time}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <span>📍</span>
                        <span>{event.location}</span>
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                        {event.participants.filter(p => p.status === 'yes').length} confermati
                      </span>
                      {index === 0 && (
                        <span className="text-xs font-semibold text-accent-600 bg-accent-50 px-3 py-1 rounded-full animate-pulse">
                          🔥 Prossimo evento
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">📅</div>
            <h3 className="gvn-title text-xl text-neutral-600 mb-2">Nessun evento in programma</h3>
            <p className="text-neutral-500 mb-6">Crea il primo evento per il gruppo!</p>
            <button className="gvn-btn-primary">
              <span>🎉</span>
              <span>Crea Evento</span>
            </button>
          </div>
        )}
      </div>

      {/* Attività recenti - redesigned */}
      <div className="gvn-card p-8">
        <h2 className="gvn-title text-2xl flex items-center space-x-3 mb-6">
          <span>🔔</span>
          <span>Attività Recenti</span>
        </h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <span className="font-medium text-neutral-700">Nuovo evento creato: "Cena al ristorante"</span>
              <p className="text-sm text-neutral-500">2 ore fa</p>
            </div>
            <span className="text-xl">🎉</span>
          </div>
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-green-50 border border-green-100">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <span className="font-medium text-neutral-700">Marco ha confermato la partecipazione</span>
              <p className="text-sm text-neutral-500">5 ore fa</p>
            </div>
            <span className="text-xl">✅</span>
          </div>
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <div className="flex-1">
              <span className="font-medium text-neutral-700">Nuova spesa aggiunta: "Benzina viaggio"</span>
              <p className="text-sm text-neutral-500">1 giorno fa</p>
            </div>
            <span className="text-xl">💰</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export { HomePage }
export default HomePage
