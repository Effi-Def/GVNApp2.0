import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'

// Componente di navigazione semplice
const SimpleNav = () => {
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
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
    <SimpleNav />
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

// Homepage migliorata
const HomePage = () => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block animate-float mb-4">
          <span className="text-6xl">🐷</span>
        </div>
        <h1 className="gvn-title text-4xl mb-4">
          Benvenuto in GVNApp 2.0
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          La tua app per organizzare eventi sociali e gestire spese di gruppo
        </p>
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
          🎉 Navigazione Attiva!
        </h2>
        <p className="text-neutral-600 mb-6">
          Puoi ora navigare tra le diverse sezioni dell'app. Clicca sui bottoni sopra o usa la navigazione.
        </p>
        <div className="gvn-badge-pig">
          Prossimo: Autenticazione e dati
        </div>
      </div>
    </div>
  </div>
)

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
