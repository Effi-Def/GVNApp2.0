import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from './stores/useAuthStore'
import { useAppStore } from './stores/AppStore'
import { eventService } from './services/firestore'
import { AuthProvider } from './contexts/AuthContext-new'
import EventsPage from './pages/EventsPage-new'
import Layout from './components/Layout/Layout'

// Loading component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
      <p className="text-neutral-600">Caricamento...</p>
    </div>
  </div>
)

// Login Page integrato con Firebase
const LoginPage = () => {
  const { loginWithGoogle, loading } = useAuthStore()
  
  const handleLogin = async () => {
    try {
      await loginWithGoogle()
    } catch (error) {
      console.error('Errore durante il login:', error)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-8">
      <div className="gvn-card p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-6">🐷</div>
        <h1 className="gvn-title text-3xl mb-4">GVNApp 2.0</h1>
        <p className="text-neutral-600 mb-8">
          Accedi per organizzare eventi e gestire spese con i tuoi amici
        </p>
        <button 
          onClick={handleLogin} 
          disabled={loading}
          className="gvn-btn-primary w-full disabled:opacity-50"
        >
          {loading ? '⏳ Accesso...' : '🚀 Accedi con Google'}
        </button>
        <p className="text-xs text-neutral-500 mt-4">
          Utilizza il tuo account Google per accedere
        </p>
      </div>
    </div>
  )
}

// Componente di navigazione con user reale
const SimpleNav = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/events', label: 'Eventi', icon: '📅' },
    { path: '/expenses', label: 'Spese', icon: '💰' },
    { path: '/polls', label: 'Sondaggi', icon: '🗳️' },
    { path: '/lists', label: 'Liste', icon: '📝' }
  ]
  
  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐷</span>
            <span className="text-xl font-bold text-primary-700">GVNApp</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-neutral-600 hover:text-primary-600 hover:bg-neutral-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600 hidden sm:block">
              Ciao, {user?.displayName?.split(' ')[0] || 'Utente'}!
            </span>
            <button onClick={onLogout} className="text-neutral-500 hover:text-neutral-700 px-2 py-1 rounded">
              🚪
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t border-neutral-200">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                isActive(item.path)
                  ? 'text-primary-700 font-medium'
                  : 'text-neutral-500 hover:text-primary-600'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

// (Layout già importato sopra)

// Componente temporaneo per le pagine
const TempPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="gvn-card p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="gvn-title text-3xl mb-4">{title}</h1>
        <p className="text-neutral-600 mb-6">Pagina in costruzione con dati reali...</p>
        <Link to="/" className="gvn-btn-primary inline-block">
          🏠 Torna alla Home
        </Link>
      </div>
    </div>
  </div>
)

