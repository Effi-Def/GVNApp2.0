import { ReactNode } from 'react'
import Navbar from './Navbar'
import BottomNavigation from './BottomNavigation'
import FirebaseTroubleshooting from '../FirebaseTroubleshooting'

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
      
      {/* Debug Component (only in development) */}
      <FirebaseTroubleshooting />
    </div>
  )
}

export default Layout
