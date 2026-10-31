import { ReactNode, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNavigation from './BottomNavigation'
import FirebaseTroubleshooting from '../FirebaseTroubleshooting'
import MobileTopActions from './MobileTopActions'
import ThemeSetupModal from '../ThemeSetupModal'
import NotificationPermissionBanner from '../NotificationPermissionBanner'
import ChatFloatingLauncher from '../Chat/ChatFloatingLauncher'
import { useActiveFarmStore } from '../../stores/useActiveFarmStore'
import { useAuthStore, refreshActiveFarmData } from '../../stores/useAuthStore'
import { useAppStore } from '../../stores/AppStore'
import { isE2EMode } from '../../e2e/runtime'

// Build/version stamp injected at build time (fallback to import.meta.env when available)
const BUILD_STAMP = (() => {
  try {
    const now = new Date()
    // Format: YYYYMMDD-HHMM
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  } catch {
    return 'unknown'
  }
})()

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation()
  const isEventChatPage = /^\/events\/[^/]+\/chat$/.test(location.pathname)
  const { user } = useAuthStore()
  const showChrome = !!user?.id
  const activeFarmId = useActiveFarmStore(s => s.activeFarmId)
  const initializedForUserId = useActiveFarmStore(s => s.initializedForUserId)
  const { setEvents, setExpenses, setPolls, setLists } = useAppStore()

  // When the active farm changes, refresh farm-scoped data.
  useEffect(() => {
    if (!user?.id) return
    if (initializedForUserId !== user.id) return
    try {
      // Prevent cross-farm data flash
      setEvents([])
      setExpenses([])
      setPolls([])
      setLists([])
    } catch {}
    void refreshActiveFarmData()
  }, [user?.id, initializedForUserId, activeFarmId])

  return (
    <div
      className="min-h-screen bg-[--bg-page] transition-colors duration-200"
    >
      {/* Desktop Navbar */}
      {showChrome ? (
        <>
          <div className="hidden md:block">
            <Navbar />
          </div>
          {/* Mobile top-right actions (notifications + settings) */}
          {!isEventChatPage && <MobileTopActions />}
        </>
      ) : null}
      
      {/* Main Content */}
      <main className={
        isEventChatPage
          ? 'w-full'
          : 'w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:pb-0 md:pt-24'
      }>
        {isEventChatPage
          ? children
          : (
            <div className="min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-8rem)]">
              {children}
            </div>
          )}
      </main>
      
      {/* Mobile Bottom Navigation */}
      {showChrome && !isEventChatPage && (
        <div className="md:hidden">
          <BottomNavigation />
        </div>
      )}
      
      {/* Global floating chat launcher (hidden on chat views) */}
      {showChrome && !isEventChatPage && (
        <div className="hidden md:block">
          <ChatFloatingLauncher />
        </div>
      )}

      {/* Tiny build/version indicator (bottom-left) for cache bust debugging */}
      {import.meta.env.DEV ? (
        <div className="fixed left-2 bottom-2 z-40 text-[10px] font-mono text-[--text-muted] select-none pointer-events-none opacity-70">
          v{BUILD_STAMP}
        </div>
      ) : null}

      {/* Debug Component (only in development, never mounted in production) */}
      {import.meta.env.DEV && !isE2EMode() ? <FirebaseTroubleshooting /> : null}

      {/* First-run theme picker */}
      {showChrome ? <ThemeSetupModal /> : null}

      {/* Notification permission prompt (one-time, after login) */}
      {showChrome ? <NotificationPermissionBanner /> : null}
    </div>
  )
}

export default Layout

