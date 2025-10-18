import { useState, useEffect } from 'react'
import { useNotificationsStore } from '../stores/useNotificationsStore'
import { useUserSettingsStore } from '../stores/UserSettingsStore'


interface NotificationSystemProps { userId: string }

const NotificationSystem = ({ userId: _userId }: NotificationSystemProps) => {
  const notifications = useNotificationsStore(state => state.notifications)
  const unreadCount = useNotificationsStore(state => state.unreadCount())
  const markAsReadStore = useNotificationsStore(state => state.markAsRead)
  const markAllAsReadStore = useNotificationsStore(state => state.markAllAsRead)
  const { notifications: notifSettings } = useUserSettingsStore()
  const [isOpen, setIsOpen] = useState(false)

  // Request desktop notification permission if enabled
  useEffect(() => {
    if (notifSettings.desktopEnabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [notifSettings.desktopEnabled])

  const markAsRead = (id: string) => {
    markAsReadStore(id)
  }

  const markAllAsRead = () => {
    markAllAsReadStore()
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'expense': return '💰'
      case 'payment': return '💸'
      case 'comment': return '💬'
      case 'reminder': return '⏰'
      default: return '🔔'
    }
  }

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'ora'
    if (diffMins < 60) return `${diffMins}m fa`
    if (diffHours < 24) return `${diffHours}h fa`
    if (diffDays < 7) return `${diffDays}g fa`
    return date.toLocaleDateString('it-IT')
  }

  return (
    <div className="relative">
      {/* Pulsante notifiche */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5a6 6 0 0012 0z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown notifiche */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-medium text-gray-800">Notifiche</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Segna tutte come lette
                </button>
              )}
            </div>

            {/* Lista notifiche */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="text-4xl mb-2">🔕</div>
                  <p className="text-sm">Nessuna notifica</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">{getIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-800">
                Vedi tutte le notifiche
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationSystem