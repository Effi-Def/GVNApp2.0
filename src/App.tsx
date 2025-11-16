import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout/Layout'
import { checkFirebaseConfig, debugFirebaseConfig } from './firebase/utils'
import HomePage from './pages/HomePage'
import EventsPage from './pages/EventsPage-complete'
import ExpensesPage from './pages/ExpensesPage-firebase'
import PollsPage from './pages/PollsPage-firebase'
import ListsPage from './pages/ListsPage-firebase'
import LoginPage from './pages/LoginPage'
import { useAuthStore } from './stores/useAuthStore'
import EventSummary from './pages/EventSummary'
import SettingsPage from './pages/SettingsPage'
import NotificationsPage from './pages/NotificationsPage'
import NotificationPreferencesPage from './pages/NotificationPreferencesPage'
import PublicEvent from './pages/PublicEvent'
import ChatsPage from './pages/ChatsPage'
import EventChatPage from './pages/EventChatPage'

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
  const location = useLocation()
  const navigate = useNavigate()

  // Allow public share routes without requiring authentication
  const isPublicShare = location.pathname.startsWith('/share/e/')

  console.log('🔍 AppContent render:', { loading, hasUser: !!user, userId: user?.id, email: user?.email, pathname: location.pathname })

  // Handle post-login redirect when user becomes available
  useEffect(() => {
    if (!loading && user) {
      try {
        const target = sessionStorage.getItem('postLoginRedirect')
        if (target && typeof target === 'string') {
          console.log('🔀 Post-login redirect to:', target)
          sessionStorage.removeItem('postLoginRedirect')
          navigate(target, { replace: true })
        }
      } catch (e) {
        console.warn('⚠️ Post-login redirect failed:', e)
      }
    }
  }, [user, loading, navigate])

  if (loading) {
    console.log('⏳ Showing loading spinner...')
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user && !isPublicShare) {
    console.log('🔒 No user, showing LoginPage')
    return <LoginPage />
  }

  // When on public share, render only the public routes without the authenticated layout
  if (isPublicShare) {
    return (
      <Routes>
        <Route path="/share/e/:id" element={<PublicEvent />} />
        {/* Fallback to login for any other path while unauthenticated */}
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id/summary" element={<EventSummary />} />
  <Route path="/events/:id/chat" element={<EventChatPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/polls" element={<PollsPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
  <Route path="/notifications/settings" element={<NotificationPreferencesPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        {/* Also accept share route here to support direct navigation when authenticated */}
        <Route path="/share/e/:id" element={<PublicEvent />} />
      </Routes>
    </Layout>
  )
}

export default App
