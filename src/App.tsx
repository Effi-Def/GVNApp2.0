import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import { checkFirebaseConfig, debugFirebaseConfig } from './firebase/utils'
import HomePage from './pages/HomePage'
import EventsPage from './pages/EventsPage-complete'
import ExpensesPage from './pages/ExpensesPage-hybrid'
import PollsPage from './pages/PollsPage-firebase'
import ListsPage from './pages/ListsPage-firebase'
import LoginPage from './pages/LoginPage'
import { useAuthStore } from './stores/useAuthStore'
import EventSummary from './pages/EventSummary'
import SettingsPage from './pages/SettingsPage'

function App() {
  // Check Firebase configuration in development
  if (import.meta.env.DEV) {
    checkFirebaseConfig()
    debugFirebaseConfig()
  }

  return (
    <Router>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id/summary" element={<EventSummary />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/polls" element={<PollsPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  )
}

export default App
