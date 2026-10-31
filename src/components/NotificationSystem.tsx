import { useState, useEffect } from 'react'
import { useNotificationsStore } from '../stores/useNotificationsStore'
import { useUserSettingsStore } from '../stores/UserSettingsStore'
import { notificationService } from '../services/notifications'
import { useNavigate } from 'react-router-dom'


interface NotificationSystemProps { userId: string }

const NotificationSystem = ({ userId }: NotificationSystemProps) => {
  const navigate = useNavigate()
  const notifications = useNotificationsStore(state => state.notifications)
  // Stesso filtro usato da Navbar e MobileTopActions: esclude chat senza @mention
  const unreadCount = useNotificationsStore(state =>
    state.notifications.filter(n => !n.read && (n.type !== 'chat' || !!n.chatMention)).length
  )
  const markAsReadStore = useNotificationsStore(state => state.markAsRead)
  const markAllAsReadStore = useNotificationsStore(state => state.markAllAsRead)
  const { notifications: notifSettings } = useUserSettingsStore()
  const [isOpen, setIsOpen] = useState(false)

  const unreadNotifications = notifications.filter(n => !n.read)

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
    if (userId) notificationService.markAsRead(userId, id)
  }

  const markAllAsRead = () => {
    markAllAsReadStore()
    if (userId) notificationService.markAllAsRead(userId)
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
        className="relative p-2 text-[--text-muted] hover:text-[--text-base] hover:bg-[--bg-raised] rounded-lg transition-colors"
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
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setIsOpen(false)
            }}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[--bg-card] rounded-lg shadow-lg border border-[--border-base] z-20 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-[--border-base] flex items-center justify-between">
              <h3 className="font-medium text-[--text-base]">Notifiche</h3>
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
              {unreadNotifications.length === 0 ? (
                <div className="p-4 text-center text-[--text-muted]">
                  <div className="text-4xl mb-2">🔕</div>
                  <p className="text-sm">Nessuna notifica</p>
                </div>
              ) : (
                unreadNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-gray-100 hover:bg-[--bg-subtle] cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      markAsRead(notification.id)
                      if (notification.actionUrl) {
                        setIsOpen(false)
                        navigate(notification.actionUrl)
                      }
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">{getIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${!notification.read ? 'text-[--text-base]' : 'text-[--text-muted]'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full ml-2" />
                          )}
                        </div>
                        <p className="text-sm text-[--text-muted] mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-[--text-muted] mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[--border-base] text-center">
              <div className="flex items-center justify-center gap-4">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/notifications')
                  }}
                >
                  Vedi tutte
                </button>
                <button
                  className="text-sm text-[--text-muted] hover:text-[--text-base]"
                  onClick={() => {
                    setIsOpen(false)
                    navigate('/settings/notifications')
                  }}
                >
                  Preferenze
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationSystem
