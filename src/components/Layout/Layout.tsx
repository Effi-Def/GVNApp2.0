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
      <main className="pb-16 md:pb-0 md:pt-20">
        {children}
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
