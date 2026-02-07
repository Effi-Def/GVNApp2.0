import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import Layout from './components/Layout/Layout'
import { checkFirebaseConfig, debugFirebaseConfig } from './firebase/utils'
import HomePage from './pages/HomePage'
import EventsPage from './pages/EventsPage'
import ExpensesPage from './pages/ExpensesPage'
import PollsPage from './pages/PollsPage'
import ListsPage from './pages/ListsPage'
import LoginPage from './pages/LoginPage'
import { loadUserData, useAuthStore } from './stores/useAuthStore'
import { useUserSettingsStore } from './stores/UserSettingsStore'
import { initMessaging } from './firebase/messaging'
import { startNotificationsListeners } from './services/notifications'
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
  const lastResumeRefreshAt = useRef(0)

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

  // Initialize notifications and user settings on login
  useEffect(() => {
    if (user) {
      const initUser = async () => {
        try {
          // 1. Load user settings (notifications, profile)
          await useUserSettingsStore.getState().loadFromFirestore(user.id)
          
          // 2. Check if push is enabled and init messaging
          const { notifications } = useUserSettingsStore.getState()
          if (notifications.pushEnabled) {
            console.log('🔔 Push enabled in settings, initializing messaging...')
            await initMessaging(user.id)
          }
        } catch (e) {
          console.error('❌ Error initializing user settings:', e)
        }
      }
      initUser()
    }
  }, [user])

  // Start realtime listener for in-app notifications (users/{uid}/notifications)
  useEffect(() => {
    if (!user?.id) return
    const unsubscribe = startNotificationsListeners(user.id)
    return () => {
      try { unsubscribe?.() } catch {}
    }
  }, [user?.id])

  // Refresh app data when returning to the app (Android often suspends background PWAs).
  useEffect(() => {
    if (!user?.id) return

    const maybeRefresh = async (reason: string) => {
      // Throttle to avoid repeated reloads on rapid focus/visibility changes
      const now = Date.now()
      if (now - lastResumeRefreshAt.current < 15000) return
      lastResumeRefreshAt.current = now
      try {
        console.log(`🔄 Resume refresh (${reason})...`)
        await loadUserData()
      } catch (e) {
        console.warn('⚠️ Resume refresh failed:', e)
      }
    }

    const onVisibility = () => {
      if (!document.hidden) {
        void maybeRefresh('visibility')
      }
    }
    const onFocus = () => {
      void maybeRefresh('focus')
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    // Also refresh once shortly after initial render when logged in
    void maybeRefresh('initial')

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id])

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
          <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
          {/* Backward compatible alias */}
          <Route path="/notifications/settings" element={<NotificationPreferencesPage />} />
        <Route path="/chats" element={<ChatsPage />} />
        {/* Also accept share route here to support direct navigation when authenticated */}
        <Route path="/share/e/:id" element={<PublicEvent />} />
      </Routes>
    </Layout>
  )
}

export default App
