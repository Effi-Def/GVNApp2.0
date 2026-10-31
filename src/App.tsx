import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef } from 'react'
import Layout from './components/Layout/Layout'
import { isE2EMode } from './e2e/runtime'
import { checkFirebaseConfig, debugFirebaseConfig } from './firebase/utils'
import { loadUserData, useAuthStore } from './stores/useAuthStore'
import { useUserSettingsStore } from './stores/UserSettingsStore'
import { initMessaging } from './firebase/messaging'
import { startNotificationsListeners } from './services/notifications'
import { initPresence } from './services/presence'
import { ActiveFarmProvider } from './contexts/FarmContext'
import ErrorBoundary from './components/ErrorBoundary'
import { useActiveFarmStore } from './stores/useActiveFarmStore'

// Lazy-loaded pages — Vite splits each page into a separate chunk automatically
const HomePage = lazy(() => import('./pages/HomePage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const PollsPage = lazy(() => import('./pages/PollsPage'))
const ListsPage = lazy(() => import('./pages/ListsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const EventSummary = lazy(() => import('./pages/EventSummary'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const FarmPage = lazy(() => import('./pages/FarmPage'))
const JoinFarmPage = lazy(() => import('./pages/JoinFarmPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage'))
const PublicEvent = lazy(() => import('./pages/PublicEvent'))
const ChatsPage = lazy(() => import('./pages/ChatsPage'))
const EventChatPage = lazy(() => import('./pages/EventChatPage'))
const FarmDashboardPage = lazy(() => import('./pages/FarmDashboardPage'))
const FarmEventPage = lazy(() => import('./pages/FarmEventPage'))
const FarmSettlementPage = lazy(() => import('./pages/FarmSettlementPage'))
const FarmMediaPage = lazy(() => import('./pages/FarmMediaPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const FarmChannelPage = lazy(() => import('./pages/FarmChannelPage'))

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
  </div>
)

function App() {
  // Check Firebase configuration in development (once on mount, not on every render)
  useEffect(() => {
    if (import.meta.env.DEV) {
      checkFirebaseConfig()
      debugFirebaseConfig()
    }
  }, [])

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

  const farms = useActiveFarmStore(s => s.farms)
  const initializingFarms = useActiveFarmStore(s => s.initializing)
  const initializedForUserId = useActiveFarmStore(s => s.initializedForUserId)

  // Allow public share routes without requiring authentication
  const isPublicShare = location.pathname.startsWith('/share/e/')

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
    if (!user) return
    if (isE2EMode()) return
    const initUser = async () => {
      try {
        // 1. Load user settings (notifications, profile)
        await useUserSettingsStore.getState().loadFromFirestore(user.id)

        // 2. Always try to init push notifications:
        //    - If permission is already 'granted' → init silently (no prompt)
        //    - If permission is 'default' → request it automatically, then init
        //    - If permission is 'denied' → skip silently
        const permissionStatus = typeof Notification !== 'undefined'
          ? Notification.permission
          : 'denied'

        if (permissionStatus === 'denied') {
          console.log('🔕 Notification permission denied by user, skipping FCM init')
          return
        }

        if (permissionStatus === 'default') {
          console.log('🔔 Requesting notification permission automatically...')
          const result = await Notification.requestPermission().catch(() => 'denied' as NotificationPermission)
          if (result !== 'granted') {
            console.log('🔕 Notification permission not granted:', result)
            return
          }
        }

        console.log('🔔 Notification permission granted, initializing FCM...')
        await initMessaging(user.id)
      } catch (e) {
        console.error('❌ Error initializing notifications:', e)
      }
    }
    initUser()
  }, [user])

  // Start realtime listener for in-app notifications (users/{uid}/notifications)
  useEffect(() => {
    if (!user?.id) return
    if (isE2EMode()) return
    const unsubscribe = startNotificationsListeners(user.id)
    return () => {
      try { unsubscribe?.() } catch {}
    }
  }, [user?.id])

  // RTDB presence: mark online on mount, offline on unmount/logout
  useEffect(() => {
    if (!user?.id) return
    if (isE2EMode()) return
    return initPresence(user.id)
  }, [user?.id])

  // Refresh app data when returning to the app (Android often suspends background PWAs).
  useEffect(() => {
    if (!user?.id) return
    if (isE2EMode()) return

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

  // Onboarding gate: if authenticated but has no farms, send to /onboarding.
  useEffect(() => {
    if (!user?.id) return
    if (initializingFarms) return
    if (initializedForUserId !== user.id) return

    const hasFarms = (farms?.length || 0) > 0
    const p = location.pathname
    const isAllowed = p === '/onboarding' || p.startsWith('/farms/join/') || p.startsWith('/share/e/')
    if (!hasFarms && !isAllowed) {
      navigate('/onboarding', { replace: true })
    }
  }, [user?.id, initializingFarms, initializedForUserId, farms?.length, location.pathname, navigate])

  if (loading) {
    console.log('⏳ Showing loading spinner...')
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user && !isPublicShare) {
    try {
      const target = `${location.pathname}${location.search || ''}${location.hash || ''}`
      // Only set if not already present (preserve explicit redirects)
      if (!sessionStorage.getItem('postLoginRedirect')) {
        sessionStorage.setItem('postLoginRedirect', target)
      }
    } catch {}
    console.log('🔒 No user, showing LoginPage')
    return (
      <ActiveFarmProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        </Layout>
      </ActiveFarmProvider>
    )
  }

  // When on public share, render only the public routes without the authenticated layout
  if (isPublicShare) {
    return (
      <ActiveFarmProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/share/e/:id" element={<PublicEvent />} />
              {/* Fallback to login for any other path while unauthenticated */}
              <Route path="*" element={<LoginPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </ActiveFarmProvider>
    )
  }

  return (
    <ActiveFarmProvider>
      <Layout>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/farm" element={<FarmDashboardPage />} />
            <Route path="/farm/channels" element={<FarmChannelPage />} />
            <Route path="/farm/channels/:channelId" element={<FarmChannelPage />} />
            <Route path="/farm/events/:id" element={<FarmEventPage />} />
            <Route path="/farm/settlement" element={<FarmSettlementPage />} />
            <Route path="/farm/media" element={<FarmMediaPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id/summary" element={<EventSummary />} />
            <Route path="/events/:id/chat" element={<EventChatPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/polls" element={<PollsPage />} />
            <Route path="/lists" element={<ListsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/farms" element={<FarmPage />} />
            <Route path="/farms/join/:token" element={<JoinFarmPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
            <Route path="/legal/:docType" element={<LegalPage />} />
            {/* Backward compatible alias */}
            <Route path="/notifications/settings" element={<NotificationPreferencesPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            {/* Also accept share route here to support direct navigation when authenticated */}
            <Route path="/share/e/:id" element={<PublicEvent />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </ActiveFarmProvider>
  )
}

export default App
