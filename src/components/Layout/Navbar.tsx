import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import NotificationSystem from '../NotificationSystem'
import { PigAvatar } from '../Avatar/PigAvatar'
import { useUserSettingsStore } from '../../stores/UserSettingsStore'

const Navbar = () => {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { profile } = useUserSettingsStore()

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
              </div>
              {/* Piccola mascotte */}
              <span className="text-lg group-hover:animate-bounce transition-transform">
                <PigAvatar keyName={(profile?.avatarKey as any) || 'pig-0'} />
              </span>
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
            {/* 🔔 Sistema Notifiche */}
            <NotificationSystem userId={user?.id || ''} />
            {/* ⚙️ Settings */}
            <Link
              to="/settings"
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Impostazioni"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a1 1 0 012 0v1.09a7.007 7.007 0 012.326.96l.77-.771a1 1 0 111.414 1.415l-.77.77c.39.707.676 1.478.84 2.29H20a1 1 0 110 2h-1.09a7.007 7.007 0 01-.96 2.326l.771.77a1 1 0 11-1.415 1.414l-.77-.77a7.007 7.007 0 01-2.29.84V20a1 1 0 11-2 0v-1.09a7.007 7.007 0 01-2.326-.96l-.77.771a1 1 0 11-1.414-1.415l.77-.77a7.007 7.007 0 01-.84-2.29H4a1 1 0 110-2h1.09a7.007 7.007 0 01.96-2.326l-.771-.77a1 1 0 111.415-1.414l.77.77A7.007 7.007 0 019.29 5.09V4zM12 9a3 3 0 100 6 3 3 0 000-6z" />
              </svg>
            </Link>
            
            <div className="hidden sm:flex items-center space-x-3 bg-neutral-50 rounded-2xl p-2 pr-4">
              {user?.photoURL && (
                <img
                  className="h-10 w-10 rounded-xl border-2 border-white shadow-sm"
                  src={user.photoURL}
                  alt={user.displayName}
                />
              )}
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900 truncate max-w-32" title={(user?.displayName && user.displayName !== 'Utente') ? user.displayName : (user?.email ? user.email : undefined)}>
                  {(user?.displayName && user.displayName !== 'Utente')
                    ? user.displayName
                    : (user?.email ? user.email.split('@')[0] : 'Utente')}
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
