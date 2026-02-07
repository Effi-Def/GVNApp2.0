import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNotificationsStore } from '../../stores/useNotificationsStore'
import { markChatNotificationsAsRead } from '../../services/notifications'

const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const unreadChat = useNotificationsStore(s => s.notifications.filter(n => !n.read && n.type === 'chat').length)
  const [moreOpen, setMoreOpen] = useState(false)

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
              className={`flex h-full w-full flex-col items-center justify-center space-y-1 mx-1 rounded-2xl transition-all duration-200 ${
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
            </Link>
          ))}

          {/* More menu for Settings/Notifications/Logout */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex h-full w-full flex-col items-center justify-center space-y-1 mx-1 rounded-2xl transition-all duration-200 ${
              moreOpen ? 'text-primary-600 bg-gradient-to-t from-primary-50 to-primary-25 shadow-lg transform -translate-y-1' : 'text-neutral-500 hover:text-primary-600 hover:bg-neutral-50'
            }`}
          >
            <span className="text-xl">⋯</span>
            <span className="text-xs">Altro</span>
          </button>
          {moreOpen && (
            <div className="absolute bottom-24 right-4 left-4 bg-white border border-neutral-200 rounded-2xl shadow-xl p-2">
              <button
                onClick={async () => {
                  setMoreOpen(false)
                  try { useNotificationsStore.getState().markTypeAsRead('chat') } catch {}
                  try { if (useAuthStore.getState().user?.id) await markChatNotificationsAsRead(useAuthStore.getState().user!.id) } catch {}
                  navigate('/chats')
                }}
                className="w-full text-left px-3 py-3 rounded-xl hover:bg-neutral-50 flex items-center justify-between"
              >
                <span>💬 Chat</span>
                {unreadChat > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold shadow">
                    {unreadChat > 9 ? '9+' : unreadChat}
                  </span>
                )}
              </button>
              <button onClick={() => { setMoreOpen(false); navigate('/notifications') }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-neutral-50">🔔 Notifiche</button>
              <button onClick={() => { setMoreOpen(false); navigate('/settings') }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-neutral-50">⚙️ Impostazioni</button>
              <button onClick={async () => { setMoreOpen(false); await logout() }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-red-50 text-red-600">🚪 Esci</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default BottomNavigation
