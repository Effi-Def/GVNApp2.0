import { Link, useLocation } from 'react-router-dom'

const BottomNavigation = () => {
  const location = useLocation()

  const navigation = [
    { name: 'Home', href: '/', icon: '🏠', emoji: '🏠' },
    { name: 'Eventi', href: '/events', icon: '📅', emoji: '🎉' },
    { name: 'Spese', href: '/expenses', icon: '💰', emoji: '💸' },
    { name: 'Sondaggi', href: '/polls', icon: '📊', emoji: '🗳️' },
    { name: 'Liste', href: '/lists', icon: '📋', emoji: '✅' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-neutral-200 z-50 shadow-2xl">
      <div className="safe-area-inset-bottom">
        <div className="grid grid-cols-5 h-20 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center justify-center space-y-1 mx-1 rounded-2xl transition-all duration-200 ${
                location.pathname === item.href
                  ? 'text-primary-600 bg-gradient-to-t from-primary-50 to-primary-25 shadow-lg transform -translate-y-1'
                  : 'text-neutral-500 hover:text-primary-600 hover:bg-neutral-50'
              }`}
            >
              {/* Indicatore attivo */}
              {location.pathname === item.href && (
                <div className="absolute -top-1 w-1 h-1 bg-primary-500 rounded-full"></div>
              )}
              
              <span className={`text-xl transition-transform ${
                location.pathname === item.href ? 'scale-110' : 'scale-100'
              }`}>
                {item.emoji}
              </span>
              
              <span className={`text-xs font-medium transition-all ${
                location.pathname === item.href 
                  ? 'font-semibold text-primary-600' 
                  : 'text-neutral-500'
              }`}>
                {item.name}
              </span>
              
              {/* Piccola mascotte per la home */}
              {item.href === '/' && location.pathname === item.href && (
                <span className="absolute -top-2 -right-1 text-xs animate-bounce">🐷</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default BottomNavigation
