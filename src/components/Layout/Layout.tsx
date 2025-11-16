import { ReactNode } from 'react'
import Navbar from './Navbar'
import BottomNavigation from './BottomNavigation'
import FirebaseTroubleshooting from '../FirebaseTroubleshooting'
import MobileTopActions from './MobileTopActions'
import AnnouncementModal from '../AnnouncementModal'
import ChatFloatingLauncher from '../Chat/ChatFloatingLauncher'

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
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      {/* Desktop Navbar */}
      <div className="hidden md:block">
        <Navbar />
      </div>
      {/* Mobile top-right actions (notifications + settings) */}
      <MobileTopActions />
      
      {/* Main Content */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:pb-0 md:pt-24">
        <div className="min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-8rem)]">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <BottomNavigation />
      </div>
      
      {/* Global floating chat launcher (hidden on chat views) */}
      <ChatFloatingLauncher />

      {/* Tiny build/version indicator (bottom-left) for cache bust debugging */}
      <div className="fixed left-2 bottom-2 z-40 text-[10px] font-mono text-neutral-400 select-none pointer-events-none opacity-70">
        v{BUILD_STAMP}
      </div>

      {/* Debug Component (only in development) */}
      <FirebaseTroubleshooting />

      {/* One-time announcement popup for important updates */}
      <AnnouncementModal />
    </div>
  )
}

export default Layout
