import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import { AuthProvider } from './contexts/AuthContext-new'
import Layout from './components/Layout/Layout'
import EventsPage from './pages/EventsPage-new'

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

// Importiamo le HomePage originale
import HomePage from './pages/HomePage'

// Componente temporaneo per le pagine
const TempPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="gvn-card p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="gvn-title text-3xl mb-4">{title}</h1>
        <p className="text-neutral-600 mb-6">Pagina in costruzione con dati reali...</p>
      </div>
    </div>
  </div>
)

function AppContent() {
  const { user, loading } = useAuthStore()
  
  if (loading) {
    return <LoadingScreen />
  }
  
  if (!user) {
    return <LoginPage />
  }
  
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
