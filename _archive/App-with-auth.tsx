import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

// Mock user per testing
const mockUser = {
  id: '1',
  displayName: 'Mario Rossi',
  email: 'mario@example.com'
}

// Simple Auth Context (mock)
const useAuth = () => {
  const [user, setUser] = useState<typeof mockUser | null>(null)
  const [loading, setLoading] = useState(false)
  
  const login = () => {
    setLoading(true)
    setTimeout(() => {
      setUser(mockUser)
      setLoading(false)
    }, 1000)
  }
  
  const logout = () => {
    setUser(null)
  }
  
  return { user, loading, login, logout }
}

// Login Page
const LoginPage = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-8">
    <div className="gvn-card p-8 max-w-md w-full text-center">
      <div className="text-6xl mb-6">🐷</div>
      <h1 className="gvn-title text-3xl mb-4">GVNApp 2.0</h1>
      <p className="text-neutral-600 mb-8">
        Accedi per organizzare eventi e gestire spese con i tuoi amici
      </p>
      <button onClick={onLogin} className="gvn-btn-primary w-full">
        🚀 Accedi (Demo)
      </button>
      <p className="text-xs text-neutral-500 mt-4">
        Versione demo - click per entrare
      </p>
    </div>
  </div>
)

// Loading component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
      <p className="text-neutral-600">Caricamento...</p>
    </div>
  </div>
)

// Componente di navigazione con user menu
const SimpleNav = ({ user, onLogout }: { user: typeof mockUser, onLogout: () => void }) => {
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
              Ciao, {user.displayName?.split(' ')[0]}!
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

// Layout wrapper che include la navigazione
const Layout = ({ children, user, onLogout }: { children: React.ReactNode, user: typeof mockUser, onLogout: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
    <SimpleNav user={user} onLogout={onLogout} />
    <main>{children}</main>
  </div>
)

// Componente temporaneo per le pagine
const TempPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="gvn-card p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="gvn-title text-3xl mb-4">{title}</h1>
        <p className="text-neutral-600 mb-6">Pagina in costruzione...</p>
        <Link to="/" className="gvn-btn-primary inline-block">
          🏠 Torna alla Home
        </Link>
      </div>
    </div>
  </div>
)

// Homepage con dati utente
const HomePage = ({ user }: { user: typeof mockUser }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block animate-float mb-4">
          <span className="text-6xl">🐷</span>
        </div>
        <h1 className="gvn-title text-4xl mb-4">
          Ciao {user.displayName?.split(' ')[0]}!
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          Benvenuto nella tua dashboard per organizzare eventi sociali
        </p>
      </div>
      
      {/* Stats rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="gvn-card p-6 text-center">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-2xl font-bold text-primary-700">3</div>
          <div className="text-sm text-neutral-600">Eventi in programma</div>
        </div>
        <div className="gvn-card p-6 text-center">
          <div className="text-3xl mb-2">💰</div>
          <div className="text-2xl font-bold text-green-600">+€15.50</div>
          <div className="text-sm text-neutral-600">Il tuo bilancio</div>
        </div>
        <div className="gvn-card p-6 text-center">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-2xl font-bold text-accent-600">12</div>
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

      <div className="gvn-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-primary-700 mb-4">
          🎉 Autenticazione Mock Attiva!
        </h2>
        <p className="text-neutral-600 mb-6">
          Sistema di login/logout funzionante. Prossimo passo: integrare i dati reali.
        </p>
        <div className="gvn-badge-pig">
          Versione: Demo con Auth Mock
        </div>
      </div>
    </div>
  </div>
)

function App() {
  const { user, loading, login, logout } = useAuth()
  
  if (loading) {
    return <LoadingScreen />
  }
  
  if (!user) {
    return <LoginPage onLogin={login} />
  }
  
  return (
    <Router>
      <Layout user={user} onLogout={logout}>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/events" element={<TempPage title="Eventi" icon="📅" />} />
          <Route path="/expenses" element={<TempPage title="Spese" icon="💰" />} />
          <Route path="/polls" element={<TempPage title="Sondaggi" icon="🗳️" />} />
          <Route path="/lists" element={<TempPage title="Liste" icon="📝" />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
