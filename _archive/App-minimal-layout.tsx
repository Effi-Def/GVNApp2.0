import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'

// Layout minimo inline
const MinimalLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/events', label: 'Eventi', icon: '📅' },
    { path: '/expenses', label: 'Spese', icon: '💰' },
    { path: '/polls', label: 'Sondaggi', icon: '🗳️' },
    { path: '/lists', label: 'Liste', icon: '📝' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      {/* Header semplice */}
      <header className="bg-white shadow-sm border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐷</span>
              <span className="text-xl font-bold text-primary-700">GVNApp</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'text-neutral-600 hover:text-primary-600'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-16 md:pb-0">
        {children}
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                location.pathname === item.path
                  ? 'text-primary-700 font-medium'
                  : 'text-neutral-500'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

// Componente di test semplice per HomePage
const TestHomePage = () => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block animate-float mb-4">
          <span className="text-6xl">🐷</span>
        </div>
        <h1 className="text-4xl font-bold text-primary-700 mb-4">
          GVNApp 2.0 Test
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          Layout minimo funzionante!
        </p>
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <h2 className="text-2xl font-semibold text-primary-700 mb-4">
          ✅ Layout Funziona!
        </h2>
        <p className="text-neutral-600">
          Se vedi questo, il layout di base è operativo
        </p>
      </div>
    </div>
  </div>
)

// Componente temporaneo per le pagine
const TempPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="text-3xl font-bold text-primary-700 mb-4">{title}</h1>
        <p className="text-neutral-600 mb-6">Pagina di test...</p>
      </div>
    </div>
  </div>
)

function App() {
  return (
    <Router>
      <MinimalLayout>
        <Routes>
          <Route path="/" element={<TestHomePage />} />
          <Route path="/events" element={<TempPage title="Eventi" icon="📅" />} />
          <Route path="/expenses" element={<TempPage title="Spese" icon="💰" />} />
          <Route path="/polls" element={<TempPage title="Sondaggi" icon="🗳️" />} />
          <Route path="/lists" element={<TempPage title="Liste" icon="📝" />} />
        </Routes>
      </MinimalLayout>
    </Router>
  )
}

export default App
