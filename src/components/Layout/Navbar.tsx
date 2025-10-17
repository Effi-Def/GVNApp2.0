import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

const Navbar = () => {
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const navigation = [
    { name: 'Home', href: '/', icon: '🏠', emoji: '🏠' },
    { name: 'Eventi', href: '/events', icon: '📅', emoji: '🎉' },
    { name: 'Spese', href: '/expenses', icon: '💰', emoji: '💸' },
    { name: 'Sondaggi', href: '/polls', icon: '📊', emoji: '🗳️' },
    { name: 'Liste', href: '/lists', icon: '📋', emoji: '✅' },
  ]

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Errore durante il logout:', error)
    }
  }

  return (
    <nav className="bg-white shadow-lg border-b border-neutral-200 fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo con mascotte */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3 group transition-transform hover:scale-105">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
                <span className="text-white font-bold text-lg font-display">G</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-display text-neutral-900 tracking-tight">GVNApp</span>
                <span className="text-xs text-neutral-500 font-medium -mt-1">Gruppo Vacanze Natali</span>
              </div>
              {/* Piccola mascotte */}
              <span className="text-lg group-hover:animate-bounce transition-transform">🐷</span>
            </Link>
          </div>

          {/* Navigation Links - Centrata */}
          <div className="hidden lg:flex items-center space-x-1 bg-neutral-50 rounded-2xl p-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`inline-flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.href
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25 transform scale-105'
                    : 'text-neutral-600 hover:text-primary-600 hover:bg-white/80 hover:shadow-sm'
                }`}
              >
                <span className="mr-2 text-base">{item.emoji}</span>
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* User Menu - Redesigned */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-neutral-50 rounded-2xl p-2 pr-4">
              {user?.photoURL && (
                <img
                  className="h-10 w-10 rounded-xl border-2 border-white shadow-sm"
                  src={user.photoURL}
                  alt={user.displayName}
                />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900 truncate max-w-32">
                  {user?.displayName?.split(' ')[0] || 'Utente'}
                </span>
                <span className="text-xs text-neutral-500">Online</span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