// Homepage con dati reali da Firebase
const HomePage = ({ user }: { user: any }) => {
  const { events, expenses, setEvents } = useAppStore()
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Carica gli eventi se non sono già presenti
  useEffect(() => {
    const loadEvents = async () => {
      if (user && events.length === 0 && !loadingEvents) {
        setLoadingEvents(true)
        try {
          const eventsData = await eventService.getAll()
          setEvents(eventsData)
        } catch (error) {
          console.error('Error loading events:', error)
        } finally {
          setLoadingEvents(false)
        }
      }
    }
    
    loadEvents()
  }, [user, events.length, setEvents, loadingEvents])

  // Calcola statistiche reali
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.date)
    eventDate.setHours(0, 0, 0, 0)
    return eventDate >= today
  })

  const userBalance = expenses.reduce((balance, expense) => {
    const userParticipation = expense.participants.find(p => p.userId === user?.id)
    if (!userParticipation) return balance

    if (expense.paidBy === user?.id) {
      const totalOwed = expense.participants
        .filter(p => p.userId !== user?.id)
        .reduce((sum, p) => sum + p.amount, 0)
      return balance + totalOwed
    } else {
      return balance - userParticipation.amount
    }
  }, 0)

  const uniqueParticipants = new Set()
  events.forEach(event => {
    event.participants.forEach(p => uniqueParticipants.add(p.userId))
  })

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block animate-float mb-4">
            <span className="text-6xl">🐷</span>
          </div>
          <h1 className="gvn-title text-4xl mb-4">
            Ciao {user?.displayName?.split(' ')[0] || 'Amico'}!
          </h1>
          <p className="text-lg text-neutral-600 mb-8">
            Benvenuto nella tua dashboard. Gestisci eventi, spese e divertiti con i tuoi amici! 🎉
          </p>
        </div>
        
        {/* Stats reali da Firebase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="gvn-card p-6 text-center">
            <div className="text-3xl mb-2">📅</div>
            <div className="text-2xl font-bold text-primary-700">
              {loadingEvents ? '...' : upcomingEvents.length}
            </div>
            <div className="text-sm text-neutral-600">Eventi in programma</div>
          </div>
          <div className="gvn-card p-6 text-center">
            <div className="text-3xl mb-2">💰</div>
            <div className={`text-2xl font-bold ${userBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {userBalance >= 0 ? '+' : ''}€{userBalance.toFixed(2)}
            </div>
            <div className="text-sm text-neutral-600">Il tuo bilancio</div>
          </div>
          <div className="gvn-card p-6 text-center">
            <div className="text-3xl mb-2">👥</div>
            <div className="text-2xl font-bold text-accent-600">{uniqueParticipants.size}</div>
            <div className="text-sm text-neutral-600">Amici attivi</div>
          </div>
        </div>
        
        {/* Grid delle sezioni principali */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/events" className="gvn-card p-6 text-center hover:scale-105 transition-transform block">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="font-semibold text-neutral-800 mb-2">Eventi</h3>
            <p className="text-sm text-neutral-600">Organizza i tuoi eventi</p>
          </Link>
          
          <Link to="/expenses" className="gvn-card p-6 text-center hover:scale-105 transition-transform block">
            <div className="text-4xl mb-3">💰</div>
            <h3 className="font-semibold text-neutral-800 mb-2">Spese</h3>
            <p className="text-sm text-neutral-600">Gestisci le spese</p>
          </Link>
          
          <Link to="/polls" className="gvn-card p-6 text-center hover:scale-105 transition-transform block">
            <div className="text-4xl mb-3">🗳️</div>
            <h3 className="font-semibold text-neutral-800 mb-2">Sondaggi</h3>
            <p className="text-sm text-neutral-600">Crea votazioni</p>
          </Link>
          
          <Link to="/lists" className="gvn-card p-6 text-center hover:scale-105 transition-transform block">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="font-semibold text-neutral-800 mb-2">Liste</h3>
            <p className="text-sm text-neutral-600">Organizza todo</p>
          </Link>
        </div>

        {/* Eventi in programma */}
        {upcomingEvents.length > 0 && (
          <div className="gvn-card p-6 mb-8">
            <h2 className="text-xl font-semibold text-neutral-800 mb-4 flex items-center gap-2">
              📅 Prossimi Eventi
              <span className="gvn-badge-secondary text-sm">{upcomingEvents.length}</span>
            </h2>
            <div className="space-y-3">
              {upcomingEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                  <div>
                    <h3 className="font-medium text-neutral-800">{event.title}</h3>
                    <p className="text-sm text-neutral-600">
                      📍 {event.location} • 📅 {new Date(event.date).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <div className="text-2xl">🎯</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="gvn-card p-8 text-center">
          <h2 className="text-2xl font-semibold text-primary-700 mb-4">
            🔥 Firebase Integrato!
          </h2>
          <p className="text-neutral-600 mb-6">
            Ora usi dati reali da Firebase. Stats e eventi sono sincronizzati dal database.
          </p>
          <div className="gvn-badge-pig">
            Versione: Produzione con Firebase
          </div>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading, logout } = useAuthStore()
  
  if (loading) {
    return <LoadingScreen />
  }
  
  if (!user) {
    return <LoginPage />
  }
  
  return (
    <Router>
      <Layout user={user} onLogout={logout}>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/expenses" element={<TempPage title="Spese" icon="💰" />} />
          <Route path="/polls" element={<TempPage title="Sondaggi" icon="🗳️" />} />
          <Route path="/lists" element={<TempPage title="Liste" icon="📝" />} />
        </Routes>
      </Layout>
    </Router>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
