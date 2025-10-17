import { Link, useLocation } from 'react-router-dom'

const SimpleNavbar = () => {
  const location = useLocation()

  const navigation = [
    { name: 'Home', href: '/', icon: '🏠' },
    { name: 'Eventi', href: '/events', icon: '📅' },
    { name: 'Spese', href: '/expenses', icon: '💰' },
    { name: 'Sondaggi', href: '/polls', icon: '📊' },
    { name: 'Liste', href: '/lists', icon: '📋' },
  ]

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
                <span className="text-xs text-neutral-500 font-medium -mt-1">Test Layout</span>
              </div>
              <span className="text-lg group-hover:animate-bounce transition-transform">🐷</span>
            </Link>
          </div>

          {/* Navigation Links - Centrata */}
          <div className="hidden lg:flex items-center space-x-1 bg-neutral-50 rounded-2xl p-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.href
                    ? 'text-primary-700 bg-white shadow-md border border-primary-100'
                    : 'text-neutral-600 hover:text-primary-600 hover:bg-white/50'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            ))}
          </div>

          {/* User Profile - Desktop */}
          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-4 py-2 bg-neutral-50 rounded-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">T</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-900 truncate max-w-32">
                  Test User
                </span>
                <span className="text-xs text-neutral-500">Demo Mode</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default SimpleNavbar
