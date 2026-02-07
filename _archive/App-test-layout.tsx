import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'

// Componente di test semplice per HomePage
const TestHomePage = () => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block animate-float mb-4">
          <span className="text-6xl">🐷</span>
        </div>
        <h1 className="gvn-title text-4xl mb-4">
          GVNApp 2.0 - Test Layout
        </h1>
        <p className="text-lg text-neutral-600 mb-8">
          Test del layout senza Firebase
        </p>
      </div>
      
      <div className="gvn-card p-8 text-center">
        <h2 className="text-2xl font-semibold text-primary-700 mb-4">
          ✅ Layout Test
        </h2>
        <p className="text-neutral-600">
          Se vedi questo, il layout di base funziona!
        </p>
      </div>
    </div>
  </div>
)

// Componente temporaneo per le pagine
const TempPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="p-8">
    <div className="max-w-4xl mx-auto">
      <div className="gvn-card p-8 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="gvn-title text-3xl mb-4">{title}</h1>
        <p className="text-neutral-600 mb-6">Pagina di test...</p>
      </div>
    </div>
  </div>
)

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<TestHomePage />} />
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
