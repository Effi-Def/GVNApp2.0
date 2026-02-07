import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

// Componente temporaneo per le pagine
const TempPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 p-8">
    <div className="max-w-4xl mx-auto">
      <div className="gvn-card p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="gvn-title text-3xl mb-4">{title}</h1>
        <p className="text-neutral-600">Pagina in costruzione...</p>
      </div>
    </div>
  </div>
)

// Homepage semplificata
const HomePage = () => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 p-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block animate-float mb-4">
          <span className="text-6xl">🐷</span>
        </div>
        <h1 className="gvn-title text-4xl mb-4">
          GVNApp 2.0
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          Benvenuto nella tua app per organizzare eventi sociali!
        </p>
      </div>
      
      {/* Grid delle sezioni principali */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="gvn-card p-6 text-center hover:scale-105 transition-transform">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold text-neutral-800 mb-2">Eventi</h3>
          <p className="text-sm text-neutral-600">Organizza i tuoi eventi</p>
        </div>
        
        <div className="gvn-card p-6 text-center hover:scale-105 transition-transform">
          <div className="text-4xl mb-3">💰</div>
          <h3 className="font-semibold text-neutral-800 mb-2">Spese</h3>
          <p className="text-sm text-neutral-600">Gestisci le spese</p>
        </div>
        
        <div className="gvn-card p-6 text-center hover:scale-105 transition-transform">
          <div className="text-4xl mb-3">🗳️</div>
          <h3 className="font-semibold text-neutral-800 mb-2">Sondaggi</h3>
          <p className="text-sm text-neutral-600">Crea votazioni</p>
        </div>
        
        <div className="gvn-card p-6 text-center hover:scale-105 transition-transform">
          <div className="text-4xl mb-3">📝</div>
          <h3 className="font-semibold text-neutral-800 mb-2">Liste</h3>
          <p className="text-sm text-neutral-600">Organizza todo</p>
        </div>
      </div>

      <div className="gvn-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-primary-700 mb-4">
          🎉 App Base Ripristinata!
        </h2>
        <p className="text-neutral-600 mb-6">
          Router attivo, design system funzionante. Prossimi passi: Auth e dati.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="gvn-btn-primary">
            🚀 Continua Setup
          </button>
        </div>
      </div>
    </div>
  </div>
)

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<TempPage title="Eventi" icon="📅" />} />
        <Route path="/expenses" element={<TempPage title="Spese" icon="💰" />} />
        <Route path="/polls" element={<TempPage title="Sondaggi" icon="🗳️" />} />
        <Route path="/lists" element={<TempPage title="Liste" icon="📝" />} />
      </Routes>
    </Router>
  )
}

export default App
